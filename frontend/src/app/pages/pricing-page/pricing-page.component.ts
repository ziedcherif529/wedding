import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-pricing-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <h1>Plans et tarifs</h1>
      <div class="grid">
        <div class="card">
          <h3>FREE</h3>
          <div class="price">0 TND</div>
          <ul>
            <li>1 espace personnel</li>
            <li>Tableaux de bord basiques</li>
            <li>Rapports limités</li>
          </ul>
          <a routerLink="/register">Choisir</a>
        </div>
        <div class="card featured">
          <h3>PREMIUM</h3>
          <div class="price">49 TND</div>
          <ul>
            <li>Modules mariage + finances</li>
            <li>Rapports avancés</li>
            <li>Chartes et export</li>
          </ul>
          <a routerLink="/register">Choisir</a>
        </div>
        <div class="card">
          <h3>FAMILY</h3>
          <div class="price">99 TND</div>
          <ul>
            <li>Espace partagé</li>
            <li>Plusieurs membres</li>
            <li>Permissions</li>
          </ul>
          <a routerLink="/register">Choisir</a>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .page { min-height: 100vh; padding: 4rem 8vw; background: #f8fafc; }
      h1 { text-align: center; margin-bottom: 2rem; }
      .grid { display: grid; grid-template-columns: repeat(3, minmax(200px, 1fr)); gap: 1.5rem; }
      .card { background: white; border-radius: 18px; padding: 1.5rem; box-shadow: 0 10px 24px rgba(15,23,42,.06); }
      .featured { border: 2px solid #4f46e5; transform: translateY(-8px); }
      .price { font-size: 2rem; font-weight: 800; margin: 1rem 0; }
      ul { padding-left: 1.1rem; color: #4b5563; }
      a { display: inline-block; margin-top: 0.8rem; background: #111827; color: white; padding: 0.75rem 1.2rem; border-radius: 999px; text-decoration: none; }
      @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
    `
  ]
})
export class PricingPageComponent {}
