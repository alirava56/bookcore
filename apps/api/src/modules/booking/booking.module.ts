import {Module} from '@nestjs/common';
import {GovernanceModule} from '../governance/governance.module';
import {OrganizationsModule} from '../organizations/organizations.module';
import {BookingController} from './booking.controller';
import {BookingService} from './booking.service';
import {BookingRateLimitGuard} from './booking-rate.guard';
@Module({imports:[OrganizationsModule,GovernanceModule],controllers:[BookingController],providers:[BookingService,BookingRateLimitGuard]})
export class BookingModule {}
