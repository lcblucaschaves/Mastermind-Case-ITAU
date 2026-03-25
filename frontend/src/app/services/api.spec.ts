import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApiService } from './api';

describe('ApiService - Comprehensive Test Suite', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;
  const API_URL = 'http://localhost:8000';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiService
      ]
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  // ============================================================
  // SERVICE CREATION
  // ============================================================
  describe('Service Creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  // ============================================================
  // REGISTER TESTS
  // ============================================================
  describe('Register - POST /register', () => {
    it('should register a new user successfully', () => {
      const registerData = {
        email: 'teste@gmail.com',
        password: 'senha123'
      };

      const expectedResponse = {
        id: 1,
        email: 'teste@gmail.com',
        score: 0
      };

      service.register(registerData).subscribe(response => {
        expect(response).toEqual(expectedResponse);
        expect(response.id).toBe(1);
        expect(response.email).toBe('teste@gmail.com');
        expect(response.score).toBe(0);
      });

      const req = httpMock.expectOne(`${API_URL}/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(registerData);
      req.flush(expectedResponse);
    });

    it('should handle email already exists error', () => {
      const registerData = {
        email: 'existing@gmail.com',
        password: 'senha123'
      };

      const errorResponse = {
        detail: 'Usuário já existe'
      };

      service.register(registerData).subscribe(
        () => { throw new Error('should have failed'); },
        (error: any) => {
          expect(error.status).toBe(400);
          expect(error.error.detail).toBe('Usuário já existe');
        }
      );

      const req = httpMock.expectOne(`${API_URL}/register`);
      expect(req.request.method).toBe('POST');
      req.flush(errorResponse, { status: 400, statusText: 'Bad Request' });
    });

    it('should validate email format', () => {
      const registerData = {
        email: 'invalid-email',
        password: 'senha123'
      };

      service.register(registerData).subscribe(
        () => { throw new Error('should have failed'); },
        (error: any) => {
          expect(error.status).toBe(400);
        }
      );

      const req = httpMock.expectOne(`${API_URL}/register`);
      req.flush(
        { detail: 'Email inválido' },
        { status: 400, statusText: 'Bad Request' }
      );
    });

    it('should validate minimum password length', () => {
      const registerData = {
        email: 'teste@gmail.com',
        password: '123'
      };

      service.register(registerData).subscribe(
        () => { throw new Error('should have failed'); },
        (error: any) => {
          expect(error.status).toBe(400);
        }
      );

      const req = httpMock.expectOne(`${API_URL}/register`);
      req.flush(
        { detail: 'Senha deve ter no mínimo 6 caracteres' },
        { status: 400, statusText: 'Bad Request' }
      );
    });

    it('should send POST request with correct method', () => {
      const registerData = {
        email: 'teste@gmail.com',
        password: 'senha123'
      };

      service.register(registerData).subscribe();

      const req = httpMock.expectOne(`${API_URL}/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(registerData);
      req.flush({ id: 1, email: 'teste@gmail.com', score: 0 });
    });
  });

  // ============================================================
  // LOGIN TESTS
  // ============================================================
  describe('Login - POST /login', () => {
    it('should login user successfully', () => {
      const loginData = {
        email: 'teste@gmail.com',
        password: 'senha123'
      };

      const expectedResponse = {
        id: 1,
        email: 'teste@gmail.com',
        score: 0
      };

      service.login(loginData).subscribe(response => {
        expect(response).toEqual(expectedResponse);
        expect(response.id).toBe(1);
        expect(response.email).toBe('teste@gmail.com');
      });

      const req = httpMock.expectOne(`${API_URL}/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(loginData);
      req.flush(expectedResponse);
    });

    it('should handle invalid credentials', () => {
      const loginData = {
        email: 'teste@gmail.com',
        password: 'senhaerrada'
      };

      const errorResponse = {
        detail: 'Credenciais inválidas'
      };

      service.login(loginData).subscribe(
        () => { throw new Error('should have failed'); },
        (error: any) => {
          expect(error.status).toBe(401);
          expect(error.error.detail).toBe('Credenciais inválidas');
        }
      );

      const req = httpMock.expectOne(`${API_URL}/login`);
      req.flush(errorResponse, { status: 401, statusText: 'Unauthorized' });
    });

    it('should handle user not found', () => {
      const loginData = {
        email: 'naoexiste@gmail.com',
        password: 'senha123'
      };

      service.login(loginData).subscribe(
        () => { throw new Error('should have failed'); },
        (error: any) => {
          expect(error.status).toBe(401);
        }
      );

      const req = httpMock.expectOne(`${API_URL}/login`);
      req.flush(
        { detail: 'Credenciais inválidas' },
        { status: 401, statusText: 'Unauthorized' }
      );
    });
  });

  // ============================================================
  // COMPLETE FLOW - REGISTER & LOGIN
  // ============================================================
  describe('Complete Flow - Register & Login', () => {
    it('should register and then login successfully', () => {
      const registerData = {
        email: 'fluxo@gmail.com',
        password: 'senha123'
      };

      const registerResponse = {
        id: 2,
        email: 'fluxo@gmail.com',
        score: 0
      };

      service.register(registerData).subscribe(regResponse => {
        expect(regResponse).toEqual(registerResponse);

        service.login(registerData).subscribe(loginResponse => {
          expect(loginResponse).toEqual(registerResponse);
          expect(loginResponse.id).toBe(2);
        });

        const loginReq = httpMock.expectOne(`${API_URL}/login`);
        loginReq.flush(registerResponse);
      });

      const regReq = httpMock.expectOne(`${API_URL}/register`);
      expect(regReq.request.method).toBe('POST');
      regReq.flush(registerResponse);
    });
  });

  // ============================================================
  // START GAME
  // ============================================================
  describe('Start Game - POST /games', () => {
    it('should start a game successfully', () => {
      const gameResponse = {
        id: 'game-123',
        status: 'playing',
        attempts: 0,
        max_attempts: 10
      };

      service.startGame().subscribe(response => {
        expect(response).toEqual(gameResponse);
        expect(response.status).toBe('playing');
      });

      const req = httpMock.expectOne(`${API_URL}/games`);
      expect(req.request.method).toBe('POST');
      req.flush(gameResponse);
    });

    it('should include auth headers when token exists', () => {
      localStorage.setItem('token', 'test-token');

      service.startGame().subscribe();

      const req = httpMock.expectOne(`${API_URL}/games`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush({ id: 'game-123', status: 'playing' });
    });
  });

  // ============================================================
  // GET GAME STATUS
  // ============================================================
  describe('Get Game Status - GET /games/:id', () => {
    it('should get game status successfully', () => {
      const gameResponse = {
        id: 'game-123',
        status: 'playing',
        attempts: 2,
        max_attempts: 10
      };

      service.getGameStatus('game-123').subscribe(response => {
        expect(response).toEqual(gameResponse);
        expect(response.status).toBe('playing');
        expect(response.attempts).toBe(2);
      });

      const req = httpMock.expectOne(`${API_URL}/games/game-123`);
      expect(req.request.method).toBe('GET');
      req.flush(gameResponse);
    });

    it('should include auth headers for game status', () => {
      localStorage.setItem('token', 'test-token-123');

      service.getGameStatus('game-456').subscribe();

      const req = httpMock.expectOne(`${API_URL}/games/game-456`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token-123');
      req.flush({ id: 'game-456', status: 'playing' });
    });

    it('should handle game status error', () => {
      service.getGameStatus('invalid-game').subscribe(
        () => { throw new Error('should have failed'); },
        (error: any) => {
          expect(error.status).toBe(404);
        }
      );

      const req = httpMock.expectOne(`${API_URL}/games/invalid-game`);
      req.flush({ detail: 'Game not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  // ============================================================
  // SUBMIT GUESS
  // ============================================================
  describe('Submit Guess - POST /games/:id/guess', () => {
    it('should submit guess successfully', () => {
      localStorage.setItem('token', 'test-token-123');

      const guessData = { colors: ['red', 'blue', 'yellow', 'green'] };
      const guessResponse = {
        feedback: {
          correct_position: 2,
          wrong_position: 1
        }
      };

      service.submitGuess('game-123', guessData).subscribe(response => {
        expect(response.feedback.correct_position).toBe(2);
        expect(response.feedback.wrong_position).toBe(1);
      });

      const req = httpMock.expectOne(`${API_URL}/games/game-123/guess`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(guessData);
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token-123');
      req.flush(guessResponse);
    });

    it('should handle guess error', () => {
      const guessData = { colors: ['red', 'blue', 'yellow', 'green'] };

      service.submitGuess('game-123', guessData).subscribe(
        () => { throw new Error('should have failed'); },
        (error: any) => {
          expect(error.status).toBe(400);
        }
      );

      const req = httpMock.expectOne(`${API_URL}/games/game-123/guess`);
      req.flush({ detail: 'Invalid colors' }, { status: 400, statusText: 'Bad Request' });
    });
  });

  // ============================================================
  // GET RANKING
  // ============================================================
  describe('Get Ranking - GET /leaderboard', () => {
    it('should get ranking successfully', () => {
      const rankingResponse = {
        leaderboard: [
          { email: 'user1@gmail.com', score: 100, attempts: 1 },
          { email: 'user2@gmail.com', score: 80, attempts: 3 }
        ]
      };

      service.getRanking().subscribe(response => {
        expect(Array.isArray(response)).toBe(true);
        expect(response.length).toBe(2);
        expect(response[0].score).toBe(100);
      });

      const req = httpMock.expectOne(`${API_URL}/leaderboard`);
      expect(req.request.method).toBe('GET');
      req.flush(rankingResponse);
    });

    it('should handle empty ranking', () => {
      const rankingResponse = { leaderboard: [] };

      service.getRanking().subscribe(response => {
        expect(Array.isArray(response)).toBe(true);
        expect(response.length).toBe(0);
      });

      const req = httpMock.expectOne(`${API_URL}/leaderboard`);
      req.flush(rankingResponse);
    });

    it('should fallback to empty array when leaderboard response is null', () => {
      service.getRanking().subscribe(response => {
        expect(Array.isArray(response)).toBe(true);
        expect(response).toEqual([]);
      });

      const req = httpMock.expectOne(`${API_URL}/leaderboard`);
      req.flush(null);
    });
  });

  // ============================================================
  // AUTHENTICATION - TOKEN MANAGEMENT
  // ============================================================
  describe('Authentication - Token Management', () => {
    it('should get stored token from localStorage', () => {
      localStorage.setItem('token', 'my-jwt-token-123');
      const token = service.getStoredToken();
      expect(token).toBe('my-jwt-token-123');
    });

    it('should return null when token not found', () => {
      localStorage.removeItem('token');
      const token = service.getStoredToken();
      expect(token).toBeNull();
    });

    it('should verify user is authenticated when token exists', () => {
      localStorage.setItem('token', 'valid-token');
      expect(service.isAuthenticated()).toBe(true);
    });

    it('should verify user is not authenticated when token missing', () => {
      localStorage.removeItem('token');
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should verify user is not authenticated with empty token', () => {
      localStorage.setItem('token', '');
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  // ============================================================
  // LOGOUT
  // ============================================================
  describe('Logout - POST /logout', () => {
    it('should logout successfully and clear localStorage', () => {
      localStorage.setItem('token', 'user-token');
      localStorage.setItem('tokenType', 'bearer');
      localStorage.setItem('userEmail', 'user@test.com');
      localStorage.setItem('userId', '123');

      service.logout().subscribe();

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('tokenType')).toBeNull();
      expect(localStorage.getItem('userEmail')).toBeNull();
      expect(localStorage.getItem('userId')).toBeNull();

      const req = httpMock.expectOne(`${API_URL}/logout`);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Authorization')).toBe('Bearer user-token');
      req.flush({ message: 'Logged out' });
    });

    it('should handle logout error but still clear localStorage', () => {
      localStorage.setItem('token', 'user-token');

      service.logout().subscribe({
        next: () => {
          throw new Error('should have failed');
        },
        error: (error: any) => {
          expect(error.status).toBe(401);
          expect(error.error.detail).toBe('Unauthorized');
        }
      });

      expect(localStorage.getItem('token')).toBeNull();

      const req = httpMock.expectOne(`${API_URL}/logout`);
      req.flush({ detail: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    });

    it('should logout without token', () => {
      localStorage.removeItem('token');

      service.logout().subscribe();

      const req = httpMock.expectOne(`${API_URL}/logout`);
      expect(req.request.headers.get('Authorization')).toBeNull();
      req.flush({ message: 'Logged out' });
    });
  });

  // ============================================================
  // MOCK MODE
  // ============================================================
  describe('Mock Mode - Testing Utilities', () => {
    it('should toggle mock mode', () => {
      expect(service.isMockMode()).toBe(false);
      service.toggleMockMode();
      expect(service.isMockMode()).toBe(true);
      service.toggleMockMode();
      expect(service.isMockMode()).toBe(false);
    });

    it('should clear mock state when toggling off', () => {
      service.toggleMockMode();
      service.startGame().subscribe();

      expect(service.isMockMode()).toBe(true);
      service.toggleMockMode();
      expect(service.isMockMode()).toBe(false);
      expect(service.getMockSecret()).toBeNull();
    });

    it('should reset mock attempts', () => {
      service.toggleMockMode();
      service.startGame().subscribe();
      service.resetMockAttempts();
      expect(service.isMockMode()).toBe(true);
      service.toggleMockMode();
    });

    it('should provide mock start game response', () => {
      service.toggleMockMode();
      service.startGame().subscribe(response => {
        expect(response.status).toBe('playing');
        expect(response.attempts).toBe(0);
        expect(response.max_attempts).toBe(10);
        expect(response.id).toContain('mock-game');
      });
      service.toggleMockMode();
    });

    it('should provide mock ranking data', () => {
      service.toggleMockMode();
      service.getRanking().subscribe(response => {
        expect(response.players).toBeDefined();
        expect(response.players.length).toBe(5);
        expect(response.players[0].name).toBe('João Silva');
      });
      service.toggleMockMode();
    });

    it('should provide mock login response', () => {
      service.toggleMockMode();
      service.login({ email: 'test@test.com', password: 'pass123' }).subscribe((response: any) => {
        expect(response.access_token).toContain('mock-token');
        expect(response.token_type).toBe('bearer');
        expect(response.email).toBe('test@test.com');
      });
      service.toggleMockMode();
    });

    it('should provide mock register response', () => {
      service.toggleMockMode();
      service.register({ email: 'newuser@test.com', password: 'pass123' }).subscribe((response: any) => {
        expect(response.email).toBe('newuser@test.com');
        expect(response.score).toBe(0);
        expect(response.id).toBeDefined();
      });
      service.toggleMockMode();
    });

    it('should provide mock guess feedback', () => {
      service.toggleMockMode();
      service.startGame().subscribe(() => {
        service.submitGuess('mock-game', { colors: ['red', 'blue', 'yellow', 'green'] }).subscribe((response: any) => {
          expect(response.feedback.correct_position).toBe(0);
          expect(response.feedback.wrong_position).toBe(2);
        });
      });
      service.toggleMockMode();
    });

    it('should return progressive mock feedback for attempts 1, 2 and 3', () => {
      vi.useFakeTimers();
      service.toggleMockMode();

      let first: any;
      let second: any;
      let third: any;

      service.startGame().subscribe();
      vi.advanceTimersByTime(300);

      service.submitGuess('mock-game', { colors: ['red', 'blue', 'yellow', 'green'] }).subscribe((response: any) => {
        first = response;
      });
      vi.advanceTimersByTime(500);

      service.submitGuess('mock-game', { colors: ['red', 'blue', 'yellow', 'green'] }).subscribe((response: any) => {
        second = response;
      });
      vi.advanceTimersByTime(500);

      service.submitGuess('mock-game', { colors: ['red', 'blue', 'yellow', 'green'] }).subscribe((response: any) => {
        third = response;
      });
      vi.advanceTimersByTime(500);

      expect(first.feedback.correct_position).toBe(0);
      expect(first.feedback.wrong_position).toBe(2);
      expect(second.feedback.correct_position).toBe(0);
      expect(second.feedback.wrong_position).toBe(3);
      expect(third.feedback.correct_position).toBe(4);
      expect(third.feedback.wrong_position).toBe(0);
      expect(third.status).toBe('won');
      expect(third.message).toContain('VITÓRIA');
      expect(Array.isArray(third.secret_code)).toBe(true);

      service.toggleMockMode();
      vi.useRealTimers();
    });

    it('should use random mock branch after third attempt', () => {
      vi.useFakeTimers();
      service.toggleMockMode();

      let fourth: any;
      service.startGame().subscribe();
      vi.advanceTimersByTime(300);

      service.submitGuess('mock-game', { colors: ['red', 'blue', 'yellow', 'green'] }).subscribe();
      vi.advanceTimersByTime(500);
      service.submitGuess('mock-game', { colors: ['red', 'blue', 'yellow', 'green'] }).subscribe();
      vi.advanceTimersByTime(500);
      service.submitGuess('mock-game', { colors: ['red', 'blue', 'yellow', 'green'] }).subscribe();
      vi.advanceTimersByTime(500);

      service.submitGuess('mock-game', { colors: ['red', 'blue', 'yellow', 'green'] }).subscribe((response: any) => {
        fourth = response;
      });
      vi.advanceTimersByTime(500);

      expect(fourth.status).toBe('playing');
      expect(fourth.message).toBe('Tentativa 4/10');
      expect(fourth.feedback.correct_position).toBeGreaterThanOrEqual(0);
      expect(fourth.feedback.correct_position).toBeLessThanOrEqual(3);
      expect(fourth.feedback.wrong_position).toBeGreaterThanOrEqual(0);
      expect(fourth.feedback.wrong_position).toBeLessThanOrEqual(4 - fourth.feedback.correct_position);

      service.toggleMockMode();
      vi.useRealTimers();
    });

    it('should return mock game status with and without secret code', () => {
      vi.useFakeTimers();
      service.toggleMockMode();

      let statusBeforeWin: any;
      let statusAfterWin: any;

      service.startGame().subscribe();
      vi.advanceTimersByTime(300);

      service.getGameStatus('mock-game').subscribe((response: any) => {
        statusBeforeWin = response;
      });
      vi.advanceTimersByTime(300);

      expect(statusBeforeWin.id).toBe('mock-game');
      expect(statusBeforeWin.status).toBe('playing');
      expect(statusBeforeWin.attempts).toBe(0);
      expect(statusBeforeWin.max_attempts).toBe(10);
      expect(statusBeforeWin.secret_code).toBeUndefined();

      service.submitGuess('mock-game', { colors: ['red', 'blue', 'yellow', 'green'] }).subscribe();
      vi.advanceTimersByTime(500);
      service.submitGuess('mock-game', { colors: ['red', 'blue', 'yellow', 'green'] }).subscribe();
      vi.advanceTimersByTime(500);
      service.submitGuess('mock-game', { colors: ['red', 'blue', 'yellow', 'green'] }).subscribe();
      vi.advanceTimersByTime(500);

      service.getGameStatus('mock-game').subscribe((response: any) => {
        statusAfterWin = response;
      });
      vi.advanceTimersByTime(300);

      expect(statusAfterWin.status).toBe('won');
      expect(statusAfterWin.attempts).toBe(3);
      expect(Array.isArray(statusAfterWin.secret_code)).toBe(true);

      service.toggleMockMode();
      vi.useRealTimers();
    });
  });
});
