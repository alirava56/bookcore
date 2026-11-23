import {requireValue} from '../../common/require-value';
import {Inject,Injectable} from '@nestjs/common';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import * as argon2 from 'argon2';
import {UnitOfWork} from '../../infrastructure/transactions/unit-of-work';
import {DatabaseService} from '../../infrastructure/database/database.service';
import {APP_CONFIG,type AppConfig} from '../../config/app-config';
import {AccessTokenService} from './token.service';
import {ProblemException} from '../../common/errors/problem';
import {pgCode,UnknownCommitOutcome} from '../../infrastructure/transactions/sqlstate';
import type {AuthenticatedPrincipal} from '../../common/security/authorization';
import type {LoginDto,RegisterDto,TokenResponse,PublicUser} from './identity.dto';

const hashToken=(value:string)=>createHash('sha256').update(value,'utf8').digest('hex');
const normalizeEmail=(email:string)=>email.trim().toLowerCase();
function ensureStrongPassword(value:string):void {
 if(value.length<12||value.length>128||!/[A-Z]/.test(value)||!/[a-z]/.test(value)||
    !/[0-9]/.test(value)||!/[^a-zA-Z0-9]/.test(value))throw new ProblemException(422,'WEAK_PASSWORD');
}
function safeUser(row:{id:string;email:string;status:'ACTIVE'|'SUSPENDED'}):PublicUser {
 return {id:row.id,email:row.email,status:row.status};
}
function rawRefresh():string{return randomBytes(32).toString('base64url');}
@Injectable()
export class IdentityService {
 constructor(private readonly db:DatabaseService,private readonly uow:UnitOfWork,
  private readonly tokens:AccessTokenService,@Inject(APP_CONFIG)private readonly cfg:AppConfig){}
 async register(dto:RegisterDto):Promise<PublicUser> {
  const email=normalizeEmail(dto.email);ensureStrongPassword(dto.password);
  const hashed=await argon2.hash(dto.password,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});
  try {return await this.uow.run(async client=>{
    const u=await client.query<{id:string;email:string;status:'ACTIVE'}>(
      `INSERT INTO users(email) VALUES($1) RETURNING id,email,status`,[email]);
    await client.query(`INSERT INTO password_credentials(user_id,password_hash) VALUES ($1,$2)`,[requireValue(u.rows[0]).id,hashed]);
    return safeUser(requireValue(u.rows[0]));
   },1);
  } catch(err){if(pgCode(err)==='23505')throw new ProblemException(409,'USER_ALREADY_EXISTS');throw err;}
 }
 async login(dto:LoginDto):Promise<TokenResponse> {
  const email=normalizeEmail(dto.email);
  const client=await this.db.connect();
  let u:{id:string;status:string;password_hash:string}|undefined;
  try {const rows=await client.query<{id:string;status:string;password_hash:string}>(
   `SELECT u.id,u.status,c.password_hash FROM users u JOIN password_credentials c ON c.user_id=u.id
    WHERE lower(btrim(u.email))=$1`,[email]);u=rows.rows[0];}
  finally{client.release();}
  // Unknown accounts still do an Argon2id work factor to reduce timing-based enumeration.
  const verified=u ? await argon2.verify(u.password_hash,dto.password).catch(()=>false) :
    (await argon2.hash(dto.password,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1}).then(()=>false));
  if(!u||u.status!=='ACTIVE'||!verified)throw new ProblemException(401,'INVALID_CREDENTIALS');
  const sid=randomUUID(),family=randomUUID(),raw=rawRefresh(),digest=hashToken(raw);
  const expiry=new Date(Date.now()+this.cfg.refreshTokenTtlDays*86400000);
  await this.uow.run(async c=>{
   const state=await c.query<{active:boolean}>('SELECT public.bookcore_share_active_user($1) AS active',[requireValue(u).id]);
   if(!state.rows[0]?.active)throw new ProblemException(401,'INVALID_CREDENTIALS');
   await c.query(`INSERT INTO auth_sessions(id,user_id,expires_at) VALUES ($1,$2,$3)`,[sid,requireValue(u).id,expiry]);
   await c.query(`INSERT INTO refresh_tokens(session_id,family_id,token_hash,expires_at)
        VALUES($1,$2,$3,$4)`,[sid,family,digest,expiry]);
  },1);
  return {accessToken:this.tokens.issue(u.id,sid),refreshToken:raw,tokenType:'Bearer',expiresInSeconds:this.cfg.accessTokenTtlSeconds};
 }
 async refresh(raw:string):Promise<TokenResponse> {
  // No access JWT required: token is a 256-bit bearer verifier, never stored in plaintext.
  if(!/^[A-Za-z0-9_-]{43}$/.test(raw))throw new ProblemException(401,'INVALID_REFRESH_TOKEN');
  const digest=hashToken(raw),replacement=rawRefresh(),replacementHash=hashToken(replacement);
  type Result={kind:'OK';sid:string;uid:string}|{kind:'REPLAY'|'DENIED'};
  let result:Result;
  try{result=await this.uow.run<Result>(async c=>{
   // Non-locking lookup only to discover session id; exclusive session lock is always first.
   const found=await c.query<{session_id:string}>(`SELECT session_id FROM refresh_tokens WHERE token_hash=$1`,[digest]);
   if(!found.rows[0])return {kind:'DENIED'};
   const sid=found.rows[0].session_id;
   const session=await c.query<{user_id:string;expires_at:Date;revoked_at:Date|null}>(
    `SELECT user_id,expires_at,revoked_at FROM auth_sessions WHERE id=$1 FOR UPDATE`,[sid]);
   if(!session.rows[0])return {kind:'DENIED'};
   const original=await c.query<{id:string;family_id:string;consumed_at:Date|null;expires_at:Date;invalidated_at:Date|null}>(
    `SELECT id,family_id,consumed_at,expires_at,invalidated_at FROM refresh_tokens WHERE token_hash=$1 FOR UPDATE`,[digest]);
   const r=original.rows[0],s=session.rows[0];
   if(!r)return {kind:'DENIED'};
   if(r.consumed_at) {
    await c.query(`UPDATE auth_sessions SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE id=$1`,[sid]);
    await c.query(`UPDATE refresh_tokens SET invalidated_at=coalesce(invalidated_at,clock_timestamp()) WHERE session_id=$1`,[sid]);
    return {kind:'REPLAY'}; // Return, do not throw within the TX: replay revocation must COMMIT.
   }
   if(s.revoked_at||new Date(s.expires_at).getTime()<=Date.now()||
      r.invalidated_at||new Date(r.expires_at).getTime()<=Date.now())return {kind:'DENIED'};
   const state=await c.query<{active:boolean}>('SELECT public.bookcore_share_active_user($1) AS active',[s.user_id]);
   if(!state.rows[0]?.active)return {kind:'DENIED'};
   await c.query(`UPDATE refresh_tokens SET consumed_at=clock_timestamp() WHERE id=$1`,[r.id]);
   await c.query(`INSERT INTO refresh_tokens(session_id,family_id,token_hash,expires_at,parent_id)
        VALUES($1,$2,$3,$4,$5)`,[sid,r.family_id,replacementHash,s.expires_at,r.id]);
   return {kind:'OK',sid,uid:s.user_id};
  },1);}catch(err){
   // Without sender-constrained proof, a lost refresh ACK cannot be distinguished from theft.
   // Never advise blind replay of a consumed token. Re-authenticate with credentials.
   if(err instanceof UnknownCommitOutcome)throw new ProblemException(503,'REFRESH_OUTCOME_UNKNOWN_REAUTH_REQUIRED');
   throw err;
  }
  if(result.kind!=='OK')throw new ProblemException(401,result.kind==='REPLAY'?'REFRESH_REPLAY_REVOKED':'INVALID_REFRESH_TOKEN');
  return {accessToken:this.tokens.issue(result.uid,result.sid),refreshToken:replacement,
   tokenType:'Bearer',expiresInSeconds:this.cfg.accessTokenTtlSeconds};
 }
 async logout(p:AuthenticatedPrincipal):Promise<void> {
  await this.uow.run(async c=>{
   await c.query(`UPDATE auth_sessions SET revoked_at=coalesce(revoked_at,clock_timestamp())
       WHERE id=$1 AND user_id=$2`,[p.sessionId,p.userId]);
   await c.query(`UPDATE refresh_tokens SET invalidated_at=coalesce(invalidated_at,clock_timestamp())
       WHERE session_id=$1`,[p.sessionId]);
  },1);
 }
 async me(p:AuthenticatedPrincipal):Promise<{user:PublicUser;memberships:Array<{tenantId:string;userId:string;role:string;status:'ACTIVE'}>}> {
  const c=await this.db.connect();
  try {
   const result=await c.query<{id:string;email:string;status:'ACTIVE'|'SUSPENDED'}>(
    `SELECT id,email,status FROM users WHERE id=$1 AND status='ACTIVE'`,[p.userId]);
   if(!result.rows[0])throw new ProblemException(401,'AUTH_SESSION_REVOKED');
   const members=await c.query<{tenant_id:string;user_id:string;role:string}>(
    `SELECT tenant_id,user_id,role FROM memberships WHERE user_id=$1 AND status='ACTIVE' ORDER BY tenant_id`,[p.userId]);
   return {user:safeUser(result.rows[0]),memberships:members.rows.map(m=>({tenantId:m.tenant_id,userId:m.user_id,role:m.role,status:'ACTIVE'}))};
  } finally{c.release();}
 }
}
