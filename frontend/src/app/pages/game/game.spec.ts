import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Game } from './game';
import { ApiService } from '../../services/api';

@Component({
  standalone: true,
  template: '',
})
class DummyRouteComponent {}

describe('Game', () => {
  let component: Game;
  let fixture: ComponentFixture<Game>;

  const apiServiceMock = {
    isAuthenticated: vi.fn(),
    isMockMode: vi.fn(),
    startGame: vi.fn(),
    submitGuess: vi.fn(),
    getGameStatus: vi.fn(),
    getMockSecret: vi.fn(),
    logout: vi.fn(),
    toggleMockMode: vi.fn(),
    resetMockAttempts: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Game],
      providers: [
        provideRouter([
          { path: 'login', component: DummyRouteComponent },
          { path: 'dashboard', component: DummyRouteComponent },
        ]),
        { provide: ApiService, useValue: apiServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Game);
    component = fixture.componentInstance;
  });

  beforeEach(() => {
    apiServiceMock.isAuthenticated.mockReset();
    apiServiceMock.isMockMode.mockReset();
    apiServiceMock.startGame.mockReset();
    apiServiceMock.submitGuess.mockReset();
    apiServiceMock.getGameStatus.mockReset();
    apiServiceMock.getMockSecret.mockReset();
    apiServiceMock.logout.mockReset();
    apiServiceMock.toggleMockMode.mockReset();
    apiServiceMock.resetMockAttempts.mockReset();

    apiServiceMock.isAuthenticated.mockReturnValue(true);
    apiServiceMock.isMockMode.mockReturnValue(false);
    apiServiceMock.startGame.mockReturnValue(of({ id: 'game-1' }));
    apiServiceMock.submitGuess.mockReturnValue(of({
      feedback: { correct_position: 4, wrong_position: 0 },
      status: 'won',
    }));
    apiServiceMock.getGameStatus.mockReturnValue(of({
      secret_code: ['red', 'blue', 'yellow', 'green'],
    }));
    apiServiceMock.getMockSecret.mockReturnValue(null);
    apiServiceMock.logout.mockReturnValue(of({}));
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render the playing board with hidden secret, current row and color selector', () => {
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const hiddenSecretSlots = Array.from(element.querySelectorAll('.secret-code-slot'));
    const currentRow = element.querySelector('.current-attempt');
    const colorButtons = element.querySelectorAll('.color-button');
    const submitButton = element.querySelector('.submit-button') as HTMLButtonElement;
    const futureRows = element.querySelectorAll('.attempt-row .position-peg.empty-slot');

    expect(hiddenSecretSlots).toHaveLength(4);
    expect(hiddenSecretSlots.every(slot => slot.textContent?.includes('🤐'))).toBe(true);
    expect(currentRow).toBeTruthy();
    expect(colorButtons).toHaveLength(component.availableColors.length);
    expect(submitButton).toBeTruthy();
    expect(submitButton.disabled).toBe(true);
    expect(futureRows.length).toBeGreaterThan(0);
  });

  it('should render previous guesses and feedback pegs in the board', () => {
    apiServiceMock.isAuthenticated.mockReturnValue(false);
    component.guesses = [
      {
        colors: ['vermelho', 'azul', 'amarelo', 'verde'],
        feedback: { correct_position: 2, wrong_position: 1 },
        timestamp: new Date(),
      },
    ];
    component.currentAttempt = 1;
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const attemptRows = element.querySelectorAll('.attempt-row');
    const positionPegs = element.querySelectorAll('.attempt-row .attempt-positions .position-peg');
    const feedbackGrid = element.querySelector('.attempt-feedback .feedback-grid');
    const boardText = element.textContent ?? '';

    expect(attemptRows.length).toBeGreaterThan(1);
    expect(positionPegs.length).toBeGreaterThanOrEqual(4);
    expect(feedbackGrid).toBeTruthy();
    expect(boardText).toContain('🔴');
    expect(boardText).toContain('🔵');
  });

  it('should render selected colors in the current row and enable submit button', () => {
    apiServiceMock.isAuthenticated.mockReturnValue(false);
    component.selectedColors = ['vermelho', 'azul', 'amarelo', 'verde'];
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const editablePegs = element.querySelectorAll('.current-attempt .position-peg.editable');
    const submitButton = element.querySelector('.submit-button') as HTMLButtonElement;

    expect(editablePegs).toHaveLength(4);
    expect(Array.from(editablePegs).every(peg => peg.textContent?.trim() !== '-')).toBe(true);
    expect(submitButton.disabled).toBe(false);
  });

  it('should clear a selected position when clicking an editable peg', () => {
    apiServiceMock.isAuthenticated.mockReturnValue(false);
    component.selectedColors = ['vermelho', 'azul', 'amarelo', 'verde'];
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const firstEditablePeg = element.querySelector('.current-attempt .position-peg.editable') as HTMLElement;

    firstEditablePeg.click();
    fixture.detectChanges();

    expect(component.selectedColors[0]).toBe('');
  });

  it('should select a color when clicking a color button', () => {
    apiServiceMock.isAuthenticated.mockReturnValue(false);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const firstColorButton = element.querySelector('.color-button') as HTMLButtonElement;

    firstColorButton.click();
    fixture.detectChanges();

    expect(component.selectedColors[0]).toBe('vermelho');
  });

  it('should submit the guess when clicking the submit button', () => {
    apiServiceMock.isAuthenticated.mockReturnValue(false);
    component.gameId = 'game-1';
    component.selectedColors = ['vermelho', 'azul', 'amarelo', 'verde'];
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const submitButton = element.querySelector('.submit-button') as HTMLButtonElement;

    submitButton.click();

    expect(apiServiceMock.submitGuess).toHaveBeenCalledWith('game-1', {
      colors: ['red', 'blue', 'yellow', 'green'],
    });
  });

  it('should render victory screen, score, revealed secret and fireworks when game is won', () => {
    apiServiceMock.isAuthenticated.mockReturnValue(false);
    component.gameStatus = 'won';
    component.currentAttempt = 3;
    component.secretCode = ['vermelho', 'azul', 'amarelo', 'verde'];
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const victoryTitle = element.querySelector('.result-title.victory');
    const defeatTitle = element.querySelector('.result-title.defeat');
    const scoreText = element.textContent ?? '';
    const secretEmojis = element.querySelectorAll('.secret-emoji');
    const restartButton = element.querySelector('.restart-button');
    const backButton = element.querySelector('.back-button');
    const fireworks = element.querySelectorAll('.fireworks-container .firework');

    expect(victoryTitle?.textContent ?? '').toContain('VENCEU');
    expect(defeatTitle).toBeNull();
    expect(scoreText).toContain('Pontuação:');
    expect(secretEmojis).toHaveLength(4);
    expect(restartButton).toBeTruthy();
    expect(backButton).toBeTruthy();
    expect(fireworks).toHaveLength(40);
  });

  it('should render defeat screen without score or fireworks when game is lost', () => {
    apiServiceMock.isAuthenticated.mockReturnValue(false);
    component.gameStatus = 'lost';
    component.currentAttempt = component.maxAttempts;
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const defeatTitle = element.querySelector('.result-title.defeat');
    const victoryTitle = element.querySelector('.result-title.victory');
    const scoreText = element.textContent ?? '';
    const fireworks = element.querySelector('.fireworks-container');
    const colorSelector = element.querySelector('.color-selector');

    expect(defeatTitle?.textContent ?? '').toContain('FIM DO JOGO');
    expect(victoryTitle).toBeNull();
    expect(scoreText).not.toContain('Pontuação:');
    expect(fireworks).toBeNull();
    expect(colorSelector).toBeNull();
  });

  it('should trigger restart and back actions from game over buttons', () => {
    apiServiceMock.isAuthenticated.mockReturnValue(false);
    component.gameStatus = 'won';
    const restartSpy = vi.spyOn(component, 'restartGame');
    const backSpy = vi.spyOn(component, 'backToDashboard');
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const restartButton = element.querySelector('.restart-button') as HTMLButtonElement;
    const backButton = element.querySelector('.back-button') as HTMLButtonElement;

    backButton.click();
    restartButton.click();

    expect(backSpy).toHaveBeenCalled();
    expect(restartSpy).toHaveBeenCalled();
  });

  it('should redirect to login when unauthenticated', () => {
    const navigateSpy = vi.spyOn((component as any).router, 'navigate').mockResolvedValue(true);
    apiServiceMock.isAuthenticated.mockReturnValue(false);

    component.ngOnInit();

    expect(navigateSpy).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
    expect(apiServiceMock.startGame).not.toHaveBeenCalled();
  });

  it('should cleanup subscriptions on destroy', () => {
    const nextSpy = vi.spyOn((component as any).destroy$, 'next');
    const completeSpy = vi.spyOn((component as any).destroy$, 'complete');

    component.ngOnDestroy();

    expect(nextSpy).toHaveBeenCalled();
    expect(completeSpy).toHaveBeenCalled();
  });

  it('should initialize game state on startGame success', () => {
    component.startGame();

    expect(component.gameId).toBe('game-1');
    expect(component.currentAttempt).toBe(0);
    expect(component.gameStatus).toBe('playing');
    expect(component.message).toContain('Jogo iniciado');
  });

  it('should not select color when game is not playing', () => {
    component.gameStatus = 'lost';
    component.selectedColors = ['', '', '', ''];

    component.selectColor('vermelho', 0);

    expect(component.selectedColors[0]).toBe('');
  });

  it('should set error message when startGame fails', () => {
    apiServiceMock.startGame.mockReturnValue(throwError(() => ({ status: 500 })));

    component.startGame();

    expect(component.messageType).toBe('error');
    expect(component.message).toContain('Erro ao iniciar o jogo');
  });

  it('should handle detectChanges error in startGame success path', () => {
    vi.spyOn((component as any).cd, 'detectChanges').mockImplementation(() => {
      throw new Error('cd fail');
    });

    component.startGame();

    expect(component.gameId).toBe('game-1');
  });

  it('should handle detectChanges error in startGame error path', () => {
    apiServiceMock.startGame.mockReturnValue(throwError(() => ({ status: 500 })));
    vi.spyOn((component as any).cd, 'detectChanges').mockImplementation(() => {
      throw new Error('cd fail');
    });

    component.startGame();

    expect(component.messageType).toBe('error');
  });

  it('should block submit when colors are missing', () => {
    component.selectedColors = ['vermelho', '', 'azul', 'verde'];

    component.submitGuess();

    expect(component.messageType).toBe('error');
    expect(apiServiceMock.submitGuess).not.toHaveBeenCalled();
  });

  it('should handle detectChanges error when submit is blocked by empty colors', () => {
    component.selectedColors = ['vermelho', '', 'azul', 'verde'];
    vi.spyOn((component as any).cd, 'detectChanges').mockImplementation(() => {
      throw new Error('cd fail');
    });

    component.submitGuess();

    expect(component.messageType).toBe('error');
  });

  it('should block submit when gameId is missing', () => {
    component.gameId = null;
    component.selectedColors = ['vermelho', 'azul', 'amarelo', 'verde'];

    component.submitGuess();

    expect(component.messageType).toBe('error');
    expect(component.message).toContain('ID do jogo não encontrado');
    expect(apiServiceMock.submitGuess).not.toHaveBeenCalled();
  });

  it('should submit guess, mark win and reveal secret', () => {
    component.gameId = 'game-1';
    component.selectedColors = ['vermelho', 'azul', 'amarelo', 'verde'];

    component.submitGuess();

    expect(apiServiceMock.submitGuess).toHaveBeenCalledWith('game-1', {
      colors: ['red', 'blue', 'yellow', 'green'],
    });
    expect(component.gameStatus).toBe('won');
    expect(component.secretCode).toEqual(['vermelho', 'azul', 'amarelo', 'verde']);
  });

  it('should support feedback response in top-level format', () => {
    component.gameId = 'game-1';
    component.selectedColors = ['vermelho', 'azul', 'amarelo', 'verde'];
    apiServiceMock.submitGuess.mockReturnValue(of({
      correct_position: 2,
      wrong_position: 1,
      message: 'API custom feedback'
    }));

    component.submitGuess();

    expect(component.guesses[0].feedback.correct_position).toBe(2);
    expect(component.guesses[0].feedback.wrong_position).toBe(1);
    expect(component.message).toContain('API custom feedback');
    expect(component.messageType).toBe('info');
  });

  it('should handle detectChanges error in submit success callback', () => {
    component.gameId = 'game-1';
    component.selectedColors = ['vermelho', 'azul', 'amarelo', 'verde'];
    apiServiceMock.submitGuess.mockReturnValue(of({
      feedback: { correct_position: 1, wrong_position: 1 },
    }));
    vi.spyOn((component as any).cd, 'detectChanges').mockImplementation(() => {
      throw new Error('cd fail');
    });

    component.submitGuess();

    expect(component.currentAttempt).toBeGreaterThan(0);
  });

  it('should fallback feedback values to zero when response has no feedback fields', () => {
    component.gameId = 'game-1';
    component.selectedColors = ['vermelho', 'azul', 'amarelo', 'verde'];
    apiServiceMock.submitGuess.mockReturnValue(of({}));

    component.submitGuess();

    expect(component.guesses[0].feedback.correct_position).toBe(0);
    expect(component.guesses[0].feedback.wrong_position).toBe(0);
    expect(component.message).toContain('Feedback: 0 corretas | 0 na posição errada');
  });

  it('should set lost state when max attempts is reached', () => {
    component.gameId = 'game-1';
    component.currentAttempt = component.maxAttempts - 1;
    component.selectedColors = ['vermelho', 'azul', 'amarelo', 'verde'];
    apiServiceMock.submitGuess.mockReturnValue(of({
      feedback: { correct_position: 1, wrong_position: 1 },
    }));

    component.submitGuess();

    expect(component.gameStatus).toBe('lost');
    expect(component.messageType).toBe('error');
    expect(component.message).toContain('Game Over');
  });

  it('should set info feedback message when game continues', () => {
    component.gameId = 'game-1';
    component.currentAttempt = 0;
    component.selectedColors = ['vermelho', 'azul', 'amarelo', 'verde'];
    apiServiceMock.submitGuess.mockReturnValue(of({
      feedback: { correct_position: 1, wrong_position: 2 },
    }));

    component.submitGuess();

    expect(component.gameStatus).toBe('playing');
    expect(component.messageType).toBe('info');
    expect(component.message).toContain('Feedback: 1 corretas | 2 na posição errada');
  });

  it('should reveal secret from mock service without calling getGameStatus', () => {
    component.gameId = 'game-1';
    apiServiceMock.isMockMode.mockReturnValue(true);
    apiServiceMock.getMockSecret.mockReturnValue(['red', 'blue', 'yellow', 'green']);

    component.revealSecret();

    expect(component.secretCode).toEqual(['vermelho', 'azul', 'amarelo', 'verde']);
    expect(apiServiceMock.getGameStatus).not.toHaveBeenCalled();
  });

  it('should return early in revealSecret when gameId is missing', () => {
    component.gameId = null;

    component.revealSecret();

    expect(apiServiceMock.getGameStatus).not.toHaveBeenCalled();
  });

  it('should reveal secret from alternate response key "secret"', () => {
    component.gameId = 'game-1';
    apiServiceMock.isMockMode.mockReturnValue(false);
    apiServiceMock.getGameStatus.mockReturnValue(of({
      secret: ['red', 'blue', 'yellow', 'green']
    }));

    component.revealSecret();

    expect(component.secretCode).toEqual(['vermelho', 'azul', 'amarelo', 'verde']);
  });

  it('should fallback to getGameStatus when mock secret is invalid', () => {
    component.gameId = 'game-1';
    apiServiceMock.isMockMode.mockReturnValue(true);
    apiServiceMock.getMockSecret.mockReturnValue(['red']);
    apiServiceMock.getGameStatus.mockReturnValue(of({
      secret_code: ['red', 'blue', 'yellow', 'green']
    }));

    component.revealSecret();

    expect(apiServiceMock.getGameStatus).toHaveBeenCalledWith('game-1');
    expect(component.secretCode).toEqual(['vermelho', 'azul', 'amarelo', 'verde']);
  });

  it('should clear secretCode when game status returns invalid secret', () => {
    component.gameId = 'game-1';
    component.secretCode = ['vermelho'];
    apiServiceMock.isMockMode.mockReturnValue(false);
    apiServiceMock.getGameStatus.mockReturnValue(of({ secret_code: ['red'] }));

    component.revealSecret();

    expect(component.secretCode).toEqual([]);
  });

  it('should clear secretCode when game status response is null', () => {
    component.gameId = 'game-1';
    component.secretCode = ['vermelho', 'azul'];
    apiServiceMock.isMockMode.mockReturnValue(false);
    apiServiceMock.getGameStatus.mockReturnValue(of(null));

    component.revealSecret();

    expect(component.secretCode).toEqual([]);
  });

  it('should logout and navigate to login on error', () => {
    const navigateSpy = vi.spyOn((component as any).router, 'navigate').mockResolvedValue(true);
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem');
    apiServiceMock.logout.mockReturnValue(throwError(() => ({ status: 401 })));

    component.logout();

    expect(removeSpy).toHaveBeenCalledWith('user');
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
  });

  it('should logout and navigate to login on success', () => {
    const navigateSpy = vi.spyOn((component as any).router, 'navigate').mockResolvedValue(true);
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem');
    apiServiceMock.logout.mockReturnValue(of({ ok: true }));

    component.logout();

    expect(removeSpy).toHaveBeenCalledWith('user');
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
  });

  it('should toggle mock mode, sync state and restart game', () => {
    const restartSpy = vi.spyOn(component, 'restartGame');
    apiServiceMock.isMockMode.mockReturnValue(true);

    component.toggleMockMode();

    expect(apiServiceMock.toggleMockMode).toHaveBeenCalled();
    expect(apiServiceMock.resetMockAttempts).toHaveBeenCalled();
    expect(component.mockMode).toBe(true);
    expect(restartSpy).toHaveBeenCalled();
  });

  it('should return defaults for unknown color mappings', () => {
    expect(component.getColorName('inexistente')).toBe('');
    expect(component.getLetterByColor('inexistente')).toBe('');
    expect(component.getColorEmoji('inexistente')).toBe('⭕');
  });

  it('should return zero score when won but penalty exceeds base score', () => {
    component.gameStatus = 'won';
    component.currentAttempt = 20;

    expect(component.calculateScore()).toBe(0);
  });

  it('should return zero score when game not won', () => {
    component.gameStatus = 'playing';
    component.currentAttempt = 3;

    expect(component.calculateScore()).toBe(0);
  });

  it('should return score when game is won', () => {
    component.gameStatus = 'won';
    component.currentAttempt = 3;

    expect(component.calculateScore()).toBe(800);
  });

  it('should handle submit error', () => {
    component.gameId = 'game-1';
    component.selectedColors = ['vermelho', 'azul', 'amarelo', 'verde'];
    apiServiceMock.submitGuess.mockReturnValue(throwError(() => ({ status: 500 })));

    component.submitGuess();

    expect(component.messageType).toBe('error');
    expect(component.message).toContain('Erro ao enviar palpite');
  });

  it('should handle detectChanges error in submit error callback', () => {
    component.gameId = 'game-1';
    component.selectedColors = ['vermelho', 'azul', 'amarelo', 'verde'];
    apiServiceMock.submitGuess.mockReturnValue(throwError(() => ({ status: 500 })));
    vi.spyOn((component as any).cd, 'detectChanges').mockImplementation(() => {
      throw new Error('cd fail');
    });

    component.submitGuess();

    expect(component.messageType).toBe('error');
  });

  it('should handle detectChanges error in revealSecret mock path', () => {
    component.gameId = 'game-1';
    apiServiceMock.isMockMode.mockReturnValue(true);
    apiServiceMock.getMockSecret.mockReturnValue(['red', 'blue', 'yellow', 'green']);
    vi.spyOn((component as any).cd, 'detectChanges').mockImplementation(() => {
      throw new Error('cd fail');
    });

    component.revealSecret();

    expect(component.secretCode).toEqual(['vermelho', 'azul', 'amarelo', 'verde']);
  });

  it('should handle detectChanges error in revealSecret getGameStatus path', () => {
    component.gameId = 'game-1';
    apiServiceMock.isMockMode.mockReturnValue(false);
    apiServiceMock.getGameStatus.mockReturnValue(of({
      secret_code: ['red', 'blue', 'yellow', 'green']
    }));
    vi.spyOn((component as any).cd, 'detectChanges').mockImplementation(() => {
      throw new Error('cd fail');
    });

    component.revealSecret();

    expect(component.secretCode).toEqual(['vermelho', 'azul', 'amarelo', 'verde']);
  });

  it('should execute revealSecret error callback without breaking flow', () => {
    component.gameId = 'game-1';
    apiServiceMock.isMockMode.mockReturnValue(false);
    apiServiceMock.getGameStatus.mockReturnValue(throwError(() => ({ status: 500 })));

    component.revealSecret();

    expect(apiServiceMock.getGameStatus).toHaveBeenCalledWith('game-1');
  });
});
