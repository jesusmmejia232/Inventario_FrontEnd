import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { PaginationModule } from 'ngx-bootstrap/pagination';
import { ToastrService } from 'ngx-toastr';
import { Store } from '@ngrx/store';
import { RootReducerState } from 'src/app/store';
import {
  getUser,
  selectPuedeCrearSalida,
} from 'src/app/store/Authentication/authentication-selector';
import { esAdminUsuario, esJefeBodegaUsuario } from 'src/app/Models/Acceso/Usuario.model';
import { Observable, Subscription } from 'rxjs';

import { SharedModule } from 'src/app/shared/shared.module';
import { ReactiveTableService } from 'src/app/shared/services/reactive-table.service';
import { FloatingMenuService } from 'src/app/shared/services/floating-menu.service';
import {
  Salidas,
  buildSalidaRecibirRequest,
} from 'src/app/Models/Inventario/Salidas.Model';
import { GlobalComponent } from 'src/app/global-component';
import { environment } from 'src/environments/environment';
import { ConfirmationComponent } from '../confirmation/confirmation.component';

/** Columna «Unidades» del listado: `Salidas/Listar` envía la suma en `Sade_Cantidad` (o `unidadesTotales`). */
function unidadesSalidaListadoDesdeApi(item: any): number {
  const raw =
    item?.unidadesTotales ??
    item?.Sade_Cantidad ??
    item?.sade_Cantidad;
  const n =
    raw === undefined || raw === null || raw === ''
      ? 0
      : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

@Component({
  selector: 'app-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    SharedModule,
    PaginationModule,
    ConfirmationComponent
  ],
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss'],
})
export class ListComponent implements OnInit, OnDestroy {
  breadCrumbItems!: Array<{}>;

  userData: any;
  puedeCrearSalida$: Observable<boolean>;
  private userSubscription?: Subscription;

  sucursales: any[] = [];
  filtroSucursal: number | null = null;
  filtroFechaInicio: string = '';
  filtroFechaFin: string = '';

  mostrarOverlayCarga = false;

  // Modal de confirmación
  mostrarConfirmacion = false;
  salidaARecibir: Salidas | null = null;

  constructor(
    public table: ReactiveTableService<Salidas>,
    public floatingMenuService: FloatingMenuService,
    private http: HttpClient,
    private toastService: ToastrService,
    private store: Store<RootReducerState>,
    private router: Router
  ) {
    this.puedeCrearSalida$ = this.store.select(selectPuedeCrearSalida);
    this.table.setConfig([
      'sali_Id',
      'sali_FechaSalida',
      'sucursalDestino',
      'sali_EstadoSalida',
      'sali_CostoTotal',
      'usuarioEnvia',
      'usuarioRecibe',
      'sali_FechaRecepcion',
    ]);
  }

  ngOnInit(): void {
    this.userSubscription = this.store.select(getUser).subscribe((user) => {
      this.userData = user;
    });

    this.breadCrumbItems = [
      { label: 'Inventario' },
      { label: 'Salidas', active: true },
    ];

    this.cargarSucursales();
    this.cargardatos();
  }

  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  private cargarSucursales(): void {
    this.http
      .get<any>(`${environment.apiUrl}/Sucursales/Listar`, {
        headers: { 'x-api-key': environment.apiKey },
      })
      .subscribe({
        next: (res) => {
          if (res.success) this.sucursales = res.data;
        },
        error: (err) => console.error('Error cargando sucursales:', err),
      });
  }

  aplicarFiltros(): void {
    this.cargardatos();
  }

  limpiarFiltros(): void {
    this.filtroSucursal = null;
    this.filtroFechaInicio = '';
    this.filtroFechaFin = '';
    this.cargardatos();
  }

  esEstadoEnviada(estado: string | undefined | null): boolean {
    return (estado || '').toLowerCase().includes('enviad');
  }

  esEstadoRecibida(estado: string | undefined | null): boolean {
    return (estado || '').toLowerCase().includes('recib');
  }

  /** Valor mostrado en la columna Unidades del listar (misma fuente que la normalización al cargar). */
  unidadesListado(row: Salidas): number {
    return unidadesSalidaListadoDesdeApi(row);
  }

  etiquetaUsuarioEnvia(row: Salidas): string {
    const u = row.usuarioEnvia ?? row.Usua_NombreUsuario;
    if (u) return String(u);
    if (row.sali_UsuarioEnvia != null && row.sali_UsuarioEnvia > 0) {
      return 'Usuario #' + row.sali_UsuarioEnvia;
    }
    return '—';
  }

  verDetallesSalida(event: MouseEvent, salida: Salidas): void {
    event.stopPropagation();
    event.preventDefault();
    if (!salida?.sali_Id) {
      this.toastService.error('No se encontró el identificador de la salida');
      return;
    }
    this.floatingMenuService.close();
    void this.router.navigate(['/inventario/salidas/details', salida.sali_Id]);
  }

  recibirSalidaDesdeMenu(event: MouseEvent, salida: Salidas): void {
    event.stopPropagation();
    event.preventDefault();
    this.floatingMenuService.close();
    this.recibirSalida(salida);
  }

  recibirSalida(salida: Salidas): void {
    if (!this.esEstadoEnviada(salida.sali_EstadoSalida)) {
      this.toastService.warning(
        'Esta salida ya fue recibida o no está en estado válido'
      );
      return;
    }

    if (!this.userData || !this.userData.usua_Id) {
      this.toastService.error('No se pudo obtener la información del usuario');
      return;
    }
    // Confirmar acción con modal
    this.salidaARecibir = salida;
    this.mostrarConfirmacion = true;
  }

  confirmarRecepcion(): void {
    if (!this.salidaARecibir) return;
    
    const salida = this.salidaARecibir;
    this.mostrarConfirmacion = false;

    const request = buildSalidaRecibirRequest(
      salida.sali_Id,
      this.userData.usua_Id as number
    );

    this.mostrarOverlayCarga = true;
    const url = `${environment.apiUrl}/Salidas/Recibir`;

    this.http
      .put<any>(url, request, {
        headers: {
          'x-api-key': environment.apiKey,
          'Content-Type': 'application/json',
        },
      })
      .subscribe({
        next: (response) => {
          const ok =
            response?.success === true ||
            response?.Success === true ||
            response?.code === 200;
          if (ok) {
            this.toastService.success(
              response.message ||
                response.Message ||
                'Salida recibida exitosamente'
            );
            this.cargardatos();
          } else {
            this.toastService.error(
              response.message ||
                response.Message ||
                'Error al recibir la salida'
            );
          }
          this.mostrarOverlayCarga = false;
        },
        error: (error) => {
          console.error('Error recibiendo salida:', error);
          const body = error?.error;
          const msg =
            body?.message ||
            body?.Message ||
            body?.title ||
            (typeof body === 'string' ? body : null);
          this.toastService.error(
            msg || 'Error al recibir la salida. Verifique los datos o intente de nuevo.'
          );
          this.mostrarOverlayCarga = false;
        },
      });
  }

  cargardatos(): void {
    this.mostrarOverlayCarga = true;
    const url = `${environment.apiUrl}/Salidas/Listar`;

    this.http
      .get<any>(url, {
        headers: { 'x-api-key': environment.apiKey },
      })
      .subscribe({
        next: (response) => {
          if (response.success && Array.isArray(response.data)) {
            let data = response.data;

            // Filtro de seguridad: Si no es Admin ni Jefe de Bodega, solo ve su sucursal
            if (
              this.userData &&
              !esAdminUsuario(this.userData) &&
              !esJefeBodegaUsuario(this.userData)
            ) {
              if (this.userData.sucs_Id) {
                data = data.filter((item: any) => item.sucs_Id === this.userData.sucs_Id);
              }
            }

            if (this.filtroSucursal) {
              data = data.filter(
                (item: any) => item.sucs_Id === this.filtroSucursal
              );
            }

            if (this.filtroFechaInicio) {
              const fechaInicio = new Date(this.filtroFechaInicio);
              data = data.filter(
                (item: any) => new Date(item.sali_FechaSalida) >= fechaInicio
              );
            }

            if (this.filtroFechaFin) {
              const fechaFin = new Date(this.filtroFechaFin);
              fechaFin.setHours(23, 59, 59, 999);
              data = data.filter(
                (item: any) => new Date(item.sali_FechaSalida) <= fechaFin
              );
            }

            const dataNormalizada = data.map(
              (item: any) =>
                ({
                  ...item,
                  unidadesTotales: unidadesSalidaListadoDesdeApi(item),
                }) as Salidas
            );

            this.table.setData(dataNormalizada);
          } else {
            this.table.setData([]);
            this.mostrarMensaje('error', 'Formato de respuesta inesperado');
          }
          this.mostrarOverlayCarga = false;
        },
        error: (error) => {
          console.error('Error cargando salidas:', error);
          this.table.setData([]);
          this.mostrarOverlayCarga = false;
          this.mostrarMensaje('error', 'Error al cargar los datos');
        },
      });
  }

  private mostrarMensaje(tipo: 'error' | 'success', mensaje: string): void {
    if (tipo === 'error') {
      this.toastService.error(mensaje, 'Error');
    } else if (tipo === 'success') {
      this.toastService.success(mensaje, 'Éxito');
    }
  }
}
