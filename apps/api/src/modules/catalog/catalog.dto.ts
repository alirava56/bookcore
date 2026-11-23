import {ApiProperty,ApiPropertyOptional} from '@nestjs/swagger';
import {Equals,IsBoolean,IsEnum,IsIn,IsInt,ValidateIf,IsString,IsUUID,Length,Matches,Max,Min} from 'class-validator';
export enum ResourceType {TRAINER='TRAINER',ROOM='ROOM'}
export enum ExceptionKind {CLOSED='CLOSED',OPEN_OVERRIDE='OPEN_OVERRIDE'}
export class CreateBranchDto {
 @ApiProperty({minLength:2,maxLength:120}) @IsString() @Length(2,120) name!:string;
 @ApiPropertyOptional({maxLength:500}) @ValidateIf((_,value:unknown)=>value!==undefined) @IsString() @Length(1,500) address?:string;
}
export class CreateServiceDto {
 @ApiProperty({minLength:2,maxLength:160}) @IsString() @Length(2,160) title!:string;
 @ApiProperty({minimum:5,maximum:1440}) @IsInt() @Min(5) @Max(1440) durationMin!:number;
}
export class CreateResourceDto {
 @ApiProperty({enum:ResourceType}) @IsEnum(ResourceType) type!:ResourceType;
 @ApiProperty({minLength:2,maxLength:160}) @IsString() @Length(2,160) displayName!:string;
 @ApiPropertyOptional({format:'uuid'}) @ValidateIf((_,value:unknown)=>value!==undefined) @IsUUID() branchId?:string;
 @ApiPropertyOptional({format:'uuid'}) @ValidateIf((_,value:unknown)=>value!==undefined) @IsUUID() trainerUserId?:string;
 @ApiPropertyOptional({minimum:0,maximum:240}) @ValidateIf((_,value:unknown)=>value!==undefined) @IsInt() @Min(0) @Max(240) bufferBeforeMin?:number;
 @ApiPropertyOptional({minimum:0,maximum:240}) @ValidateIf((_,value:unknown)=>value!==undefined) @IsInt() @Min(0) @Max(240) bufferAfterMin?:number;
}
export class CreateBusinessHourDto {
 @ApiPropertyOptional({format:'uuid'}) @ValidateIf((_,value:unknown)=>value!==undefined) @IsUUID() branchId?:string;
 @ApiPropertyOptional({format:'uuid'}) @ValidateIf((_,value:unknown)=>value!==undefined) @IsUUID() resourceId?:string;
 @ApiProperty({minimum:1,maximum:7}) @IsInt() @Min(1) @Max(7) isoWeekday!:number;
 @ApiProperty({pattern:'^([01][0-9]|2[0-3]):[0-5][0-9]$'}) @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startLocal!:string;
 @ApiProperty({pattern:'^([01][0-9]|2[0-3]):[0-5][0-9]$'}) @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endLocal!:string;
 @ApiProperty({enum:[0,1]}) @IsIn([0,1]) endDayOffset!:0|1;
}
export class CreateScheduleExceptionDto {
 @ApiPropertyOptional({format:'uuid'}) @ValidateIf((_,value:unknown)=>value!==undefined) @IsUUID() branchId?:string;
 @ApiPropertyOptional({format:'uuid'}) @ValidateIf((_,value:unknown)=>value!==undefined) @IsUUID() resourceId?:string;
 @ApiProperty({enum:ExceptionKind}) @IsEnum(ExceptionKind) kind!:ExceptionKind;
 @ApiProperty({format:'date-time'}) @IsString() startAt!:string;
 @ApiProperty({format:'date-time'}) @IsString() endAt!:string;
 @ApiProperty({minLength:1,maxLength:500}) @IsString() @Length(1,500) reason!:string;
}
export class DeactivateRuleDto {
 @ApiProperty({enum:[false]}) @IsBoolean() @Equals(false) active!:false;
}
export class PageDto { @ApiPropertyOptional({nullable:true}) nextCursor!:string|null; @ApiProperty() hasMore!:boolean; }
export class BranchDto {
 @ApiProperty({format:'uuid'}) id!:string;@ApiProperty({format:'uuid'}) tenantId!:string;
 @ApiProperty() name!:string;@ApiPropertyOptional({nullable:true}) address!:string|null;@ApiProperty() active!:boolean;
}
export class ServiceDto {
 @ApiProperty({format:'uuid'}) id!:string;@ApiProperty({format:'uuid'}) tenantId!:string;
 @ApiProperty() title!:string;@ApiProperty() durationMin!:number;@ApiProperty() active!:boolean;
}
export class ResourceDto {
 @ApiProperty({format:'uuid'}) id!:string;@ApiProperty({format:'uuid'}) tenantId!:string;
 @ApiProperty({enum:ResourceType}) type!:ResourceType;@ApiProperty() displayName!:string;
 @ApiPropertyOptional({format:'uuid',nullable:true}) branchId!:string|null;
 @ApiPropertyOptional({format:'uuid',nullable:true}) trainerUserId!:string|null;
 @ApiProperty() active!:boolean;@ApiProperty() bufferBeforeMin!:number;@ApiProperty() bufferAfterMin!:number;
}
export class BusinessHourDto {
 @ApiProperty({format:'uuid'}) id!:string;@ApiProperty() isoWeekday!:number;
 @ApiProperty() startLocal!:string;@ApiProperty() endLocal!:string;@ApiProperty({enum:[0,1]}) endDayOffset!:0|1;
 @ApiPropertyOptional({format:'uuid',nullable:true}) branchId!:string|null;
 @ApiPropertyOptional({format:'uuid',nullable:true}) resourceId!:string|null;
 @ApiProperty() active!:boolean;
}
export class ScheduleExceptionDto {
 @ApiProperty({format:'uuid'}) id!:string;@ApiProperty({enum:ExceptionKind}) kind!:ExceptionKind;
 @ApiProperty({format:'date-time'}) startAt!:string;@ApiProperty({format:'date-time'}) endAt!:string;
 @ApiProperty() reason!:string;
 @ApiPropertyOptional({format:'uuid',nullable:true}) branchId!:string|null;
 @ApiPropertyOptional({format:'uuid',nullable:true}) resourceId!:string|null;
 @ApiProperty() active!:boolean;
}
export class BranchListDto {@ApiProperty({type:[BranchDto]}) items!:BranchDto[];@ApiProperty({type:PageDto}) page!:PageDto;}
export class ServiceListDto {@ApiProperty({type:[ServiceDto]}) items!:ServiceDto[];@ApiProperty({type:PageDto}) page!:PageDto;}
export class ResourceListDto {@ApiProperty({type:[ResourceDto]}) items!:ResourceDto[];@ApiProperty({type:PageDto}) page!:PageDto;}
export class BusinessHourListDto {@ApiProperty({type:[BusinessHourDto]}) items!:BusinessHourDto[];@ApiProperty({type:PageDto}) page!:PageDto;}
export class ScheduleExceptionListDto {@ApiProperty({type:[ScheduleExceptionDto]}) items!:ScheduleExceptionDto[];@ApiProperty({type:PageDto}) page!:PageDto;}
