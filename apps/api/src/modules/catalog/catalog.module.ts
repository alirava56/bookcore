import {Module} from '@nestjs/common';
import {CatalogController} from './catalog.controller';
import {CatalogService} from './catalog.service';
import {OrganizationsModule} from '../organizations/organizations.module';
@Module({imports:[OrganizationsModule],controllers:[CatalogController],providers:[CatalogService],exports:[CatalogService]})
export class CatalogModule {}
