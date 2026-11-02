import { Module } from '@nestjs/common';

import { CatalogsService } from './catalogs.service';
import { LocationsController } from './locations.controller';
import { OrganizersController } from './organizers.controller';
import { ProfessionalSchoolsController } from './professional-schools.controller';

@Module({
  controllers: [
    ProfessionalSchoolsController,
    LocationsController,
    OrganizersController,
  ],
  providers: [CatalogsService],
  exports: [CatalogsService],
})
export class CatalogsModule {}
