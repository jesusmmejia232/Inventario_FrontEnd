import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { loginSuccess } from './store/Authentication/authentication.actions';
import { normalizeUsuarioLogin } from './Models/Acceso/Usuario.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Inventario';

  constructor(private store: Store) {}

  ngOnInit(): void {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      try {
        const user = normalizeUsuarioLogin(JSON.parse(currentUser));
        this.store.dispatch(loginSuccess({ user }));
      } catch (error) {
        // Error al parsear: el store no se hidrata pero la sesión permanece válida
      }
    }
  }
}
