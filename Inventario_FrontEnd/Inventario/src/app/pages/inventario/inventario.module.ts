import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventarioRoutingModule } from './inventario-routing.module';
import { ListComponent as EntradasListComponent } from './entradas/list/list.component';
import { ListComponent as SalidasListComponent } from './salidas/list/list.component';
import { SalidaCreatePageComponent } from './salidas/create/salida-create-page.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    InventarioRoutingModule,
    EntradasListComponent,
    SalidasListComponent,
    SalidaCreatePageComponent
  ]
})
export class InventarioModule { }
