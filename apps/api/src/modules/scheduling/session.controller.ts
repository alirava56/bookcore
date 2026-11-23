import {Body,Controller,Get,Headers,HttpCode,Param,ParseUUIDPipe,Patch,Post,Query,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiHeader,ApiParam,ApiQuery,ApiResponse,ApiTags} from '@nestjs/swagger';
import {Public} from '../../common/security/authorization';
import {AuthRateLimitGuard} from '../../common/security/rate-limit.guard';
import {CurrentPrincipal} from '../../common/security/principal';
import type {AuthenticatedPrincipal} from '../../common/security/authorization';
import {SessionService} from './session.service';
import {CreateSessionDto,CancelSessionDto,CapacitySessionDto,PublicSessionDto,PublicSessionListDto,StaffSessionDto,StaffSessionListDto} from './session.dto';

@ApiTags('Session Scheduling') @ApiBearerAuth() @ApiParam({name:'orgId',format:'uuid'})
@Controller('organizations/:orgId/sessions')
export class StaffSessionController {
 constructor(private readonly sessions:SessionService){}
 @Post() @ApiHeader({name:'Idempotency-Key',required:false,description:'Recommended UUID for safe replay after unknown commit'}) @ApiResponse({status:201,type:StaffSessionDto})
 create(@CurrentPrincipal() p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,@Body()body:CreateSessionDto,
  @Headers('idempotency-key')key?:string){
  return this.sessions.create(p,orgId,body,key);
 }
 @Get() @ApiResponse({status:200,type:StaffSessionListDto})
 @ApiQuery({name:'from',required:false}) @ApiQuery({name:'to',required:false})
 @ApiQuery({name:'limit',required:false}) @ApiQuery({name:'cursor',required:false})
 list(@CurrentPrincipal() p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,
  @Query('from')from?:string,@Query('to')to?:string,@Query('limit')limit?:string,@Query('cursor')cursor?:string){
  return this.sessions.listStaff(p,orgId,{from,to,limit,cursor});
 }
 @Get(':sessionId') @ApiResponse({status:200,type:StaffSessionDto})
 get(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,
  @Param('sessionId',ParseUUIDPipe)id:string){return this.sessions.getStaff(p,orgId,id);}
 @Post(':sessionId/publish') @HttpCode(200) @ApiResponse({status:200,type:StaffSessionDto})
 publish(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,
  @Param('sessionId',ParseUUIDPipe)id:string){return this.sessions.publish(p,orgId,id);}
 @ApiHeader({name:'Idempotency-Key',required:true,description:'UUID for replay and unknown-COMMIT recovery'}) @Post(':sessionId/cancel') @HttpCode(200) @ApiResponse({status:200,type:StaffSessionDto})
 cancel(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,
  @Param('sessionId',ParseUUIDPipe)id:string,@Headers('idempotency-key')key:string,
  @Body()body:CancelSessionDto){return this.sessions.cancel(p,orgId,id,key,body);}
 @Post(':sessionId/finish') @HttpCode(200) @ApiResponse({status:200,type:StaffSessionDto})
 finish(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,
  @Param('sessionId',ParseUUIDPipe)id:string){return this.sessions.finish(p,orgId,id);}
 @ApiHeader({name:'Idempotency-Key',required:true,description:'UUID for replay and unknown-COMMIT recovery'}) @Patch(':sessionId/capacity') @ApiResponse({status:200,type:StaffSessionDto})
 capacity(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,
  @Param('sessionId',ParseUUIDPipe)id:string,@Headers('idempotency-key')key:string,
  @Body()body:CapacitySessionDto){return this.sessions.capacity(p,orgId,id,key,body);}
}
@ApiTags('Public Sessions') @ApiParam({name:'orgId',format:'uuid'})
@Controller('public/organizations/:orgId/sessions')
export class PublicSessionController {
 constructor(private readonly sessions:SessionService){}
 @Public() @UseGuards(AuthRateLimitGuard) @Get() @ApiResponse({status:200,type:PublicSessionListDto})
 @ApiQuery({name:'from',required:false}) @ApiQuery({name:'to',required:false})
 @ApiQuery({name:'limit',required:false}) @ApiQuery({name:'cursor',required:false})
 list(@Param('orgId',ParseUUIDPipe)orgId:string,@Query('from')from?:string,
  @Query('to')to?:string,@Query('limit')limit?:string,@Query('cursor')cursor?:string){
   return this.sessions.listPublic(orgId,{from,to,limit,cursor});
 }
 @Public() @UseGuards(AuthRateLimitGuard) @Get(':sessionId') @ApiResponse({status:200,type:PublicSessionDto})
 get(@Param('orgId',ParseUUIDPipe)orgId:string,@Param('sessionId',ParseUUIDPipe)id:string){
   return this.sessions.getPublic(orgId,id);
 }
}
