import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { map, take } from 'rxjs';
import { RootReducerState } from 'src/app/store';
import { selectPuedeCrearSalida } from 'src/app/store/Authentication/authentication-selector';

export const salidasCreateGuard: CanActivateFn = () => {
  const store = inject(Store<RootReducerState>);
  const router = inject(Router);
  return store.select(selectPuedeCrearSalida).pipe(
    take(1),
    map((ok) => {
      if (ok) {
        return true;
      }
      void router.navigate(['/inventario/salidas/list']);
      return false;
    })
  );
};
