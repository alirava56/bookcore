import {Module} from '@nestjs/common';
import {OrganizationsController} from './organizations.controller';
import {OrganizationsService} from './organizations.service';
import {TenantAuthorizationService} from './authorization.service';
@Module({controllers:[OrganizationsController],providers:[OrganizationsService,TenantAuthorizationService],
 exports:[TenantAuthorizationService]})
export class OrganizationsModule {}
