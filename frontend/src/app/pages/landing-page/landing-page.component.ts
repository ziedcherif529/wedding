import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="landing-shell">
      <header class="topbar">
        <div class="brand">SmartLife</div>
        <nav>
          <a routerLink="/">Accueil</a>
          <a routerLink="/pricing">Tarifs</a>
          <a routerLink="/login">Connexion</a>
          <a routerLink="/register" class="cta">Créer un compte</a>
        </nav>
      </header>

      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">SaaS premium</span>
          <h1>Le compagnon digital du mariage et des finances familiales.</h1>
          <p>Centralisez vos budgets, achats, paiements, économies et tâches de mariage dans un espace personnel sécurisé.</p>
          <div class="hero-actions">
            <a routerLink="/register" class="primary">Commencer gratuitement</a>
            <a routerLink="/pricing" class="secondary">Voir les plans</a>
          </div>
        </div>
        <div class="hero-panel">
          <div class="panel-card">
            <p class="panel-eyebrow">Un espace pour tout organiser</p>
            <div class="metric"><span>Budget mariage</span><strong>Planifié</strong></div>
            <div class="metric"><span>Finances</span><strong>Suivies</strong></div>
            <div class="metric"><span>Achats importants</span><strong>Centralisés</strong></div>
          </div>
        </div>
      </section>

      <section class="features">
        <div class="feature">
          <h3>Wedding Planner</h3>
          <p>Suivez votre budget, achats, fournisseurs, paiements et tâches.</p>
        </div>
        <div class="feature">
          <h3>Smart Finance</h3>
          <p>Analysez vos revenus, dépenses, budgets mensuels et objectifs d’épargne.</p>
        </div>
        <div class="feature">
          <h3>Gestion SaaS</h3>
          <p>Espaces personnels, abonnements, rôles et sécurité multi-tenant.</p>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .landing-shell { min-height: 100vh; background: linear-gradient(135deg, #0f172a, #111827 35%, #1f2937); color: white; }
      .topbar { display: flex; justify-content: space-between; padding: 1.25rem 8vw; align-items: center; }
      .brand { font-size: 1.4rem; font-weight: 800; }
      nav { display: flex; gap: 1.2rem; align-items: center; }
      nav a { color: white; text-decoration: none; opacity: 0.9; }
      .cta, .primary, .secondary { padding: 0.8rem 1.2rem; border-radius: 999px; text-decoration: none; } 
      .cta, .primary { background: #7c3aed; color: white; }
      .secondary { background: rgba(255,255,255,0.08); color: white; }
      .hero { display: grid; grid-template-columns: 1.4fr 0.9fr; gap: 2rem; padding: 4rem 8vw; align-items: center; }
      .eyebrow { display: inline-block; background: rgba(124,58,237,.25); color: #d8b4fe; border: 1px solid rgba(216,180,254,.4); padding: 0.4rem 0.8rem; border-radius: 999px; margin-bottom: 1rem; }
      h1 { font-size: clamp(2.5rem, 6vw, 4.25rem); line-height: 1.1; margin: 0 0 1rem; }
      .hero-copy p { font-size: 1.1rem; max-width: 600px; color: #d1d5db; }
      .hero-actions { display: flex; gap: 1rem; margin-top: 2rem; }
      .hero-panel { display: flex; justify-content: center; }
      .panel-card { width: min(100%, 420px); background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); backdrop-filter: blur(8px); border-radius: 22px; padding: 1.5rem; box-shadow: 0 20px 45px rgba(15,23,42,.5); }
      .panel-eyebrow { color: #c4b5fd; text-transform: uppercase; font-size: .75rem; font-weight: 750; letter-spacing: .1em; margin: 0 0 .6rem; }
      .metric { display: flex; justify-content: space-between; padding: 0.85rem 0; border-bottom: 1px solid rgba(255,255,255,.08); }
      .metric:last-child { border-bottom: 0; }
      .features { padding: 0 8vw 5rem; display: grid; grid-template-columns: repeat(3, minmax(220px, 1fr)); gap: 1.5rem; }
      .feature { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 18px; padding: 1.5rem; }
      @media (max-width: 760px) { .hero { grid-template-columns: 1fr; } .features { grid-template-columns: 1fr; } nav { display: none; } }
    `
  ]
})
export class LandingPageComponent {}
