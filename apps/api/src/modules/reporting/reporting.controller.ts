import {Controller,Get,Param,ParseUUIDPipe,Query} from '@nestjs/common';
import {ApiBearerAuth,ApiProperty,ApiResponse,ApiTags,ApiQuery} from '@nestjs/swagger';
import {CurrentPrincipal} from '../../common/security/principal';
import type {AuthenticatedPrincipal} from '../../common/security/authorization';
import {ReportingService} from './reporting.service';
export class OccupancyDto {
 @ApiProperty({format:'uuid'}) tenantId!:string;
 @ApiProperty({format:'date-time'}) from!:string;
 @ApiProperty({format:'date-time'}) to!:string;
 @ApiProperty() sessions!:number;
 @ApiProperty() confirmed!:number;
 @ApiProperty() attended!:number;
 @ApiProperty() noShow!:number;
 @ApiProperty() cancelledBookings!:number;
}
@ApiTags('Reporting') @ApiBearerAuth() @Controller('organizations/:orgId/reports')
export class ReportingController {
 constructor(private readonly reports:ReportingService){}
 @Get('occupancy') @ApiQuery({name:'from',required:true,format:'date-time'})
 @ApiQuery({name:'to',required:true,format:'date-time'})
 @ApiResponse({status:200,type:OccupancyDto})
 occupancy(@CurrentPrincipal()p:AuthenticatedPrincipal,@Param('orgId',ParseUUIDPipe)id:string,
  @Query('from')from:string,@Query('to')to:string){return this.reports.occupancy(p,id,from,to);}
}
