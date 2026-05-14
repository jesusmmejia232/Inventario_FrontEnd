import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { PaginationModule } from 'ngx-bootstrap/pagination';
import { ToastrService } from 'ngx-toastr';
import { Store } from '@ngrx/store';
import { NgSelectModule } from '@ng-select/ng-select';
import { RootReducerState } from '../../../../store';
import {
  getUser,
  selectPuedeCrearSalida,
} from '../../../../store/Authentication/authentication-selector';
import { esAdminUsuario, esJefeBodegaUsuario } from '../../../../Models/Acceso/Usuario.model';
import { from, Observable, of, Subscription } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';

import { SharedModule } from '../../../../shared/shared.module';
import { ReactiveTableService } from '../../../../shared/services/reactive-table.service';
import { FloatingMenuService } from '../../../../shared/services/floating-menu.service';
import {
  Salidas,
  buildSalidaRecibirRequest,
} from '../../../../Models/Inventario/Salidas.Model';
import { GlobalComponent } from '../../../../global-component';
import { environment } from '../../../../../environments/environment';
import { ConfirmationComponent } from '../confirmation/confirmation.component';
import { InventoryService } from '../../../../shared/services/inventory.service';

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

function parseFechaFlexible(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const s = String(value).trim();
  if (!s) return null;

  // 1) ISO / formatos parseables por JS Date (ej. 2026-05-06T00:07:19.057)
  const d1 = new Date(s);
  if (!Number.isNaN(d1.getTime())) return d1;

  // 2) dd/MM/yyyy o dd/MM/yyyy HH:mm(:ss)?
  const m = s.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const HH = Number(m[4] ?? 0);
    const MI = Number(m[5] ?? 0);
    const SS = Number(m[6] ?? 0);
    const d = new Date(yyyy, mm - 1, dd, HH, MI, SS, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function fechaSalidaDesdeApi(item: any): Date | null {
  // Algunos endpoints envían fecha como `sali_FechaSalida`; otros como `sali_FechaCreacion`.
  // Tomamos la primera que sea válida.
  return (
    parseFechaFlexible(item?.sali_FechaSalida ?? item?.Sali_FechaSalida) ||
    parseFechaFlexible(item?.sali_FechaCreacion ?? item?.Sali_FechaCreacion) ||
    parseFechaFlexible(item?.sali_FechaModificacion ?? item?.Sali_FechaModificacion)
  );
}

function parseDateInputLocal(value: string, endOfDay: boolean): Date | null {
  const s = (value || '').trim();
  if (!s) return null;
  // Esperado de <input type="date">: YYYY-MM-DD
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  return endOfDay
    ? new Date(yyyy, mm - 1, dd, 23, 59, 59, 999)
    : new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
}

@Component({
  selector: 'app-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NgSelectModule,
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
  private unidadesDetalleSubscription?: Subscription;

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
    private router: Router,
    private inventoryService: InventoryService
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
    if (this.unidadesDetalleSubscription) {
      this.unidadesDetalleSubscription.unsubscribe();
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
    const u =
      row.usuarioEnvia ??
      row.usuario_Envia ??
      (row as any).Usuario_Envia ??
      row.Usua_NombreUsuario;
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
              const fechaInicio =
                parseDateInputLocal(this.filtroFechaInicio, false) ??
                new Date(this.filtroFechaInicio);
              data = data.filter((item: any) => {
                const f = fechaSalidaDesdeApi(item);
                return f ? f >= fechaInicio : false;
              });
            }

            if (this.filtroFechaFin) {
              const fechaFin =
                parseDateInputLocal(this.filtroFechaFin, true) ??
                (() => {
                  const d = new Date(this.filtroFechaFin);
                  d.setHours(23, 59, 59, 999);
                  return d;
                })();
              data = data.filter((item: any) => {
                const f = fechaSalidaDesdeApi(item);
                return f ? f <= fechaFin : false;
              });
            }

            const dataNormalizada = data.map(
              (item: any) =>
                ({
                  ...item,
                  unidadesTotales: unidadesSalidaListadoDesdeApi(item),
                  usuarioEnvia:
                    item.usuarioEnvia ??
                    item.usuario_Envia ??
                    item.Usuario_Envia ??
                    item.Usua_NombreUsuario,
                }) as Salidas
            );

            this.table.setData(dataNormalizada);
            // Recalcular Unidades desde `ObtenerCompleta` por cada salida (sumando `Sade_Cantidad` del detalle).
            this.actualizarUnidadesDesdeObtenerCompleta(dataNormalizada);
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

  private actualizarUnidadesDesdeObtenerCompleta(rows: Salidas[]): void {
    if (!Array.isArray(rows) || rows.length === 0) return;

    if (this.unidadesDetalleSubscription) {
      this.unidadesDetalleSubscription.unsubscribe();
      this.unidadesDetalleSubscription = undefined;
    }

    const porId = new Map<number, Salidas>();
    for (const r of rows) {
      if (r?.sali_Id != null && Number(r.sali_Id) > 0) {
        porId.set(Number(r.sali_Id), r);
      }
    }

    // Ejecuta en paralelo con límite de concurrencia para no saturar el backend.
    this.unidadesDetalleSubscription = from(Array.from(porId.keys()))
      .pipe(
        mergeMap(
          (id) =>
            this.inventoryService.getSalidaDetalle(id).pipe(
              map((res) => ({
                id,
                unidades: this.sumarSadeCantidadDesdeDetalleSalida(
                  res?.data?.detalleSalida
                ),
              })),
              catchError(() => of({ id, unidades: 0 }))
            ),
          6
        )
      )
      .subscribe(({ id, unidades }) => {
        const row = porId.get(id);
        if (!row) return;
        row.unidadesTotales = unidades;
        row.Sade_Cantidad = unidades;
        // Emitir nuevamente para refrescar la tabla.
        const current = this.table.data$.value;
        this.table.data$.next([...current]);
      });
  }

  private sumarSadeCantidadDesdeDetalleSalida(detalleSalida: unknown): number {
    try {
      let raw: any[] = [];
      if (typeof detalleSalida === 'string' && detalleSalida.trim()) {
        raw = JSON.parse(detalleSalida);
      } else if (Array.isArray(detalleSalida)) {
        raw = detalleSalida;
      }
      let total = 0;
      for (const r of raw) {
        const n = Number(r?.Sade_Cantidad ?? r?.sade_Cantidad ?? 0);
        if (Number.isFinite(n)) total += n;
      }
      return total;
    } catch {
      return 0;
    }
  }

  private mostrarMensaje(tipo: 'error' | 'success', mensaje: string): void {
    if (tipo === 'error') {
      this.toastService.error(mensaje, 'Error');
    } else if (tipo === 'success') {
      this.toastService.success(mensaje, 'Éxito');
    }
  }
}
