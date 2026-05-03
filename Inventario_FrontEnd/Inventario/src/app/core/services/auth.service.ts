import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { User } from '../../store/Authentication/auth.models';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, map, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { GlobalComponent } from '../../global-component';
import { environment } from '../../../environments/environment';
import {
  login,
  loginSuccess,
  loginFailure,
  logout,
  logoutSuccess,
  RegisterSuccess,
} from '../../store/Authentication/authentication.actions';
import { UsuarioLogin } from '../../Models/Acceso/Usuario.model';

const AUTH_API = GlobalComponent.AUTH_API;

/** Cuerpo que exige el endpoint IniciarSesion (DTO completo); el SP solo usa usuario y clave. */
function buildIniciarSesionBody(
  usua_NombreUsuario: string,
  usua_Clave: string
): UsuarioLogin {
  const now = new Date().toISOString();
  return {
    code_Status: 0,
    message_Status: '',
    usua_Id: 0,
    usua_NombreUsuario,
    usuarioRecibe: '',
    usua_Clave,
    usua_EsAdmin: false,
    empl_Id: 0,
    usua_Estado: true,
    usua_Creacion: 0,
    usua_FechaCreacion: now,
    usua_Modificacion: 0,
    usua_FechaModificacion: now,
  };
}

const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type': 'application/json',
    'x-api-key': environment.apiKey,
  }),
};

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  user!: User;
  currentUserValue: any;

  private currentUserSubject: BehaviorSubject<User>;

  constructor(private http: HttpClient, private store: Store) {
    this.currentUserSubject = new BehaviorSubject<User>(
      JSON.parse(localStorage.getItem('currentUser')!)
    );
  }

  register(email: string, first_name: string, password: string) {
    return this.http
      .post(
        AUTH_API + 'signup',
        {
          email,
          first_name,
          password,
        },
        httpOptions
      )
      .pipe(
        map((response: any) => {
          const user = response;
          this.store.dispatch(RegisterSuccess({ user }));
          return user;
        }),
        catchError((error: any) => {
          const errorMessage = 'Login failed';
          this.store.dispatch(loginFailure({ error: errorMessage }));
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  login(username: string, password: string) {
    return this.http
      .post(
        AUTH_API + 'IniciarSesion',
        buildIniciarSesionBody(username, password),
        httpOptions
      )
      .pipe(
        map((response: any) => {
          // Verificar si el login fue exitoso usando code_Status
          // 1 = Éxito, -1 = Advertencia, 0 = Error
          if (response.data && response.data.code_Status === 1) {
            const user = response.data;
            localStorage.setItem('currentUser', JSON.stringify(user));
            this.currentUserSubject.next(user);
            this.store.dispatch(loginSuccess({ user }));
            return response;
          } else {
            const errorMessage =
              response.data?.message_Status ||
              'Usuario o contraseña incorrectos';
            this.store.dispatch(loginFailure({ error: errorMessage }));
            throw new Error(errorMessage);
          }
        }),
        catchError((error: any) => {
          const errorMessage =
            error.message || 'Error de conexión con el servidor';
          this.store.dispatch(loginFailure({ error: errorMessage }));
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  logout(): Observable<void> {
    this.store.dispatch(logout());

    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    this.currentUserSubject.next(null!);
    this.store.dispatch(logoutSuccess());

    return of(undefined).pipe(
      tap(() => {
        // Perform any additional logic after the logout is successful
      })
    );
  }

  resetPassword(email: string) {
    return this.http.post(AUTH_API + 'reset-password', { email }, httpOptions);
  }
}
