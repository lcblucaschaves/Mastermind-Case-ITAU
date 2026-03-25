import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  userEmail: string = '';

  constructor(
    private readonly router: Router,
    private readonly apiService: ApiService
  ) {}

  ngOnInit(): void {
    // redirect to login if not authenticated
    if (!this.apiService.isAuthenticated()) {
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }

    const user = localStorage.getItem('user');
    if (!user) {
      this.userEmail = 'Jogador';
      return;
    }
    try {
      const userData = JSON.parse(user);
      this.userEmail = userData.email || 'Jogador';
    } catch {
      this.userEmail = 'Jogador';
    }
  }

  startGame(): void {
    this.router.navigate(['/game']);
  }

  viewRanking(): void {
    this.router.navigate(['/ranking']);
  }

  logout(): void {
    this.apiService.logout().subscribe({
      next: () => {
        localStorage.removeItem('user');
        this.router.navigate(['/login'], { replaceUrl: true });
      },
      error: () => {
        // even if logout request fails, clear local user data and redirect
        localStorage.removeItem('user');
        this.router.navigate(['/login'], { replaceUrl: true });
      }
    });
  }
}
