import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
  maxAttempts = 10;
  numPositions = 4;
  currentAttempt = 0;
  guesses: Guess[] = [];
  selectedColors: string[] = Array(4).fill('');
  gameStatus: 'playing' | 'won' | 'lost' = 'playing';

  // Secret code to reveal at game end (letters like 'vermelho', 'azul', ...)
  secretCode: string[] = [];

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
    private readonly router: Router,
    private readonly cd: ChangeDetectorRef
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
          // limpar segredo anterior
          this.secretCode = [];
          this.gameStatus = 'playing';
          this.message = 'Jogo iniciado! Tente adivinhar a sequência de cores.';
          this.messageType = 'info';
          try { this.cd.detectChanges(); } catch (_e) {}
        },
        error: () => {
          this.message = 'Erro ao iniciar o jogo. Tente novamente.';
          this.messageType = 'error';
          try { this.cd.detectChanges(); } catch (_e) {}
        },
      });
  }

  /**
   * Seleciona uma cor para a posição selecionada
   */
  selectColor(colorLetter: string, position: number): void {
    if (this.gameStatus !== 'playing') return;
    this.selectedColors[position] = colorLetter;
    // Reatribuir o array para garantir detecção de mudanças imediata
    this.selectedColors = [...this.selectedColors];
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
    // Reatribuir para forçar atualização do template
    this.selectedColors = [...this.selectedColors];
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
          // A API pode retornar o feedback em dois formatos:
          // 1) { feedback: { correct_position, wrong_position } } (modo mock atual)
          // 2) { correct_position, wrong_position, message, status } (backend conforme api_contract.yaml)
          const feedback = response?.feedback ?? {
            correct_position: response?.correct_position ?? 0,
            wrong_position: response?.wrong_position ?? 0,
          };

          this.currentAttempt++;
          this.guesses.push({
            colors: [...this.selectedColors],
            feedback,
            timestamp: new Date(),
          });

          // Mensagem vinda da API quando disponível
          const apiMessage = response?.message ?? null;

          // Verificar se ganhou
          if (feedback.correct_position === this.numPositions) {
            this.gameStatus = 'won';
            this.message = apiMessage ?? `🎉 Parabéns! Você venceu em ${this.currentAttempt} tentativa(s)!`;
            this.messageType = 'success';
          } else if (this.currentAttempt >= this.maxAttempts) {
            this.gameStatus = 'lost';
            this.message = apiMessage ?? `😢 Game Over! Você atingiu o limite de ${this.maxAttempts} tentativas.`;
            this.messageType = 'error';
          } else {
            this.message = apiMessage ?? `Feedback: ${feedback.correct_position} corretas | ${feedback.wrong_position} na posição errada`;
            this.messageType = 'info';
          }

          // Se a API retornou o secret_code (ou jogo terminou), solicitar reveal
          if (response?.secret_code || this.gameStatus !== 'playing') {
            this.revealSecret();
          }

          // Limpar seleção para o próximo palpite
          this.selectedColors = Array(this.numPositions).fill('');
          // Forçar atualização do template caso o callback tenha sido executado fora da zona do Angular
          try { this.cd.detectChanges(); } catch (_e) {}
        },
        error: () => {
          this.message = 'Erro ao enviar palpite. Tente novamente.';
          this.messageType = 'error';
          try { this.cd.detectChanges(); } catch (_e) {}
        },
      });
  }

  /**
   * Busca o status do jogo e revela o código secreto quando disponível
   */
  revealSecret(): void {
    if (!this.gameId) return;
    // Se estivermos em modo mock e o serviço já tiver o secret local, usar direto (evita chamada extra)
    if (this.apiService.isMockMode()) {
      const mock = this.apiService.getMockSecret?.();
      if (mock && Array.isArray(mock) && mock.length === this.numPositions) {
        this.secretCode = mock.map((c: string) => this.getLetterByColor(c));
        try { this.cd.detectChanges(); } catch (_e) {}
        return;
      }
    }
    this.apiService.getGameStatus(this.gameId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp: any) => {
          const secret = resp?.secret_code ?? resp?.secret ?? null;
          if (Array.isArray(secret) && secret.length === this.numPositions) {
            // converter nomes em inglês para as "letras" usadas pela UI
            this.secretCode = secret.map((c: string) => this.getLetterByColor(c));
          } else {
            this.secretCode = [];
          }
          try { this.cd.detectChanges(); } catch (_e) {}
        },
        error: () => {
          // não bloquear se erro
        }
      });
  }

  /**
   * Retorna a "letra" (português) a partir do nome da cor em inglês
   */
  getLetterByColor(colorName: string): string {
    const obj = this.availableColors.find(c => c.color === colorName);
    return obj ? obj.letter : '';
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
    const baseScore = 1100;
    const attemptPenalty = (this.currentAttempt) * 100;
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
