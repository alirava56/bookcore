import {Module} from '@nestjs/common';
import {OrganizationsModule} from '../organizations/organizations.module';
import {GovernanceController} from './governance.controller';
import {GovernanceRateLimitGuard} from './governance-rate.guard';
import {GovernanceService} from './governance.service';
@Module({imports:[OrganizationsModule],providers:[GovernanceService,GovernanceRateLimitGuard],controllers:[GovernanceController],exports:[GovernanceService]})
export class GovernanceModule {}
