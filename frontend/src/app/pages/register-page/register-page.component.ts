import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-shell">
      <div class="auth-card">
        <h1>Créer un compte</h1>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label>Nom complet</label>
          <input formControlName="full_name" type="text" />
          <label>Email</label>
          <input formControlName="email" type="email" />
          <label>Mot de passe</label>
          <input formControlName="password" type="password" />
          <button type="submit" [disabled]="form.invalid || loading">{{ loading ? 'Création...' : 'S’inscrire' }}</button>
        </form>
        <p>Déjà inscrit ? <a routerLink="/login">Se connecter</a></p>
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .auth-shell { min-height: 100vh; display: grid; place-items: center; background: linear-gradient(135deg, #eef2ff, #f8fafc); }
      .auth-card { width: min(450px, calc(100vw - 2rem)); background: white; border-radius: 20px; padding: 2rem; box-shadow: 0 18px 42px rgba(0,0,0,.08); }
      h1 { margin-top: 0; }
      form { display: grid; gap: 0.8rem; }
      input { padding: 0.9rem 1rem; border-radius: 10px; border: 1px solid #d1d5db; }
      button { margin-top: 0.5rem; padding: 0.9rem; border: none; background: #4f46e5; color: white; border-radius: 10px; font-weight: 700; cursor: pointer; }
      a { color: #4f46e5; text-decoration: none; }
    `
  ]
})
export class RegisterPageComponent {
  loading = false;
  form = this.fb.nonNullable.group({
    full_name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {}

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.auth.register(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/login']);
      },
      error: () => {
        this.loading = false;
        alert('Impossible de créer le compte');
      }
    });
  }
}
