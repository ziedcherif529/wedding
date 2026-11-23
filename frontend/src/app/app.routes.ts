import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { DashboardPageComponent } from './pages/dashboard-page/dashboard-page.component';
import { FinancePageComponent } from './pages/finance-page/finance-page.component';
import { LandingPageComponent } from './pages/landing-page/landing-page.component';
import { LoginPageComponent } from './pages/login-page/login-page.component';
import { PricingPageComponent } from './pages/pricing-page/pricing-page.component';
import { RegisterPageComponent } from './pages/register-page/register-page.component';
import { SettingsPageComponent } from './pages/settings-page/settings-page.component';
import { WeddingPageComponent } from './pages/wedding-page/wedding-page.component';

export const routes: Routes = [
  { path: '', component: LandingPageComponent },
  { path: 'login', component: LoginPageComponent },
  { path: 'register', component: RegisterPageComponent },
  { path: 'pricing', component: PricingPageComponent },
  { path: 'dashboard', component: DashboardPageComponent, canActivate: [authGuard] },
  { path: 'wedding', component: WeddingPageComponent, canActivate: [authGuard] },
  { path: 'finance', component: FinancePageComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsPageComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
