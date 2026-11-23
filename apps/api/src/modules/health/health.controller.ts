import {LifecycleState} from '../../common/observability/lifecycle-state';
import { Controller,Get,UseGuards,Optional } from '@nestjs/common';
import { ApiOperation,ApiProperty,ApiResponse,ApiSecurity,ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { ProblemException } from '../../common/errors/problem';
import { MonitorGuard } from '../../common/security/monitor.guard';
import {Public,MonitoringRoute} from '../../common/security/authorization';

class HealthStatus { @ApiProperty({enum:['ok']}) status!: 'ok'; }
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly db:DatabaseService,@Optional() private readonly lifecycle?:LifecycleState){}
  @Public() @Get('live')
  @ApiOperation({summary:'Process liveness; no dependency details'})
  @ApiResponse({status:200,type:HealthStatus})
  live():HealthStatus {return {status:'ok'};}

  @MonitoringRoute() @Get('ready')
  @UseGuards(MonitorGuard)
  @ApiSecurity('monitorAuth')
  @ApiOperation({summary:'Private monitoring only: network allowlist and monitoring API key'})
  @ApiResponse({status:200,type:HealthStatus})
  @ApiResponse({status:401,description:'Missing or invalid monitoring key'})
  @ApiResponse({status:403,description:'Monitoring network denied'})
  @ApiResponse({status:503,description:'Dependency unavailable'})
  async ready():Promise<HealthStatus> {
    if(this.lifecycle?.isDraining())throw new ProblemException(503,'INSTANCE_DRAINING');
    if(!await this.db.ready())throw new ProblemException(503,'DEPENDENCY_UNAVAILABLE');
    return {status:'ok'};
  }
}
