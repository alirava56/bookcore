import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { UnitOfWork } from '../transactions/unit-of-work';
import { BookingSqlAdapter } from '../../modules/booking/booking-sql.adapter';
@Global()
@Module({ providers:[DatabaseService,UnitOfWork,BookingSqlAdapter],exports:[DatabaseService,UnitOfWork,BookingSqlAdapter] })
export class DatabaseModule {}
