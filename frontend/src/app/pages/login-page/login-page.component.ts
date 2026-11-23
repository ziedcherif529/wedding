import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-shell">
      <div class="auth-card">
        <h1>Connexion</h1>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label>Email</label>
          <input formControlName="email" type="email" placeholder="vous@exemple.com" />
          <label>Mot de passe</label>
          <input formControlName="password" type="password" placeholder="••••••••" />
          <button type="submit" [disabled]="form.invalid || loading">{{ loading ? 'Connexion...' : 'Se connecter' }}</button>
        </form>
        <p>Pas de compte ? <a routerLink="/register">Créer un compte</a></p>
        <p class="muted"><a routerLink="/">Retour à l'accueil</a></p>
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .auth-shell { min-height: 100vh; display: grid; place-items: center; background: #f3f4f6; }
      .auth-card { width: min(450px, calc(100vw - 2rem)); background: white; border-radius: 20px; padding: 2rem; box-shadow: 0 18px 42px rgba(0,0,0,.08); }
      h1 { margin-top: 0; }
      form { display: grid; gap: 0.8rem; }
      label { font-weight: 600; }
      input { padding: 0.9rem 1rem; border-radius: 10px; border: 1px solid #d1d5db; }
      button { margin-top: 0.5rem; padding: 0.9rem; border: none; background: #111827; color: white; border-radius: 10px; font-weight: 700; cursor: pointer; }
      button[disabled] { opacity: 0.7; cursor: wait; }
      a { color: #4f46e5; text-decoration: none; }
      .muted { color: #6b7280; }
    `
  ]
})
export class LoginPageComponent {
  loading = false;
  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {}

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.loading = false;
        alert('Identifiants invalides');
      }
    });
  }
}
