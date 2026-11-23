import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import {
  FinanceDashboard,
  FinanceExpense,
  SmartLifeApiService,
  WeddingBudget,
  WeddingDashboard
} from '../../services/smartlife-api.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">SmartLife</div>
        <nav>
          <a routerLink="/dashboard" class="active">Tableau de bord</a>
          <a routerLink="/wedding">Mariage</a>
          <a routerLink="/finance">Finances</a>
          <a routerLink="/settings">Paramètres</a>
        </nav>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <p class="eyebrow">Votre espace</p>
            <h1>Tableau de bord</h1>
          </div>
          <button class="logout" type="button" (click)="logout()">Déconnexion</button>
        </header>
        <p class="notice error" *ngIf="error">{{ error }}</p>
        <p class="notice" *ngIf="loading">Chargement de vos données…</p>
        <section class="stats" *ngIf="!loading">
          <a class="card" routerLink="/wedding"><span>Budget mariage</span><strong>{{ wedding.total_budget | number:'1.0-2' }} TND</strong></a>
          <a class="card" routerLink="/finance"><span>Revenus du mois</span><strong>{{ finance.monthly_income | number:'1.0-2' }} TND</strong></a>
          <a class="card" routerLink="/finance"><span>Dépenses du mois</span><strong>{{ finance.monthly_expenses | number:'1.0-2' }} TND</strong></a>
          <a class="card" routerLink="/finance"><span>Épargne</span><strong>{{ finance.total_savings | number:'1.0-2' }} TND</strong></a>
        </section>
        <section class="content-grid" *ngIf="!loading">
          <div class="panel">
            <div class="panel-heading">
              <div><p class="eyebrow">Planification</p><h2>Budget mariage</h2></div>
              <a routerLink="/wedding">Gérer</a>
            </div>
            <p class="empty" *ngIf="!budgets.length">Aucun budget enregistré pour le moment.</p>
            <div class="bars">
              <div class="bar-row" *ngFor="let budget of budgets">
                <div class="bar-label"><span>{{ budget.category }}</span><small>{{ budget.actual_amount | number:'1.0-2' }} / {{ budget.planned_amount | number:'1.0-2' }} TND</small></div>
                <div class="bar" role="progressbar" [attr.aria-valuenow]="percent(budget)" aria-valuemin="0" aria-valuemax="100">
                  <span [style.width.%]="percent(budget)"></span>
                </div>
              </div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-heading">
              <div><p class="eyebrow">Activité</p><h2>Dépenses récentes</h2></div>
              <a routerLink="/finance">Tout voir</a>
            </div>
            <p class="empty" *ngIf="!expenses.length">Aucune dépense enregistrée.</p>
            <ul class="activity-list">
              <li *ngFor="let expense of expenses.slice(0, 5)">
                <span><strong>{{ expense.description }}</strong><small>{{ expense.category }}</small></span>
                <b>{{ expense.amount | number:'1.0-2' }} TND</b>
              </li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 248px 1fr; background: #f5f7fb; }
    .sidebar { background: #111827; color: white; padding: 2rem 1rem; }
    .brand { font-size: 1.45rem; font-weight: 800; letter-spacing: -.04em; margin: 0 .7rem 2.2rem; }
    nav { display: grid; gap: .45rem; }
    nav a { color: #cbd5e1; text-decoration: none; padding: .8rem 1rem; border-radius: 10px; transition: background .18s, color .18s; }
    nav a.active, nav a:hover { background: rgba(255,255,255,.1); color: white; }
    .main { padding: clamp(1.25rem, 4vw, 3rem); max-width: 1440px; width: 100%; margin: 0 auto; }
    .topbar, .panel-heading { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    .topbar { margin-bottom: 1.8rem; }
    h1, h2 { margin: 0; letter-spacing: -.035em; }
    h1 { font-size: clamp(1.8rem, 3vw, 2.3rem); }
    h2 { font-size: 1.15rem; }
    .eyebrow { color: #7c3aed; text-transform: uppercase; font-size: .72rem; font-weight: 750; letter-spacing: .12em; margin: 0 0 .35rem; }
    .logout { border: 0; border-radius: 10px; padding: .72rem 1rem; background: #fee2e2; color: #b91c1c; font-weight: 700; cursor: pointer; }
    .logout:hover { background: #fecaca; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
    .card, .panel { background: white; border: 1px solid #e8ebf2; border-radius: 16px; box-shadow: 0 8px 26px rgba(15,23,42,.045); padding: 1.25rem; }
    .card { display: grid; gap: .5rem; color: inherit; text-decoration: none; transition: transform .18s, box-shadow .18s; }
    .card:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(15,23,42,.09); }
    .card span, small { color: #64748b; font-size: .85rem; }
    .card strong { font-size: 1.35rem; letter-spacing: -.03em; }
    .content-grid { display: grid; grid-template-columns: 1.2fr .8fr; gap: 1.25rem; }
    .panel-heading { margin-bottom: 1.25rem; }
    .panel-heading a { color: #6d28d9; font-size: .88rem; font-weight: 700; text-decoration: none; }
    .bars { display: grid; gap: 1.2rem; }
    .bar-label { display: flex; justify-content: space-between; gap: .8rem; margin-bottom: .45rem; }
    .bar { background: #eef0f6; height: 9px; border-radius: 999px; overflow: hidden; }
    .bar span { display: block; height: 100%; background: linear-gradient(90deg, #7c3aed, #a78bfa); border-radius: inherit; }
    .activity-list { list-style: none; padding: 0; margin: 0; }
    .activity-list li { display: flex; justify-content: space-between; align-items: center; gap: .8rem; padding: .85rem 0; border-top: 1px solid #eef0f4; }
    .activity-list li span { display: grid; }
    .activity-list b { white-space: nowrap; font-size: .9rem; }
    .empty { color: #64748b; padding: .6rem 0; }
    .notice { color: #475569; }
    .error { color: #b91c1c; }
    @media (max-width: 900px) { .shell { grid-template-columns: 1fr; } .sidebar { padding: 1rem; } .brand { margin: 0 0 .8rem; } nav { display: flex; overflow: auto; } nav a { white-space: nowrap; } .stats { grid-template-columns: repeat(2, 1fr); } .content-grid { grid-template-columns: 1fr; } }
    @media (max-width: 480px) { .stats { grid-template-columns: 1fr; } .topbar { align-items: flex-start; } }
  `]
})
export class DashboardPageComponent implements OnInit {
  finance: FinanceDashboard = {
    monthly_income: 0, monthly_expenses: 0, monthly_balance: 0,
    total_savings: 0, total_debt: 0, savings_rate: 0, budget_utilization: 0
  };
  wedding: WeddingDashboard = {
    total_budget: 0, estimated_expenses: 0, total_paid: 0, remaining: 0,
    budget_utilization: 0, completed_purchases: 0, pending_purchases: 0,
    countdown_days: 0, recent_activities: []
  };
  budgets: WeddingBudget[] = [];
  expenses: FinanceExpense[] = [];
  loading = true;
  error = '';

  constructor(private api: SmartLifeApiService, private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    forkJoin({
      finance: this.api.getFinanceDashboard(),
      wedding: this.api.getWeddingDashboard(),
      budgets: this.api.getWeddingBudgets(),
      expenses: this.api.getExpenses()
    }).subscribe({
      next: (data) => {
        this.finance = data.finance;
        this.wedding = data.wedding;
        this.budgets = data.budgets;
        this.expenses = data.expenses;
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger les données. Vérifiez la connexion au serveur.';
        this.loading = false;
      }
    });
  }

  percent(budget: WeddingBudget): number {
    return budget.planned_amount > 0
      ? Math.min(100, Math.round((budget.actual_amount / budget.planned_amount) * 100))
      : 0;
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
