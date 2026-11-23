import { HttpException, HttpStatus } from '@nestjs/common';
import {UnknownCommitOutcome} from '../../infrastructure/transactions/sqlstate';
export interface ProblemDocument {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  instance: string;
  requestId?: string;
}
export class ProblemException extends HttpException {
  constructor(status:number,public readonly problemCode:string) {
    super(problemCode,status);
  }
}
export function safeProblem(status:number, code:string, instance:string, requestId?:string):ProblemDocument {
  const fallback:Record<number,string> = {
    400:'Bad Request',401:'Unauthorized',403:'Forbidden',404:'Not Found',
    405:'Method Not Allowed',409:'Conflict',413:'Payload Too Large',
    422:'Unprocessable Content',429:'Too Many Requests',500:'Internal Server Error',
    503:'Service Unavailable'
  };
  const title = fallback[status] ?? 'Request Failed';
  return {
    type:'about:blank',
    title,status,detail:title,code,instance,requestId,
  };
}
export function exceptionStatus(ex:unknown):number {
  if(ex instanceof UnknownCommitOutcome)return 503;
  if(ex instanceof HttpException) return ex.getStatus();
  return HttpStatus.INTERNAL_SERVER_ERROR;
}
export function exceptionCode(ex:unknown,status:number):string {
  if(ex instanceof UnknownCommitOutcome)return 'UNKNOWN_COMMIT_OUTCOME';
  if(ex instanceof ProblemException) return ex.problemCode;
  if(status===400)return 'INVALID_REQUEST';
  if(status===401)return 'AUTHENTICATION_REQUIRED';
  if(status===403)return 'ACCESS_DENIED';
  if(status===404)return 'RESOURCE_NOT_FOUND';
  if(status===413)return 'PAYLOAD_TOO_LARGE';
  if(status===503)return 'DEPENDENCY_UNAVAILABLE';
  if(status===500)return 'INTERNAL_ERROR';
  return `HTTP_${status}`;
}
