import {ApiProperty,ApiPropertyOptional} from '@nestjs/swagger';
import {IsUUID,IsEnum,IsInt,Min,Max,IsString,Length,Matches} from 'class-validator';
import {StaffRole} from '../organizations/organization.dto';
export class CreateStaffInvitationDto {
 @ApiProperty({format:'uuid'}) @IsUUID() userId!:string;
 @ApiProperty({enum:StaffRole}) @IsEnum(StaffRole) role!:StaffRole;
}
export class StaffInvitationTokenDto {
 @ApiProperty({description:'Single-use invitation bearer secret; never pass in URL'})
 @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token!:string;
}
export class InvitationRevokeDto {
 @ApiProperty({minLength:10,maxLength:500}) @IsString() @Length(10,500) reason!:string;
}
export class GrantConsentDto {
 @ApiProperty({minimum:1,maximum:30,description:'Limited tenant-wide booking mandate, days'})
 @IsInt() @Min(1) @Max(30) durationDays!:number;
}
export class InvitationResponseDto {
 @ApiProperty({format:'uuid'}) id!:string;
 @ApiProperty({format:'uuid'}) tenantId!:string;
 @ApiProperty({format:'uuid'}) inviteeId!:string;
 @ApiProperty({enum:StaffRole}) role!:string;
 @ApiProperty({enum:['PENDING','ACCEPTED','DECLINED','REVOKED']}) status!:string;
 @ApiProperty({format:'date-time'}) expiresAt!:string;
}
export class CreatedInvitationDto extends InvitationResponseDto {
 @ApiProperty({description:'Shown exactly once to initiating administrator; operator must deliver securely'}) token!:string;
}
export class ConsentDto {
 @ApiProperty({format:'uuid'}) id!:string;
 @ApiProperty({format:'uuid'}) tenantId!:string;
 @ApiProperty({format:'uuid'}) customerId!:string;
 @ApiProperty({format:'date-time'}) expiresAt!:string;
 @ApiPropertyOptional({format:'date-time',nullable:true}) revokedAt!:string|null;
}
