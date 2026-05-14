import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SharedModule } from '../../../../shared/shared.module';
import { CreateComponent } from './create.component';
import { Salidas } from '../../../../Models/Inventario/Salidas.Model';

@Component({
  selector: 'app-salida-create-page',
  standalone: true,
  imports: [CommonModule, SharedModule, CreateComponent],
  templateUrl: './salida-create-page.component.html',
  styleUrls: ['./salida-create-page.component.scss'],
})
export class SalidaCreatePageComponent {
  breadCrumbItems!: Array<{ label?: string; active?: boolean }>;

  constructor(private router: Router) {
    this.breadCrumbItems = [
      { label: 'Inventario' },
      { label: 'Salidas', active: false },
      { label: 'Nueva salida', active: true },
    ];
  }

  volver(): void {
    this.router.navigate(['/inventario/salidas/list']);
  }

  alGuardar(_salida: Salidas): void {
    this.router.navigate(['/inventario/salidas/list']);
  }
}
