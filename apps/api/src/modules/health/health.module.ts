import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { MonitorGuard } from '../../common/security/monitor.guard';
@Module({controllers:[HealthController],providers:[MonitorGuard]})
export class HealthModule {}
