import {Body,Controller,Get,Param,Post,Patch,Query,ParseUUIDPipe} from '@nestjs/common';
import {ApiBearerAuth,ApiBody,ApiExtraModels,ApiResponse,ApiTags,getSchemaPath} from '@nestjs/swagger';
import {CurrentPrincipal} from '../../common/security/principal';
import type {AuthenticatedPrincipal} from '../../common/security/authorization';
import {OrganizationsService} from './organizations.service';
import {CreateOrganizationDto,CreateMembershipDto,PatchMembershipDto,OrganizationResponseDto,MembershipResponseDto,MembershipListResponseDto} from './organization.dto';
import {ProblemException} from '../../common/errors/problem';
@ApiTags('Organizations') @ApiBearerAuth()
@ApiExtraModels(PatchMembershipDto)
@Controller('organizations')
export class OrganizationsController {
 constructor(private readonly service:OrganizationsService){}
 @Post() @ApiResponse({status:201,type:OrganizationResponseDto})
 create(@CurrentPrincipal()p:AuthenticatedPrincipal,@Body()dto:CreateOrganizationDto){return this.service.create(p,dto);}
 @Get(':orgId') @ApiResponse({status:200,type:OrganizationResponseDto})
 get(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string){return this.service.get(p,orgId);}
 @Get(':orgId/members') @ApiResponse({status:200,type:MembershipListResponseDto})
 list(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,
  @Query('cursor')cursor?:string,@Query('limit')limitRaw?:string){
   if(cursor && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor))throw new ProblemException(400,'INVALID_CURSOR');
   const limit=limitRaw===undefined?25:Number(limitRaw);
   if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new ProblemException(400,'INVALID_PAGE_LIMIT');
   return this.service.list(p,orgId,cursor??null,limit);
 }
 @Post(':orgId/members') @ApiResponse({status:201,type:MembershipResponseDto})
 add(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,
 @Body()dto:CreateMembershipDto){return this.service.add(p,orgId,dto);}
 @Patch(':orgId/members/:userId') @ApiResponse({status:200,type:MembershipResponseDto})
 @ApiBody({schema:{allOf:[{$ref:getSchemaPath(PatchMembershipDto)}],minProperties:1}})
 @ApiResponse({status:400,description:'At least one non-null role or status is required.'})
 @ApiResponse({status:409,description:'Reactivation requires an accepted staff invitation. The last active owner cannot be removed.'})
 patch(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,
 @Param('userId',ParseUUIDPipe)userId:string,@Body()dto:PatchMembershipDto){return this.service.patch(p,orgId,userId,dto);}
}
