export interface UsuarioLogin {
  usua_Id?: number;
  usua_NombreUsuario?: string;
  usuarioRecibe?: string;
  usua_Clave?: string | null;
  usua_EsAdmin?: boolean;
  sucs_Id?: number;
  empl_Id?: number;
  usua_Estado?: boolean;
  usua_Creacion?: number;
  usua_FechaCreacion?: string;
  usua_Modificacion?: number | null;
  usua_FechaModificacion?: string | null;
  
  empl_EsJefeBodega?: boolean;
  empl_Nombres?: string;
  empl_Apellidos?: string;
  empl_DNI?: string;
  empl_Sexo?: string;
  empl_Cargo?: string;
  empl_EstadoCivil?: string;
  empl_Municipio?: string;
  empl_Departamento?: string;
  
  code_Status?: number;
  message_Status?: string;
}

function flagTruthy(v: unknown): boolean {
  return v === true || v === 1 || v === '1';
}

/** API puede enviar 0/1; unifica a boolean para el store y la UI. */
export function normalizeUsuarioLogin(raw: Record<string, unknown> | null | undefined): UsuarioLogin {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const { usua_Clave: _omit, ...rest } = raw;
  const adminVal = raw['usua_EsAdmin'];
  const jefeVal = raw['empl_EsJefeBodega'];
  const emplId = raw['empl_Id'];
  const sucsId = raw['sucs_Id'];
  return {
    ...(rest as UsuarioLogin),
    usua_Id: Number(raw['usua_Id']) || 0,
    empl_Id: emplId != null ? Number(emplId) : undefined,
    sucs_Id: sucsId != null ? Number(sucsId) : undefined,
    usua_EsAdmin: flagTruthy(adminVal),
    empl_EsJefeBodega: flagTruthy(jefeVal),
  };
}

export function esJefeBodegaUsuario(u: UsuarioLogin | null | undefined): boolean {
  if (!u) return false;
  return flagTruthy(u.empl_EsJefeBodega);
}

export function esAdminUsuario(u: UsuarioLogin | null | undefined): boolean {
  if (!u) return false;
  return flagTruthy(u.usua_EsAdmin);
}

export class Usuario {
    usua_Id: number = 0;
    usua_NombreUsuario: string = '';
    usua_Clave: string = '';
    usua_EsAdmin: boolean = false;
    empl_Id: number = 0;
    usua_Estado: boolean = false;
    usua_Creacion: number = 0;
    usua_FechaCreacion: Date = new Date();
    usua_Modificacion?: number;
    usua_FechaModificacion?: Date;

    empl_EsJefeBodega: boolean = false;
    empl_Nombres: string = '';
    empl_Apellidos: string = '';
    empl_DNI: string = '';
    empl_Sexo: string = '';
    empl_Cargo: string = '';
    empl_EstadoCivil: string = '';
    empl_Municipio: string = '';
    empl_Departamento: string = '';

    code_Status: number = 0;
    message_Status: string = '';

    constructor(init?: Partial<Usuario>) {
        Object.assign(this, init);
    }

    get nombreCompleto(): string {
        return `${this.empl_Nombres} ${this.empl_Apellidos}`.trim();
    }
}