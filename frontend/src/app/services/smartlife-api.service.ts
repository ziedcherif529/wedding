import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface FinanceDashboard {
  monthly_income: number;
  monthly_expenses: number;
  monthly_balance: number;
  total_savings: number;
  total_debt: number;
  savings_rate: number;
  budget_utilization: number;
}

export interface WeddingDashboard {
  total_budget: number;
  estimated_expenses: number;
  total_paid: number;
  remaining: number;
  budget_utilization: number;
  completed_purchases: number;
  pending_purchases: number;
  countdown_days: number;
  recent_activities: { label: string; value: string }[];
}

export interface FinanceBudget {
  id: string;
  category: string;
  budget_amount: number;
  month: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_savings: number;
}

export interface FinanceExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
  notes?: string | null;
}

export interface FinanceIncome {
  id: string;
  description: string;
  source: string;
  received_amount: number;
}

export interface Wedding {
  id: string;
  name: string;
  budget_total: number;
  currency: string;
}

export interface WeddingBudget {
  id: string;
  category: string;
  planned_amount: number;
  actual_amount: number;
}

export interface WeddingShoppingItem {
  id: string;
  name: string;
  category: string;
  quantity: string;
  estimated_unit_price: number;
  actual_unit_price: number;
  amount_paid: number;
  priority: string;
  status: string;
  room?: string | null;
  description?: string | null;
  confirmed_unit_price?: string;
  purchase_date?: string | null;
  supplier?: string | null;
  warranty_info?: string | null;
  notes?: string | null;
}

export interface WeddingContributionRecord {
  id: string;
  source: string;
  amount: string;
  confirmed: boolean;
  expected_date: string | null;
  notes: string | null;
}

export interface WeddingEvent {
  id: string;
  name: string;
  event_type: string;
  event_date: string | null;
  location: string | null;
  guest_count: number | null;
  estimated_budget: string;
  actual_budget: string;
  notes: string | null;
  position: number;
}

export interface WeddingPreference {
  onboarding_completed: boolean;
  partner_one_name: string | null;
  partner_two_name: string | null;
  city: string | null;
  governorate: string | null;
  venue: string | null;
  expected_guest_count: number | null;
  wedding_styles: string[];
  region: string | null;
  current_savings: string;
  partner_one_monthly_savings: string;
  partner_two_monthly_savings: string;
  family_contributions: string;
  other_expected_income: string;
  gifts_mode: string;
  include_home_preparation: boolean;
  home_categories: string[];
}

export interface WeddingBudgetLine {
  id: string;
  event_id: string | null;
  name: string;
  parent_category: string | null;
  enabled: boolean;
  planned_budget: string;
  estimated_cost: string;
  confirmed_price: string;
  actual_cost: string;
  reserved_amount: string;
  budget_variance: string;
  budget_consumption: string;
  notes: string | null;
}

export interface WeddingPaymentRecord {
  id: string;
  event_id: string | null;
  budget_category_id: string | null;
  provider_id: string | null;
  shopping_item_id: string | null;
  description: string;
  amount_due: string;
  amount_paid: string;
  remaining_amount: string;
  transaction_type: 'payment' | 'refund';
  due_date: string | null;
  payment_date: string | null;
  payment_method: string | null;
  status: string;
  notes: string | null;
}

export interface WeddingTask {
  id: string;
  event_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  suggested: boolean;
}

export interface WeddingProvider {
  id: string;
  name: string;
  service_category: string;
  phone: string | null;
  email: string | null;
  governorate: string | null;
  agreed_price: string;
  amount_paid: string;
  remaining_balance: string;
  contract_status: string;
  quotes: { id: string; quoted_price: string; quote_date: string | null; notes: string | null }[];
}

export interface WeddingDashboardSummary {
  wedding: { id: string; name: string; wedding_date: string | null };
  financial: {
    total_planned_budget: string;
    total_estimated_expenses: string;
    total_actual_expenses: string;
    total_amount_paid: string;
    total_remaining_payments: string;
    available_savings: string;
    confirmed_future_contributions: string;
    remaining_budget: string;
    budget_utilization_percent: string;
  };
  progress: {
    completed_tasks: number;
    remaining_tasks: number;
    completed_purchases: number;
    pending_purchases: number;
    confirmed_providers: number;
    upcoming_payments: number;
    overdue_payments: number;
  };
  important_dates: {
    countdown_days: number | null;
    next_event: { name: string; date: string | null } | null;
    next_payment: { description: string; date: string | null } | null;
    next_task: { title: string; date: string | null } | null;
  };
  budget_distribution: { id: string; name: string; planned: string; estimated: string; actual: string }[];
  payment_progress: { paid: string; remaining: string };
  purchase_progress: { completed: number; total: number };
}

export interface WeddingGuest {
  id: string;
  table_id: string | null;
  table_name: string | null;
  name: string;
  relationship: string;
  partner_association: string | null;
  phone: string | null;
  accompanying_guests: number;
  invitation_status: string;
  attendance_status: string;
  notes: string | null;
}

export interface WeddingGuestsResponse {
  summary: {
    guest_records: number;
    total_people: number;
    confirmed_people: number;
    pending_records: number;
    declined_people: number;
  };
  guests: WeddingGuest[];
  tables: { id: string; name: string; capacity: number | null; assigned_people: number; notes: string | null }[];
}

export interface SavingsForecast {
  months_remaining: number;
  current_savings: string;
  monthly_partner_savings: string;
  confirmed_contributions: string;
  unconfirmed_contributions: string;
  projected_wedding_cost: string;
  conservative: {
    projected_resources: string;
    financial_gap: string;
    required_additional_monthly_savings: string;
    assumptions: string;
  };
  optimistic: { projected_resources: string; financial_gap: string; assumptions: string };
}

@Injectable({ providedIn: 'root' })
export class SmartLifeApiService {
  private readonly apiUrl = 'http://localhost:8000/api/v1';

  constructor(private http: HttpClient, private auth: AuthService) {}

  private options(): { headers: HttpHeaders } {
    return {
      headers: new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken() ?? ''}` })
    };
  }

  getFinanceDashboard(): Observable<FinanceDashboard> {
    return this.http.get<FinanceDashboard>(`${this.apiUrl}/finance/dashboard`, this.options());
  }

  getWeddingDashboard(): Observable<WeddingDashboard> {
    return this.http.get<WeddingDashboard>(`${this.apiUrl}/wedding/dashboard`, this.options());
  }

  getExpenses(): Observable<FinanceExpense[]> {
    return this.http.get<FinanceExpense[]>(`${this.apiUrl}/finance/expenses`, this.options());
  }

  addExpense(payload: object): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.apiUrl}/finance/expenses`, payload, this.options());
  }

  deleteExpense(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/finance/expenses/${id}`, this.options());
  }

  getIncome(): Observable<FinanceIncome[]> {
    return this.http.get<FinanceIncome[]>(`${this.apiUrl}/finance/income`, this.options());
  }

  addIncome(payload: object): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.apiUrl}/finance/income`, payload, this.options());
  }

  getFinanceBudgets(): Observable<FinanceBudget[]> {
    return this.http.get<FinanceBudget[]>(`${this.apiUrl}/finance/budgets`, this.options());
  }

  addFinanceBudget(payload: object): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.apiUrl}/finance/budgets`, payload, this.options());
  }

  getSavingsGoals(): Observable<SavingsGoal[]> {
    return this.http.get<SavingsGoal[]>(`${this.apiUrl}/finance/savings-goals`, this.options());
  }

  addSavingsGoal(payload: object): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.apiUrl}/finance/savings-goals`, payload, this.options());
  }

  getWeddings(): Observable<Wedding[]> {
    return this.http.get<Wedding[]>(`${this.apiUrl}/wedding`, this.options());
  }

  addWedding(payload: object): Observable<{ id: string; name: string }> {
    return this.http.post<{ id: string; name: string }>(`${this.apiUrl}/wedding`, payload, this.options());
  }

  getWeddingBudgets(): Observable<WeddingBudget[]> {
    return this.http.get<WeddingBudget[]>(`${this.apiUrl}/wedding/budgets`, this.options());
  }

  addWeddingBudget(payload: object): Observable<{ id: string; category: string }> {
    return this.http.post<{ id: string; category: string }>(`${this.apiUrl}/wedding/budgets`, payload, this.options());
  }

  getShoppingItems(): Observable<WeddingShoppingItem[]> {
    return this.http.get<WeddingShoppingItem[]>(`${this.apiUrl}/wedding/shopping-items`, this.options());
  }

  addShoppingItem(payload: object): Observable<{ id: string; name: string }> {
    return this.http.post<{ id: string; name: string }>(`${this.apiUrl}/wedding/shopping-items`, payload, this.options());
  }

  updateShoppingItem(id: string, payload: object): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/wedding/shopping-items/${id}`, payload, this.options());
  }

  deleteShoppingItem(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/wedding/shopping-items/${id}`, this.options());
  }

  createWeddingOnboarding(payload: object): Observable<{ id: string; name: string }> {
    return this.http.post<{ id: string; name: string }>(`${this.apiUrl}/wedding/onboarding`, payload, this.options());
  }

  getWeddingPreferences(): Observable<WeddingPreference> {
    return this.http.get<WeddingPreference>(`${this.apiUrl}/wedding/preferences`, this.options());
  }

  getWeddingEvents(): Observable<WeddingEvent[]> {
    return this.http.get<WeddingEvent[]>(`${this.apiUrl}/wedding/events`, this.options());
  }

  addWeddingEvent(payload: object): Observable<{ id: string; name: string }> {
    return this.http.post<{ id: string; name: string }>(`${this.apiUrl}/wedding/events`, payload, this.options());
  }

  updateWeddingEvent(id: string, payload: object): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/wedding/events/${id}`, payload, this.options());
  }

  deleteWeddingEvent(id: string): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/wedding/events/${id}`, this.options());
  }

  getWeddingSummary(filters: { event_id?: string; month?: string; category_id?: string } = {}): Observable<WeddingDashboardSummary> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<WeddingDashboardSummary>(`${this.apiUrl}/wedding/dashboard/summary${suffix}`, this.options());
  }

  getWeddingBudgetItems(filters: { event_id?: string; category?: string } = {}): Observable<WeddingBudgetLine[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<WeddingBudgetLine[]>(`${this.apiUrl}/wedding/budget-items${suffix}`, this.options());
  }

  addWeddingBudgetItem(payload: object): Observable<{ id: string; name: string }> {
    return this.http.post<{ id: string; name: string }>(`${this.apiUrl}/wedding/budget-items`, payload, this.options());
  }

  updateWeddingBudgetItem(id: string, payload: object): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/wedding/budget-items/${id}`, payload, this.options());
  }

  deleteWeddingBudgetItem(id: string): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/wedding/budget-items/${id}`, this.options());
  }

  getWeddingPayments(month?: string, eventId?: string): Observable<WeddingPaymentRecord[]> {
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    if (eventId) params.set('event_id', eventId);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<WeddingPaymentRecord[]>(`${this.apiUrl}/wedding/payments${suffix}`, this.options());
  }

  addWeddingPayment(payload: object): Observable<WeddingPaymentRecord> {
    return this.http.post<WeddingPaymentRecord>(`${this.apiUrl}/wedding/payments`, payload, this.options());
  }

  updateWeddingPayment(id: string, payload: object): Observable<WeddingPaymentRecord> {
    return this.http.put<WeddingPaymentRecord>(`${this.apiUrl}/wedding/payments/${id}`, payload, this.options());
  }

  cancelWeddingPayment(id: string): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/wedding/payments/${id}`, this.options());
  }

  getWeddingTasks(filters: { event_id?: string; status?: string } = {}): Observable<WeddingTask[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<WeddingTask[]>(`${this.apiUrl}/wedding/tasks${suffix}`, this.options());
  }

  addWeddingTask(payload: object): Observable<{ id: string; title: string }> {
    return this.http.post<{ id: string; title: string }>(`${this.apiUrl}/wedding/tasks`, payload, this.options());
  }

  updateWeddingTask(id: string, payload: object): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/wedding/tasks/${id}`, payload, this.options());
  }

  deleteWeddingTask(id: string): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/wedding/tasks/${id}`, this.options());
  }

  getWeddingProviders(): Observable<WeddingProvider[]> {
    return this.http.get<WeddingProvider[]>(`${this.apiUrl}/wedding/providers`, this.options());
  }

  addWeddingProvider(payload: object): Observable<{ id: string; name: string }> {
    return this.http.post<{ id: string; name: string }>(`${this.apiUrl}/wedding/providers`, payload, this.options());
  }

  addProviderQuote(providerId: string, payload: object): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.apiUrl}/wedding/providers/${providerId}/quotes`, payload, this.options());
  }

  addProviderContract(providerId: string, payload: object): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.apiUrl}/wedding/providers/${providerId}/contract`, payload, this.options());
  }

  getWeddingGuests(): Observable<WeddingGuestsResponse> {
    return this.http.get<WeddingGuestsResponse>(`${this.apiUrl}/wedding/guests`, this.options());
  }

  addWeddingGuest(payload: object): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.apiUrl}/wedding/guests`, payload, this.options());
  }

  updateWeddingGuest(id: string, payload: object): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/wedding/guests/${id}`, payload, this.options());
  }

  deleteWeddingGuest(id: string): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/wedding/guests/${id}`, this.options());
  }

  addGuestTable(payload: object): Observable<{ id: string; name: string }> {
    return this.http.post<{ id: string; name: string }>(`${this.apiUrl}/wedding/guest-tables`, payload, this.options());
  }

  updateWeddingSavingsPlan(payload: object): Observable<{ id: string }> {
    return this.http.put<{ id: string }>(`${this.apiUrl}/wedding/savings-plan`, payload, this.options());
  }

  getWeddingSavingsPlan(): Observable<{
    current_savings: string;
    monthly_partner_one: string;
    monthly_partner_two: string;
    expected_family_contributions: string;
    expected_other_income: string;
    include_gifts: boolean;
  }> {
    return this.http.get<{
      current_savings: string;
      monthly_partner_one: string;
      monthly_partner_two: string;
      expected_family_contributions: string;
      expected_other_income: string;
      include_gifts: boolean;
    }>(`${this.apiUrl}/wedding/savings-plan`, this.options());
  }

  getWeddingContributions(): Observable<WeddingContributionRecord[]> {
    return this.http.get<WeddingContributionRecord[]>(`${this.apiUrl}/wedding/contributions`, this.options());
  }

  addWeddingContribution(payload: object): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.apiUrl}/wedding/contributions`, payload, this.options());
  }

  getSavingsForecast(): Observable<SavingsForecast> {
    return this.http.get<SavingsForecast>(`${this.apiUrl}/wedding/savings-plan/forecast`, this.options());
  }

  getWeddingCalendar(startDate: string, endDate: string): Observable<{ id: string; type: string; title: string; date: string; status: string }[]> {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    return this.http.get<{ id: string; type: string; title: string; date: string; status: string }[]>(
      `${this.apiUrl}/wedding/calendar?${params}`, this.options()
    );
  }

  getWeddingActivity(): Observable<{ id: string; summary: string; created_at: string }[]> {
    return this.http.get<{ id: string; summary: string; created_at: string }[]>(`${this.apiUrl}/wedding/activity`, this.options());
  }

  getWorkspaceMembers(): Observable<{ id: string | null; user_id: string; name: string; email: string; role: string }[]> {
    return this.http.get<{ id: string | null; user_id: string; name: string; email: string; role: string }[]>(`${this.apiUrl}/wedding/members`, this.options());
  }

  inviteWorkspaceMember(payload: { email: string; role: 'EDITOR' | 'VIEWER' }): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/wedding/members`, payload, this.options());
  }

  removeWorkspaceMember(id: string): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/wedding/members/${id}`, this.options());
  }

  bulkUpdatePurchases(item_ids: string[], status: string): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(`${this.apiUrl}/wedding/shopping/bulk-status`, { item_ids, status }, this.options());
  }

  addAdvancedPurchase(payload: object): Observable<{ id: string; name: string }> {
    return this.http.post<{ id: string; name: string }>(`${this.apiUrl}/wedding/shopping`, payload, this.options());
  }

  getAdvancedPurchases(filters: { search?: string; category?: string; room?: string; status?: string; sort_by?: string } = {}): Observable<WeddingShoppingItem[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<WeddingShoppingItem[]>(`${this.apiUrl}/wedding/shopping${suffix}`, this.options());
  }

  updateAdvancedPurchase(id: string, payload: object): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/wedding/shopping/${id}`, payload, this.options());
  }

  deleteAdvancedPurchase(id: string): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/wedding/shopping/${id}`, this.options());
  }

  exportPurchases(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/wedding/shopping/export.csv`, {
      headers: new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken() ?? ''}` }),
      responseType: 'blob'
    });
  }
}
