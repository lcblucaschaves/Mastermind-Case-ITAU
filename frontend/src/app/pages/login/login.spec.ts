import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Login } from './login';
import { ApiService } from '../../services/api';

describe('Login Component', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  const apiServiceMock = {
    login: vi.fn(),
    register: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: apiServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  beforeEach(() => {
    apiServiceMock.login.mockReset();
    apiServiceMock.register.mockReset();
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize login and register forms', () => {
    expect(component.loginForm).toBeTruthy();
    expect(component.registerForm).toBeTruthy();
    expect(component.loginForm.get('email')?.value).toBe('');
  });

  it('should show validation message on invalid login form', () => {
    component.onLogin();
    expect(component.errorMessage).toContain('preencha todos os campos');
    expect(apiServiceMock.login).not.toHaveBeenCalled();
  });

  it('should trigger onLogin when login form is submitted from DOM', () => {
    const loginSpy = vi.spyOn(component, 'onLogin');
    const loginFormEl = fixture.nativeElement.querySelector('form.login-form');

    loginFormEl.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(loginSpy).toHaveBeenCalled();
  });

  it('should login, persist token and navigate to dashboard', async () => {
    vi.useFakeTimers();
    const navigateSpy = vi.spyOn((component as any).router, 'navigate').mockResolvedValue(true);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    apiServiceMock.login.mockReturnValue(of({
      access_token: 'jwt-token',
      token_type: 'bearer',
      id: 10,
      email: 'user@test.com',
      name: 'User',
    }));

    component.loginForm.setValue({ email: 'user@test.com', password: '123456' });
    component.onLogin();

    expect(apiServiceMock.login).toHaveBeenCalled();
    expect(setItemSpy).toHaveBeenCalledWith('token', 'jwt-token');
    expect(component.loginCompleted).toBe(true);

    vi.advanceTimersByTime(1500);
    await Promise.resolve();
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
    vi.useRealTimers();
  });

  it('should show friendly message when register receives duplicated email', () => {
    apiServiceMock.register.mockReturnValue(
      throwError(() => ({ status: 400, error: { detail: 'email já existe' } }))
    );

    component.registerForm.setValue({
      name: 'User',
      email: 'user@test.com',
      password: '123456',
      confirmPassword: '123456',
    });

    component.onRegister();

    expect(apiServiceMock.register).toHaveBeenCalled();
    expect(component.errorMessage).toContain('email já está cadastrado');
  });

  it('should set invalid register form message and return early', () => {
    component.toggleMode(true);
    component.registerForm.patchValue({
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    });

    component.onRegister();

    expect(component.errorMessage).toContain('preencha todos os campos');
    expect(apiServiceMock.register).not.toHaveBeenCalled();
  });

  it('should toggle register mode and clear messages', () => {
    component.isRegisterMode = false;
    component.successMessage = 'Previous';
    component.errorMessage = 'Previous';
    component.toggleMode(true);
    expect(component.isRegisterMode).toBe(true);
    expect(component.successMessage).toBe('');
    expect(component.errorMessage).toBe('');
  });

  it('should toggle back to login mode and reset register form', () => {
    component.registerForm.setValue({
      name: 'Temp User',
      email: 'temp@test.com',
      password: '123456',
      confirmPassword: '123456'
    });

    component.toggleMode(false);

    expect(component.isRegisterMode).toBe(false);
    expect(component.registerForm.get('name')?.value).toBeNull();
    expect(component.registerForm.get('email')?.value).toBeNull();
  });

  it('should validate email field', () => {
    const emailControl = component.loginForm.get('email');
    emailControl?.setValue('invalid');
    expect(emailControl?.errors?.['email']).toBe(true);
    emailControl?.setValue('valid@email.com');
    expect(emailControl?.valid).toBe(true);
  });

  it('should validate password min length', () => {
    const passwordControl = component.loginForm.get('password');
    passwordControl?.setValue('123');
    expect(passwordControl?.errors?.['minlength']).toBeDefined();
  });

  it('should identify invalid touched field', () => {
    const emailControl = component.loginForm.get('email');
    emailControl?.markAsTouched();
    emailControl?.setValue('');
    const result = component.isFieldInvalid('email', component.loginForm);
    expect(result).toBe(true);
  });

  it('should handle 401 unauthorized error login', () => {
    apiServiceMock.login.mockReturnValue(
      throwError(() => ({ 
        status: 401, 
        error: { detail: 'Credenciais inválidas' } 
      }))
    );

    component.loginForm.setValue({ email: 'user@test.com', password: '123456' });
    component.onLogin();

    expect(component.errorMessage).toContain('Credenciais inválidas');
    expect(component.isLoading).toBe(false);
  });

  it('should handle 400 bad request error login', () => {
    apiServiceMock.login.mockReturnValue(
      throwError(() => ({ 
        status: 400, 
        error: { detail: 'Dados inválidos' } 
      }))
    );

    component.loginForm.setValue({ email: 'test@test.com', password: '123456' });
    component.onLogin();

    expect(component.errorMessage).toContain('Dados inválidos');
  });

  it('should handle network error login', () => {
    apiServiceMock.login.mockReturnValue(
      throwError(() => ({ status: 0, error: {} }))
    );

    component.loginForm.setValue({ email: 'test@test.com', password: '123456' });
    component.onLogin();

    expect(component.errorMessage).toContain('Erro de conexão');
  });

  it('should handle generic server error on login', () => {
    apiServiceMock.login.mockReturnValue(
      throwError(() => ({ status: 500, error: { detail: 'Erro interno' } }))
    );

    component.loginForm.setValue({ email: 'test@test.com', password: '123456' });
    component.onLogin();

    expect(component.errorMessage).toContain('Erro interno');
    expect(component.isLoading).toBe(false);
  });

  it('should validate matching passwords', () => {
    component.registerForm.setValue({
      name: 'User',
      email: 'test@test.com',
      password: 'password123',
      confirmPassword: 'password123'
    });
    expect(component.registerForm.valid).toBe(true);
  });

  it('should invalidate non-matching passwords', () => {
    component.registerForm.patchValue({
      password: 'password123',
      confirmPassword: 'different'
    });
    expect(component.registerForm.errors?.['passwordMismatch']).toBe(true);
  });

  it('should preserve existing confirmPassword errors in validator', () => {
    const confirmPassword = component.registerForm.get('confirmPassword');
    confirmPassword?.setErrors({ required: true });

    const result = (component as any).passwordMatchValidator(component.registerForm);

    expect(result).toBeNull();
    expect(confirmPassword?.errors?.['required']).toBe(true);
  });

  it('should return null in password validator when controls are missing', () => {
    const result = (component as any).passwordMatchValidator({ get: () => null });
    expect(result).toBeNull();
  });

  it('should clear loading on toggle mode', () => {
    component.isLoading = true;
    component.toggleMode(true);
    expect(component.isLoading).toBe(false);
  });

  it('should handle register network error', () => {
    apiServiceMock.register.mockReturnValue(
      throwError(() => ({ status: 0, error: {} }))
    );

    component.registerForm.setValue({
      name: 'User',
      email: 'test@test.com',
      password: '123456',
      confirmPassword: '123456',
    });
    component.onRegister();

    expect(component.errorMessage).toContain('Erro de conexão');
  });

  it('should cleanup on destroy', () => {
    const destroySpy = vi.spyOn((component as any).destroy$, 'next');
    component.ngOnDestroy();
    expect(destroySpy).toHaveBeenCalled();
  });

  it('should persist user data on successful login', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    vi.useFakeTimers();
    vi.spyOn((component as any).router, 'navigate').mockResolvedValue(true);

    apiServiceMock.login.mockReturnValue(of({
      access_token: 'jwt-token',
      token_type: 'bearer',
      id: 10,
      email: 'user@test.com',
      name: 'User',
    }));

    component.loginForm.setValue({ email: 'user@test.com', password: '123456' });
    component.onLogin();

    expect(setItemSpy).toHaveBeenCalledWith('tokenType', 'bearer');
    expect(setItemSpy).toHaveBeenCalledWith('userId', '10');

    vi.useRealTimers();
  });

  it('should register successfully with valid data', () => {
    vi.useFakeTimers();
    const navigateSpy = vi.spyOn((component as any).router, 'navigate').mockResolvedValue(true);

    apiServiceMock.register.mockReturnValue(of({
      id: 5,
      name: 'New User',
      email: 'newuser@test.com'
    }));

    component.registerForm.setValue({
      name: 'New User',
      email: 'newuser@test.com',
      password: '123456',
      confirmPassword: '123456'
    });
    component.onRegister();

    expect(apiServiceMock.register).toHaveBeenCalledWith({
      name: 'New User',
      email: 'newuser@test.com',
      password: '123456'
    });
    expect(component.successMessage).toContain('Conta criada com sucesso');
    expect(component.registerCompleted).toBe(true);

    vi.advanceTimersByTime(1500);
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);

    vi.useRealTimers();
  });

  it('should register successfully using form name fallback when response has no name', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    apiServiceMock.register.mockReturnValue(of({
      id: 7,
      email: 'fallback@test.com'
    }));

    component.registerForm.setValue({
      name: 'Fallback Name',
      email: 'fallback@test.com',
      password: '123456',
      confirmPassword: '123456'
    });

    component.onRegister();

    expect(setItemSpy).toHaveBeenCalledWith(
      'user',
      JSON.stringify({ name: 'Fallback Name', email: 'fallback@test.com', id: 7 })
    );
  });

  it('should validate register name min length', () => {
    const nameControl = component.registerForm.get('name');
    nameControl?.setValue('A');
    expect(nameControl?.errors?.['minlength']).toBeDefined();
  });

  it('should handle register 400 generic error', () => {
    apiServiceMock.register.mockReturnValue(
      throwError(() => ({ 
        status: 400, 
        error: { detail: 'Campo obrigatório' } 
      }))
    );

    component.registerForm.setValue({
      name: 'User',
      email: 'test@test.com',
      password: '123456',
      confirmPassword: '123456',
    });
    component.onRegister();

    expect(component.errorMessage).toContain('Campo obrigatório');
  });

  it('should handle register generic server error', () => {
    apiServiceMock.register.mockReturnValue(
      throwError(() => ({ status: 500, error: { detail: 'Falha inesperada' } }))
    );

    component.registerForm.setValue({
      name: 'User',
      email: 'test@test.com',
      password: '123456',
      confirmPassword: '123456',
    });
    component.onRegister();

    expect(component.errorMessage).toContain('Falha inesperada');
    expect(component.isLoading).toBe(false);
  });

  it('should use default register error message when detail is missing', () => {
    apiServiceMock.register.mockReturnValue(
      throwError(() => ({ status: 500, error: {} }))
    );

    component.registerForm.setValue({
      name: 'User',
      email: 'test@test.com',
      password: '123456',
      confirmPassword: '123456',
    });
    component.onRegister();

    expect(component.errorMessage).toContain('Erro ao criar conta. Tente novamente.');
  });

  it('should render explanation and login section in template', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Como Jogar');
    expect(text).toContain('Mastermind');
    expect(text).toContain('Entrar no Jogo');
  });

  it('should switch to register mode from tab click and display register form', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.tab-button');
    buttons[1].click();
    fixture.detectChanges();

    expect(component.isRegisterMode).toBe(true);
    expect(fixture.nativeElement.querySelector('#register-name')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Criar Conta');
  });

  it('should trigger onRegister when register form is submitted from DOM', () => {
    const registerSpy = vi.spyOn(component, 'onRegister');
    apiServiceMock.register.mockReturnValue(of({ id: 11, email: 'user@test.com', name: 'User' }));
    const buttons = fixture.nativeElement.querySelectorAll('.tab-button');
    buttons[1].click();

    component.registerForm.setValue({
      name: 'User',
      email: 'user@test.com',
      password: '123456',
      confirmPassword: '123456'
    });
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]');
    submitButton.click();
    fixture.detectChanges();

    expect(registerSpy).toHaveBeenCalled();
  });

  it('should fallback user data fields on login success when response fields are missing', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    apiServiceMock.login.mockReturnValue(of({
      access_token: 'jwt-token',
      token_type: 'bearer'
    }));

    component.loginForm.setValue({ email: 'fallback@test.com', password: '123456' });
    component.onLogin();

    expect(setItemSpy).toHaveBeenCalledWith(
      'user',
      JSON.stringify({ name: 'fallback@test.com', email: 'fallback@test.com', id: 1 })
    );
    expect(setItemSpy).toHaveBeenCalledWith('userId', '1');
    expect(setItemSpy).toHaveBeenCalledWith('userEmail', 'fallback@test.com');
  });

  it('should render register field validation messages in template', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.tab-button');
    buttons[1].click();

    component.registerForm.get('name')?.markAsTouched();
    component.registerForm.get('email')?.markAsTouched();
    component.registerForm.get('password')?.markAsTouched();
    component.registerForm.get('confirmPassword')?.markAsTouched();
    component.registerForm.patchValue({
      name: 'A',
      email: 'invalido',
      password: '123',
      confirmPassword: '456'
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Nome é obrigatório');
    expect(text).toContain('E-mail válido é obrigatório');
    expect(text).toContain('Senha é obrigatória');
    expect(text).toContain('As senhas não coincidem');
  });

  it('should render register success and error messages in template', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.tab-button');
    buttons[1].click();

    component.successMessage = 'sucesso cadastro';
    component.errorMessage = 'erro cadastro';
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('sucesso cadastro');
    expect(text).toContain('erro cadastro');
  });

  it('should render login field validation messages in template', () => {
    component.loginForm.get('email')?.markAsTouched();
    component.loginForm.get('password')?.markAsTouched();
    component.loginForm.patchValue({ email: 'invalido', password: '123' });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('E-mail válido é obrigatório');
  });

  it('should render login loading text while waiting response', () => {
    apiServiceMock.login.mockReturnValue(NEVER);
    component.loginForm.setValue({ email: 'user@test.com', password: '123456' });
    component.onLogin();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Entrando...');
  });

  it('should render register loading text while waiting response', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.tab-button');
    buttons[1].click();
    apiServiceMock.register.mockReturnValue(NEVER);
    component.registerForm.setValue({
      name: 'User',
      email: 'user@test.com',
      password: '123456',
      confirmPassword: '123456',
    });
    component.onRegister();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Criando...');
  });
});
