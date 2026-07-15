import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../services/auth-store';

@Component({
  selector: 'app-access-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './access-page.html',
  styleUrl: './access-page.css',
})
export class AccessPage {
  private readonly formBuilder = inject(FormBuilder);
  readonly auth = inject(AuthStore);

  readonly hasLoginError = signal(false);

  readonly loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  async login(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const value = this.loginForm.getRawValue();
    this.hasLoginError.set(!(await this.auth.login(value.email, value.password)));
  }

  async logout(): Promise<void> {
    this.hasLoginError.set(false);
    await this.auth.logout();
    this.loginForm.reset({ email: '', password: '' });
  }

  privileges(): string[] {
    return [
      'Gestire eventi e immagini',
      'Visualizzare le persone in lista',
      'Gestire ingressi in modalita Lista',
      'Gestire pagamenti e tipologia ingresso in Cassa',
    ];
  }
}
