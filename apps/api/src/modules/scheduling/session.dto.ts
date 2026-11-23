import {ApiProperty,ApiPropertyOptional} from '@nestjs/swagger';
import {IsInt,IsString,IsUUID,ValidateIf,Length,Max,Min} from 'class-validator';

export class CreateSessionDto {
 @ApiProperty({format:'uuid'}) @IsUUID() branchId!:string;
 @ApiProperty({format:'uuid'}) @IsUUID() serviceId!:string;
 @ApiProperty({format:'uuid'}) @IsUUID() trainerResourceId!:string;
 @ApiPropertyOptional({format:'uuid'}) @ValidateIf((_,value:unknown)=>value!==undefined) @IsUUID() roomResourceId?:string;
 @ApiProperty({format:'date-time'}) @IsString() startAt!:string;
 @ApiProperty({format:'date-time'}) @IsString() endAt!:string;
 @ApiProperty({minimum:1,maximum:1000}) @IsInt() @Min(1) @Max(1000) capacityTotal!:number;
}
export class CancelSessionDto {
 @ApiProperty({minLength:1,maxLength:500}) @IsString() @Length(1,500) reason!:string;
}
export class CapacitySessionDto {
 @ApiProperty({minimum:1,maximum:1000}) @IsInt() @Min(1) @Max(1000) capacityTotal!:number;
}
export class StaffSessionDto {
 @ApiProperty({format:'uuid'}) id!:string;
 @ApiProperty({format:'uuid'}) tenantId!:string;
 @ApiProperty({format:'uuid'}) branchId!:string;
 @ApiProperty({format:'uuid'}) serviceId!:string;
 @ApiProperty({format:'uuid'}) trainerResourceId!:string;
 @ApiProperty({nullable:true,format:'uuid'}) roomResourceId!:string|null;
 @ApiProperty({format:'date-time'}) startAt!:string;
 @ApiProperty({format:'date-time'}) endAt!:string;
 @ApiProperty() timezone!:string;
 @ApiProperty({enum:['DRAFT','PUBLISHED','CANCELLED','FINISHED']}) status!:string;
 @ApiProperty() capacityTotal!:number;
 @ApiProperty() seatsCommitted!:number;
 @ApiProperty() seatsAvailable!:number;
 @ApiProperty() version!:number;
}
export class PublicSessionDto {
 @ApiProperty({format:'uuid'}) id!:string;
 @ApiProperty() serviceTitle!:string;
 @ApiProperty() branchName!:string;
 @ApiProperty({format:'date-time'}) startAt!:string;
 @ApiProperty({format:'date-time'}) endAt!:string;
 @ApiProperty() timezone!:string;
 @ApiProperty({enum:['PUBLISHED']}) status!:'PUBLISHED';
 @ApiProperty({description:'Non-guaranteed snapshot'}) seatsAvailable!:number;
}
export class PageInfoDto {@ApiProperty({nullable:true}) nextCursor!:string|null;@ApiProperty() hasMore!:boolean;}
export class StaffSessionListDto {@ApiProperty({type:[StaffSessionDto]}) items!:StaffSessionDto[];@ApiProperty({type:PageInfoDto}) page!:PageInfoDto;}
export class PublicSessionListDto {@ApiProperty({type:[PublicSessionDto]}) items!:PublicSessionDto[];@ApiProperty({type:PageInfoDto}) page!:PageInfoDto;}
