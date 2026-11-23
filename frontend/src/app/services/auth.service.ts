import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_verified: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'smartlife_access_token';
  private readonly apiUrl = 'http://localhost:8000/api/v1';

  constructor(private http: HttpClient) {}

  login(payload: { email: string; password: string }): Observable<{ access_token: string; refresh_token: string }> {
    return this.http.post<{ access_token: string; refresh_token: string }>(`${this.apiUrl}/auth/login`, payload).pipe(
      tap((response) => {
        localStorage.setItem(this.tokenKey, response.access_token);
      })
    );
  }

  register(payload: { full_name: string; email: string; password: string }): Observable<UserProfile> {
    return this.http.post<UserProfile>(`${this.apiUrl}/auth/register`, payload);
  }

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${this.getToken()}` }
    });
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
  }
}
