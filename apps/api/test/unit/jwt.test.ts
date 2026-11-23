import {requireValue} from '../../src/common/require-value';
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {AccessTokenService} from '../../src/modules/identity/token.service';
import {parseConfig} from '../../src/config/app-config';
import {withTestAuth} from '../test-auth';
const cfg=parseConfig(withTestAuth({NODE_ENV:'test',DATABASE_URL:'postgres://u:pass@localhost/test',
 MONITOR_API_KEY:'01234567890123456789012345678901'}));
const service=new AccessTokenService(cfg);
const uid='bd8dc489-1d3b-49aa-83b8-60f72246473e',sid='edeab095-6d90-4dc2-9c82-4e7191c74a32';
test('access token includes UUID subject, sid, type and verifies with pinned HS256 key',()=>{
 const value=service.issue(uid,sid);const claims=service.verify(value);
 assert.equal(claims.sub,uid);assert.equal(claims.sid,sid);assert.equal(claims.type,'access');
});
test('incorrect issuer, audience and signature are rejected',()=>{
 const secret=requireValue(cfg.jwtKeys[cfg.jwtActiveKid]);
 for(const options of [{issuer:'https://wrong.invalid',audience:cfg.jwtAudience},
                     {issuer:cfg.jwtIssuer,audience:'wrong'}]) {
  const value=jwt.sign({sid,type:'access'},secret,{algorithm:'HS256',keyid:cfg.jwtActiveKid,subject:uid,
  jwtid:'1',expiresIn:120,...options,header:{alg:'HS256',typ:'JWT'}});
  assert.throws(()=>service.verify(value),/INVALID_ACCESS_TOKEN/);
 }
 const forged=jwt.sign({sid,type:'access'},'invalid-signer-not-the-real-key-0123456789',{algorithm:'HS256',
   keyid:cfg.jwtActiveKid,subject:uid,jwtid:'1',expiresIn:120,issuer:cfg.jwtIssuer,
   audience:cfg.jwtAudience,header:{alg:'HS256',typ:'JWT'}});
 assert.throws(()=>service.verify(forged),/INVALID_ACCESS_TOKEN/);
});
test('expired, missing type and attacker-selected algorithm are rejected',()=>{
 const key=requireValue(cfg.jwtKeys[cfg.jwtActiveKid]);
 const expired=jwt.sign({sid,type:'access'},key,{algorithm:'HS256',keyid:cfg.jwtActiveKid,subject:uid,
  jwtid:'1',expiresIn:-10,issuer:cfg.jwtIssuer,audience:cfg.jwtAudience,header:{alg:'HS256',typ:'JWT'}});
 assert.throws(()=>service.verify(expired),/INVALID_ACCESS_TOKEN/);
 const wrong=jwt.sign({sid,type:'refresh'},key,{algorithm:'HS256',keyid:cfg.jwtActiveKid,subject:uid,
  jwtid:'1',expiresIn:120,issuer:cfg.jwtIssuer,audience:cfg.jwtAudience,header:{alg:'HS256',typ:'JWT'}});
 assert.throws(()=>service.verify(wrong),/INVALID_ACCESS_TOKEN/);
 const none=Buffer.from(JSON.stringify({alg:'none',typ:'JWT',kid:cfg.jwtActiveKid})).toString('base64url')+'.'+
  Buffer.from(JSON.stringify({sub:uid,sid,type:'access'})).toString('base64url')+'.';
 assert.throws(()=>service.verify(none),/INVALID_ACCESS_TOKEN/);
});
test('production validates signing key configuration',()=>{
 const env=withTestAuth({NODE_ENV:'production',DATABASE_URL:'postgres://u:strong-password@localhost/test',
 MONITOR_API_KEY:'01234567890123456789012345678901'});
 assert.throws(()=>parseConfig({...env,AUTH_JWT_KEYS_JSON:JSON.stringify({'k1':'weak'}),AUTH_JWT_ACTIVE_KID:'k1'}),
  /CONFIG_INVALID_AUTH_JWT_KEYS_JSON/);
 assert.throws(()=>parseConfig({...env,AUTH_JWT_ACTIVE_KID:'not-registered'}),/CONFIG_INVALID_AUTH_JWT_KEYS_JSON/);
});
