import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApiService } from './api';

describe('ApiService - Register & Login Tests', () => {
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
  });

  describe('Service Creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  // ============================================================
  // TESTES DO REGISTER
  // ============================================================

  describe('Register - POST /register', () => {
    
    it('should register a new user successfully', () => {
      // Dados de teste
      const registerData = {
        email: 'teste@gmail.com',
        password: 'senha123'
      };

      const expectedResponse = {
        id: 1,
        email: 'teste@gmail.com',
        score: 0
      };

      // Executar o registro
      service.register(registerData).subscribe(response => {
        expect(response).toEqual(expectedResponse);
        expect(response.id).toBe(1);
        expect(response.email).toBe('teste@gmail.com');
        expect(response.score).toBe(0);
      });

      // Verificar requisição
      const req = httpMock.expectOne(`${API_URL}/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(registerData);
      
      // Responder com sucesso
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
        password: '123' // Menos de 6 caracteres
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

    it('should send POST request', () => {
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
  // TESTES DO LOGIN
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
  // TESTES DO FLUXO COMPLETO (REGISTRO + LOGIN)
  // ============================================================

  describe('Complete Flow - Register & Login', () => {
    
    it('should register and then login successfully', () => {
      // PASSO 1: Registrar
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

        // PASSO 2: Fazer login com o novo usuário
        service.login(registerData).subscribe(loginResponse => {
          expect(loginResponse).toEqual(registerResponse);
          expect(loginResponse.id).toBe(2);
        });

        // Esperar requisição de login
        const loginReq = httpMock.expectOne(`${API_URL}/login`);
        loginReq.flush(registerResponse);
      });

      // Esperar e responder requisição de registro
      const regReq = httpMock.expectOne(`${API_URL}/register`);
      expect(regReq.request.method).toBe('POST');
      regReq.flush(registerResponse);
    });
  });

  // ============================================================
  // TESTES DOS OUTROS MÉTODOS (COMPATIBILIDADE)
  // ============================================================

  describe('Other Methods', () => {
    
    it('should start a game', () => {
      const gameResponse = {
        id: 'game-123',
        status: 'playing',
        attempts: 0,
        max_attempts: 10
      };

      service.startGame().subscribe(response => {
        expect(response).toEqual(gameResponse);
      });

      const req = httpMock.expectOne(`${API_URL}/games`);
      expect(req.request.method).toBe('POST');
      req.flush(gameResponse);
    });

    it('should get ranking', () => {
      const rankingResponse = {
        players: [
          { email: 'user1@gmail.com', score: 100 },
          { email: 'user2@gmail.com', score: 80 }
        ]
      };

      service.getRanking().subscribe(response => {
        expect(response.players).toBeDefined();
        expect(response.players.length).toBe(2);
      });

      const req = httpMock.expectOne(`${API_URL}/ranking`);
      expect(req.request.method).toBe('GET');
      req.flush(rankingResponse);
    });
  });
});
