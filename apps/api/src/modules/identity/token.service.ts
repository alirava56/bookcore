import {requireValue} from '../../common/require-value';
import {Inject,Injectable} from '@nestjs/common';
import jwt,{type JwtPayload} from 'jsonwebtoken';
import {APP_CONFIG,type AppConfig} from '../../config/app-config';
import {ProblemException} from '../../common/errors/problem';
import {randomUUID} from 'node:crypto';

export interface AccessClaims {sub:string;sid:string;jti:string;type:'access'}
@Injectable()
export class AccessTokenService {
 constructor(@Inject(APP_CONFIG)private readonly config:AppConfig){}
 issue(userId:string,sessionId:string):string {
  return jwt.sign({sid:sessionId,type:'access'},requireValue(this.config.jwtKeys[this.config.jwtActiveKid]),{
   algorithm:'HS256',keyid:this.config.jwtActiveKid,issuer:this.config.jwtIssuer,audience:this.config.jwtAudience,
   subject:userId,jwtid:randomUUID(),expiresIn:this.config.accessTokenTtlSeconds,header:{alg:'HS256',typ:'JWT'}
  });
 }
 verify(token:string):AccessClaims {
  try {
   const untrusted=jwt.decode(token,{complete:true});
   if(!untrusted||typeof untrusted==='string'||untrusted.header.alg!=='HS256'||
      untrusted.header.typ!=='JWT'||typeof untrusted.header.kid!=='string' ||
      !Object.hasOwn(this.config.jwtKeys,untrusted.header.kid))throw new Error('invalid');
   const verified=jwt.verify(token,requireValue(this.config.jwtKeys[untrusted.header.kid]),{
      algorithms:['HS256'],issuer:this.config.jwtIssuer,audience:this.config.jwtAudience,clockTolerance:0
   }) as JwtPayload;
   if(verified.type!=='access'||typeof verified.sub!=='string'||typeof verified.sid!=='string'||
      typeof verified.jti!=='string'||!validUuid(verified.sub)||!validUuid(verified.sid))throw new Error('invalid');
   return {sub:verified.sub,sid:verified.sid,jti:verified.jti,type:'access'};
  } catch {throw new ProblemException(401,'INVALID_ACCESS_TOKEN');}
 }
}
const validUuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
