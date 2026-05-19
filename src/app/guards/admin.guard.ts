import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../services/auth-store';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  return auth.loadCurrentUser().then((user) => {
    if (user?.role === 'admin') {
      return true;
    }

    return router.createUrlTree(['/accesso']);
  });
};
