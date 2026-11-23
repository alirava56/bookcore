import {ApiProperty,ApiPropertyOptional} from '@nestjs/swagger';
import {IsIn,IsString,IsUUID,Length,ValidateIf} from 'class-validator';

// customerId may only be used by authorized staff when the authenticated customer
// has a live tenant-scoped BookingConsent; enforced again in the booking TX.
export class CreateBookingDto {
 @ApiPropertyOptional({format:'uuid',description:'Staff on-behalf booking requires active customer consent'})
 @ValidateIf((_,value:unknown)=>value!==undefined) @IsUUID() customerId?:string;
}
export class CancelBookingDto {
 @ApiPropertyOptional({minLength:1,maxLength:500})
 @ValidateIf((_,value:unknown)=>value!==undefined) @IsString() @Length(1,500) reason?:string;
}
export class AttendanceBookingDto {
 @ApiProperty({enum:['ATTENDED','NO_SHOW']}) @IsIn(['ATTENDED','NO_SHOW']) status!:'ATTENDED'|'NO_SHOW';
 // The design contract allows reason but history schema forbids a reason on attendance events.
 @ApiPropertyOptional({minLength:1,maxLength:500})
 @ValidateIf((_,value:unknown)=>value!==undefined) @IsString() @Length(1,500) reason?:string;
}
export class BookingReceiptDto {
 @ApiProperty({format:'uuid'}) id!:string;
 @ApiProperty({format:'uuid'}) tenantId!:string;
 @ApiProperty({format:'uuid'}) sessionId!:string;
 @ApiProperty({format:'uuid'}) customerId!:string;
 @ApiProperty({enum:['CONFIRMED','CANCELLED','ATTENDED','NO_SHOW']}) status!:string;
 @ApiProperty({format:'date-time'}) createdAt!:string;
 @ApiPropertyOptional({format:'date-time',nullable:true}) cancelledAt?:string|null;
 @ApiPropertyOptional() alreadyCancelled?:boolean;
}
export class BookingPageDto {
 @ApiProperty({type:[BookingReceiptDto]}) items!:BookingReceiptDto[];
 @ApiProperty({type:'object',properties:{nextCursor:{type:'string',nullable:true},hasMore:{type:'boolean'}}})
 page!:{nextCursor:string|null;hasMore:boolean};
}
