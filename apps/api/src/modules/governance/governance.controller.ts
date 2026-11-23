import {Body,Controller,Get,HttpCode,Param,ParseUUIDPipe,Post,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiResponse,ApiTags} from '@nestjs/swagger';
import {CurrentPrincipal} from '../../common/security/principal';
import type {AuthenticatedPrincipal} from '../../common/security/authorization';
import {GovernanceRateLimitGuard} from './governance-rate.guard';
import {GovernanceService} from './governance.service';
import {CreateStaffInvitationDto,StaffInvitationTokenDto,InvitationRevokeDto,GrantConsentDto,
 InvitationResponseDto,CreatedInvitationDto,ConsentDto} from './governance.dto';
@ApiTags('Security Governance') @ApiBearerAuth() @UseGuards(GovernanceRateLimitGuard) @Controller()
export class GovernanceController {
 constructor(private readonly svc:GovernanceService){}
 @Post('organizations/:orgId/staff-invitations') @ApiResponse({status:201,type:CreatedInvitationDto})
 invite(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,
  @Body()dto:CreateStaffInvitationDto){return this.svc.invite(p,orgId,dto);}
 @Get('organizations/:orgId/staff-invitations')
 listInvites(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string){return this.svc.listInvitations(p,orgId);}
 @Post('organizations/:orgId/staff-invitations/:invitationId/revoke') @HttpCode(200)
 revoke(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,
  @Param('invitationId',ParseUUIDPipe)invitationId:string,@Body()dto:InvitationRevokeDto){return this.svc.revokeInvitation(p,orgId,invitationId,dto.reason);}
 @Post('me/staff-invitations/accept') @HttpCode(200) @ApiResponse({status:200,type:InvitationResponseDto})
 accept(@CurrentPrincipal()p:AuthenticatedPrincipal,@Body()dto:StaffInvitationTokenDto){return this.svc.accept(p,dto.token);}
 @Post('me/staff-invitations/decline') @HttpCode(200)
 decline(@CurrentPrincipal()p:AuthenticatedPrincipal,@Body()dto:StaffInvitationTokenDto){return this.svc.decline(p,dto.token);}
 @Post('organizations/:orgId/booking-consents') @ApiResponse({status:201,type:ConsentDto})
 grant(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,
  @Body()dto:GrantConsentDto){return this.svc.grantConsent(p,orgId,dto);}
 @Get('organizations/:orgId/booking-consents/me')
 mine(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string){return this.svc.myConsents(p,orgId);}
 @Post('organizations/:orgId/booking-consents/:consentId/revoke') @HttpCode(200) @ApiResponse({status:200,type:ConsentDto})
 revokeConsent(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,
  @Param('consentId',ParseUUIDPipe)consentId:string){return this.svc.revokeConsent(p,orgId,consentId);}
}
