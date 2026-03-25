import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = 'http://localhost:8000';
  
  // Modo MOCK para testar sem backend
  private MOCK_MODE = false;
  private mockAttemptCount = 0;
  private mockSecretCode: string[] | null = null;

  constructor() { }

  /**
   * Inicia um novo jogo
   */
  startGame(): Observable<any> {
    if (this.MOCK_MODE) {
      this.mockAttemptCount = 0;
      this.mockSecretCode = this.generateMockSecret();
      return of({
        id: 'mock-game-' + Date.now(),
        status: 'playing',
        attempts: 0,
        max_attempts: 10
      }).pipe(delay(300));
    }
    
    const opts = this.getAuthHeaders();
    return this.http.post(`${this.apiUrl}/games`, {}, opts);
  }

  /**
   * Envia um palpite (guess) para um jogo específico
   * @param gameId - ID do jogo
   * @param guessData - { colors: string[] }
   */
  submitGuess(gameId: string, guessData: any): Observable<any> {
    if (this.MOCK_MODE) {
      this.mockAttemptCount++;
      
      // Simula acerto progressivo
      // 1ª tentativa: 2 cores corretas na posição errada
      if (this.mockAttemptCount === 1) {
        return of({
          feedback: {
            correct_position: 0,
            wrong_position: 2
          }
        }).pipe(delay(500));
      }
      
      // 2ª tentativa: 3 cores corretas na posição errada
      if (this.mockAttemptCount === 2) {
        return of({
          feedback: {
            correct_position: 0,
            wrong_position: 3
          }
        }).pipe(delay(500));
      }
      
      // 3ª tentativa: VITÓRIA! Todas as 4 cores corretas na posição correta
      if (this.mockAttemptCount === 3) {
        return of({
          feedback: {
            correct_position: 4,
            wrong_position: 0
          },
          status: 'won',
          message: `Tentativa ${this.mockAttemptCount}/10 - VITÓRIA!`,
          secret_code: this.mockSecretCode
        }).pipe(delay(500));
      }
      
      // Após 3 tentativas, continua com padrão aleatório
      const randomCorrect = Math.floor(Math.random() * 4);
      const randomWrong = Math.floor(Math.random() * (4 - randomCorrect));
      
      return of({
        feedback: {
          correct_position: randomCorrect,
          wrong_position: randomWrong
        },
        status: 'playing',
        message: `Tentativa ${this.mockAttemptCount}/10`
      }).pipe(delay(500));
    }
    
    const opts = this.getAuthHeaders();
    return this.http.post(`${this.apiUrl}/games/${gameId}/guess`, guessData, opts);
  }

  /**
   * Obtém o status de um jogo
   * @param gameId - ID do jogo
   */
  getGameStatus(gameId: string): Observable<any> {
    if (this.MOCK_MODE) {
      const base: any = {
        id: gameId,
        status: this.mockAttemptCount >= 3 ? 'won' : 'playing',
        attempts: this.mockAttemptCount,
        max_attempts: 10
      };
      if (this.mockAttemptCount >= 3 && this.mockSecretCode) base.secret_code = this.mockSecretCode;
      return of(base).pipe(delay(300));
    }
    
    const opts = this.getAuthHeaders();
    return this.http.get(`${this.apiUrl}/games/${gameId}`, opts);
  }

  /**
   * Busca o ranking de jogadores
   */
  getRanking(): Observable<any> {
    if (this.MOCK_MODE) {
      return of({
        players: [
          { name: 'João Silva', email: 'joao@example.com', score: 950, attempts: 1, date: '2026-03-22' },
          { name: 'Maria Santos', email: 'maria@example.com', score: 850, attempts: 3, date: '2026-03-22' },
          { name: 'Pedro Costa', email: 'pedro@example.com', score: 750, attempts: 5, date: '2026-03-22' },
          { name: 'Ana Oliveira', email: 'ana@example.com', score: 650, attempts: 6, date: '2026-03-22' },
          { name: 'Carlos Souza', email: 'carlos@example.com', score: 550, attempts: 8, date: '2026-03-22' }
        ]
      }).pipe(delay(300));
    }
    
      return this.http.get(`${this.apiUrl}/leaderboard`).pipe(
        map((resp: any) => resp?.leaderboard || [])
      );
  }

  /**
   * Faz login
   */
  login(credentials: any): Observable<any> {
    if (this.MOCK_MODE) {
      return of({
        access_token: 'mock-token-' + Date.now(),
        token_type: 'bearer',
        id: 1,
        email: credentials.email,
        score: 0
      }).pipe(delay(500));
    }
    
    return this.http.post(`${this.apiUrl}/login`, credentials);
  }

  /**
   * Obtém o token armazenado do localStorage
   */
  getStoredToken(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * Verifica se o usuário está autenticado
   */
  isAuthenticated(): boolean {
    return !!this.getStoredToken();
  }

  /**
   * Remove dados de autenticação
   * getStoredToken - Token armazenado 
   */  
  logout(): Observable<any> {
    const opts = this.getAuthHeaders();
    // clear localStorage immediately to avoid repeated 401s
    localStorage.removeItem('token');
    localStorage.removeItem('tokenType');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userId');

    return this.http.post(`${this.apiUrl}/logout`, {}, opts);
  }

  private getAuthHeaders(): any {
    const token = this.getStoredToken();
    if (!token) return {};
    return { headers: new HttpHeaders().set('Authorization', `Bearer ${token}`) };
  }

  /**
   * Registra um novo usuário
   * @param userData - { email: string, password: string }
   * @returns Observable com { id, email, score }
   */
  register(userData: any): Observable<any> {
    if (this.MOCK_MODE) {
      return of({
        id: Math.floor(Math.random() * 1000),
        email: userData.email,
        score: 0
      }).pipe(delay(500));
    }
    
    return this.http.post(`${this.apiUrl}/register`, userData);
  }

  /**
   * Alterna modo MOCK para facilitar testes
   */
  toggleMockMode(): void {
    this.MOCK_MODE = !this.MOCK_MODE;
    if (!this.MOCK_MODE) {
      this.mockSecretCode = null;
      this.mockAttemptCount = 0;
    }
    console.log('🎭 MOCK MODE:', this.MOCK_MODE ? 'ATIVADO ✅' : 'DESATIVADO ❌');
  }

  /**
   * Retorna o secret code gerado no modo mock (ou null)
   */
  getMockSecret(): string[] | null {
    return this.mockSecretCode;
  }

  private generateMockSecret(): string[] {
    const colors = ['red','blue','yellow','green','purple','orange'];
    const secret: string[] = [];
    for (let i = 0; i < 4; i++) {
      const idx = Math.floor(Math.random() * colors.length);
      secret.push(colors[idx]);
    }
    return secret;
  }

  /**
   * Verifica se está em modo MOCK
   */
  isMockMode(): boolean {
    return this.MOCK_MODE;
  }

  /**
   * Reset do contador de tentativas
   */
  resetMockAttempts(): void {
    this.mockAttemptCount = 0;
  }
}

