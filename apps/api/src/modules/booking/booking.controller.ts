import {Body,Controller,Get,Headers,HttpCode,Param,ParseUUIDPipe,Post,Query,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiHeader,ApiParam,ApiQuery,ApiResponse,ApiTags} from '@nestjs/swagger';
import {CurrentPrincipal} from '../../common/security/principal';
import type {AuthenticatedPrincipal} from '../../common/security/authorization';
import {BookingService} from './booking.service';
import {BookingRateLimitGuard} from './booking-rate.guard';
import {AttendanceBookingDto,BookingPageDto,BookingReceiptDto,CancelBookingDto,CreateBookingDto} from './booking.dto';
@ApiTags('Bookings') @ApiBearerAuth() @ApiParam({name:'orgId',format:'uuid'})
@UseGuards(BookingRateLimitGuard)
@Controller('organizations/:orgId')
export class BookingController {
 constructor(private readonly bookings:BookingService){}
 @Post('sessions/:sessionId/bookings') @ApiHeader({name:'Idempotency-Key',required:true})
 @ApiResponse({status:201,type:BookingReceiptDto})
 create(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,
  @Param('sessionId',ParseUUIDPipe)sessionId:string,@Headers('idempotency-key')key:string,
  @Body()dto:CreateBookingDto){return this.bookings.create(p,orgId,sessionId,key,dto);}
 @Get('bookings/me') @ApiResponse({status:200,type:BookingPageDto})
 @ApiQuery({name:'from',required:false}) @ApiQuery({name:'to',required:false})
 @ApiQuery({name:'cursor',required:false}) @ApiQuery({name:'limit',required:false})
 mine(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,
  @Query('from')from?:string,@Query('to')to?:string,@Query('cursor')cursor?:string,
  @Query('limit')limit?:string){return this.bookings.mine(p,orgId,{from,to,cursor,limit});}
 @Post('bookings/:bookingId/cancel') @HttpCode(200)
 @ApiHeader({name:'Idempotency-Key',required:true}) @ApiResponse({status:200,type:BookingReceiptDto})
 cancel(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,
  @Param('bookingId',ParseUUIDPipe)id:string,@Headers('idempotency-key')key:string,
  @Body()dto:CancelBookingDto){return this.bookings.cancel(p,orgId,id,key,dto);}
 @Post('bookings/:bookingId/attendance') @HttpCode(200)
 @ApiHeader({name:'Idempotency-Key',required:true}) @ApiResponse({status:200,type:BookingReceiptDto})
 attendance(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)orgId:string,
  @Param('bookingId',ParseUUIDPipe)id:string,@Headers('idempotency-key')key:string,
  @Body()dto:AttendanceBookingDto){return this.bookings.attendance(p,orgId,id,key,dto);}
}
