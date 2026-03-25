import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface Guess {
  colors: string[];
  feedback: {
    correct_position: number;
    wrong_position: number;
  };
  timestamp: Date;
}

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './game.html',
  styleUrl: './game.scss',
})
export class Game implements OnInit, OnDestroy {
  // Estado do jogo
  gameId: string | null = null;
  secretCode: string[] = [];
  maxAttempts = 10;
  numPositions = 4;
  currentAttempt = 0;
  guesses: Guess[] = [];
  selectedColors: string[] = Array(4).fill('');
  gameStatus: 'playing' | 'won' | 'lost' = 'playing';

  // UI - Color options with letters (6 colors available)
  availableColors = [
    { letter: 'vermelho', color: 'red', emoji: '🔴' },
    { letter: 'azul', color: 'blue', emoji: '🔵' },
    { letter: 'amarelo', color: 'yellow', emoji: '🟡' },
    { letter: 'verde', color: 'green', emoji: '🟢' },
    { letter: 'roxo', color: 'purple', emoji: '🟣' },
    { letter: 'laranja', color: 'orange', emoji: '🟠' }
  ];
  message = '';
  messageType: 'info' | 'success' | 'error' = 'info';
  mockMode = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly apiService: ApiService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    // prevent access if not authenticated
    if (!this.apiService.isAuthenticated()) {
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }

    this.mockMode = this.apiService.isMockMode();
    this.startGame();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicia um novo jogo
   */
  startGame(): void {
    this.apiService.startGame()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.gameId = response.id;
          this.currentAttempt = 0;
          this.guesses = [];
          this.selectedColors = Array(this.numPositions).fill('');
          this.gameStatus = 'playing';
          this.message = 'Jogo iniciado! Tente adivinhar a sequência de cores.';
          this.messageType = 'info';
        },
        error: () => {
          this.message = 'Erro ao iniciar o jogo. Tente novamente.';
          this.messageType = 'error';
        },
      });
  }

  /**
   * Seleciona uma cor para a posição selecionada
   */
  selectColor(colorLetter: string, position: number): void {
    if (this.gameStatus !== 'playing') return;
    this.selectedColors[position] = colorLetter;
  }

  /**
   * Obtém a cor em inglês baseado na letra
   */
  getColorName(letter: string): string {
    const colorObj = this.availableColors.find(c => c.letter === letter);
    return colorObj ? colorObj.color : '';
  }

  /**
   * Converte array de letras para array de cores em inglês
   */
  convertToEnglishColors(letters: string[]): string[] {
    return letters.map(letter => this.getColorName(letter));
  }

  /**
   * Remove a seleção de uma posição
   */
  clearPosition(position: number): void {
    this.selectedColors[position] = '';
  }

  /**
   * Envia o palpite ao servidor
   */
  submitGuess(): void {
    if (this.selectedColors.some(color => !color)) {
      this.message = 'Por favor, selecione uma cor para cada posição.';
      this.messageType = 'error';
      return;
    }

    if (!this.gameId) {
      this.message = 'Erro: ID do jogo não encontrado.';
      this.messageType = 'error';
      return;
    }

    const guessData = {
      colors: this.convertToEnglishColors(this.selectedColors),
    };

    this.apiService.submitGuess(this.gameId, guessData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.currentAttempt++;
          this.guesses.push({
            colors: [...this.selectedColors],
            feedback: response.feedback,
            timestamp: new Date(),
          });

          // Verificar se ganhou
          if (response.feedback.correct_position === this.numPositions) {
            this.gameStatus = 'won';
            this.message = `🎉 Parabéns! Você venceu em ${this.currentAttempt} tentativa(s)!`;
            this.messageType = 'success';
          } else if (this.currentAttempt >= this.maxAttempts) {
            this.gameStatus = 'lost';
            this.message = `😢 Game Over! Você atingiu o limite de ${this.maxAttempts} tentativas.`;
            this.messageType = 'error';
          } else {
            this.message = `Feedback: ${response.feedback.correct_position} corretas | ${response.feedback.wrong_position} na posição errada`;
            this.messageType = 'info';
          }

          // Limpar seleção para o próximo palpite
          this.selectedColors = Array(this.numPositions).fill('');
        },
        error: () => {
          this.message = 'Erro ao enviar palpite. Tente novamente.';
          this.messageType = 'error';
        },
      });
  }

  /**
   * Volta para o login
   */
  logout(): void {
    this.apiService.logout().pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        localStorage.removeItem('user');
        this.router.navigate(['/login'], { replaceUrl: true });
      },
      error: () => {
        localStorage.removeItem('user');
        this.router.navigate(['/login'], { replaceUrl: true });
      }
    });
  }

  /**
   * Volta para o dashboard
   */
  backToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  /**
   * Restart o jogo
   */
  restartGame(): void {
    this.startGame();
  }

  /**
   * Calcula a pontuação do jogador
   */
  calculateScore(): number {
    if (this.gameStatus !== 'won') return 0;
    const baseScore = 1000;
    const attemptPenalty = (this.currentAttempt - 1) * 50;
    return Math.max(baseScore - attemptPenalty, 0);
  }

  /**
   * Verifica se a posição está selecionada
   */
  isPositionSelected(position: number): boolean {
    return !!this.selectedColors[position];
  }

  /**
   * Obtém as positions para ngFor
   */
  getPositions(): number[] {
    return Array(this.numPositions).fill(0).map((_, i) => i);
  }

  /**
   * Obtém emoji da cor pela letra
   */
  getColorEmoji(letter: string): string {
    const colorObj = this.availableColors.find(c => c.letter === letter);
    return colorObj ? colorObj.emoji : '⭕';
  }

  /**
   * Alterna modo MOCK para testes
   */
  toggleMockMode(): void {
    this.apiService.toggleMockMode();
    this.mockMode = this.apiService.isMockMode();
    this.apiService.resetMockAttempts();
    this.restartGame();
  }
}
