import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListComponent as EntradasListComponent } from './entradas/list/list.component';
import { ListComponent as SalidasListComponent } from './salidas/list/list.component';
import { SalidaCreatePageComponent } from './salidas/create/salida-create-page.component';

const routes: Routes = [
  {
    path: 'entradas/list',
    component: EntradasListComponent
  },
  {
    path: 'salidas/list',
    component: SalidasListComponent
  },
  {
    path: 'salidas/create',
    component: SalidaCreatePageComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InventarioRoutingModule { }
