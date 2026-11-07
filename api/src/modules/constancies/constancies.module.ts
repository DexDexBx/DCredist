import { Module } from '@nestjs/common';
import { ConstanciesService } from './constancies.service';

@Module({
  providers: [ConstanciesService],
  exports: [ConstanciesService],
})
export class ConstanciesModule {}
