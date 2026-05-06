import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthenticationService } from '../services/auth.service';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {

    constructor(private authenticationService: AuthenticationService) { }

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        return next.handle(request).pipe(catchError(err => {
            if (err?.status === 401) {
                // auto logout if 401 response returned from api
                this.authenticationService.logout();
                location.reload();
            }
            const body = err?.error;
            let apiMessage: string | undefined;
            if (body != null && typeof body === 'object') {
                apiMessage = body.message ?? body.Message;
            } else if (typeof body === 'string' && body.trim()) {
                apiMessage = body;
            }
            const error =
                (typeof apiMessage === 'string' ? apiMessage : '') ||
                err?.message ||
                err?.statusText ||
                'Error de red';
            return throwError(() => error);
        }))
    }
}
