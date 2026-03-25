import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  userEmail: string = '';

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    const user = localStorage.getItem('user');
    if (!user) {
      this.router.navigate(['/login']);
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
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }
}
