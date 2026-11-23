import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import {
  SavingsForecast,
  SmartLifeApiService,
  Wedding,
  WeddingBudgetLine,
  WeddingDashboardSummary,
  WeddingEvent,
  WeddingGuestsResponse,
  WeddingPaymentRecord,
  WeddingPreference,
  WeddingProvider,
  WeddingShoppingItem,
  WeddingTask
} from '../../services/smartlife-api.service';

type PlannerTab = 'overview' | 'budget' | 'events' | 'purchases' | 'payments' | 'providers' | 'tasks' | 'guests' | 'savings' | 'calendar' | 'sharing';

interface EventDraft {
  name: string;
  event_type: string;
  event_date: string;
  location: string;
  guest_count: number | null;
  estimated_budget: string;
  actual_budget: string;
  notes: string;
}

interface CategorySuggestion {
  group: string;
  names: string[];
}

@Component({
  selector: 'app-wedding-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="page">
      <header class="page-heading">
        <div>
          <p class="eyebrow">Tunisie · TND</p>
          <h1>Wedding Planner</h1>
          <p class="subtitle" *ngIf="weddingRecord">{{ weddingRecord.name }}<span *ngIf="preferences?.city"> · {{ preferences?.city }}</span></p>
          <p class="subtitle" *ngIf="!weddingRecord">Construisez un espace de préparation qui vous ressemble.</p>
        </div>
        <button *ngIf="!needsOnboarding && weddingRecord" class="button soft" type="button" (click)="printPage()">Imprimer / PDF</button>
      </header>

      <p class="notice" *ngIf="loading">Chargement des données du mariage…</p>
      <p class="notice error" role="alert" *ngIf="error">{{ error }}</p>
      <p class="notice success" role="status" *ngIf="success">{{ success }}</p>

      <section *ngIf="needsOnboarding && !loading" class="wizard panel">
        <div class="wizard-heading">
          <div><p class="eyebrow">Création de votre espace</p><h2>Un mariage organisé selon vos choix</h2></div>
          <span class="step-count">Étape {{ wizardStep }} / 7</span>
        </div>
        <div class="step-track" aria-hidden="true"><span [style.width.%]="wizardStep / 7 * 100"></span></div>
        <nav class="step-nav" aria-label="Étapes de configuration">
          <button *ngFor="let label of wizardLabels; let i = index" type="button" [class.current]="wizardStep === i + 1" [class.past]="wizardStep > i + 1" (click)="goToStep(i + 1)">{{ i + 1 }}. {{ label }}</button>
        </nav>

        <section *ngIf="wizardStep === 1" class="wizard-content">
          <h3>Informations générales</h3>
          <p>Les champs non obligatoires peuvent être laissés vides et complétés plus tard.</p>
          <div class="form-grid">
            <label>Nom du projet *<input name="projectName" [(ngModel)]="wizard.project_name" required maxlength="160" placeholder="Notre mariage"></label>
            <label>Date du mariage<input name="weddingDate" [(ngModel)]="wizard.wedding_date" type="date"></label>
            <label>Nom du partenaire 1<input name="partner1" [(ngModel)]="wizard.partner_one_name"></label>
            <label>Nom du partenaire 2<input name="partner2" [(ngModel)]="wizard.partner_two_name"></label>
            <label>Date des fiançailles / Mlek<input name="engagementDate" [(ngModel)]="wizard.engagement_date" type="date"></label>
            <label>Ville<input name="city" [(ngModel)]="wizard.city" placeholder="Tunis"></label>
            <label>Gouvernorat<input name="governorate" [(ngModel)]="wizard.governorate"></label>
            <label>Salle ou lieu<input name="venue" [(ngModel)]="wizard.venue"></label>
            <label>Nombre estimé d’invités<input name="guestCount" [(ngModel)]="wizard.expected_guest_count" type="number" min="0"></label>
            <label>Langue préférée<select name="language" [(ngModel)]="wizard.preferred_language"><option value="fr">Français</option><option value="ar">العربية</option><option value="en">English</option></select></label>
          </div>
        </section>

        <section *ngIf="wizardStep === 2" class="wizard-content">
          <h3>Style de votre mariage</h3><p>Choisissez zéro, un ou plusieurs styles. Rien n’est imposé.</p>
          <div class="choice-grid">
            <label class="choice" *ngFor="let style of weddingStyles"><input type="checkbox" [checked]="wizard.wedding_styles.includes(style)" (change)="toggleValue(wizard.wedding_styles, style, $any($event.target).checked)"><span>{{ style }}</span></label>
          </div>
          <label class="wide-label">Votre description libre<textarea name="customStyle" [(ngModel)]="wizard.custom_style" rows="3" placeholder="Décrivez les idées qui vous tiennent à cœur."></textarea></label>
        </section>

        <section *ngIf="wizardStep === 3" class="wizard-content">
          <h3>Région et traditions</h3><p>Les suggestions régionales restent facultatives et modifiables.</p>
          <label class="compact-label">Région<select name="region" [(ngModel)]="wizard.region"><option value="">Aucune préférence</option><option *ngFor="let region of regions" [value]="region">{{ region }}</option></select></label>
          <div *ngIf="wizard.region === 'Sfax'" class="suggestion-note">Suggestions possibles à Sfax : Zaza, Jelwa, Syegha, Hjemtha, douceurs et musique locale. Aucune ne sera ajoutée sans votre sélection.</div>
        </section>

        <section *ngIf="wizardStep === 4" class="wizard-content">
          <h3>Événements que vous souhaitez organiser</h3><p>Sélectionnez uniquement les événements de votre programme. Vous pourrez les modifier ensuite.</p>
          <div class="choice-grid">
            <label class="choice" *ngFor="let eventName of suggestedEvents"><input type="checkbox" [checked]="hasEvent(eventName)" (change)="toggleEvent(eventName, $any($event.target).checked)"><span>{{ eventName }}</span></label>
          </div>
          <div class="event-editor" *ngFor="let event of wizard.events; let i = index">
            <div class="event-editor-title"><strong>{{ event.name }}</strong><button class="link-button danger-text" type="button" (click)="removeEvent(i)">Retirer</button></div>
            <div class="form-grid compact">
              <label>Date<input [name]="'eventDate' + i" [(ngModel)]="event.event_date" type="date"></label>
              <label>Lieu<input [name]="'eventLocation' + i" [(ngModel)]="event.location"></label>
              <label>Invités<input [name]="'eventGuests' + i" [(ngModel)]="event.guest_count" type="number" min="0"></label>
              <label>Budget estimé (DT)<input [name]="'eventBudget' + i" [(ngModel)]="event.estimated_budget" inputmode="decimal" placeholder="0.000"></label>
            </div>
          </div>
          <div class="inline-add">
            <input name="customEvent" [(ngModel)]="customEventName" placeholder="Ajouter un événement personnalisé">
            <button type="button" class="button soft" (click)="addCustomEvent()">Ajouter</button>
          </div>
        </section>

        <section *ngIf="wizardStep === 5" class="wizard-content">
          <h3>Budget et capacité d’épargne</h3><p>Les aides et cadeaux ne sont jamais considérés comme certains par défaut.</p>
          <div class="form-grid">
            <label>Budget total prévu (DT)<input name="totalBudget" [(ngModel)]="wizard.total_budget" inputmode="decimal" placeholder="0.000"></label>
            <label>Épargne disponible (DT)<input name="savings" [(ngModel)]="wizard.current_savings" inputmode="decimal" placeholder="0.000"></label>
            <label>Épargne mensuelle partenaire 1 (DT)<input name="save1" [(ngModel)]="wizard.partner_one_monthly_savings" inputmode="decimal" placeholder="0.000"></label>
            <label>Épargne mensuelle partenaire 2 (DT)<input name="save2" [(ngModel)]="wizard.partner_two_monthly_savings" inputmode="decimal" placeholder="0.000"></label>
            <label>Contribution familiale estimée (DT)<input name="family" [(ngModel)]="wizard.family_contributions" inputmode="decimal" placeholder="0.000"></label>
            <label>Autres revenus prévus (DT)<input name="otherIncome" [(ngModel)]="wizard.other_expected_income" inputmode="decimal" placeholder="0.000"></label>
            <label>Traitement des cadeaux
              <select name="giftsMode" [(ngModel)]="wizard.gifts_mode">
                <option value="excluded">Exclus du budget</option><option value="tracked">Suivis séparément</option><option value="forecast">Inclus dans le scénario optimiste seulement</option>
              </select>
            </label>
          </div>
        </section>

        <section *ngIf="wizardStep === 6" class="wizard-content">
          <h3>Préparation du futur logement</h3><p>Ajoutez seulement les postes qui concernent votre projet.</p>
          <label class="choice"><input name="homePrep" [(ngModel)]="wizard.include_home_preparation" type="checkbox"><span>Inclure la préparation du logement</span></label>
          <div class="choice-grid" *ngIf="wizard.include_home_preparation">
            <label class="choice" *ngFor="let category of homeCategories"><input type="checkbox" [checked]="wizard.home_categories.includes(category)" (change)="toggleValue(wizard.home_categories, category, $any($event.target).checked)"><span>{{ category }}</span></label>
          </div>
        </section>

        <section *ngIf="wizardStep === 7" class="wizard-content">
          <h3>Vérifiez et personnalisez votre espace</h3>
          <div class="review-grid">
            <article><strong>Projet</strong><span>{{ wizard.project_name || '—' }}</span><span>{{ wizard.partner_one_name || 'Partenaire 1' }} & {{ wizard.partner_two_name || 'Partenaire 2' }}</span><span>{{ wizard.wedding_date || 'Date à définir' }}</span></article>
            <article><strong>Style et région</strong><span>{{ wizard.wedding_styles.join(', ') || 'À personnaliser' }}</span><span>{{ wizard.region || 'Région non définie' }}</span></article>
            <article><strong>Événements sélectionnés</strong><span>{{ eventNames() || 'Aucun événement sélectionné' }}</span></article>
            <article><strong>Budget</strong><span>{{ wizard.total_budget || '0.000' }} DT · cadeaux : {{ giftsLabel(wizard.gifts_mode) }}</span></article>
          </div>
          <h4>Catégories de budget suggérées — sélection facultative</h4>
          <div class="suggestion-group" *ngFor="let group of categorySuggestions">
            <strong>{{ group.group }}</strong>
            <div class="choice-grid">
              <label class="choice small-choice" *ngFor="let category of group.names"><input type="checkbox" [checked]="wizard.custom_categories.includes(category)" (change)="toggleValue(wizard.custom_categories, category, $any($event.target).checked)"><span>{{ category }}</span></label>
            </div>
          </div>
          <div class="inline-add">
            <input name="customCategory" [(ngModel)]="customCategoryName" placeholder="Ajouter une catégorie personnelle">
            <button class="button soft" type="button" (click)="addCustomCategory()">Ajouter</button>
          </div>
          <div class="chip-list"><button class="chip" type="button" *ngFor="let category of wizard.custom_categories" (click)="removeCategory(category)" [attr.aria-label]="'Retirer ' + category">{{ category }} ×</button></div>
        </section>

        <footer class="wizard-actions">
          <button class="button ghost" type="button" (click)="previousStep()" [disabled]="wizardStep === 1 || saving">Retour</button>
          <span class="step-hint">Les suggestions et catégories sont optionnelles.</span>
          <button *ngIf="wizardStep < 7" class="button primary" type="button" (click)="nextStep()" [disabled]="saving || (wizardStep === 1 && !wizard.project_name.trim())">Continuer</button>
          <button *ngIf="wizardStep === 7" class="button primary" type="button" (click)="saveOnboarding()" [disabled]="saving || !wizard.project_name.trim()">{{ saving ? 'Création…' : 'Créer mon espace mariage' }}</button>
        </footer>
      </section>

      <ng-container *ngIf="!needsOnboarding && !loading && summary">
        <nav class="planner-nav" aria-label="Navigation du wedding planner">
          <button *ngFor="let tab of tabs" type="button" [class.active]="activeTab === tab.id" (click)="activeTab = tab.id">{{ tab.label }}</button>
        </nav>
        <div class="panel filter-bar">
          <label>Événement<select name="filterEvent" [(ngModel)]="dashboardFilters.event_id" (ngModelChange)="refreshSummary()"><option value="">Tous les événements</option><option *ngFor="let event of events" [value]="event.id">{{ event.name }}</option></select></label>
          <label>Mois<input name="filterMonth" type="month" [(ngModel)]="dashboardFilters.month" (ngModelChange)="refreshSummary()"></label>
          <label>Catégorie<select name="filterCategory" [(ngModel)]="dashboardFilters.category_id" (ngModelChange)="refreshSummary()"><option value="">Toutes les catégories</option><option *ngFor="let item of budgetItems" [value]="item.id">{{ item.name }}</option></select></label>
          <button class="link-button" type="button" (click)="clearFilters()">Effacer les filtres</button>
        </div>

        <section *ngIf="activeTab === 'overview'" class="tab-content">
          <div class="metrics-grid">
            <article class="metric-card"><span>Budget planifié</span><strong>{{ summary.financial.total_planned_budget | number:'1.3-3':'fr-TN' }} DT</strong></article>
            <article class="metric-card"><span>Dépenses estimées</span><strong>{{ summary.financial.total_estimated_expenses | number:'1.3-3':'fr-TN' }} DT</strong></article>
            <article class="metric-card"><span>Dépenses réelles</span><strong>{{ summary.financial.total_actual_expenses | number:'1.3-3':'fr-TN' }} DT</strong></article>
            <article class="metric-card"><span>Montant payé</span><strong>{{ summary.financial.total_amount_paid | number:'1.3-3':'fr-TN' }} DT</strong></article>
            <article class="metric-card"><span>Paiements restants</span><strong>{{ summary.financial.total_remaining_payments | number:'1.3-3':'fr-TN' }} DT</strong></article>
            <article class="metric-card"><span>Épargne disponible</span><strong>{{ summary.financial.available_savings | number:'1.3-3':'fr-TN' }} DT</strong></article>
            <article class="metric-card"><span>Contributions confirmées</span><strong>{{ summary.financial.confirmed_future_contributions | number:'1.3-3':'fr-TN' }} DT</strong></article>
            <article class="metric-card"><span>Budget restant</span><strong>{{ summary.financial.remaining_budget | number:'1.3-3':'fr-TN' }} DT</strong></article>
          </div>
          <div class="dashboard-grid">
            <article class="panel">
              <div class="panel-heading"><div><p class="eyebrow">Prévu · estimé · réel</p><h2>Budget par catégorie</h2></div><button class="link-button" type="button" (click)="activeTab = 'budget'">Gérer</button></div>
              <p class="empty" *ngIf="!summary.budget_distribution.length">Aucune catégorie sélectionnée. Ajoutez vos propres postes quand vous le souhaitez.</p>
              <div class="budget-chart-row" *ngFor="let item of summary.budget_distribution">
                <div class="chart-label"><strong>{{ item.name }}</strong><small>Planifié {{ item.planned | number:'1.3-3':'fr-TN' }} · réel {{ item.actual | number:'1.3-3':'fr-TN' }} DT</small></div>
                <div class="bar"><span [style.width.%]="barPercent(item.actual, item.planned)"></span></div>
              </div>
              <div class="payment-progress"><span>Paiements : {{ summary.payment_progress.paid | number:'1.3-3':'fr-TN' }} DT réglés</span><span>{{ summary.payment_progress.remaining | number:'1.3-3':'fr-TN' }} DT restants</span></div>
            </article>
            <article class="panel">
              <p class="eyebrow">Progression</p><h2>Préparation du mariage</h2>
              <div class="progress-list">
                <div><span>Tâches terminées</span><strong>{{ summary.progress.completed_tasks }}</strong></div>
                <div><span>Tâches restantes</span><strong>{{ summary.progress.remaining_tasks }}</strong></div>
                <div><span>Achats terminés</span><strong>{{ summary.progress.completed_purchases }} / {{ summary.purchase_progress.total }}</strong></div>
                <div><span>Prestataires confirmés</span><strong>{{ summary.progress.confirmed_providers }}</strong></div>
                <div><span>Échéances à venir</span><strong>{{ summary.progress.upcoming_payments }}</strong></div>
                <div><span>Échéances en retard</span><strong class="danger-text">{{ summary.progress.overdue_payments }}</strong></div>
              </div>
            </article>
            <article class="panel important-dates">
              <p class="eyebrow">À venir</p><h2>Dates importantes</h2>
              <div class="date-row"><span>Décompte</span><strong>{{ summary.important_dates.countdown_days === null ? 'Date à définir' : (summary.important_dates.countdown_days + ' jours') }}</strong></div>
              <div class="date-row"><span>Prochain événement</span><strong>{{ summary.important_dates.next_event ? summary.important_dates.next_event.name + ' · ' + summary.important_dates.next_event.date : 'Aucun événement planifié' }}</strong></div>
              <div class="date-row"><span>Prochain paiement</span><strong>{{ summary.important_dates.next_payment ? summary.important_dates.next_payment.description + ' · ' + summary.important_dates.next_payment.date : 'Aucun paiement programmé' }}</strong></div>
              <div class="date-row"><span>Prochaine tâche</span><strong>{{ summary.important_dates.next_task ? summary.important_dates.next_task.title + ' · ' + summary.important_dates.next_task.date : 'Aucune tâche à échéance' }}</strong></div>
            </article>
          </div>
        </section>

        <section *ngIf="activeTab === 'budget'" class="tab-content two-columns">
          <article class="panel">
            <div class="panel-heading"><div><p class="eyebrow">TND · montants décimaux</p><h2>Budget flexible</h2></div></div>
            <p class="empty" *ngIf="!budgetItems.length">Aucun poste budgétaire. Les catégories sont facultatives.</p>
            <div class="budget-item" *ngFor="let item of budgetItems">
              <div class="item-main">
                <label class="toggle"><input type="checkbox" [checked]="item.enabled" (change)="toggleBudgetItem(item, $any($event.target).checked)"><span>{{ item.name }}</span></label>
                <small *ngIf="item.parent_category">{{ item.parent_category }}</small>
              </div>
              <div class="amount-grid">
                <span>Prévu <b>{{ item.planned_budget | number:'1.3-3':'fr-TN' }} DT</b></span>
                <span>Estimé <b>{{ item.estimated_cost | number:'1.3-3':'fr-TN' }} DT</b></span>
                <span>Confirmé <b>{{ item.confirmed_price | number:'1.3-3':'fr-TN' }} DT</b></span>
                <span>Réel <b>{{ item.actual_cost | number:'1.3-3':'fr-TN' }} DT</b></span>
                <span>Variance <b>{{ item.budget_variance | number:'1.3-3':'fr-TN' }} DT</b></span>
              </div>
              <div class="item-actions"><button class="link-button" type="button" (click)="editBudget(item)">Modifier</button><button class="link-button danger-text" type="button" (click)="deleteBudget(item)">Supprimer</button></div>
              <form *ngIf="editingBudgetId === item.id" class="edit-grid" (ngSubmit)="saveBudgetEdit(item)">
                <label>Nom<input [name]="'editBudgetName' + item.id" [(ngModel)]="budgetEdit.name" required></label>
                <label>Prévu<input [name]="'editBudgetPlanned' + item.id" [(ngModel)]="budgetEdit.planned_budget" inputmode="decimal"></label>
                <label>Estimé<input [name]="'editBudgetEstimated' + item.id" [(ngModel)]="budgetEdit.estimated_cost" inputmode="decimal"></label>
                <label>Confirmé<input [name]="'editBudgetConfirmed' + item.id" [(ngModel)]="budgetEdit.confirmed_price" inputmode="decimal"></label>
                <label>Réel<input [name]="'editBudgetActual' + item.id" [(ngModel)]="budgetEdit.actual_cost" inputmode="decimal"></label>
                <div><button class="button primary small-button" type="submit">Enregistrer</button><button class="link-button" type="button" (click)="editingBudgetId = null">Annuler</button></div>
              </form>
            </div>
          </article>
          <article class="panel">
            <p class="eyebrow">Personnalisé</p><h2>Ajouter un poste</h2>
            <form class="stack-form" (ngSubmit)="addBudgetItem()">
              <label>Nom du poste<input name="budgetName" [(ngModel)]="budgetForm.name" required placeholder="Ex. Photographe"></label>
              <label>Famille de dépenses<input name="budgetParent" [(ngModel)]="budgetForm.parent_category" placeholder="Services, cérémonie…"></label>
              <label>Événement associé<select name="budgetEvent" [(ngModel)]="budgetForm.event_id"><option value="">Aucun événement</option><option *ngFor="let event of events" [value]="event.id">{{ event.name }}</option></select></label>
              <label>Budget prévu (DT)<input name="budgetPlanned" [(ngModel)]="budgetForm.planned_budget" inputmode="decimal" placeholder="0.000"></label>
              <label>Coût estimé (DT)<input name="budgetEstimated" [(ngModel)]="budgetForm.estimated_cost" inputmode="decimal" placeholder="0.000"></label>
              <label>Prix confirmé (DT)<input name="budgetConfirmed" [(ngModel)]="budgetForm.confirmed_price" inputmode="decimal" placeholder="0.000"></label>
              <label>Coût final réel (DT)<input name="budgetActual" [(ngModel)]="budgetForm.actual_cost" inputmode="decimal" placeholder="0.000"></label>
              <label>Montant réservé (DT)<input name="budgetReserved" [(ngModel)]="budgetForm.reserved_amount" inputmode="decimal" placeholder="0.000"></label>
              <label>Notes<textarea name="budgetNotes" [(ngModel)]="budgetForm.notes" rows="2"></textarea></label>
              <button class="button primary" [disabled]="saving" type="submit">Ajouter au budget</button>
            </form>
          </article>
        </section>

        <section *ngIf="activeTab === 'events'" class="tab-content two-columns">
          <article class="panel">
            <p class="eyebrow">Votre programme</p><h2>Événements sélectionnés</h2>
            <p class="empty" *ngIf="!events.length">Aucun événement pour le moment.</p>
            <div class="event-card" *ngFor="let event of events">
              <div><strong>{{ event.name }}</strong><span>{{ event.event_date || 'Date à définir' }}<ng-container *ngIf="event.location"> · {{ event.location }}</ng-container></span><small>{{ event.guest_count ?? '—' }} invités · estimé {{ event.estimated_budget | number:'1.3-3':'fr-TN' }} DT</small></div>
              <div class="item-actions"><button class="link-button" type="button" (click)="editEvent(event)">Modifier</button><button class="link-button danger-text" type="button" (click)="deleteEvent(event)">Supprimer</button></div>
            </div>
          </article>
          <article class="panel">
            <p class="eyebrow">{{ editingEventId ? 'Modification' : 'Personnalisé' }}</p><h2>{{ editingEventId ? 'Modifier l’événement' : 'Ajouter un événement' }}</h2>
            <form class="stack-form" (ngSubmit)="saveEvent()">
              <label>Nom<input name="eventName" [(ngModel)]="eventForm.name" required></label>
              <label>Type<input name="eventType" [(ngModel)]="eventForm.event_type" placeholder="henna, réception…"></label>
              <label>Date<input name="eventDate" [(ngModel)]="eventForm.event_date" type="date"></label>
              <label>Lieu<input name="eventLocation" [(ngModel)]="eventForm.location"></label>
              <label>Nombre d’invités<input name="eventGuestCount" [(ngModel)]="eventForm.guest_count" type="number" min="0"></label>
              <label>Budget estimé (DT)<input name="eventEstimated" [(ngModel)]="eventForm.estimated_budget" inputmode="decimal"></label>
              <label>Budget réel (DT)<input name="eventActual" [(ngModel)]="eventForm.actual_budget" inputmode="decimal"></label>
              <label>Notes<textarea name="eventNotes" [(ngModel)]="eventForm.notes" rows="2"></textarea></label>
              <button class="button primary" type="submit" [disabled]="saving">{{ editingEventId ? 'Enregistrer' : 'Ajouter l’événement' }}</button>
              <button *ngIf="editingEventId" class="button ghost" type="button" (click)="cancelEventEdit()">Annuler</button>
            </form>
          </article>
        </section>

        <section *ngIf="activeTab === 'purchases'" class="tab-content">
          <div class="panel toolbar">
            <label>Rechercher<input name="purchaseSearch" [(ngModel)]="purchaseFilters.search" (ngModelChange)="loadPurchases()" placeholder="Nom de l’achat"></label>
            <label>État<select name="purchaseStatus" [(ngModel)]="purchaseFilters.status" (ngModelChange)="loadPurchases()"><option value="">Tous</option><option value="not_started">Non commencé</option><option value="to_purchase">À acheter</option><option value="comparing">Comparaison</option><option value="reserved">Réservé</option><option value="partially_paid">Partiellement payé</option><option value="purchased">Acheté</option><option value="delivered">Livré</option><option value="cancelled">Annulé</option></select></label>
            <label>Trier<select name="purchaseSort" [(ngModel)]="purchaseFilters.sort_by" (ngModelChange)="loadPurchases()"><option value="name">Nom</option><option value="purchase_date">Date d’achat</option><option value="estimated_unit_price">Prix estimé</option><option value="status">État</option></select></label>
            <button class="button soft" type="button" (click)="exportPurchases()">Exporter CSV / Excel</button>
            <button class="button ghost" type="button" (click)="printPage()">Imprimer / PDF</button>
          </div>
          <article class="panel">
            <div class="panel-heading"><div><p class="eyebrow">Achats par pièce et catégorie</p><h2>Liste d’achats</h2></div><button class="button soft" type="button" [disabled]="!selectedPurchaseIds.length || saving" (click)="markSelectedPurchased()">Marquer les sélections achetées ({{ selectedPurchaseIds.length }})</button></div>
            <p class="empty" *ngIf="!purchases.length">Aucun achat ne correspond à la liste ou aux filtres.</p>
            <div class="purchase-row" *ngFor="let item of purchases">
              <input type="checkbox" [checked]="selectedPurchaseIds.includes(item.id)" (change)="togglePurchaseSelection(item.id, $any($event.target).checked)" [attr.aria-label]="'Sélectionner ' + item.name">
              <div class="purchase-name"><strong>{{ item.name }}</strong><small>{{ item.room || 'Sans pièce' }} · {{ item.category }} · Qté {{ item.quantity }}</small></div>
              <span class="status-pill">{{ purchaseStatusLabel(item.status) }}</span>
              <span class="money">{{ item.estimated_unit_price | number:'1.3-3':'fr-TN' }} DT</span>
              <button class="link-button danger-text" type="button" (click)="deletePurchase(item)">Supprimer</button>
            </div>
            <form class="form-separator" (ngSubmit)="addPurchase()">
              <h3>Ajouter un achat</h3>
              <div class="form-grid compact">
                <label>Nom *<input name="purchaseName" [(ngModel)]="purchaseForm.name" required></label>
                <label>Pièce / liste<input name="purchaseRoom" [(ngModel)]="purchaseForm.room" placeholder="Cuisine"></label>
                <label>Catégorie<input name="purchaseCategory" [(ngModel)]="purchaseForm.category" placeholder="Équipement"></label>
                <label>Quantité<input name="purchaseQuantity" [(ngModel)]="purchaseForm.quantity"></label>
                <label>Prix estimé / unité (DT)<input name="purchaseEstimate" [(ngModel)]="purchaseForm.estimated_unit_price" inputmode="decimal"></label>
                <label>Fournisseur<input name="purchaseSupplier" [(ngModel)]="purchaseForm.supplier"></label>
                <label>Date d’achat<input name="purchaseDate" [(ngModel)]="purchaseForm.purchase_date" type="date"></label>
              </div>
              <button class="button primary" type="submit" [disabled]="saving">Ajouter à la liste</button>
            </form>
          </article>
        </section>

        <section *ngIf="activeTab === 'payments'" class="tab-content two-columns">
          <article class="panel">
            <p class="eyebrow">Échéances</p><h2>Calendrier des paiements</h2>
            <label class="compact-label">Filtrer par mois<input name="paymentMonth" [(ngModel)]="paymentMonth" type="month" (ngModelChange)="loadPayments()"></label>
            <p class="empty" *ngIf="!payments.length">Aucun paiement programmé.</p>
            <div class="payment-row" *ngFor="let payment of payments">
              <div><strong>{{ payment.description }}</strong><small>{{ payment.due_date || 'Sans échéance' }} · {{ payment.payment_method || 'Mode à définir' }}</small><span class="status-pill" [class.overdue]="payment.status === 'overdue'">{{ paymentStatusLabel(payment.status) }}</span></div>
              <div class="payment-values"><strong>{{ payment.amount_paid | number:'1.3-3':'fr-TN' }} / {{ payment.amount_due | number:'1.3-3':'fr-TN' }} DT</strong><small>Reste {{ payment.remaining_amount | number:'1.3-3':'fr-TN' }} DT</small></div>
              <button *ngIf="payment.status !== 'paid' && payment.status !== 'cancelled'" class="link-button" type="button" (click)="markPaymentPaid(payment)">Régler</button>
              <button *ngIf="payment.status !== 'cancelled'" class="link-button danger-text" type="button" (click)="cancelPayment(payment)">Annuler</button>
            </div>
          </article>
          <article class="panel">
            <p class="eyebrow">Acompte ou échéance</p><h2>Programmer un paiement</h2>
            <form class="stack-form" (ngSubmit)="addPayment()">
              <label>Description<input name="paymentDescription" [(ngModel)]="paymentForm.description" required></label>
              <label>À rattacher à<select name="paymentTargetType" [(ngModel)]="paymentTargetType"><option value="budget">Poste budgétaire</option><option value="provider">Prestataire</option><option value="purchase">Achat</option></select></label>
              <label *ngIf="paymentTargetType === 'budget'">Poste<select name="paymentBudget" [(ngModel)]="paymentForm.budget_category_id" required><option value="">Choisir un poste</option><option *ngFor="let item of budgetItems" [value]="item.id">{{ item.name }}</option></select></label>
              <label *ngIf="paymentTargetType === 'provider'">Prestataire<select name="paymentProvider" [(ngModel)]="paymentForm.provider_id" required><option value="">Choisir</option><option *ngFor="let provider of providers" [value]="provider.id">{{ provider.name }}</option></select></label>
              <label *ngIf="paymentTargetType === 'purchase'">Achat<select name="paymentPurchase" [(ngModel)]="paymentForm.shopping_item_id" required><option value="">Choisir</option><option *ngFor="let item of purchases" [value]="item.id">{{ item.name }}</option></select></label>
              <label>Événement associé<select name="paymentEvent" [(ngModel)]="paymentForm.event_id"><option value="">Aucun</option><option *ngFor="let event of events" [value]="event.id">{{ event.name }}</option></select></label>
              <label>Montant de l’échéance (DT)<input name="paymentDue" [(ngModel)]="paymentForm.amount_due" inputmode="decimal" required></label>
              <label>Déjà payé (DT)<input name="paymentPaid" [(ngModel)]="paymentForm.amount_paid" inputmode="decimal"></label>
              <label>Date d’échéance<input name="paymentDate" [(ngModel)]="paymentForm.due_date" type="date"></label>
              <label>Mode de paiement<input name="paymentMethod" [(ngModel)]="paymentForm.payment_method" placeholder="Espèces, virement…"></label>
              <button class="button primary" type="submit" [disabled]="saving">Enregistrer l’échéance</button>
            </form>
          </article>
        </section>

        <section *ngIf="activeTab === 'providers'" class="tab-content two-columns">
          <article class="panel">
            <p class="eyebrow">Comparaison sans avis publics</p><h2>Prestataires et devis</h2>
            <p class="empty" *ngIf="!providers.length">Ajoutez des prestataires pour comparer les offres.</p>
            <div class="provider-card" *ngFor="let provider of providers">
              <div><strong>{{ provider.name }}</strong><small>{{ provider.service_category }} · {{ provider.governorate || 'Gouvernorat non défini' }}</small><small>{{ provider.phone || '' }} {{ provider.email || '' }}</small></div>
              <div class="provider-money"><span>Accord {{ provider.agreed_price | number:'1.3-3':'fr-TN' }} DT</span><span>Payé {{ provider.amount_paid | number:'1.3-3':'fr-TN' }} DT</span><b>Reste {{ provider.remaining_balance | number:'1.3-3':'fr-TN' }} DT</b></div>
              <span class="status-pill">{{ provider.contract_status }}</span>
              <div class="quote-list"><span *ngFor="let quote of provider.quotes">{{ quote.quoted_price | number:'1.3-3':'fr-TN' }} DT <small>{{ quote.quote_date || '' }}</small></span></div>
              <div class="inline-add">
                <input [name]="'quote' + provider.id" [(ngModel)]="quoteInputs[provider.id]" inputmode="decimal" placeholder="Nouveau devis (DT)">
                <button class="link-button" type="button" (click)="addQuote(provider)">Comparer le devis</button>
              </div>
              <button class="link-button" type="button" (click)="confirmProvider(provider)">Enregistrer le contrat</button>
            </div>
          </article>
          <article class="panel">
            <p class="eyebrow">Fournisseurs locaux</p><h2>Ajouter un prestataire</h2>
            <form class="stack-form" (ngSubmit)="addProvider()">
              <label>Nom *<input name="providerName" [(ngModel)]="providerForm.name" required></label>
              <label>Service<select name="providerCategory" [(ngModel)]="providerForm.service_category"><option *ngFor="let kind of providerTypes" [value]="kind">{{ kind }}</option></select></label>
              <label>Téléphone<input name="providerPhone" [(ngModel)]="providerForm.phone"></label>
              <label>E-mail<input name="providerEmail" [(ngModel)]="providerForm.email" type="email"></label>
              <label>Adresse<input name="providerAddress" [(ngModel)]="providerForm.address"></label>
              <label>Gouvernorat<input name="providerGovernorate" [(ngModel)]="providerForm.governorate"></label>
              <label>Prix convenu (DT)<input name="providerPrice" [(ngModel)]="providerForm.agreed_price" inputmode="decimal"></label>
              <label>Acompte (DT)<input name="providerDeposit" [(ngModel)]="providerForm.deposit" inputmode="decimal"></label>
              <label>Date de réservation<input name="providerBooking" [(ngModel)]="providerForm.booking_date" type="date"></label>
              <label>Date de prestation<input name="providerServiceDate" [(ngModel)]="providerForm.service_date" type="date"></label>
              <label>Notes<textarea name="providerNotes" [(ngModel)]="providerForm.notes" rows="2"></textarea></label>
              <button class="button primary" type="submit" [disabled]="saving">Ajouter le prestataire</button>
            </form>
          </article>
        </section>

        <section *ngIf="activeTab === 'tasks'" class="tab-content two-columns">
          <article class="panel">
            <p class="eyebrow">Liste de préparation modifiable</p><h2>Tâches</h2>
            <p class="empty" *ngIf="!tasks.length">Aucune tâche. Les jalons suggérés sont créés si une date de mariage est définie.</p>
            <div class="task-row" *ngFor="let task of tasks">
              <input type="checkbox" [checked]="task.status === 'completed'" (change)="toggleTask(task, $any($event.target).checked)" [attr.aria-label]="'Terminer ' + task.title">
              <div class="task-copy"><strong [class.struck]="task.status === 'completed'">{{ task.title }}</strong><small>{{ task.due_date || 'Sans échéance' }} · {{ task.suggested ? 'Suggestion modifiable' : 'Personnelle' }}</small></div>
              <select [name]="'taskStatus' + task.id" [ngModel]="task.status" (ngModelChange)="setTaskStatus(task, $event)"><option value="pending">À faire</option><option value="in_progress">En cours</option><option value="completed">Terminée</option><option value="cancelled">Annulée</option></select>
              <button class="link-button danger-text" type="button" (click)="deleteTask(task)">×</button>
            </div>
          </article>
          <article class="panel">
            <p class="eyebrow">Personnalisé</p><h2>Ajouter une tâche</h2>
            <form class="stack-form" (ngSubmit)="addTask()">
              <label>Titre<input name="taskTitle" [(ngModel)]="taskForm.title" required></label>
              <label>Description<textarea name="taskDescription" [(ngModel)]="taskForm.description" rows="2"></textarea></label>
              <label>Date limite<input name="taskDate" [(ngModel)]="taskForm.due_date" type="date"></label>
              <label>Priorité<select name="taskPriority" [(ngModel)]="taskForm.priority"><option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option></select></label>
              <label>Événement<select name="taskEvent" [(ngModel)]="taskForm.event_id"><option value="">Aucun</option><option *ngFor="let event of events" [value]="event.id">{{ event.name }}</option></select></label>
              <button class="button primary" type="submit" [disabled]="saving">Ajouter la tâche</button>
            </form>
          </article>
        </section>

        <section *ngIf="activeTab === 'guests'" class="tab-content two-columns">
          <article class="panel">
            <p class="eyebrow">Gestion facultative</p><h2>Invités</h2>
            <div class="guest-summary"><span>{{ guests?.summary?.total_people || 0 }} personnes</span><span>{{ guests?.summary?.confirmed_people || 0 }} confirmées</span><span>{{ guests?.summary?.pending_records || 0 }} en attente</span><span>{{ guests?.summary?.declined_people || 0 }} déclinées</span></div>
            <p class="empty" *ngIf="!guests?.guests?.length">Aucun invité ajouté.</p>
            <div class="guest-row" *ngFor="let guest of guests?.guests">
              <div><strong>{{ guest.name }}</strong><small>{{ guest.relationship }} · {{ guest.partner_association || 'Association non précisée' }} · +{{ guest.accompanying_guests }}</small></div>
              <select [name]="'rsvp' + guest.id" [ngModel]="guest.attendance_status" (ngModelChange)="updateGuestAttendance(guest, $event)"><option value="pending">En attente</option><option value="confirmed">Confirmé</option><option value="declined">Décliné</option></select>
              <select [name]="'guestTable' + guest.id" [ngModel]="guest.table_id || ''" (ngModelChange)="assignGuestTable(guest, $event)"><option value="">Sans table</option><option *ngFor="let table of guests?.tables" [value]="table.id">{{ table.name }}</option></select>
              <button class="link-button danger-text" type="button" (click)="deleteGuest(guest.id)">Supprimer</button>
            </div>
            <h3 class="subsection-title">Tables</h3>
            <div class="table-pills" *ngFor="let table of guests?.tables"><span>{{ table.name }} · {{ table.assigned_people }}<ng-container *ngIf="table.capacity"> / {{ table.capacity }}</ng-container></span></div>
            <form class="inline-add" (ngSubmit)="addGuestTable()"><input name="tableName" [(ngModel)]="tableForm.name" placeholder="Nom d’une table" required><input name="tableCapacity" [(ngModel)]="tableForm.capacity" type="number" min="1" placeholder="Places"><button class="button soft" type="submit">Ajouter la table</button></form>
          </article>
          <article class="panel">
            <p class="eyebrow">Données minimales</p><h2>Ajouter un invité</h2>
            <form class="stack-form" (ngSubmit)="addGuest()">
              <label>Nom *<input name="guestName" [(ngModel)]="guestForm.name" required></label>
              <label>Relation<select name="guestRelationship" [(ngModel)]="guestForm.relationship"><option value="family">Famille</option><option value="friend">Ami(e)</option><option value="colleague">Collègue</option><option value="other">Autre</option></select></label>
              <label>Associé à<select name="guestPartner" [(ngModel)]="guestForm.partner_association"><option value="">Non précisé</option><option value="partner_one">Partenaire 1</option><option value="partner_two">Partenaire 2</option><option value="both">Les deux</option><option value="other">Autre</option></select></label>
              <label>Téléphone (facultatif)<input name="guestPhone" [(ngModel)]="guestForm.phone"></label>
              <label>Accompagnants<input name="guestPlusOnes" [(ngModel)]="guestForm.accompanying_guests" type="number" min="0" max="20"></label>
              <label>Table<select name="guestTable" [(ngModel)]="guestForm.table_id"><option value="">Aucune</option><option *ngFor="let table of guests?.tables" [value]="table.id">{{ table.name }}</option></select></label>
              <label>Invitation<select name="guestInvitation" [(ngModel)]="guestForm.invitation_status"><option value="pending">À envoyer</option><option value="sent">Envoyée</option><option value="declined">Déclinée</option></select></label>
              <label>Notes<textarea name="guestNotes" [(ngModel)]="guestForm.notes" rows="2"></textarea></label>
              <button class="button primary" type="submit" [disabled]="saving">Ajouter l’invité</button>
            </form>
          </article>
        </section>

        <section *ngIf="activeTab === 'savings'" class="tab-content two-columns">
          <article class="panel">
            <p class="eyebrow">Projection, pas garantie</p><h2>Scénarios d’épargne</h2>
            <p class="empty" *ngIf="!forecast">Enregistrez le plan pour calculer les scénarios.</p>
            <ng-container *ngIf="forecast">
              <p>{{ forecast.months_remaining }} mois avant le mariage · coût projeté {{ forecast.projected_wedding_cost | number:'1.3-3':'fr-TN' }} DT.</p>
              <div class="scenario"><strong>Prudent</strong><span>Ressources {{ forecast.conservative.projected_resources | number:'1.3-3':'fr-TN' }} DT</span><span>Écart {{ forecast.conservative.financial_gap | number:'1.3-3':'fr-TN' }} DT</span><span>Épargne additionnelle requise / mois {{ forecast.conservative.required_additional_monthly_savings | number:'1.3-3':'fr-TN' }} DT</span><small>{{ forecast.conservative.assumptions }}</small></div>
              <div class="scenario optimistic"><strong>Optimiste · non garanti</strong><span>Ressources {{ forecast.optimistic.projected_resources | number:'1.3-3':'fr-TN' }} DT</span><span>Écart {{ forecast.optimistic.financial_gap | number:'1.3-3':'fr-TN' }} DT</span><small>{{ forecast.optimistic.assumptions }}</small></div>
            </ng-container>
            <h3 class="subsection-title">Contributions prévues</h3>
            <p class="empty" *ngIf="!contributions.length">Aucune contribution prévue.</p>
            <div class="contribution-row" *ngFor="let contribution of contributions"><span>{{ contribution.source }} · {{ contribution.confirmed ? 'confirmée' : 'non confirmée' }}</span><b>{{ contribution.amount | number:'1.3-3':'fr-TN' }} DT</b></div>
          </article>
          <article class="panel">
            <p class="eyebrow">Plan financier</p><h2>Épargne mensuelle</h2>
            <form class="stack-form" (ngSubmit)="saveSavingsPlan()">
              <label>Épargne actuelle (DT)<input name="planCurrent" [(ngModel)]="savingsForm.current_savings" inputmode="decimal"></label>
              <label>Partenaire 1 / mois (DT)<input name="planPartner1" [(ngModel)]="savingsForm.monthly_partner_one" inputmode="decimal"></label>
              <label>Partenaire 2 / mois (DT)<input name="planPartner2" [(ngModel)]="savingsForm.monthly_partner_two" inputmode="decimal"></label>
              <label>Contributions familiales prévues (DT)<input name="planFamily" [(ngModel)]="savingsForm.expected_family_contributions" inputmode="decimal"></label>
              <label>Autres revenus prévus (DT)<input name="planOther" [(ngModel)]="savingsForm.expected_other_income" inputmode="decimal"></label>
              <label class="choice"><input name="includeGifts" [(ngModel)]="savingsForm.include_gifts" type="checkbox"><span>Inclure les cadeaux uniquement au scénario optimiste</span></label>
              <button class="button primary" type="submit" [disabled]="saving">Enregistrer et recalculer</button>
            </form>
            <form class="form-separator" (ngSubmit)="addContribution()">
              <h3>Ajouter une aide ou contribution</h3>
              <div class="form-grid compact"><label>Source<input name="contributionSource" [(ngModel)]="contributionForm.source" required></label><label>Montant (DT)<input name="contributionAmount" [(ngModel)]="contributionForm.amount" inputmode="decimal"></label><label>Date prévue<input name="contributionDate" [(ngModel)]="contributionForm.expected_date" type="date"></label><label class="choice"><input name="contributionConfirmed" [(ngModel)]="contributionForm.confirmed" type="checkbox"><span>Confirmée</span></label></div>
              <button class="button soft" type="submit" [disabled]="saving">Ajouter la contribution</button>
            </form>
          </article>
        </section>

        <section *ngIf="activeTab === 'calendar'" class="tab-content">
          <article class="panel">
            <div class="panel-heading"><div><p class="eyebrow">Événements · échéances · tâches · achats</p><h2>Calendrier</h2></div>
              <div class="view-switch"><button type="button" [class.active]="calendarView === 'agenda'" (click)="setCalendarView('agenda')">Agenda</button><button type="button" [class.active]="calendarView === 'week'" (click)="setCalendarView('week')">Semaine</button><button type="button" [class.active]="calendarView === 'month'" (click)="setCalendarView('month')">Mois</button></div>
            </div>
            <div class="inline-add calendar-range"><label>Du<input name="calendarStart" [(ngModel)]="calendarStart" type="date"></label><label>Au<input name="calendarEnd" [(ngModel)]="calendarEnd" type="date"></label><button class="button soft" type="button" (click)="loadCalendar()">Afficher</button></div>
            <p class="empty" *ngIf="!calendarEntries.length">Rien de programmé sur cette période.</p>
            <div class="calendar-row" *ngFor="let entry of calendarEntries"><span class="calendar-type" [attr.data-type]="entry.type">{{ calendarTypeLabel(entry.type) }}</span><strong>{{ entry.title }}</strong><time>{{ entry.date }}</time><span class="status-pill">{{ entry.status }}</span><button *ngIf="entry.type === 'event'" class="link-button" type="button" (click)="editCalendarEvent(entry.id)">Modifier</button></div>
          </article>
        </section>

        <section *ngIf="activeTab === 'sharing'" class="tab-content two-columns">
          <article class="panel"><p class="eyebrow">Espace partagé</p><h2>Partenaires</h2>
            <p class="notice">Un collaborateur doit d’abord créer un compte SmartLife avec l’adresse invitée.</p>
            <div class="member-row" *ngFor="let member of members"><div><strong>{{ member.name }}</strong><small>{{ member.email }}</small></div><span class="status-pill">{{ member.role }}</span><button *ngIf="member.id" class="link-button danger-text" type="button" (click)="removeMember(member.id)">Retirer</button></div>
          </article>
          <article class="panel"><p class="eyebrow">Accès existants</p><h2>Inviter un membre</h2>
            <form class="stack-form" (ngSubmit)="inviteMember()"><label>E-mail du compte<input name="memberEmail" [(ngModel)]="memberForm.email" type="email" required></label><label>Rôle<select name="memberRole" [(ngModel)]="memberForm.role"><option value="EDITOR">Éditeur</option><option value="VIEWER">Lecture seule</option></select></label><button class="button primary" type="submit" [disabled]="saving">Partager l’espace</button></form>
            <h3 class="subsection-title">Activité récente</h3><div class="activity-row" *ngFor="let log of activity"><span>{{ log.summary }}</span><time>{{ log.created_at | date:'short' }}</time></div>
          </article>
        </section>
      </ng-container>
    </main>
  `,
  styles: [`
    :host { display:block; color:#172033; }
    .page { min-height:100vh; max-width:1480px; margin:auto; padding:clamp(1rem,3.8vw,3rem); background:#f6f7fb; }
    .page-heading,.panel-heading,.wizard-heading,.wizard-actions { display:flex; justify-content:space-between; align-items:center; gap:1rem; }
    h1,h2,h3,h4 { margin:0; letter-spacing:-.035em; } h1 { font-size:clamp(1.9rem,3vw,2.5rem); } h2 { font-size:1.2rem; } h3 { font-size:1.02rem; } h4 { margin:1.2rem 0 .7rem; }
    .eyebrow { color:#7c3aed; text-transform:uppercase; font-size:.72rem; font-weight:800; letter-spacing:.12em; margin:0 0 .35rem; }
    .subtitle { color:#64748b; margin:.4rem 0 0; }.panel,.wizard { background:#fff; border:1px solid #e8ebf2; border-radius:17px; box-shadow:0 8px 26px rgba(15,23,42,.045); padding:1.25rem; }
    .notice { color:#475569; }.notice.error { color:#b91c1c; }.success { color:#047857; }
    .planner-nav { display:flex; gap:.45rem; overflow-x:auto; padding:.5rem 0 1rem; }
    .planner-nav button,.view-switch button { white-space:nowrap; border:0; background:transparent; color:#526078; font:inherit; font-weight:700; padding:.68rem .82rem; border-radius:9px; cursor:pointer; }
    .planner-nav button.active,.planner-nav button:hover,.view-switch button.active { background:#ede9fe; color:#5b21b6; }
    .filter-bar { display:flex; align-items:end; gap:.8rem; margin-bottom:1.2rem; flex-wrap:wrap; }.filter-bar label { min-width:155px; flex:1; }
    .tab-content { display:grid; gap:1.1rem; }.two-columns { grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr); align-items:start; }
    .metrics-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.85rem; margin-bottom:1.1rem; }
    .metric-card { background:#fff; border:1px solid #e8ebf2; border-radius:14px; padding:1rem; display:grid; gap:.4rem; box-shadow:0 6px 18px rgba(15,23,42,.03); }
    .metric-card span { color:#64748b; font-size:.83rem; }.metric-card strong { font-size:1.14rem; letter-spacing:-.025em; }
    .dashboard-grid { display:grid; grid-template-columns:1.1fr .9fr; gap:1.1rem; }.dashboard-grid .important-dates { grid-column:1/-1; }
    .panel-heading { margin-bottom:1rem; }.panel-heading .eyebrow { margin-bottom:.2rem; }
    .empty { color:#64748b; padding:.4rem 0; }.budget-chart-row { margin:1rem 0; }.chart-label { display:flex; justify-content:space-between; gap:.8rem; margin-bottom:.38rem; }.chart-label small { color:#64748b; }
    .bar,.step-track { height:8px; background:#edf0f6; border-radius:99px; overflow:hidden; }.bar span,.step-track span { display:block; height:100%; background:linear-gradient(90deg,#7c3aed,#a78bfa); border-radius:inherit; }
    .payment-progress { display:flex; justify-content:space-between; gap:1rem; color:#64748b; border-top:1px solid #eef0f4; padding-top:.9rem; margin-top:1.2rem; font-size:.88rem; }
    .progress-list { display:grid; grid-template-columns:1fr 1fr; gap:.2rem 1rem; margin-top:.8rem; }.progress-list div,.date-row { display:flex; justify-content:space-between; gap:1rem; padding:.68rem 0; border-bottom:1px solid #eef0f4; }.progress-list span,.date-row span { color:#64748b; }.date-row strong { text-align:right; }
    .budget-item,.event-card,.provider-card,.scenario { border-top:1px solid #eef0f4; padding:1rem 0; }.item-main { display:flex; justify-content:space-between; align-items:center; }.item-main small { color:#64748b; }.toggle { display:flex; align-items:center; gap:.55rem; font-weight:750; }
    .amount-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:.5rem; margin:.7rem 0; font-size:.82rem; }.amount-grid span { display:grid; color:#64748b; }.amount-grid b { color:#172033; font-weight:700; }
    .item-actions { display:flex; gap:.8rem; }.link-button { padding:.3rem .1rem; background:transparent; border:0; color:#6d28d9; font:inherit; font-size:.86rem; font-weight:700; cursor:pointer; }.danger-text { color:#b91c1c; }
    .edit-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:.7rem; margin-top:.8rem; padding:.8rem; background:#faf9ff; border-radius:10px; }
    .stack-form { display:grid; gap:.75rem; margin-top:1rem; }.form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.8rem; margin-top:1rem; }.form-grid.compact { margin:.6rem 0; }
    label { display:grid; gap:.35rem; color:#475569; font-size:.83rem; font-weight:650; }.compact-label { max-width:280px; margin:.8rem 0; }
    input,select,textarea { width:100%; min-width:0; padding:.68rem .75rem; border:1px solid #dbe1ea; border-radius:9px; color:#172033; background:white; outline:none; font:inherit; font-size:.9rem; }
    input:focus,select:focus,textarea:focus { border-color:#8b5cf6; box-shadow:0 0 0 3px #ede9fe; }.choice input,.toggle input,.task-row>input,.purchase-row>input { width:auto; }
    .button { border:0; border-radius:9px; padding:.7rem .95rem; font:inherit; font-weight:750; cursor:pointer; white-space:nowrap; }    .button.primary { color:#fff; background:#6d28d9; }.button.soft { background:#f3e8ff; color:#5b21b6; }.button.ghost { background:#f1f5f9; color:#334155; }.button:disabled { opacity:.55; cursor:wait; }.small-button { padding:.5rem .7rem; font-size:.82rem; }
    .event-card,.provider-card { display:grid; grid-template-columns:1fr auto; gap:.55rem; }.event-card>div:first-child,.provider-card>div:first-child { display:grid; gap:.25rem; }.event-card span,.event-card small,.provider-card small { color:#64748b; }
    .toolbar { display:flex; align-items:end; flex-wrap:wrap; gap:.8rem; margin-bottom:1rem; }.toolbar label { min-width:150px; flex:1; }
    .purchase-row,.payment-row,.task-row,.guest-row,.member-row,.calendar-row,.activity-row,.contribution-row { display:flex; align-items:center; gap:.8rem; border-top:1px solid #eef0f4; padding:.75rem 0; }
    .purchase-name,.task-copy,.member-row>div { display:grid; flex:1; gap:.2rem; }.purchase-name small,.task-copy small,.member-row small { color:#64748b; }.money { white-space:nowrap; }.status-pill,.calendar-type { background:#f1f5f9; color:#475569; border-radius:99px; padding:.25rem .55rem; font-size:.75rem; font-weight:700; white-space:nowrap; }.status-pill.overdue { background:#fee2e2; color:#b91c1c; }
    .form-separator { border-top:1px solid #eef0f4; margin-top:1rem; padding-top:1rem; }.form-separator h3 { margin-bottom:.6rem; }.payment-row>div:first-child { flex:1; display:grid; gap:.25rem; }.payment-row small { color:#64748b; }.payment-values { display:grid; text-align:right; white-space:nowrap; }
    .provider-money { display:grid; gap:.2rem; color:#475569; font-size:.84rem; }.provider-money b { color:#172033; }.quote-list { display:flex; flex-wrap:wrap; gap:.6rem; grid-column:1/-1; }.quote-list>span { background:#f8fafc; border-radius:8px; padding:.4rem .55rem; }
    .task-row select,.guest-row select { width:auto; }.struck { text-decoration:line-through; color:#94a3b8; }.guest-summary { display:flex; flex-wrap:wrap; gap:.6rem; margin:1rem 0; }.guest-summary span,.table-pills span { background:#f5f3ff; border-radius:99px; padding:.38rem .7rem; color:#5b21b6; font-size:.82rem; font-weight:700; }
    .subsection-title { margin-top:1.3rem; }.inline-add { display:flex; gap:.55rem; align-items:end; margin-top:.75rem; }.inline-add input { flex:1; }.table-pills { margin:.45rem 0; }
    .scenario { display:grid; gap:.4rem; }.scenario small { color:#64748b; line-height:1.5; }.scenario.optimistic { background:#faf9ff; border:0; border-radius:10px; padding:1rem; }
    .view-switch { display:flex; background:#f8fafc; border-radius:10px; }.view-switch button { padding:.5rem .65rem; }.calendar-range { align-items:end; margin-bottom:.8rem; }.calendar-range label { min-width:150px; }    .calendar-row { flex-wrap:wrap; }.calendar-row strong { flex:1; }.calendar-row time { color:#64748b; }.calendar-type[data-type="task"] { background:#eff6ff; color:#1d4ed8; }
    .member-row>div { min-width:0; }.activity-row { justify-content:space-between; font-size:.84rem; }.activity-row time { color:#64748b; white-space:nowrap; }.wizard { max-width:1040px; margin:1rem auto; padding:clamp(1rem,3vw,2rem); }.step-count { color:#64748b; font-weight:700; white-space:nowrap; }.step-track { margin:1rem 0; }.step-nav { display:flex; gap:.3rem; overflow:auto; padding-bottom:.8rem; border-bottom:1px solid #eef0f4; }.step-nav button { border:0; border-radius:8px; background:transparent; color:#64748b; font:inherit; font-size:.78rem; font-weight:700; white-space:nowrap; padding:.5rem; cursor:pointer; }.step-nav button.current { background:#ede9fe; color:#5b21b6; }.step-nav button.past { color:#047857; }.wizard-content { min-height:290px; padding:1.25rem 0; }.wizard-content>p { color:#64748b; margin:.4rem 0 1rem; }.wizard-actions { border-top:1px solid #eef0f4; padding-top:1rem; }.step-hint { color:#64748b; font-size:.8rem; text-align:center; }
    .choice-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.5rem; margin:.7rem 0; }.choice { display:flex; align-items:center; gap:.55rem; padding:.7rem; border:1px solid #e8ebf2; border-radius:9px; color:#334155; font-size:.88rem; }.wide-label { margin-top:1rem; }.compact-label select { width:100%; }.suggestion-note { padding:.75rem; border-radius:9px; color:#6b4f00; background:#fffbeb; margin-top:.8rem; }.event-editor { border-top:1px solid #eef0f4; margin-top:1rem; padding-top:.8rem; }.event-editor-title { display:flex; justify-content:space-between; align-items:center; }.review-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:.7rem; margin:1rem 0; }.review-grid article { display:grid; gap:.3rem; background:#f8fafc; padding:.8rem; border-radius:10px; }.review-grid span { color:#64748b; font-size:.86rem; }.suggestion-group { border-top:1px solid #eef0f4; padding:.7rem 0; }.small-choice { font-size:.78rem; padding:.5rem; }.chip-list { display:flex; flex-wrap:wrap; gap:.4rem; margin-top:.7rem; }.chip { border:0; border-radius:99px; padding:.4rem .7rem; color:#5b21b6; background:#f3e8ff; cursor:pointer; }
    @media (max-width:980px) { .metrics-grid { grid-template-columns:repeat(2,1fr); }.dashboard-grid,.two-columns { grid-template-columns:1fr; }.dashboard-grid .important-dates { grid-column:auto; }.planner-nav { margin:0 -1rem; padding-left:1rem; padding-right:1rem; } }
    @media (max-width:640px) { .page-heading { align-items:flex-start; }.metrics-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }.filter-bar { align-items:stretch; }.filter-bar label { min-width:calc(50% - .5rem); }.form-grid,.edit-grid,.review-grid { grid-template-columns:1fr; }.choice-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }.step-nav button { padding:.45rem; }.step-hint { display:none; }.amount-grid { grid-template-columns:repeat(2,1fr); }.purchase-row,.payment-row,.guest-row,.task-row { align-items:flex-start; flex-wrap:wrap; }.payment-values { text-align:left; }.calendar-row strong { flex-basis:60%; }.panel-heading { align-items:flex-start; flex-wrap:wrap; }.payment-progress { flex-direction:column; }.inline-add { flex-wrap:wrap; }.inline-add>* { flex:1 1 100%; } }
    @media print { .planner-nav,.filter-bar,.button,.link-button,.wizard-actions,.toolbar { display:none!important; }.page { background:white; max-width:none; padding:0; }.panel,.metric-card { box-shadow:none; break-inside:avoid; } }
  `]
})
export class WeddingPageComponent implements OnInit {
  readonly tabs: { id: PlannerTab; label: string }[] = [
    { id: 'overview', label: 'Vue générale' }, { id: 'budget', label: 'Budget' },
    { id: 'events', label: 'Événements' }, { id: 'purchases', label: 'Achats' },
    { id: 'payments', label: 'Paiements' }, { id: 'providers', label: 'Prestataires' },
    { id: 'tasks', label: 'Tâches' }, { id: 'guests', label: 'Invités' },
    { id: 'savings', label: 'Épargne' }, { id: 'calendar', label: 'Calendrier' },
    { id: 'sharing', label: 'Partage' }
  ];
  readonly wizardLabels = ['Projet', 'Style', 'Région', 'Événements', 'Budget', 'Logement', 'Résumé'];
  readonly weddingStyles = ['Traditionnel tunisien', 'Moderne', 'Régional', 'Minimaliste', 'Luxe', 'Familial', 'Religieux', 'Personnalisé'];
  readonly regions = ['Sfax', 'Tunis', 'Sousse', 'Monastir', 'Mahdia', 'Djerba', 'Gabès', 'Kairouan', 'Autre'];
  readonly suggestedEvents = ['Fiançailles', 'Mlek', 'Henna', 'Zaza', 'Jelwa', 'Hjemtha', 'Dîner familial', 'Réception de mariage', 'Cérémonie civile', 'Cérémonie religieuse', 'Lune de miel'];
  readonly homeCategories = ['Rénovation', 'Cuisine', 'Salle de bain', 'Peinture', 'Meubles', 'Chambre', 'Salon', 'Salle à manger', 'Électroménager', 'Équipement de cuisine', 'Literie et linge'];
  readonly providerTypes = ['Salle de mariage', 'Photographe', 'Vidéaste', 'Traiteur', 'Musicien', 'DJ', 'Décorateur', 'Maquilleur', 'Coiffeur', 'Transport', 'Magasin de meubles', 'Électroménager', 'Autre'];
  readonly categorySuggestions: CategorySuggestion[] = [
    { group: 'Cérémonies et célébrations', names: ['Fiançailles', 'Mlek', 'Henna', 'Zaza', 'Jelwa', 'Hjemtha', 'Réception', 'Dîner familial', 'Cérémonie civile', 'Cérémonie religieuse', 'Musique traditionnelle', 'DJ', 'Orchestre'] },
    { group: 'Services', names: ['Salle', 'Traiteur', 'Photographe', 'Vidéaste', 'Décoration', 'Wedding planner', 'Maquillage', 'Coiffure', 'Transport', 'Sonorisation', 'Éclairage', 'Pâtisseries', 'Boissons', 'Serveurs', 'Sécurité'] },
    { group: 'Préparatifs', names: ['Robe de mariée', 'Tenues traditionnelles', 'Accessoires', 'Chaussures', 'Soins beauté', 'Bijoux', 'Syegha', 'Dbech', 'Costume', 'Montre', 'Trousseau'] },
    { group: 'Logement et voyage', names: ['Mobilier de chambre', 'Literie', 'Salon', 'Cuisine', 'Électroménager', 'Rénovation', 'Plomberie', 'Électricité', 'Transport lune de miel', 'Hôtel', 'Activités', 'Documents de voyage'] }
  ];

  loading = true;
  saving = false;
  needsOnboarding = false;
  error = '';
  success = '';
  activeTab: PlannerTab = 'overview';
  weddingRecord: Wedding | null = null;
  preferences: WeddingPreference | null = null;
  summary: WeddingDashboardSummary | null = null;
  events: WeddingEvent[] = [];
  budgetItems: WeddingBudgetLine[] = [];
  payments: WeddingPaymentRecord[] = [];
  tasks: WeddingTask[] = [];
  providers: WeddingProvider[] = [];
  guests: WeddingGuestsResponse | null = null;
  purchases: WeddingShoppingItem[] = [];
  forecast: SavingsForecast | null = null;
  contributions: { id: string; source: string; amount: string; confirmed: boolean; expected_date: string | null; notes: string | null }[] = [];
  members: { id: string | null; user_id: string; name: string; email: string; role: string }[] = [];
  activity: { id: string; summary: string; created_at: string }[] = [];
  calendarEntries: { id: string; type: string; title: string; date: string; status: string }[] = [];
  wizardStep = 1;
  customEventName = '';
  customCategoryName = '';
  editingBudgetId: string | null = null;
  editingEventId: string | null = null;
  dashboardFilters = { event_id: '', month: '', category_id: '' };
  purchaseFilters = { search: '', category: '', room: '', status: '', sort_by: 'name' };
  paymentMonth = '';
  paymentTargetType: 'budget' | 'provider' | 'purchase' = 'budget';
  selectedPurchaseIds: string[] = [];
  calendarView: 'agenda' | 'week' | 'month' = 'agenda';
  calendarStart = this.today();
  calendarEnd = this.offsetDate(30);
  quoteInputs: Record<string, string> = {};

  wizard = {
    project_name: '', partner_one_name: '', partner_two_name: '', wedding_date: '',
    engagement_date: '', city: '', governorate: '', venue: '', expected_guest_count: null as number | null,
    preferred_language: 'fr', wedding_styles: [] as string[], custom_style: '', region: '',
    events: [] as EventDraft[], total_budget: '0.000', current_savings: '0.000',
    partner_one_monthly_savings: '0.000', partner_two_monthly_savings: '0.000',
    family_contributions: '0.000', other_expected_income: '0.000', gifts_mode: 'excluded',
    include_home_preparation: false, home_categories: [] as string[], custom_categories: [] as string[]
  };
  budgetForm = this.emptyBudgetForm();
  budgetEdit = { name: '', planned_budget: '0.000', estimated_cost: '0.000', confirmed_price: '0.000', actual_cost: '0.000' };
  eventForm = this.emptyEventForm();
  purchaseForm = this.emptyPurchaseForm();
  paymentForm = { event_id: '', budget_category_id: '', provider_id: '', shopping_item_id: '', description: '', amount_due: '', amount_paid: '0.000', due_date: '', payment_date: '', payment_method: '' };
  providerForm = { name: '', service_category: 'Salle de mariage', phone: '', email: '', address: '', governorate: '', agreed_price: '0.000', deposit: '0.000', booking_date: '', service_date: '', notes: '' };
  taskForm = { event_id: '', title: '', description: '', due_date: '', priority: 'medium' as 'low' | 'medium' | 'high' };
  guestForm = { table_id: '', name: '', relationship: 'family', partner_association: '', phone: '', accompanying_guests: 0, invitation_status: 'pending', notes: '' };
  tableForm = { name: '', capacity: null as number | null };
  savingsForm = { current_savings: '0.000', monthly_partner_one: '0.000', monthly_partner_two: '0.000', expected_family_contributions: '0.000', expected_other_income: '0.000', include_gifts: false };
  contributionForm = { source: '', amount: '0.000', confirmed: false, expected_date: '', notes: '' };
  memberForm: { email: string; role: 'EDITOR' | 'VIEWER' } = { email: '', role: 'EDITOR' };

  constructor(private api: SmartLifeApiService) {}

  ngOnInit(): void {
    this.loadWorkspace();
  }

  loadWorkspace(): void {
    this.loading = true;
    this.error = '';
    this.api.getWeddings().subscribe({
      next: (weddings) => {
        this.weddingRecord = weddings[0] ?? null;
        if (!this.weddingRecord) {
          this.needsOnboarding = true;
          this.loading = false;
          return;
        }
        this.api.getWeddingPreferences().subscribe({
          next: (preferences) => {
            this.preferences = preferences;
            this.needsOnboarding = !preferences.onboarding_completed;
            this.loadPlannerData();
          },
          error: (error: HttpErrorResponse) => {
            if (error.status === 404) {
              this.needsOnboarding = true;
              this.wizard.project_name = this.weddingRecord?.name ?? '';
              this.wizard.total_budget = String(this.weddingRecord?.budget_total ?? '0.000');
              this.loading = false;
            } else {
              this.fail('Impossible de charger la configuration du mariage.');
            }
          }
        });
      },
      error: () => this.fail('Impossible de charger votre espace mariage.')
    });
  }

  loadPlannerData(): void {
    this.loading = true;
    const filters = {
      event_id: this.dashboardFilters.event_id || undefined,
      month: this.dashboardFilters.month || undefined,
      category_id: this.dashboardFilters.category_id || undefined
    };
    forkJoin({
      summary: this.api.getWeddingSummary(filters),
      events: this.api.getWeddingEvents(),
      budgets: this.api.getWeddingBudgetItems(),
      payments: this.api.getWeddingPayments(this.paymentMonth || undefined),
      tasks: this.api.getWeddingTasks(),
      providers: this.api.getWeddingProviders(),
      guests: this.api.getWeddingGuests(),
      purchases: this.api.getAdvancedPurchases(this.purchaseFilters),
      forecast: this.api.getSavingsForecast(),
      savings: this.api.getWeddingSavingsPlan(),
      contributions: this.api.getWeddingContributions(),
      members: this.api.getWorkspaceMembers(),
      activity: this.api.getWeddingActivity(),
      calendar: this.api.getWeddingCalendar(this.calendarStart, this.calendarEnd)
    }).subscribe({
      next: (data) => {
        this.summary = data.summary;
        this.events = data.events;
        this.budgetItems = data.budgets;
        this.payments = data.payments;
        this.tasks = data.tasks;
        this.providers = data.providers;
        this.guests = data.guests;
        this.purchases = data.purchases;
        this.forecast = data.forecast;
        this.savingsForm = { ...data.savings };
        this.contributions = data.contributions;
        this.members = data.members;
        this.activity = data.activity;
        this.calendarEntries = data.calendar;
        this.loading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.fail(error.status === 403 ? 'Votre rôle ne permet pas de consulter ces données.' : 'Impossible de charger les données du wedding planner.');
      }
    });
  }

  saveOnboarding(): void {
    if (!this.wizard.project_name.trim() || this.saving) return;
    this.saving = true;
    this.error = '';
    const payload = {
      ...this.wizard,
      project_name: this.wizard.project_name.trim(),
      wedding_date: this.wizard.wedding_date || null,
      engagement_date: this.wizard.engagement_date || null,
      city: this.wizard.city || null,
      governorate: this.wizard.governorate || null,
      venue: this.wizard.venue || null,
      region: this.wizard.region || null,
      events: this.wizard.events.map((event) => ({
        ...event,
        event_date: event.event_date || null,
        location: event.location || null,
        guest_count: event.guest_count,
        estimated_budget: event.estimated_budget || '0.000',
        actual_budget: event.actual_budget || '0.000',
        notes: event.notes || null
      }))
    };
    this.api.createWeddingOnboarding(payload).subscribe({
      next: () => {
        this.needsOnboarding = false;
        this.success = 'Votre espace personnalisé est prêt.';
        this.saving = false;
        this.loadWorkspace();
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.fail(this.apiError(error, 'Impossible de créer l’espace mariage.'));
      }
    });
  }

  nextStep(): void {
    if (this.wizardStep === 1 && !this.wizard.project_name.trim()) {
      this.fail('Indiquez le nom du projet pour continuer.');
      return;
    }
    this.error = '';
    this.wizardStep = Math.min(7, this.wizardStep + 1);
  }

  previousStep(): void {
    this.error = '';
    this.wizardStep = Math.max(1, this.wizardStep - 1);
  }

  goToStep(step: number): void {
    if (step <= this.wizardStep || (this.wizardStep === 1 && this.wizard.project_name.trim())) {
      this.wizardStep = step;
    }
  }

  toggleValue(values: string[], value: string, selected: boolean): void {
    if (selected && !values.includes(value)) values.push(value);
    if (!selected) {
      const index = values.indexOf(value);
      if (index >= 0) values.splice(index, 1);
    }
  }

  hasEvent(name: string): boolean {
    return this.wizard.events.some((event) => event.name === name);
  }

  toggleEvent(name: string, selected: boolean): void {
    const index = this.wizard.events.findIndex((event) => event.name === name);
    if (selected && index < 0) this.wizard.events.push(this.emptyEventForm(name));
    if (!selected && index >= 0) this.wizard.events.splice(index, 1);
  }

  addCustomEvent(): void {
    const name = this.customEventName.trim();
    if (!name || this.hasEvent(name)) return;
    this.wizard.events.push(this.emptyEventForm(name));
    this.customEventName = '';
  }

  removeEvent(index: number): void {
    this.wizard.events.splice(index, 1);
  }

  addCustomCategory(): void {
    const name = this.customCategoryName.trim();
    if (!name) return;
    if (!this.wizard.custom_categories.includes(name)) this.wizard.custom_categories.push(name);
    this.customCategoryName = '';
  }

  removeCategory(name: string): void {
    this.toggleValue(this.wizard.custom_categories, name, false);
  }

  giftsLabel(mode: string): string {
    return mode === 'forecast' ? 'scénario optimiste' : mode === 'tracked' ? 'suivis séparément' : 'exclus';
  }

  eventNames(): string {
    return this.wizard.events.map((event) => event.name).join(', ');
  }

  refreshSummary(): void {
    if (!this.summary) return;
    this.api.getWeddingSummary({
      event_id: this.dashboardFilters.event_id || undefined,
      month: this.dashboardFilters.month || undefined,
      category_id: this.dashboardFilters.category_id || undefined
    }).subscribe({
      next: (summary) => this.summary = summary,
      error: (error: HttpErrorResponse) => this.fail(this.apiError(error, 'Impossible de filtrer le tableau de bord.'))
    });
  }

  clearFilters(): void {
    this.dashboardFilters = { event_id: '', month: '', category_id: '' };
    this.refreshSummary();
  }

  barPercent(actual: string, planned: string): number {
    const base = Number(planned);
    return base > 0 ? Math.min(100, Number(actual) / base * 100) : 0;
  }

  addBudgetItem(): void {
    this.mutate(this.api.addWeddingBudgetItem({
      ...this.budgetForm,
      event_id: this.budgetForm.event_id || null,
      parent_category: this.budgetForm.parent_category || null
    }), 'Poste budgétaire ajouté.', () => this.budgetForm = this.emptyBudgetForm());
  }

  editBudget(item: WeddingBudgetLine): void {
    this.editingBudgetId = item.id;
    this.budgetEdit = {
      name: item.name, planned_budget: item.planned_budget,
      estimated_cost: item.estimated_cost, confirmed_price: item.confirmed_price, actual_cost: item.actual_cost
    };
  }

  saveBudgetEdit(item: WeddingBudgetLine): void {
    this.mutate(this.api.updateWeddingBudgetItem(item.id, this.budgetEdit), 'Poste budgétaire mis à jour.', () => this.editingBudgetId = null);
  }

  toggleBudgetItem(item: WeddingBudgetLine, enabled: boolean): void {
    this.mutate(this.api.updateWeddingBudgetItem(item.id, { enabled }), enabled ? 'Poste activé.' : 'Poste désactivé.');
  }

  deleteBudget(item: WeddingBudgetLine): void {
    this.mutate(this.api.deleteWeddingBudgetItem(item.id), 'Poste supprimé.');
  }

  editEvent(event: WeddingEvent): void {
    this.editingEventId = event.id;
    this.eventForm = {
      name: event.name, event_type: event.event_type, event_date: event.event_date || '',
      location: event.location || '', guest_count: event.guest_count,
      estimated_budget: event.estimated_budget, actual_budget: event.actual_budget, notes: event.notes || ''
    };
    this.activeTab = 'events';
  }

  editCalendarEvent(id: string): void {
    const event = this.events.find((item) => item.id === id);
    if (event) this.editEvent(event);
  }

  saveEvent(): void {
    const payload = { ...this.eventForm, event_date: this.eventForm.event_date || null, location: this.eventForm.location || null };
    const request = this.editingEventId
      ? this.api.updateWeddingEvent(this.editingEventId, payload)
      : this.api.addWeddingEvent(payload);
    this.mutate(request, this.editingEventId ? 'Événement mis à jour.' : 'Événement ajouté.', () => {
      this.eventForm = this.emptyEventForm();
      this.editingEventId = null;
    });
  }

  cancelEventEdit(): void {
    this.editingEventId = null;
    this.eventForm = this.emptyEventForm();
  }

  deleteEvent(event: WeddingEvent): void {
    this.mutate(this.api.deleteWeddingEvent(event.id), 'Événement supprimé.');
  }

  loadPurchases(): void {
    this.api.getAdvancedPurchases(this.purchaseFilters).subscribe({
      next: (items) => this.purchases = items,
      error: (error: HttpErrorResponse) => this.fail(this.apiError(error, 'Impossible de filtrer les achats.'))
    });
  }

  addPurchase(): void {
    this.mutate(this.api.addAdvancedPurchase({
      ...this.purchaseForm,
      description: this.purchaseForm.description || null,
      room: this.purchaseForm.room || null,
      supplier: this.purchaseForm.supplier || null,
      purchase_date: this.purchaseForm.purchase_date || null,
      status: 'to_purchase',
      priority: 'medium',
      confirmed_unit_price: '0.000',
      actual_unit_price: '0.000',
      amount_paid: '0.000'
    }), 'Achat ajouté.', () => this.purchaseForm = this.emptyPurchaseForm());
  }

  togglePurchaseSelection(id: string, selected: boolean): void {
    this.toggleValue(this.selectedPurchaseIds, id, selected);
  }

  markSelectedPurchased(): void {
    const ids = [...this.selectedPurchaseIds];
    this.mutate(this.api.bulkUpdatePurchases(ids, 'purchased'), 'Achats sélectionnés mis à jour.', () => this.selectedPurchaseIds = []);
  }

  deletePurchase(item: WeddingShoppingItem): void {
    this.mutate(this.api.deleteAdvancedPurchase(item.id), 'Achat supprimé.');
  }

  exportPurchases(): void {
    this.api.exportPurchases().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'wedding-shopping.csv';
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (error: HttpErrorResponse) => this.fail(this.apiError(error, 'Impossible d’exporter la liste d’achats.'))
    });
  }

  purchaseStatusLabel(status: string): string {
    return ({
      not_started: 'Non commencé', to_purchase: 'À acheter', comparing: 'Comparaison',
      reserved: 'Réservé', partially_paid: 'Partiellement payé', purchased: 'Acheté',
      delivered: 'Livré', cancelled: 'Annulé', completed: 'Terminé', pending: 'En attente'
    } as Record<string, string>)[status] ?? status;
  }

  addPayment(): void {
    const payload = {
      ...this.paymentForm,
      event_id: this.paymentForm.event_id || null,
      budget_category_id: this.paymentTargetType === 'budget' ? this.paymentForm.budget_category_id || null : null,
      provider_id: this.paymentTargetType === 'provider' ? this.paymentForm.provider_id || null : null,
      shopping_item_id: this.paymentTargetType === 'purchase' ? this.paymentForm.shopping_item_id || null : null,
      due_date: this.paymentForm.due_date || null,
      payment_date: this.paymentForm.payment_date || null,
      status: 'upcoming'
    };
    this.mutate(this.api.addWeddingPayment(payload), 'Échéance ajoutée.', () => {
      this.paymentForm = { event_id: '', budget_category_id: '', provider_id: '', shopping_item_id: '', description: '', amount_due: '', amount_paid: '0.000', due_date: '', payment_date: '', payment_method: '' };
    });
  }

  loadPayments(): void {
    this.api.getWeddingPayments(this.paymentMonth || undefined).subscribe({
      next: (payments) => this.payments = payments,
      error: (error: HttpErrorResponse) => this.fail(this.apiError(error, 'Impossible de filtrer les paiements.'))
    });
  }

  markPaymentPaid(payment: WeddingPaymentRecord): void {
    this.mutate(this.api.updateWeddingPayment(payment.id, {
      amount_paid: payment.amount_due,
      payment_date: this.today(),
      status: 'paid'
    }), 'Paiement enregistré.');
  }

  cancelPayment(payment: WeddingPaymentRecord): void {
    this.mutate(this.api.cancelWeddingPayment(payment.id), 'Échéance annulée.');
  }

  paymentStatusLabel(status: string): string {
    return ({
      upcoming: 'À venir', due_today: 'À régler aujourd’hui', overdue: 'En retard',
      partially_paid: 'Partiellement réglé', paid: 'Payé', cancelled: 'Annulé'
    } as Record<string, string>)[status] ?? status;
  }

  addProvider(): void {
    this.mutate(this.api.addWeddingProvider({
      ...this.providerForm,
      phone: this.providerForm.phone || null,
      email: this.providerForm.email || null,
      address: this.providerForm.address || null,
      governorate: this.providerForm.governorate || null,
      booking_date: this.providerForm.booking_date || null,
      service_date: this.providerForm.service_date || null,
      contract_status: 'considering'
    }), 'Prestataire ajouté.', () => this.providerForm = {
      name: '', service_category: 'Salle de mariage', phone: '', email: '', address: '',
      governorate: '', agreed_price: '0.000', deposit: '0.000',
      booking_date: '', service_date: '', notes: ''
    });
  }

  addQuote(provider: WeddingProvider): void {
    const quoted_price = this.quoteInputs[provider.id];
    if (!quoted_price) return;
    this.mutate(this.api.addProviderQuote(provider.id, { quoted_price }), 'Devis ajouté.', () => this.quoteInputs[provider.id] = '');
  }

  confirmProvider(provider: WeddingProvider): void {
    this.mutate(this.api.addProviderContract(provider.id, {
      agreed_price: provider.agreed_price, deposit: '0.000', status: 'signed'
    }), 'Contrat enregistré et prestataire confirmé.');
  }

  addTask(): void {
    this.mutate(this.api.addWeddingTask({
      ...this.taskForm,
      event_id: this.taskForm.event_id || null,
      due_date: this.taskForm.due_date || null,
      description: this.taskForm.description || null,
      status: 'pending',
      suggested: false
    }), 'Tâche ajoutée.', () => this.taskForm = { event_id: '', title: '', description: '', due_date: '', priority: 'medium' });
  }

  toggleTask(task: WeddingTask, completed: boolean): void {
    this.setTaskStatus(task, completed ? 'completed' : 'pending');
  }

  setTaskStatus(task: WeddingTask, status: string): void {
    this.mutate(this.api.updateWeddingTask(task.id, { status }), 'Tâche mise à jour.');
  }

  deleteTask(task: WeddingTask): void {
    this.mutate(this.api.deleteWeddingTask(task.id), 'Tâche supprimée.');
  }

  addGuest(): void {
    this.mutate(this.api.addWeddingGuest({
      ...this.guestForm,
      table_id: this.guestForm.table_id || null,
      partner_association: this.guestForm.partner_association || null,
      phone: this.guestForm.phone || null,
      attendance_status: 'pending'
    }), 'Invité ajouté.', () => this.guestForm = {
      table_id: '', name: '', relationship: 'family', partner_association: '',
      phone: '', accompanying_guests: 0, invitation_status: 'pending', notes: ''
    });
  }

  addGuestTable(): void {
    if (!this.tableForm.name.trim()) return;
    this.mutate(this.api.addGuestTable({ ...this.tableForm }), 'Table ajoutée.', () => this.tableForm = { name: '', capacity: null });
  }

  updateGuestAttendance(guest: NonNullable<WeddingGuestsResponse>['guests'][number], attendance_status: string): void {
    this.mutate(this.api.updateWeddingGuest(guest.id, { attendance_status }), 'Présence mise à jour.');
  }

  assignGuestTable(guest: NonNullable<WeddingGuestsResponse>['guests'][number], table_id: string): void {
    this.mutate(this.api.updateWeddingGuest(guest.id, { table_id: table_id || null }), 'Placement mis à jour.');
  }

  deleteGuest(id: string): void {
    this.mutate(this.api.deleteWeddingGuest(id), 'Invité supprimé.');
  }

  saveSavingsPlan(): void {
    this.mutate(this.api.updateWeddingSavingsPlan(this.savingsForm), 'Plan d’épargne enregistré.');
  }

  addContribution(): void {
    this.mutate(this.api.addWeddingContribution({
      ...this.contributionForm,
      expected_date: this.contributionForm.expected_date || null,
      notes: this.contributionForm.notes || null
    }), 'Contribution ajoutée.', () => this.contributionForm = { source: '', amount: '0.000', confirmed: false, expected_date: '', notes: '' });
  }

  setCalendarView(view: 'agenda' | 'week' | 'month'): void {
    this.calendarView = view;
    const start = new Date();
    if (view === 'week') {
      const day = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - day);
      this.calendarStart = this.isoDate(start);
      this.calendarEnd = this.offsetFrom(this.calendarStart, 6);
    } else if (view === 'month') {
      start.setDate(1);
      this.calendarStart = this.isoDate(start);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      this.calendarEnd = this.isoDate(end);
    } else {
      this.calendarStart = this.today();
      this.calendarEnd = this.offsetDate(30);
    }
    this.loadCalendar();
  }

  loadCalendar(): void {
    if (!this.calendarStart || !this.calendarEnd) return;
    this.api.getWeddingCalendar(this.calendarStart, this.calendarEnd).subscribe({
      next: (entries) => this.calendarEntries = entries,
      error: (error: HttpErrorResponse) => this.fail(this.apiError(error, 'Impossible de charger le calendrier.'))
    });
  }

  inviteMember(): void {
    this.mutate(this.api.inviteWorkspaceMember(this.memberForm), 'Accès partagé.', () => this.memberForm = { email: '', role: 'EDITOR' });
  }

  removeMember(id: string): void {
    this.mutate(this.api.removeWorkspaceMember(id), 'Membre retiré.');
  }

  calendarTypeLabel(type: string): string {
    return ({ event: 'Événement', payment: 'Paiement', task: 'Tâche', purchase: 'Achat', provider: 'Prestataire' } as Record<string, string>)[type] ?? type;
  }

  printPage(): void {
    window.print();
  }

  private mutate(request: Observable<unknown>, successMessage: string, afterSuccess: () => void = () => undefined): void {
    if (this.saving) return;
    this.saving = true;
    this.error = '';
    this.success = '';
    request.subscribe({
      next: () => {
        afterSuccess();
        this.saving = false;
        this.success = successMessage;
        this.loadPlannerData();
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.fail(this.apiError(error, 'L’enregistrement a échoué.'));
      }
    });
  }

  private fail(message: string): void {
    this.error = message;
    this.loading = false;
  }

  private apiError(error: HttpErrorResponse, fallback: string): string {
    const detail = error.error?.detail;
    return typeof detail === 'string' ? detail : fallback;
  }

  private emptyBudgetForm(): { name: string; parent_category: string; event_id: string; enabled: boolean; planned_budget: string; estimated_cost: string; confirmed_price: string; actual_cost: string; reserved_amount: string; notes: string } {
    return { name: '', parent_category: '', event_id: '', enabled: true, planned_budget: '0.000', estimated_cost: '0.000', confirmed_price: '0.000', actual_cost: '0.000', reserved_amount: '0.000', notes: '' };
  }

  private emptyEventForm(name = ''): EventDraft {
    return { name, event_type: 'custom', event_date: '', location: '', guest_count: null, estimated_budget: '0.000', actual_budget: '0.000', notes: '' };
  }

  private emptyPurchaseForm(): { name: string; category: string; description: string; room: string; quantity: string; estimated_unit_price: string; supplier: string; purchase_date: string } {
    return { name: '', category: 'Autre', description: '', room: '', quantity: '1', estimated_unit_price: '0.000', supplier: '', purchase_date: '' };
  }

  private today(): string {
    return this.isoDate(new Date());
  }

  private offsetDate(days: number): string {
    const dateValue = new Date();
    dateValue.setDate(dateValue.getDate() + days);
    return this.isoDate(dateValue);
  }

  private offsetFrom(value: string, days: number): string {
    const dateValue = new Date(`${value}T00:00:00`);
    dateValue.setDate(dateValue.getDate() + days);
    return this.isoDate(dateValue);
  }

  private isoDate(dateValue: Date): string {
    return `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`;
  }
}
