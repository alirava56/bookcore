import {Body,Controller,Get,Param,Patch,Post,Query,ParseUUIDPipe} from '@nestjs/common';
import {ApiBearerAuth,ApiResponse,ApiTags,ApiQuery,ApiParam} from '@nestjs/swagger';
import {CurrentPrincipal} from '../../common/security/principal';
import type {AuthenticatedPrincipal} from '../../common/security/authorization';
import {ProblemException} from '../../common/errors/problem';
import {CatalogService} from './catalog.service';
import {CreateBranchDto,CreateServiceDto,CreateResourceDto,CreateBusinessHourDto,CreateScheduleExceptionDto,
 DeactivateRuleDto,BranchDto,ServiceDto,ResourceDto,BusinessHourDto,ScheduleExceptionDto,
 BranchListDto,ServiceListDto,ResourceListDto,BusinessHourListDto,ScheduleExceptionListDto} from './catalog.dto';
export function pageInput(cursor?:string,limitRaw?:string){
 if(cursor!==undefined&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor))throw new ProblemException(400,'INVALID_CURSOR');
 const limit=limitRaw===undefined?25:Number(limitRaw);
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new ProblemException(400,'INVALID_PAGE_LIMIT');
 return {cursor:cursor??null,limit};
}
@ApiTags('Catalog and schedules') @ApiBearerAuth() @ApiParam({name:'orgId',format:'uuid'}) @Controller('organizations/:orgId')
export class CatalogController {
 constructor(private readonly service:CatalogService){}
 @Post('branches') @ApiResponse({status:201,type:BranchDto})
 createBranch(@CurrentPrincipal() p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,@Body()dto:CreateBranchDto){return this.service.createBranch(p,orgId,dto);}
 @Get('branches') @ApiResponse({status:200,type:BranchListDto})
 @ApiQuery({name:'cursor',required:false,type:String}) @ApiQuery({name:'limit',required:false,type:Number})
 listBranches(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,@Query('cursor')cursor?:string,@Query('limit')limit?:string){return this.service.list(p,orgId,'branches',pageInput(cursor,limit));}
 @Post('services') @ApiResponse({status:201,type:ServiceDto})
 createService(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,@Body()dto:CreateServiceDto){return this.service.createService(p,orgId,dto);}
 @Get('services') @ApiResponse({status:200,type:ServiceListDto})
 @ApiQuery({name:'cursor',required:false,type:String}) @ApiQuery({name:'limit',required:false,type:Number})
 listServices(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,@Query('cursor')cursor?:string,@Query('limit')limit?:string){return this.service.list(p,orgId,'services',pageInput(cursor,limit));}
 @Post('resources') @ApiResponse({status:201,type:ResourceDto})
 createResource(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,@Body()dto:CreateResourceDto){return this.service.createResource(p,orgId,dto);}
 @Get('resources') @ApiResponse({status:200,type:ResourceListDto})
 @ApiQuery({name:'cursor',required:false,type:String}) @ApiQuery({name:'limit',required:false,type:Number})
 listResources(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,@Query('cursor')cursor?:string,@Query('limit')limit?:string){return this.service.list(p,orgId,'resources',pageInput(cursor,limit));}
 @Post('business-hours') @ApiResponse({status:201,type:BusinessHourDto})
 createHour(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,@Body()dto:CreateBusinessHourDto){return this.service.createHour(p,orgId,dto);}
 @Get('business-hours') @ApiResponse({status:200,type:BusinessHourListDto})
 @ApiQuery({name:'cursor',required:false,type:String}) @ApiQuery({name:'limit',required:false,type:Number})
 listHours(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,@Query('cursor')cursor?:string,@Query('limit')limit?:string){return this.service.list(p,orgId,'business_hours',pageInput(cursor,limit));}
 @Patch('business-hours/:hourId') @ApiResponse({status:200,type:BusinessHourDto})
 deactivateHour(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,@Param('hourId',ParseUUIDPipe)id:string,@Body()dto:DeactivateRuleDto){return this.service.deactivate(p,orgId,'business_hours',id,dto);}
 @Post('schedule-exceptions') @ApiResponse({status:201,type:ScheduleExceptionDto})
 createException(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,@Body()dto:CreateScheduleExceptionDto){return this.service.createException(p,orgId,dto);}
 @Get('schedule-exceptions') @ApiResponse({status:200,type:ScheduleExceptionListDto})
 @ApiQuery({name:'cursor',required:false,type:String}) @ApiQuery({name:'limit',required:false,type:Number})
 @ApiQuery({name:'from',required:false,type:String}) @ApiQuery({name:'to',required:false,type:String})
 listExceptions(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,@Query('cursor')cursor?:string,@Query('limit')limit?:string,
 @Query('from')from?:string,@Query('to')to?:string){return this.service.list(p,orgId,'schedule_exceptions',pageInput(cursor,limit),{from,to});}
 @Patch('schedule-exceptions/:exceptionId') @ApiResponse({status:200,type:ScheduleExceptionDto})
 deactivateException(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,@Param('exceptionId',ParseUUIDPipe)id:string,@Body()dto:DeactivateRuleDto){return this.service.deactivate(p,orgId,'schedule_exceptions',id,dto);}
}
