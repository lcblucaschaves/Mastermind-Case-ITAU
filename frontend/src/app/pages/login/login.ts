import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit, OnDestroy {
  loginForm!: FormGroup;
  registerForm!: FormGroup;
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  isRegisterMode = false;
  loginCompleted = false;
  registerCompleted = false;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ApiService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    // Limpar mensagens ao inicializar
    this.successMessage = '';
    this.errorMessage = '';
    this.isLoading = false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializa os formulários com validações
   */
  private initializeForm(): void {
    // Formulário de Login
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });

    // Formulário de Registro
    this.registerForm = this.fb.group(
      {
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator }
    );
  }

  /**
   * Validador personalizado para conferir se as senhas coincidem
   */
  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (!password || !confirmPassword) {
      return null;
    }

    if (confirmPassword.errors && !confirmPassword.errors['passwordMismatch']) {
      return null;
    }

    if (password.value === confirmPassword.value) {
      confirmPassword.setErrors(null);
      return null;
    } else {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
  }

  /**
   * Alterna entre modo login e modo registro
   */
  toggleMode(isRegister: boolean): void {
    this.isRegisterMode = isRegister;
    this.successMessage = '';
    this.errorMessage = '';
    this.isLoading = false;
    this.loginCompleted = false;
    this.registerCompleted = false;

    if (isRegister) {
      this.loginForm.reset();
    } else {
      this.registerForm.reset();
    }
  }

  /**
   * Verifica se um campo é inválido e foi tocado
   */
  isFieldInvalid(fieldName: string, form: FormGroup): boolean {
    const field = form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Executa o login
   */
  onLogin(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.loginForm.invalid) {
      this.errorMessage = 'Por favor, preencha todos os campos corretamente.';
      return;
    }

    this.isLoading = true;
    const loginData = this.loginForm.value;

    this.apiService.login(loginData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Armazenar token JWT
          localStorage.setItem('token', response.access_token);
          localStorage.setItem('tokenType', response.token_type);
          
          // Armazenar dados do usuário
          const userData = { email: loginData.email, id: response.id || 1 };
          localStorage.setItem('user', JSON.stringify(userData));
          localStorage.setItem('userId', (response.id || 1).toString());
          localStorage.setItem('userEmail', loginData.email);
          
          this.successMessage = `✅ Login realizado com sucesso! Bem-vindo!`;
          this.loginCompleted = true;
          this.isLoading = false;
          this.cdr.detectChanges();
          
          // Redirecionar para dashboard após mostrar mensagem
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 1500);
        },
        error: (error) => {
          // Extrair mensagem de erro do response
          const errorDetail = error.error?.detail || 'Erro ao fazer login. Tente novamente.';
          
          // Tratamento específico de erros
          if (error.status === 401) {
            this.errorMessage = `❌ ${errorDetail}`;
          } else if (error.status === 400) {
            this.errorMessage = `⚠️ Dados inválidos. Verifique email e senha.`;
          } else if (error.status === 0) {
            this.errorMessage = `❌ Erro de conexão. Verifique se o backend está rodando.`;
          } else {
            this.errorMessage = `❌ ${errorDetail}`;
          }
          
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Executa o cadastro de novo usuário
   */
  onRegister(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.registerForm.invalid) {
      this.errorMessage = 'Por favor, preencha todos os campos corretamente.';
      return;
    }

    this.isLoading = true;
    
    // Extrair apenas email e password para enviar ao backend
    const { email, password } = this.registerForm.value;
    const registerData = { email, password };

    this.apiService.register(registerData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Armazenar dados do usuário no localStorage
          const userData = { email, id: response.id };
          localStorage.setItem('user', JSON.stringify(userData));
          localStorage.setItem('userId', response.id.toString());
          localStorage.setItem('userEmail', email);
          
          this.successMessage = `✅ Conta criada com sucesso! Bem-vindo ao Mastermind!`;
          this.registerCompleted = true;
          this.isLoading = false;
          this.cdr.detectChanges();
          
          // Limpar formulário
          this.registerForm.reset();
          
          // Redirecionar para dashboard após mostrar mensagem
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 1500);
        },
        error: (error) => {
          // Extrair mensagem de erro do response
          const errorDetail = error.error?.detail || 'Erro ao criar conta. Tente novamente.';
          
          // Tratamento específico de erros
          if (error.status === 400) {
            if (errorDetail.includes('já existe')) {
              this.errorMessage = `❌ Este email já está cadastrado. Faça login ao invés disso.`;
            } else {
              this.errorMessage = `⚠️ ${errorDetail}`;
            }
          } else if (error.status === 0) {
            this.errorMessage = `❌ Erro de conexão. Verifique se o backend está rodando.`;
          } else {
            this.errorMessage = `❌ ${errorDetail}`;
          }
          
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });
  }
}
