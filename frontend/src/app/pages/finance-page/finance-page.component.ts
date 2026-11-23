import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  FinanceBudget,
  FinanceDashboard,
  FinanceExpense,
  FinanceIncome,
  SavingsGoal,
  SmartLifeApiService
} from '../../services/smartlife-api.service';

@Component({
  selector: 'app-finance-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="page">
      <header class="heading">
        <div><p class="eyebrow">Vue d’ensemble</p><h1>Smart Finance</h1><p class="subtitle">Suivez vos revenus et dépenses depuis vos enregistrements.</p></div>
      </header>
      <p class="notice" *ngIf="loading">Chargement…</p>
      <p class="notice error" *ngIf="error">{{ error }}</p>
      <ng-container *ngIf="!loading">
        <section class="summary">
          <article class="card"><span>Revenus du mois</span><strong>{{ dashboard.monthly_income | number:'1.0-2' }} TND</strong></article>
          <article class="card"><span>Dépenses du mois</span><strong>{{ dashboard.monthly_expenses | number:'1.0-2' }} TND</strong></article>
          <article class="card"><span>Solde du mois</span><strong [class.negative]="dashboard.monthly_balance < 0">{{ dashboard.monthly_balance | number:'1.0-2' }} TND</strong></article>
          <article class="card"><span>Épargne cumulée</span><strong>{{ dashboard.total_savings | number:'1.0-2' }} TND</strong></article>
        </section>
        <section class="grid">
          <div class="panel">
            <div class="panel-title"><div><p class="eyebrow">Dépenses enregistrées</p><h2>Dépenses récentes</h2></div><span class="count">{{ expenses.length }}</span></div>
            <p class="empty" *ngIf="!expenses.length">Aucune dépense enregistrée.</p>
            <ul class="entries">
              <li *ngFor="let expense of expenses">
                <span class="entry-copy"><strong>{{ expense.description }}</strong><small>{{ expense.category }}</small></span>
                <strong class="amount">− {{ expense.amount | number:'1.0-2' }} TND</strong>
                <button class="delete" type="button" aria-label="Supprimer la dépense" (click)="deleteExpense(expense)">×</button>
              </li>
            </ul>
            <form class="form" (ngSubmit)="addExpense()">
              <h3>Ajouter une dépense</h3>
              <div class="fields">
                <label>Description<input name="expenseDesc" [(ngModel)]="expenseForm.description" required placeholder="Ex. Courses"></label>
                <label>Catégorie<input name="expenseCategory" [(ngModel)]="expenseForm.category" required placeholder="Alimentation"></label>
                <label>Montant (TND)<input name="expenseAmount" [(ngModel)]="expenseForm.amount" type="number" min="0.01" step="0.01" required></label>
                <label>Date<input name="expenseDate" [(ngModel)]="expenseForm.transaction_date" type="date" required></label>
              </div>
              <button class="primary" type="submit" [disabled]="saving">Enregistrer la dépense</button>
            </form>
          </div>
          <div class="panel">
            <div class="panel-title"><div><p class="eyebrow">Entrées</p><h2>Revenus</h2></div><span class="count">{{ income.length }}</span></div>
            <p class="empty" *ngIf="!income.length">Aucun revenu enregistré.</p>
            <ul class="entries">
              <li *ngFor="let item of income">
                <span class="entry-copy"><strong>{{ item.description }}</strong><small>{{ item.source }}</small></span>
                <strong class="amount positive">+ {{ item.received_amount | number:'1.0-2' }} TND</strong>
              </li>
            </ul>
            <form class="form" (ngSubmit)="addIncome()">
              <h3>Ajouter un revenu</h3>
              <div class="fields">
                <label>Description<input name="incomeDesc" [(ngModel)]="incomeForm.description" required placeholder="Ex. Salaire"></label>
                <label>Source<input name="incomeSource" [(ngModel)]="incomeForm.source" required placeholder="Employeur"></label>
                <label>Montant reçu (TND)<input name="incomeAmount" [(ngModel)]="incomeForm.received_amount" type="number" min="0" step="0.01"></label>
                <label>Date<input name="incomeDate" [(ngModel)]="incomeForm.transaction_date" type="date" required></label>
              </div>
              <button class="primary" type="submit" [disabled]="saving">Enregistrer le revenu</button>
            </form>
          </div>
          <div class="panel">
            <div class="panel-title"><div><p class="eyebrow">Limites</p><h2>Budgets mensuels</h2></div></div>
            <p class="empty" *ngIf="!budgets.length">Aucun budget défini.</p>
            <div class="budget-row" *ngFor="let budget of budgets"><strong>{{ budget.category }}</strong><span>{{ budget.budget_amount | number:'1.0-2' }} TND · {{ budget.month }}</span></div>
            <form class="form" (ngSubmit)="addBudget()">
              <h3>Définir un budget</h3>
              <div class="fields">
                <label>Catégorie<input name="budgetCategory" [(ngModel)]="budgetForm.category" required placeholder="Transport"></label>
                <label>Montant (TND)<input name="budgetAmount" [(ngModel)]="budgetForm.budget_amount" type="number" min="0" step="0.01"></label>
                <label>Mois<input name="budgetMonth" [(ngModel)]="budgetForm.month" type="month" required></label>
              </div>
              <button class="secondary" type="submit" [disabled]="saving">Enregistrer le budget</button>
            </form>
          </div>
          <div class="panel">
            <div class="panel-title"><div><p class="eyebrow">Projets à financer</p><h2>Objectifs d’épargne</h2></div></div>
            <p class="empty" *ngIf="!goals.length">Aucun objectif d’épargne.</p>
            <div class="goal" *ngFor="let goal of goals">
              <div class="goal-label"><strong>{{ goal.name }}</strong><span>{{ goal.current_savings | number:'1.0-2' }} / {{ goal.target_amount | number:'1.0-2' }} TND</span></div>
              <div class="track"><span [style.width.%]="goalPercent(goal)"></span></div>
            </div>
            <form class="form" (ngSubmit)="addGoal()">
              <h3>Ajouter un objectif</h3>
              <div class="fields">
                <label>Nom<input name="goalName" [(ngModel)]="goalForm.name" required placeholder="Voyage"></label>
                <label>Montant cible<input name="goalTarget" [(ngModel)]="goalForm.target_amount" type="number" min="0" step="0.01"></label>
                <label>Déjà épargné<input name="goalCurrent" [(ngModel)]="goalForm.current_savings" type="number" min="0" step="0.01"></label>
                <label>Contribution mensuelle<input name="goalMonthly" [(ngModel)]="goalForm.monthly_contribution" type="number" min="0" step="0.01"></label>
              </div>
              <button class="secondary" type="submit" [disabled]="saving">Créer l’objectif</button>
            </form>
          </div>
        </section>
      </ng-container>
    </main>
  `,
  styles: [`
    :host { display: block; }
    .page { min-height: 100vh; max-width: 1440px; margin: auto; padding: clamp(1.25rem, 4vw, 3rem); background: #f5f7fb; }
    .heading { margin-bottom: 1.5rem; } h1, h2, h3 { margin: 0; letter-spacing: -.035em; } h1 { font-size: clamp(1.8rem, 3vw, 2.3rem); } h2 { font-size: 1.12rem; } h3 { font-size: .98rem; margin-bottom: .85rem; }
    .eyebrow { color: #7c3aed; text-transform: uppercase; font-size: .72rem; font-weight: 750; letter-spacing: .12em; margin: 0 0 .35rem; } .subtitle { color: #64748b; margin: .4rem 0 0; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
    .card, .panel { background: white; border: 1px solid #e8ebf2; border-radius: 16px; box-shadow: 0 8px 26px rgba(15,23,42,.045); padding: 1.25rem; }
    .card { display: grid; gap: .45rem; } .card span { color: #64748b; font-size: .86rem; } .card strong { font-size: 1.35rem; } .negative { color: #b91c1c; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; }
    .panel-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: .8rem; } .count { background: #f1f5f9; color: #64748b; padding: .2rem .55rem; border-radius: 20px; font-size: .85rem; }
    .entries { list-style: none; padding: 0; margin: 0; } .entries li { display: flex; align-items: center; gap: .7rem; border-bottom: 1px solid #eef0f4; padding: .75rem 0; }
    .entry-copy { display: grid; flex: 1; } .entry-copy small { color: #64748b; } .amount { white-space: nowrap; font-size: .9rem; } .positive { color: #047857; }
    .delete { border: 0; background: transparent; color: #b91c1c; font-size: 1.2rem; cursor: pointer; border-radius: 6px; } .delete:hover { background: #fee2e2; }
    .form { border-top: 1px solid #eef0f4; margin-top: 1rem; padding-top: 1rem; } .fields { display: grid; grid-template-columns: 1fr 1fr; gap: .7rem; margin-bottom: .8rem; }
    label { display: grid; gap: .35rem; color: #475569; font-size: .83rem; font-weight: 650; } input { min-width: 0; width: 100%; padding: .68rem .75rem; border: 1px solid #dbe1ea; border-radius: 9px; outline: none; }
    input:focus { border-color: #8b5cf6; box-shadow: 0 0 0 3px #ede9fe; }
    button.primary, button.secondary { border: 0; border-radius: 9px; padding: .72rem 1rem; font-weight: 700; cursor: pointer; } .primary { color: white; background: #6d28d9; } .secondary { color: #5b21b6; background: #f3e8ff; }
    button:disabled { opacity: .6; cursor: wait; } .empty { color: #64748b; } .budget-row { display: flex; justify-content: space-between; gap: .75rem; border-bottom: 1px solid #eef0f4; padding: .65rem 0; } .budget-row span { color: #64748b; font-size: .86rem; }
    .goal { margin: .9rem 0; } .goal-label { display: flex; justify-content: space-between; gap: .7rem; margin-bottom: .4rem; } .goal-label span { color: #64748b; font-size: .85rem; }
    .track { height: 8px; border-radius: 999px; overflow: hidden; background: #eef0f6; } .track span { display: block; height: 100%; background: linear-gradient(90deg, #7c3aed, #a78bfa); }
    .notice { color: #475569; } .error { color: #b91c1c; }
    @media (max-width: 850px) { .summary { grid-template-columns: repeat(2, 1fr); } .grid { grid-template-columns: 1fr; } }
    @media (max-width: 480px) { .fields { grid-template-columns: 1fr; } }
  `]
})
export class FinancePageComponent implements OnInit {
  dashboard: FinanceDashboard = {
    monthly_income: 0, monthly_expenses: 0, monthly_balance: 0,
    total_savings: 0, total_debt: 0, savings_rate: 0, budget_utilization: 0
  };
  expenses: FinanceExpense[] = [];
  income: FinanceIncome[] = [];
  budgets: FinanceBudget[] = [];
  goals: SavingsGoal[] = [];
  expenseForm = { description: '', category: '', amount: 0, transaction_date: this.today() };
  incomeForm = { description: '', source: '', received_amount: 0, transaction_date: this.today() };
  budgetForm = { category: '', budget_amount: 0, month: new Date().toISOString().slice(0, 7) };
  goalForm = { name: '', target_amount: 0, current_savings: 0, monthly_contribution: 0 };
  loading = true;
  saving = false;
  error = '';

  constructor(private api: SmartLifeApiService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    forkJoin({
      dashboard: this.api.getFinanceDashboard(),
      expenses: this.api.getExpenses(),
      income: this.api.getIncome(),
      budgets: this.api.getFinanceBudgets(),
      goals: this.api.getSavingsGoals()
    }).subscribe({
      next: (data) => {
        this.dashboard = data.dashboard;
        this.expenses = data.expenses;
        this.income = data.income;
        this.budgets = data.budgets;
        this.goals = data.goals;
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger les données financières.';
        this.loading = false;
      }
    });
  }

  addExpense(): void {
    if (!this.expenseForm.description.trim() || this.saving) return;
    this.runSave(() => this.api.addExpense({ ...this.expenseForm, budget_category: this.expenseForm.category }), () => {
      this.expenseForm = { description: '', category: '', amount: 0, transaction_date: this.today() };
    });
  }

  addIncome(): void {
    if (!this.incomeForm.description.trim() || !this.incomeForm.source.trim() || this.saving) return;
    this.runSave(() => this.api.addIncome({
      ...this.incomeForm, expected_amount: this.incomeForm.received_amount, status: 'received'
    }), () => {
      this.incomeForm = { description: '', source: '', received_amount: 0, transaction_date: this.today() };
    });
  }

  addBudget(): void {
    if (!this.budgetForm.category.trim() || this.saving) return;
    this.runSave(() => this.api.addFinanceBudget(this.budgetForm), () => {
      this.budgetForm = { category: '', budget_amount: 0, month: new Date().toISOString().slice(0, 7) };
    });
  }

  addGoal(): void {
    if (!this.goalForm.name.trim() || this.saving) return;
    this.runSave(() => this.api.addSavingsGoal(this.goalForm), () => {
      this.goalForm = { name: '', target_amount: 0, current_savings: 0, monthly_contribution: 0 };
    });
  }

  deleteExpense(expense: FinanceExpense): void {
    if (this.saving) return;
    this.runSave(() => this.api.deleteExpense(expense.id));
  }

  goalPercent(goal: SavingsGoal): number {
    return goal.target_amount > 0
      ? Math.min(100, Math.round(goal.current_savings / goal.target_amount * 100))
      : 0;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private runSave(request: () => import('rxjs').Observable<unknown>, afterSave: () => void = () => undefined): void {
    this.saving = true;
    this.error = '';
    request().subscribe({
      next: () => {
        afterSave();
        this.saving = false;
        this.loadData();
      },
      error: () => {
        this.saving = false;
        this.error = 'L’enregistrement a échoué. Vérifiez la connexion puis réessayez.';
      }
    });
  }
}
