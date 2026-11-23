import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService, UserProfile } from '../../services/auth.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="page">
      <header class="heading">
        <div><p class="eyebrow">Compte</p><h1>Paramètres</h1><p class="subtitle">Informations de votre profil SmartLife.</p></div>
        <button type="button" class="logout" (click)="logout()">Déconnexion</button>
      </header>
      <p class="notice" *ngIf="loading">Chargement du profil…</p>
      <p class="notice error" *ngIf="error">{{ error }}</p>
      <section class="panel" *ngIf="profile">
        <div class="row"><span>Nom complet</span><strong>{{ profile.full_name }}</strong></div>
        <div class="row"><span>Adresse e-mail</span><strong>{{ profile.email }}</strong></div>
        <div class="row"><span>Rôle du compte</span><strong>{{ profile.role }}</strong></div>
        <div class="row"><span>E-mail vérifié</span><strong>{{ profile.is_verified ? 'Oui' : 'Non' }}</strong></div>
      </section>
      <a class="back" routerLink="/dashboard">Retour au tableau de bord</a>
    </main>
  `,
  styles: [`
    :host { display: block; }
    .page { min-height: 100vh; max-width: 1000px; margin: auto; padding: clamp(1.25rem, 4vw, 3rem); background: #f5f7fb; }
    .heading { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
    h1 { margin: 0; font-size: clamp(1.8rem, 3vw, 2.3rem); letter-spacing: -.035em; }
    .eyebrow { color: #7c3aed; text-transform: uppercase; font-size: .72rem; font-weight: 750; letter-spacing: .12em; margin: 0 0 .35rem; }
    .subtitle { color: #64748b; margin: .4rem 0 0; }
    .panel { background: white; border: 1px solid #e8ebf2; border-radius: 16px; box-shadow: 0 8px 26px rgba(15,23,42,.045); padding: 1.25rem; }
    .row { display: flex; justify-content: space-between; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid #eef0f4; }
    .row:last-child { border-bottom: 0; } .row span { color: #64748b; }
    .logout { border: 0; border-radius: 9px; padding: .72rem 1rem; background: #fee2e2; color: #b91c1c; font-weight: 700; cursor: pointer; }
    .logout:hover { background: #fecaca; } .back { display: inline-block; margin-top: 1rem; color: #6d28d9; font-weight: 700; text-decoration: none; }
    .notice { color: #475569; } .error { color: #b91c1c; }
  `]
})
export class SettingsPageComponent implements OnInit {
  profile: UserProfile | null = null;
  loading = true;
  error = '';

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.auth.getProfile().subscribe({
      next: (profile) => {
        this.profile = profile;
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger votre profil.';
        this.loading = false;
      }
    });
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
