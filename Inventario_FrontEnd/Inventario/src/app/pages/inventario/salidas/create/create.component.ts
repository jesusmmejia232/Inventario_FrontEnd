import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Salidas } from 'src/app/Models/Inventario/Salidas.Model';
import { environment } from 'src/environments/environment';
import { ToastrService } from 'ngx-toastr';
import { Store } from '@ngrx/store';
import { RootReducerState } from 'src/app/store';
import { getUser } from 'src/app/store/Authentication/authentication-selector';
import { Subscription, forkJoin, of, catchError } from 'rxjs';

interface Articulo {
  arti_Id: number;
  arti_Codigo: string;
  arti_Descripcion: string;
  lotes?: string;
  /** `stock_Disponible` devuelto por /Articulos/Listar */
  stock: number;
  lotesDisponibles: any[];
}

interface DetalleItem {
  arti_Id: number;
  arti_Codigo: string;
  arti_Descripcion: string;
  cantidad: number;
  stockDisponible: number;
  costoUnitarioPromedio: number;  // Costo promedio ponderado
  costoTotal: number;  // cantidad * costoUnitarioPromedio
  lotesUsados: LoteUsado[];  // Detalles de los lotes seleccionados por FIFO
}

interface LoteUsado {
  lote_Id: number;
  lote_Codigo: string;
  cantidad: number;
  costoUnitario: number;
  fechaVencimiento: string;
}

@Component({
  selector: 'app-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create.component.html',
  styleUrls: ['./create.component.scss']
})
export class CreateComponent implements OnInit, OnDestroy {
  @Output() onCancel = new EventEmitter<void>();
  @Output() onSave = new EventEmitter<Salidas>();

  // Usuario de Sesión
  userData: any;
  private userSubscription?: Subscription;

  // Catálogos
  sucursales: any[] = [];
  vehiculos: any[] = [];
  articulos: Articulo[] = [];
  
  // Formulario
  sucs_Id: number | null = null;
  vehi_Id: number | null = null;
  /** Texto libre del transportista (ya no es FK a empleado). */
  transportistaTexto = '';
  
  // Grid de Detalles
  detalles: DetalleItem[] = [];
  
  // Selección de Producto
  articuloSeleccionado: number | null = null;
  cantidadSeleccionada: number = 1;
  
  // Estado
  cargando = false;
  guardando = false;
  /** Valor para input datetime-local (fecha/hora de creación de la salida) */
  saliFechaCreacionInput = '';
  submitted = false;
  errores: { sucs?: string; fecha?: string; detalles?: string } = {};

  constructor(
    private http: HttpClient,
    private toastService: ToastrService,
    private store: Store<RootReducerState>
  ) {}

  ngOnInit(): void {
    // Obtener usuario de sesión
    this.userSubscription = this.store.select(getUser).subscribe((user) => {
      this.userData = user;
    });

    this.saliFechaCreacionInput = this.toDateTimeLocalValue(new Date());
    this.cargarCatalogos();
  }

  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  private cargarCatalogos(): void {
    this.cargando = true;
    
    // Cargar Sucursales
    this.http.get<any>(`${environment.apiUrl}/Sucursales/Listar`, {
      headers: { 'x-api-key': environment.apiKey }
    }).subscribe({
      next: (res) => {
        if (res.success) this.sucursales = res.data;
      },
      error: (err) => console.error('Error cargando sucursales:', err)
    });

    // Cargar Vehículos
    this.http.get<any>(`${environment.apiUrl}/Vehiculos/Listar`, {
      headers: { 'x-api-key': environment.apiKey }
    }).subscribe({
      next: (res) => {
        if (res.success) this.vehiculos = res.data;
      },
      error: (err) => console.error('Error cargando vehículos:', err)
    });

    // Artículos desde /Articulos/Listar (incluye stock_Disponible) + /Lotes/Listar para FIFO y payload de lotes.
    // Si Lotes/Listar falla, el stock mostrado sigue siendo el del catálogo de artículos.
    forkJoin({
      articulos: this.http
        .get<any>(`${environment.apiUrl}/Articulos/Listar`, {
          headers: { 'x-api-key': environment.apiKey }
        })
        .pipe(
          catchError((err) => {
            console.error('Error Articulos/Listar:', err);
            return of({ success: false, data: [] });
          })
        ),
      lotes: this.http
        .get<any>(`${environment.apiUrl}/Lotes/Listar`, {
          headers: { 'x-api-key': environment.apiKey }
        })
        .pipe(
          catchError((err) => {
            console.error('Error Lotes/Listar:', err);
            return of({ success: false, data: [], _lotesRequestFailed: true });
          })
        )
    }).subscribe({
      next: ({ articulos: resArt, lotes: resLotes }) => {
        const artsRaw = this.extraerArrayRespuestaApi(resArt);
        const lotesRaw = this.extraerArrayRespuestaApi(resLotes);
        const articulosOk =
          resArt?.success === true ||
          resArt?.Success === true ||
          artsRaw.length > 0;

        if (!articulosOk && artsRaw.length === 0) {
          this.articulos = [];
          this.toastService.warning('No se pudieron cargar los artículos');
        } else {
          if (resLotes?._lotesRequestFailed) {
            console.warn(
              'Lotes/Listar falló: el stock en pantalla viene de Articulos/Listar; no se podrá armar la salida por FIFO hasta que los lotes carguen.'
            );
          }
          this.articulos = this.mezclarArticulosConLotes(artsRaw, lotesRaw);
        }
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando artículos o lotes:', err);
        this.toastService.error('Error al cargar artículos para la salida');
        this.cargando = false;
      }
    });
  }

  /** Extrae un arreglo típico de `data` / `Data` o cuerpo array. */
  private extraerArrayRespuestaApi(res: any): any[] {
    if (!res) return [];
    const d = res.data ?? res.Data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(res)) return res;
    return [];
  }

  private normalizarIdArticulo(val: unknown): number | null {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }

  /** Convierte un registro de lote (API o anidado en artículo) al shape usado por FIFO. */
  private normalizarLoteParaFifo(l: any): {
    Lote_Id: number;
    Lote_Codigo: string;
    Lote_CantidadDisponible: number;
    Lote_CostoUnitario: number;
    Lote_FechaVencimiento: string;
  } | null {
    const disp = Number(l.Lote_CantidadDisponible ?? l.lote_CantidadDisponible ?? 0);
    if (disp <= 0) return null;
    const loteId = Number(l.Lote_Id ?? l.lote_Id);
    if (!Number.isFinite(loteId) || loteId <= 0) return null;
    return {
      Lote_Id: loteId,
      Lote_Codigo: String(l.Lote_Codigo ?? l.lote_Codigo ?? ''),
      Lote_CantidadDisponible: disp,
      Lote_CostoUnitario: Number(l.Lote_CostoUnitario ?? l.lote_CostoUnitario ?? 0),
      Lote_FechaVencimiento: String(l.Lote_FechaVencimiento ?? l.lote_FechaVencimiento ?? '')
    };
  }

  /** Une catálogo de /Articulos/Listar con /Lotes/Listar y, si hace falta, tbLotes del propio artículo. */
  private mezclarArticulosConLotes(artsRaw: any[], lotesRaw: any[]): Articulo[] {
    const lotesPorArticulo = new Map<number, any[]>();
    for (const l of lotesRaw) {
      const artiId = this.normalizarIdArticulo(l.arti_Id ?? l.Arti_Id);
      if (artiId === null) continue;
      const normalizado = this.normalizarLoteParaFifo(l);
      if (!normalizado) continue;
      const arr = lotesPorArticulo.get(artiId) ?? [];
      arr.push(normalizado);
      lotesPorArticulo.set(artiId, arr);
    }

    return artsRaw
      .map((art: any) => {
        const artiId = this.normalizarIdArticulo(art.arti_Id ?? art.Arti_Id);
        if (artiId === null) return null;
        let lotesDisponibles = (lotesPorArticulo.get(artiId) ?? []).slice();
        if (lotesDisponibles.length === 0) {
          const nested = art.tbLotes ?? art.TbLotes ?? [];
          const arrNested = Array.isArray(nested) ? nested : [];
          for (const l of arrNested) {
            const n = this.normalizarLoteParaFifo(l);
            if (n) {
              lotesDisponibles.push(n);
            }
          }
        }
        const stock = Number(
          art.stock_Disponible ??
            art.Stock_Disponible ??
            art.stockDisponible ??
            0
        );
        return {
          arti_Id: artiId,
          arti_Codigo: art.arti_Codigo ?? art.Arti_Codigo ?? '',
          arti_Descripcion: art.arti_Descripcion ?? art.Arti_Descripcion ?? '',
          lotesDisponibles,
          stock: Number.isFinite(stock) ? stock : 0
        };
      })
      .filter((a): a is Articulo => a !== null);
  }

  agregarDetalle(): void {
    if (!this.articuloSeleccionado || this.cantidadSeleccionada <= 0) {
      this.toastService.warning('Seleccione un artículo y una cantidad válida');
      return;
    }

    const articulo = this.articulos.find(a => a.arti_Id === this.articuloSeleccionado);
    if (!articulo) return;

    // Validar stock
    if (this.cantidadSeleccionada > articulo.stock) {
      this.toastService.error(`Stock insuficiente. Disponible: ${articulo.stock}`);
      return;
    }

    // Verificar si ya existe en el grid
    const existente = this.detalles.find(d => d.arti_Id === this.articuloSeleccionado);
    if (existente) {
      this.toastService.warning('El artículo ya está agregado. Elimínelo primero si desea modificar la cantidad.');
      return;
    }

    // === CALCULAR COSTOS CON FIFO ===
    const resultadoFIFO = this.calcularCostosConFIFO(articulo, this.cantidadSeleccionada);
    
    if (!resultadoFIFO) {
      if (!articulo.lotesDisponibles?.length) {
        this.toastService.error(
          'No hay lotes para este artículo (FIFO). Incluya tbLotes en Articulos/Listar o habilite el endpoint de lotes.'
        );
      }
      return;
    }

    // Agregar al grid con costos calculados
    this.detalles.push({
      arti_Id: articulo.arti_Id,
      arti_Codigo: articulo.arti_Codigo,
      arti_Descripcion: articulo.arti_Descripcion,
      cantidad: this.cantidadSeleccionada,
      stockDisponible: articulo.stock,
      costoUnitarioPromedio: resultadoFIFO.costoUnitarioPromedio,
      costoTotal: resultadoFIFO.costoTotal,
      lotesUsados: resultadoFIFO.lotesUsados
    });

    // Resetear selección
    this.articuloSeleccionado = null;
    this.cantidadSeleccionada = 1;
    this.errores.detalles = undefined;
  }

  /**
   * Simula la lógica FIFO del backend para calcular costos
   */
  private calcularCostosConFIFO(articulo: Articulo, cantidadRequerida: number): {
    costoUnitarioPromedio: number;
    costoTotal: number;
    lotesUsados: LoteUsado[];
  } | null {
    if (!articulo.lotesDisponibles?.length) {
      return null;
    }

    // Ordenar lotes por fecha de vencimiento (FIFO)
    const lotesOrdenados = [...articulo.lotesDisponibles].sort((a, b) => {
      const fechaA = new Date(a.Lote_FechaVencimiento);
      const fechaB = new Date(b.Lote_FechaVencimiento);
      return fechaA.getTime() - fechaB.getTime();
    });

    let cantidadRestante = cantidadRequerida;
    let costoAcumulado = 0;
    const lotesUsados: LoteUsado[] = [];

    for (const lote of lotesOrdenados) {
      if (cantidadRestante <= 0) break;

      const cantidadDisponible = lote.Lote_CantidadDisponible || 0;
      if (cantidadDisponible <= 0) continue;

      // Tomar lo que se pueda de este lote
      const cantidadTomar = Math.min(cantidadRestante, cantidadDisponible);
      const costoUnitario = lote.Lote_CostoUnitario || 0;

      costoAcumulado += cantidadTomar * costoUnitario;
      cantidadRestante -= cantidadTomar;

      lotesUsados.push({
        lote_Id: lote.Lote_Id,
        lote_Codigo: lote.Lote_Codigo,
        cantidad: cantidadTomar,
        costoUnitario: costoUnitario,
        fechaVencimiento: lote.Lote_FechaVencimiento
      });
    }

    // Si no se pudo completar la cantidad, retornar null
    if (cantidadRestante > 0) {
      this.toastService.error('Stock insuficiente en lotes disponibles');
      return null;
    }

    const costoTotal = costoAcumulado;
    const costoUnitarioPromedio = costoTotal / cantidadRequerida;

    return {
      costoUnitarioPromedio,
      costoTotal,
      lotesUsados
    };
  }

  eliminarDetalle(index: number): void {
    this.detalles.splice(index, 1);
  }

  /**
   * Calcula el costo total de todos los productos en el grid
   */
  get costoTotalSalida(): number {
    return this.detalles.reduce((sum, item) => sum + item.costoTotal, 0);
  }

  /**
   * Calcula el total de unidades de todos los productos
   */
  get unidadesTotales(): number {
    return this.detalles.reduce((sum, item) => sum + item.cantidad, 0);
  }

  private toDateTimeLocalValue(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /** yyyy-MM-dd para la API en cada detalle */
  private formatDateOnlyForApi(fecha: string): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) {
      return fecha.slice(0, 10);
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private obtenerFechaCreacionIso(): string | null {
    if (!this.saliFechaCreacionInput?.trim()) {
      return null;
    }
    const parsed = new Date(this.saliFechaCreacionInput);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString();
  }

  /**
   * Un registro de detalle por cada lote consumido (FIFO), con costo, vencimiento y cantidad del lote.
   * Coincide con el DTO de /Salidas/Insertar (code_Status / message_Status en cada línea).
   */
  private construirDetallesParaApi(): Array<{
    code_Status: number;
    message_Status: string;
    lote_Id: number;
    sade_CostoUnitario: number;
    sade_FechaVencimiento: string;
    arti_Id: number;
    sade_Cantidad: number;
  }> {
    const filas: Array<{
      code_Status: number;
      message_Status: string;
      lote_Id: number;
      sade_CostoUnitario: number;
      sade_FechaVencimiento: string;
      arti_Id: number;
      sade_Cantidad: number;
    }> = [];

    for (const d of this.detalles) {
      for (const l of d.lotesUsados) {
        filas.push({
          code_Status: 0,
          message_Status: '',
          lote_Id: l.lote_Id,
          sade_CostoUnitario: l.costoUnitario,
          sade_FechaVencimiento: this.formatDateOnlyForApi(l.fechaVencimiento),
          arti_Id: d.arti_Id,
          sade_Cantidad: l.cantidad,
        });
      }
    }
    return filas;
  }

  private validarFormulario(): boolean {
    this.errores = {};
    this.submitted = true;

    if (!this.sucs_Id) {
      this.errores.sucs = 'Seleccione una sucursal de destino';
    }

    const fechaIso = this.obtenerFechaCreacionIso();
    if (!fechaIso) {
      this.errores.fecha = 'Indique una fecha y hora de creación válidas';
    }

    if (this.detalles.length === 0) {
      this.errores.detalles = 'Agregue al menos un artículo a la salida';
    } else {
      const detApi = this.construirDetallesParaApi();
      if (detApi.length === 0) {
        this.errores.detalles = 'Los detalles no tienen información de lotes válida';
      }
    }

    if (!this.userData?.usua_Id) {
      this.toastService.error('No se pudo obtener la información del usuario');
      return false;
    }

    const ok = !this.errores.sucs && !this.errores.fecha && !this.errores.detalles;
    if (!ok) {
      const primero =
        this.errores.sucs || this.errores.fecha || this.errores.detalles;
      if (primero) {
        this.toastService.warning('Revise los campos marcados antes de continuar');
      }
    }
    return ok;
  }

  guardar(): void {
    if (!this.validarFormulario()) {
      return;
    }

    // === VALIDAR LÍMITE DE L 5,000 ===
    // Obtener salidas pendientes de la sucursal seleccionada
    const url = `${environment.apiUrl}/Salidas/Listar`;
    this.http.get<any>(url, {
      headers: { 'x-api-key': environment.apiKey }
    }).subscribe({
      next: (response) => {
        if (response.success && Array.isArray(response.data)) {
          // Calcular total pendiente de la sucursal
          const totalPendiente = response.data
            .filter((s: any) => 
              s.sucs_Id === this.sucs_Id && 
              s.sali_EstadoSalida === 'Enviada a Sucursal'
            )
            .reduce((sum: number, s: any) => sum + (s.sali_CostoTotal || 0), 0);

          const totalConNuevaSalida = totalPendiente + this.costoTotalSalida;

          if (totalConNuevaSalida > 5000) {
            this.toastService.error(
              `La sucursal supera el límite de L 5,000. ` +
              `Pendiente: L ${totalPendiente.toFixed(2)}, ` +
              `Nueva salida: L ${this.costoTotalSalida.toFixed(2)}, ` +
              `Total: L ${totalConNuevaSalida.toFixed(2)}`
            );
            return;
          }

          // Si pasa la validación, enviar
          this.enviarSalida();
        } else {
          // Si falla la consulta, enviar de todas formas (el backend validará)
          this.enviarSalida();
        }
      },
      error: () => {
        // Si falla la consulta, enviar de todas formas (el backend validará)
        this.enviarSalida();
      }
    });
  }

  private enviarSalida(): void {
    const usuarioId = this.userData.usua_Id as number;
    const fechaCreacion = this.obtenerFechaCreacionIso() as string;

    /**
     * Cuerpo /Salidas/Insertar.
     * El costo total de la salida no se envía: el SP lo calcula desde el JSON de detalles
     * (cantidad × costo unitario por línea). Aquí seguimos usando `costoTotalSalida` solo para UI y validación local del tope.
     */
    const request: {
      code_Status: number;
      message_Status: string;
      sucs_Id: number;
      sali_UsuarioEnvia: number;
      vehi_Id: number;
      sali_Transportista: number;
      sali_Creacion: number;
      sali_FechaCreacion: string;
      lote_Id: number;
      detalles: ReturnType<CreateComponent['construirDetallesParaApi']>;
    } = {
      code_Status: 0,
      message_Status: '',
      sucs_Id: this.sucs_Id as number,
      sali_UsuarioEnvia: usuarioId,
      vehi_Id: this.vehi_Id ?? 0,
      sali_Transportista: 0,
      sali_Creacion: usuarioId,
      sali_FechaCreacion: fechaCreacion,
      lote_Id: 0,
      detalles: this.construirDetallesParaApi(),
    };

    this.guardando = true;
    this.http.post<any>(`${environment.apiUrl}/Salidas/Insertar`, request, {
      headers: { 
        'x-api-key': environment.apiKey,
        'Content-Type': 'application/json'
      }
    }).subscribe({
      next: (res) => {
        const raw = res?.data;
        const sp = Array.isArray(raw) ? raw[0] : raw;
        const codeStatus =
          sp?.code_Status ?? sp?.Code_Status ?? null;
        const msgSp =
          (sp?.message_Status ?? sp?.Message_Status ?? '').trim();
        const msgTop = (res?.message ?? res?.Message ?? '').trim();
        const msg = msgSp || msgTop;

        if (codeStatus === 1) {
          this.toastService.success(
            msg || 'Salida creada exitosamente',
            'Éxito'
          );
          this.onSave.emit(new Salidas());
          this.resetForm();
        } else if (codeStatus === 2) {
          /* Tope L 5.000 u otra regla de negocio del SP: advertencia, sin navegar ni limpiar */
          this.toastService.warning(
            msg || 'No se puede registrar la salida.',
            'Advertencia'
          );
        } else if (codeStatus === -1) {
          this.toastService.error(
            msg || 'Error al crear la salida',
            'Error'
          );
        } else if (codeStatus != null) {
          this.toastService.error(
            msg || 'No se pudo registrar la salida.',
            'Error'
          );
        } else if (res.success) {
          /* Respuesta sin fila SP: evitar éxito verde si el texto es de validación de negocio */
          if (/supera|l[ií]mite|5[.,]000|5000|no se puede registrar/i.test(msg)) {
            this.toastService.warning(msg, 'Advertencia');
          } else {
            this.toastService.success(
              msg || 'Salida creada exitosamente',
              'Éxito'
            );
            this.onSave.emit(new Salidas());
            this.resetForm();
          }
        } else {
          this.toastService.error(msg || 'Error al crear la salida');
        }
        this.guardando = false;
      },
      error: (err) => {
        console.error('Error guardando salida:', err);
        this.toastService.error('Error de conexión al guardar la salida');
        this.guardando = false;
      }
    });
  }

  resetForm(): void {
    this.sucs_Id = null;
    this.vehi_Id = null;
    this.transportistaTexto = '';
    this.detalles = [];
    this.articuloSeleccionado = null;
    this.cantidadSeleccionada = 1;
    this.saliFechaCreacionInput = this.toDateTimeLocalValue(new Date());
    this.submitted = false;
    this.errores = {};
  }

  cancelar(): void {
    this.onCancel.emit();
  }
}
