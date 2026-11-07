import { Module } from '@nestjs/common';
import { ConstanciesModule } from '../constancies/constancies.module';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
  imports: [ConstanciesModule],
  controllers: [VerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}