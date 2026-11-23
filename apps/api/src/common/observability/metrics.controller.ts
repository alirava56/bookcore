import {Controller,Get,Header,UseGuards} from '@nestjs/common';
import {ApiExcludeController} from '@nestjs/swagger';
import {MonitoringRoute} from '../security/authorization';
import {MonitorGuard} from '../security/monitor.guard';
import {MetricsService} from './metrics.registry';
import {DatabaseService} from '../../infrastructure/database/database.service';
@ApiExcludeController()
@Controller('internal/metrics')
export class MetricsController {
 constructor(private readonly registry:MetricsService,private readonly database:DatabaseService){}
 @MonitoringRoute() @UseGuards(MonitorGuard) @Get()
 @Header('Content-Type','text/plain; version=0.0.4; charset=utf-8')
 metrics():string {
  const {total,idle,waiting}=this.database.poolStatistics();
  this.registry.poolState(total,idle,waiting);
  return this.registry.render();
 }
}
