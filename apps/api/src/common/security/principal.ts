import {createParamDecorator,ExecutionContext} from '@nestjs/common';
import {ProblemException} from '../errors/problem';
import type {PrincipalRequest,AuthenticatedPrincipal} from './authorization';
export const CurrentPrincipal=createParamDecorator((_data:unknown,ctx:ExecutionContext):AuthenticatedPrincipal=>{
 const value=ctx.switchToHttp().getRequest<PrincipalRequest>().principal;
 if(!value)throw new ProblemException(401,'AUTHENTICATION_REQUIRED');return value;
});
