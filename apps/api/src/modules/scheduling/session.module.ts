import {Module} from '@nestjs/common';
import {OrganizationsModule} from '../organizations/organizations.module';
import {CatalogModule} from '../catalog/catalog.module';
import {SessionService} from './session.service';
import {StaffSessionController,PublicSessionController} from './session.controller';
@Module({imports:[OrganizationsModule,CatalogModule],controllers:[StaffSessionController,PublicSessionController],providers:[SessionService],exports:[SessionService]})
export class SessionModule {}
