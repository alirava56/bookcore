import {IsString,Length,IsInt,Min,Max,IsOptional,IsUUID,IsEnum,ValidateIf} from 'class-validator';
import {ApiProperty,ApiPropertyOptional} from '@nestjs/swagger';
export enum StaffRole {OWNER='OWNER',MANAGER='MANAGER',RECEPTIONIST='RECEPTIONIST',TRAINER='TRAINER'}
export enum MembershipStatus {ACTIVE='ACTIVE',REVOKED='REVOKED'}
export class CreateOrganizationDto {
 @ApiProperty({minLength:2,maxLength:160}) @IsString() @Length(2,160) name!:string;
 @ApiProperty({example:"Asia/Tehran"}) @IsString() @Length(1,64) timezone!:string;
 @ApiPropertyOptional({minimum:0,maximum:10080}) @IsOptional() @IsInt() @Min(0) @Max(10080) cancellationCutoffMin?:number;
}
export class CreateMembershipDto {
 @ApiProperty({format:"uuid"}) @IsUUID() userId!:string;
 @ApiProperty({enum:StaffRole}) @IsEnum(StaffRole) role!:StaffRole;
}
export class PatchMembershipDto {
 @ApiPropertyOptional({enum:StaffRole}) @ValidateIf((_,value)=>value!==undefined) @IsEnum(StaffRole) role?:StaffRole;
 @ApiPropertyOptional({enum:MembershipStatus}) @ValidateIf((_,value)=>value!==undefined) @IsEnum(MembershipStatus) status?:MembershipStatus;
}
export interface OrganizationResponse{id:string;name:string;timezone:string;cancellationCutoffMin:number;status:string}
export interface MembershipResponse{tenantId:string;userId:string;role:StaffRole;status:MembershipStatus}

export class OrganizationResponseDto {
 @ApiProperty({format:'uuid'}) id!:string;
 @ApiProperty() name!:string;
 @ApiProperty() timezone!:string;
 @ApiProperty() cancellationCutoffMin!:number;
 @ApiProperty({enum:['ACTIVE','SUSPENDED']}) status!:string;
}
export class MembershipResponseDto {
 @ApiProperty({format:'uuid'}) tenantId!:string;
 @ApiProperty({format:'uuid'}) userId!:string;
 @ApiProperty({enum:StaffRole}) role!:StaffRole;
 @ApiProperty({enum:MembershipStatus}) status!:MembershipStatus;
}
export class PageInfoResponseDto {
 @ApiProperty({nullable:true}) nextCursor!:string|null;
 @ApiProperty() hasMore!:boolean;
}
export class MembershipListResponseDto {
 @ApiProperty({type:[MembershipResponseDto]}) items!:MembershipResponseDto[];
 @ApiProperty({type:PageInfoResponseDto}) page!:PageInfoResponseDto;
}
