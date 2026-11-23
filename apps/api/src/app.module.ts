import {ObservabilityModule} from './common/observability/observability.module';
import {GovernanceModule} from './modules/governance/governance.module';
import {Module,Global,DynamicModule} from '@nestjs/common';
import {APP_GUARD} from '@nestjs/core';
import {AppConfigModule,type AppConfig} from './config/app-config';
import {DatabaseModule} from './infrastructure/database/database.module';
import {HealthModule} from './modules/health/health.module';
import {IdentityModule} from './modules/identity/identity.module';
import {OrganizationsModule} from './modules/organizations/organizations.module';
import {CatalogModule} from './modules/catalog/catalog.module';
import {SessionModule} from './modules/scheduling/session.module';
import {BookingModule} from './modules/booking/booking.module';
import {ReportingModule} from './modules/reporting/reporting.module';
import {JsonLogger} from './common/logging/json-logger';
import {ProblemFilter} from './common/errors/problem.filter';
import {GlobalAuthGuard} from './common/security/authorization';
@Global()
@Module({imports:[IdentityModule],providers:[JsonLogger,ProblemFilter,
  {provide:APP_GUARD,useClass:GlobalAuthGuard}],exports:[JsonLogger,ProblemFilter]})
export class CommonModule {}
@Module({})
export class AppModule {
 static forRoot(config:AppConfig):DynamicModule {
  return {module:AppModule,imports:[AppConfigModule.register(config),ObservabilityModule,DatabaseModule,
    IdentityModule,OrganizationsModule,GovernanceModule,CatalogModule,SessionModule,BookingModule,ReportingModule,CommonModule,HealthModule]};
 }
}
