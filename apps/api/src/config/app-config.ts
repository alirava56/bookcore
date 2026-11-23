import { DynamicModule, Global, Module } from '@nestjs/common';
import { isIP } from 'node:net';

export const APP_CONFIG = Symbol('APP_CONFIG');
export type AppEnvironment = 'development' | 'test' | 'production';
export interface AppConfig {
  environment: AppEnvironment;
  host: string;
  port: number;
  databaseUrl: string;
  dbPoolMax: number;
  connectionTimeoutMs: number;
  txLockTimeoutMs: number;
  txStatementTimeoutMs: number;
  healthQueryTimeoutMs: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  trustedProxyHops: number;
  authRateLimitProxyIps?: readonly string[];
  corsOrigins: string[];
  jsonBodyLimit: string;
  monitorApiKey: string;
  monitorAllowedIps: string[];
  swaggerUi: boolean;
  maxInflightRequests?:number;
  jwtIssuer: string;
  jwtAudience: string;
  jwtActiveKid: string;
  jwtKeys: Readonly<Record<string,string>>;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
}

const integer = (name: string, raw: string | undefined, fallback: number, min: number, max: number) => {
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`CONFIG_INVALID_${name}`);
  return value;
};
const required = (name: string, raw: string | undefined): string => {
  if (!raw || !raw.trim()) throw new Error(`CONFIG_MISSING_${name}`);
  return raw;
};
function ips(raw: string): string[] {
  const values = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (!values.length || values.some((s) => !isIP(s))) {
    throw new Error('CONFIG_INVALID_MONITOR_ALLOWED_IPS');
  }
  return values;
}
export function parseConfig(env: NodeJS.ProcessEnv): AppConfig {
  const environment = env.NODE_ENV ?? 'development';
  if (!['development','test','production'].includes(environment)) throw new Error('CONFIG_INVALID_NODE_ENV');
  const host = env.HTTP_HOST ?? '127.0.0.1';
  if (!host.trim()) throw new Error('CONFIG_INVALID_HTTP_HOST');
  const databaseUrl = required('DATABASE_URL', env.DATABASE_URL);
  let parsed: URL;
  try { parsed = new URL(databaseUrl); } catch { throw new Error('CONFIG_INVALID_DATABASE_URL'); }
  if (!['postgresql:','postgres:'].includes(parsed.protocol) || !parsed.hostname || !parsed.pathname || parsed.pathname === '/') {
    throw new Error('CONFIG_INVALID_DATABASE_URL');
  }
  if (environment === 'production' && (!parsed.password || parsed.password.startsWith('CHANGE_ME'))) {
    throw new Error('CONFIG_INVALID_DATABASE_PASSWORD');
  }
  const monitorApiKey = required('MONITOR_API_KEY', env.MONITOR_API_KEY);
  if (monitorApiKey.length < 32) throw new Error('CONFIG_INVALID_MONITOR_API_KEY');
  if (environment === 'production' && /REPLACE_WITH|CHANGE_ME|DEV_ONLY/i.test(monitorApiKey)) {
    throw new Error('CONFIG_INVALID_MONITOR_API_KEY');
  }
  const corsOrigins = (env.CORS_ORIGINS ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  if (corsOrigins.includes('*') || corsOrigins.some((v) => !/^https?:\/\/[^/]+$/.test(v))) {
    throw new Error('CONFIG_INVALID_CORS_ORIGINS');
  }
  const swaggerUi = env.ENABLE_SWAGGER_UI === 'true';
  if (environment === 'production' && swaggerUi) throw new Error('CONFIG_FORBIDDEN_SWAGGER_PRODUCTION');
  const jsonBodyLimit = env.JSON_BODY_LIMIT ?? '64kb';
  if (!/^\d+(?:b|kb|mb)$/i.test(jsonBodyLimit)) throw new Error('CONFIG_INVALID_JSON_BODY_LIMIT');
  const logLevel = env.LOG_LEVEL ?? 'info';
  if (!['debug','info','warn','error'].includes(logLevel)) throw new Error('CONFIG_INVALID_LOG_LEVEL');
  const jwtIssuer=required('AUTH_JWT_ISSUER',env.AUTH_JWT_ISSUER);
  const jwtAudience=required('AUTH_JWT_AUDIENCE',env.AUTH_JWT_AUDIENCE);
  const jwtActiveKid=required('AUTH_JWT_ACTIVE_KID',env.AUTH_JWT_ACTIVE_KID);
  let jwtKeys:Record<string,string>;
  try {
    const value:unknown=JSON.parse(required('AUTH_JWT_KEYS_JSON',env.AUTH_JWT_KEYS_JSON));
    if(!value || Array.isArray(value) || typeof value!=='object')throw new Error('invalid');
    jwtKeys=value as Record<string,string>;
    if(Object.entries(jwtKeys).length<1 || Object.entries(jwtKeys).some(([key,secret])=>
      !/^[A-Za-z0-9_-]{1,32}$/.test(key) || typeof secret!=='string' || Buffer.byteLength(secret)<32 ||
      (environment==='production' && /DEV_ONLY|CHANGE_ME|REPLACE_WITH/i.test(secret))))throw new Error('invalid');
    if(!Object.hasOwn(jwtKeys,jwtActiveKid))throw new Error('invalid');
  } catch {throw new Error('CONFIG_INVALID_AUTH_JWT_KEYS_JSON');}
  if(!/^https?:\/\/[^\s]+$/.test(jwtIssuer)) throw new Error('CONFIG_INVALID_AUTH_JWT_ISSUER');
  if(jwtAudience.length<3)throw new Error('CONFIG_INVALID_AUTH_JWT_AUDIENCE');
  return {
    jwtIssuer,jwtAudience,jwtActiveKid,jwtKeys,
    accessTokenTtlSeconds:integer('ACCESS_TOKEN_TTL_SECONDS',env.ACCESS_TOKEN_TTL_SECONDS,900,60,3600),
    refreshTokenTtlDays:integer('REFRESH_TOKEN_TTL_DAYS',env.REFRESH_TOKEN_TTL_DAYS,30,1,90),
    environment: environment as AppEnvironment,
    host,
    port: integer('HTTP_PORT',env.HTTP_PORT,3000,1,65535),
    databaseUrl,
    dbPoolMax: integer('DB_POOL_MAX',env.DB_POOL_MAX,10,1,40),
    connectionTimeoutMs: integer('DB_CONNECTION_TIMEOUT_MS',env.DB_CONNECTION_TIMEOUT_MS,3000,200,30000),
    txLockTimeoutMs: integer('TX_LOCK_TIMEOUT_MS',env.TX_LOCK_TIMEOUT_MS,2000,100,120000),
    txStatementTimeoutMs: integer('TX_STATEMENT_TIMEOUT_MS',env.TX_STATEMENT_TIMEOUT_MS,5000,200,120000),
    healthQueryTimeoutMs: integer('HEALTH_QUERY_TIMEOUT_MS',env.HEALTH_QUERY_TIMEOUT_MS,1500,100,10000),
    logLevel: logLevel as AppConfig['logLevel'],
    trustedProxyHops: integer('TRUSTED_PROXY_HOPS',env.TRUSTED_PROXY_HOPS,0,0,4),
    corsOrigins,
    jsonBodyLimit,
    monitorApiKey,
    authRateLimitProxyIps: env.AUTH_RATE_LIMIT_PROXY_IPS ? ips(env.AUTH_RATE_LIMIT_PROXY_IPS) : [],
    monitorAllowedIps: ips(env.MONITOR_ALLOWED_IPS ?? '127.0.0.1,::1'),
    swaggerUi,
    maxInflightRequests:integer('MAX_INFLIGHT_REQUESTS',env.MAX_INFLIGHT_REQUESTS,64,1,10000),
  };
}

@Global()
@Module({})
export class AppConfigModule {
  static register(config:AppConfig):DynamicModule {
    return {module:AppConfigModule,providers:[{provide:APP_CONFIG,useValue:config}],exports:[APP_CONFIG],global:true};
  }
}
