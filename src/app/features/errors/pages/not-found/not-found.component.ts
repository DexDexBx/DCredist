import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, IconComponent],
  templateUrl: './not-found.component.html',
})
export class NotFoundComponent {}
