import { Module } from '@nestjs/common';
import { ConstanciesModule } from '../constancies/constancies.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [ConstanciesModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
