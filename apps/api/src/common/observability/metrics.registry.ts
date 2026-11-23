import {Injectable} from '@nestjs/common';
import {MetricsRegistry} from './metrics.domain';
@Injectable()
export class MetricsService extends MetricsRegistry {}
