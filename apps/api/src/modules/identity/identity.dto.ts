import {IsEmail,IsString,Length} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';
export class RegisterDto {
 @ApiProperty({format:'email',maxLength:254}) @IsEmail() @Length(3,254) email!:string;
 @ApiProperty({minLength:12,maxLength:128,writeOnly:true}) @IsString() @Length(12,128) password!:string;
}
export class LoginDto {
 @ApiProperty({format:'email',maxLength:254}) @IsEmail() @Length(3,254) email!:string;
 @ApiProperty({writeOnly:true}) @IsString() @Length(1,128) password!:string;
}
export class RefreshDto {
 @ApiProperty({writeOnly:true}) @IsString() @Length(32,4096) refreshToken!:string;
}
export interface PublicUser {id:string;email:string;status:'ACTIVE'|'SUSPENDED'}
export interface TokenResponse {accessToken:string;refreshToken:string;tokenType:'Bearer';expiresInSeconds:number}
export class UserResponseDto {
 @ApiProperty({format:'uuid'}) id!:string;
 @ApiProperty({format:'email'}) email!:string;
 @ApiProperty({enum:['ACTIVE','SUSPENDED']}) status!:'ACTIVE'|'SUSPENDED';
}
export class ActiveMembershipResponseDto {
 @ApiProperty({format:'uuid'}) tenantId!:string;
 @ApiProperty({format:'uuid'}) userId!:string;
 @ApiProperty({enum:['OWNER','MANAGER','RECEPTIONIST','TRAINER']}) role!:string;
 @ApiProperty({enum:['ACTIVE']}) status!:'ACTIVE';
}
export class MeResponseDto {
 @ApiProperty({type:UserResponseDto}) user!:UserResponseDto;
 @ApiProperty({type:[ActiveMembershipResponseDto]}) memberships!:ActiveMembershipResponseDto[];
}
export class TokensResponseDto {
 @ApiProperty() accessToken!:string;
 @ApiProperty() refreshToken!:string;
 @ApiProperty({enum:['Bearer']}) tokenType!:'Bearer';
 @ApiProperty({type:Number}) expiresInSeconds!:number;
}
