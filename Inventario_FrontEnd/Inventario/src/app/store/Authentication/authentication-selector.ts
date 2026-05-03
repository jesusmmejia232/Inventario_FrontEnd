import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AuthenticationState } from './authentication.reducer';
import { esJefeBodegaUsuario } from 'src/app/Models/Acceso/Usuario.model';

export const getLayoutState = createFeatureSelector<AuthenticationState>('auth');

export const getUser = createSelector(
    getLayoutState,
    (state: AuthenticationState) => state.user
);

/** Solo jefe de bodega puede registrar nuevas salidas (no basta con admin). */
export const selectPuedeCrearSalida = createSelector(getUser, (user) =>
    esJefeBodegaUsuario(user ?? undefined)
);

export const getisLoggedIn = createSelector(
    getLayoutState,
    (state: AuthenticationState) => state.isLoggedIn
);

export const getError = createSelector(
    getLayoutState,
    (state: AuthenticationState) => state.error
);

// Alias más semántico
export const selectAuthError = getError;