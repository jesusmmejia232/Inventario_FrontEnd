import {
  Component,
  Output,
  EventEmitter,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Salidas } from 'src/app/Models/Inventario/Salidas.Model';
import { environment } from 'src/environments/environment';
import { ToastrService } from 'ngx-toastr';
import { Store } from '@ngrx/store';
import { RootReducerState } from 'src/app/store';
import { getUser } from 'src/app/store/Authentication/authentication-selector';

/** Fila normalizada para la tabla (API puede enviar PascalCase o nombres extendidos). */
export interface DetalleSalidaFila {
  sadeId: number;
  artiId: number;
  loteId: number;
  cantidad: number;
  costoUnitario: number;
  vencimiento: string;
  subtotal: number;
  artiCodigo?: string;
  articulo?: string;
  loteCodigo?: string;
}

import { ConfirmationComponent } from '../confirmation/confirmation.component';

@Component({
  selector: 'app-details',
  standalone: true,
  imports: [CommonModule, ConfirmationComponent],
  templateUrl: './details.component.html',
  styleUrl: './details.component.scss',
})
export class DetailsComponent implements OnChanges {
  @Input() salidaData: Salidas | null = null;
  /** Si se define, carga por id (p. ej. desde la ruta de detalle). */
  @Input() saliId: number | null = null;

  @Output() onCancel = new EventEmitter<void>();
  @Output() onRecibir = new EventEmitter<void>();

  salidaDetalle: any = null;
  detallesProductos: DetalleSalidaFila[] = [];
  cargando = false;
  userData: any;

  mostrarConfirmacion = false;

  constructor(
    private http: HttpClient,
    private toastService: ToastrService,
    private store: Store<RootReducerState>
  ) {
    this.store.select(getUser).subscribe((user) => {
      this.userData = user;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const id = this.resolverIdSalida();
    if (id != null && id > 0) {
      this.cargarDetallesCompletos(id);
    }
  }

  private resolverIdSalida(): number | null {
    if (this.saliId != null && this.saliId > 0) {
      return this.saliId;
    }
    if (this.salidaData?.sali_Id) {
      return this.salidaData.sali_Id;
    }
    return null;
  }

  esEstadoEnviada(estado: string | undefined | null): boolean {
    const e = (estado || '').toLowerCase();
    return e.includes('enviad');
  }

  esEstadoRecibida(estado: string | undefined | null): boolean {
    const e = (estado || '').toLowerCase();
    return e.includes('recib');
  }

  private cargarDetallesCompletos(sali_Id: number): void {
    this.cargando = true;
    const url = `${environment.apiUrl}/Salidas/ObtenerCompleta/${sali_Id}`;

    this.http
      .get<any>(url, {
        headers: { 'x-api-key': environment.apiKey },
      })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.salidaDetalle = response.data;
            this.procesarDetallesSalida(response.data.detalleSalida);
          } else {
            this.toastService.error(
              response.message || 'Error al cargar los detalles de la salida'
            );
          }
          this.cargando = false;
        },
        error: (error) => {
          console.error('Error cargando detalles:', error);
          this.toastService.error('Error de conexión al cargar detalles');
          this.cargando = false;
        },
      });
  }

  private procesarDetallesSalida(detalles: unknown): void {
    try {
      let raw: any[] = [];
      if (typeof detalles === 'string' && detalles.trim()) {
        raw = JSON.parse(detalles);
      } else if (Array.isArray(detalles)) {
        raw = detalles;
      }
      this.detallesProductos = raw.map((r) => this.normalizarFilaDetalle(r));
    } catch (e) {
      console.error('Error al parsear detalleSalida:', e);
      this.detallesProductos = [];
      this.toastService.warning('No se pudo cargar el detalle de productos');
    }
  }

  private normalizarFilaDetalle(r: any): DetalleSalidaFila {
    const cant = Number(r.Sade_Cantidad ?? r.sade_Cantidad ?? 0);
    const cpu = Number(r.Sade_CostoUnitario ?? r.sade_CostoUnitario ?? 0);
    const ven = String(r.Sade_FechaVencimiento ?? r.sade_FechaVencimiento ?? '');
    return {
      sadeId: Number(r.Sade_Id ?? r.sade_Id ?? 0),
      artiId: Number(r.Arti_Id ?? r.arti_Id ?? 0),
      loteId: Number(r.Lote_Id ?? r.lote_Id ?? 0),
      cantidad: cant,
      costoUnitario: cpu,
      vencimiento: ven,
      subtotal: cant * cpu,
      artiCodigo: r.Arti_Codigo ?? r.arti_Codigo,
      articulo: r.Articulo ?? r.arti_Descripcion,
      loteCodigo: r.Lote_Codigo ?? r.lote_Codigo,
    };
  }

  recibirSalida(): void {
    if (!this.salidaDetalle) return;

    if (!this.esEstadoEnviada(this.salidaDetalle.sali_EstadoSalida)) {
      this.toastService.warning(
        'Esta salida ya fue recibida o no está en estado válido'
      );
      return;
    }

    if (!this.userData || !this.userData.usua_Id) {
      this.toastService.error('No se pudo obtener la información del usuario');
      return;
    }

    this.mostrarConfirmacion = true;
  }

  confirmarRecepcion(): void {
    if (!this.salidaDetalle) return;

    this.mostrarConfirmacion = false;

    const request = {
      sali_Id: this.salidaDetalle.sali_Id,
      usua_Creacion: this.userData.usua_Id,
    };

    this.cargando = true;
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
          if (response.success) {
            this.toastService.success(
              response.message || 'Salida recibida exitosamente'
            );
            this.onRecibir.emit();
            this.cerrar();
          } else {
            this.toastService.error(
              response.message || 'Error al recibir la salida'
            );
          }
          this.cargando = false;
        },
        error: (error) => {
          console.error('Error recibiendo salida:', error);
          this.toastService.error('Error de conexión al recibir la salida');
          this.cargando = false;
        },
      });
  }

  cerrar(): void {
    this.onCancel.emit();
    this.salidaDetalle = null;
    this.detallesProductos = [];
  }
}
