export function withTestAuth(env:NodeJS.ProcessEnv):NodeJS.ProcessEnv {
 return {...env,AUTH_JWT_ISSUER:env.AUTH_JWT_ISSUER??'https://bookcore.test',
 AUTH_JWT_AUDIENCE:env.AUTH_JWT_AUDIENCE??'bookcore-test',
 AUTH_JWT_ACTIVE_KID:env.AUTH_JWT_ACTIVE_KID??'test-v1',
 AUTH_JWT_KEYS_JSON:env.AUTH_JWT_KEYS_JSON??JSON.stringify({'test-v1':'ONLY_TEST_JWT_KEY_NOT_FOR_PRODUCTION_0123456789abcdef'})};
}
