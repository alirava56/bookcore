import {Global,Module} from '@nestjs/common';
import {MetricsService} from './metrics.registry';
import {LifecycleState} from './lifecycle-state';
import {MetricsController} from './metrics.controller';
import {MonitorGuard} from '../security/monitor.guard';
@Global()
@Module({controllers:[MetricsController],providers:[MetricsService,LifecycleState,MonitorGuard],
 exports:[MetricsService,LifecycleState]})
export class ObservabilityModule {}
