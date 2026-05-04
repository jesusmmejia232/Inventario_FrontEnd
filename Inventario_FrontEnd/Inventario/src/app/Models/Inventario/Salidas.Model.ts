export class Salidas {
    sali_Id: number = 0;
    sucs_Id: number = 0;
    sali_FechaSalida: Date = new Date();
    sali_EstadoSalida: string = "";
    sali_CostoTotal: number = 0;
    sali_UsuarioEnvia: number = 0;
    sali_UsuarioRecibe?: number;
    vehi_Id?: number;
    sali_Transportista?: number;
    sali_FechaRecepcion?: Date;
    sali_GuiaRemision?: string;
    sali_Estado: boolean = true;
    Usua_NombreUsuario: string = "";
    
    // Auditoría
    sali_Creacion: number = 0;
    sali_FechaCreacion: Date = new Date();
    sali_Modificacion?: number;
    sali_FechaModificacion?: Date;

    // Propiedades de Lectura (API Response)
    secuencia?: number; // Para ordenamiento en tabla
    sucursalDestino?: string;
    unidadesTotales?: number;
    usuarioEnvia?: string;
    usuarioRecibe?: string;
    vehiculo?: string;
    /** Desde `Salidas/ObtenerCompleta` u otras lecturas extendidas */
    vehi_Marca?: string;
    vehi_Modelo?: string;
    transportista?: string;
    detalleSalida?: string; // JSON string

    constructor(init?: Partial<Salidas>) {
        Object.assign(this, init);
    }
}

/** Cuerpo esperado por `PUT /Salidas/Recibir`. */
export interface SalidaRecibirRequest {
    code_Status: number;
    message_Status: string;
    sali_Id: number;
    usua_Creacion: number;
}

export function buildSalidaRecibirRequest(
    sali_Id: number,
    usua_Creacion: number
): SalidaRecibirRequest {
    return {
        code_Status: 0,
        message_Status: '',
        sali_Id,
        usua_Creacion,
    };
}
