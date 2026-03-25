import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-ranking',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ranking.html',
  styleUrl: './ranking.scss'
})
export class Ranking implements OnInit, OnDestroy {
  players: any[] = [];
  isLoading = false;
  message = '';
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly apiService: ApiService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}


  ngOnInit(): void {
    this.loadRanking();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadRanking(): void {
    this.isLoading = true;
    this.message = '';
    
    this.apiService.getRanking()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          // aceitar dois formatos: array direto ou { players: [] }
          const raw = Array.isArray(response) ? response : (response.players || []);
          this.players = raw.map((p: any) => ({
            name: p.name || p.email || `user-${p.id || '??'}`,
            email: p.email || '',
            score: Number(p.score ?? 0),
            attempts: Number(p.attempts ?? 0),
            date: p.date || ''
          }));
          this.isLoading = false;
          try { this.cdr.detectChanges(); } catch {}
        },
        error: (err) => {
          this.message = 'Erro ao buscar o ranking. Tente novamente.';
          this.isLoading = false;
          try { this.cdr.detectChanges(); } catch {}
        }
      });
  }

  getMedal(index: number): string {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return '';
  }

  backToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.apiService.logout().pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        localStorage.removeItem('user');
        this.router.navigate(['/login']);
      },
      error: () => {
        localStorage.removeItem('user');
        this.router.navigate(['/login']);
      }
    });
  }
}
