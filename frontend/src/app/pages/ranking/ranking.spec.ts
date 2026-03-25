import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError, NEVER } from 'rxjs';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Ranking } from './ranking';
import { ApiService } from '../../services/api';

describe('Ranking', () => {
  let component: Ranking;
  let fixture: ComponentFixture<Ranking>;

  const apiServiceMock = {
    isAuthenticated: vi.fn(),
    getRanking: vi.fn(),
    logout: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ranking],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: apiServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Ranking);
    component = fixture.componentInstance;
  });

  beforeEach(() => {
    apiServiceMock.isAuthenticated.mockReset();
    apiServiceMock.getRanking.mockReset();
    apiServiceMock.logout.mockReset();

    apiServiceMock.isAuthenticated.mockReturnValue(true);
    apiServiceMock.getRanking.mockReturnValue(of([]));
    apiServiceMock.logout.mockReturnValue(of({}));
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should redirect to login when unauthenticated', () => {
    const navigateSpy = vi.spyOn((component as any).router, 'navigate').mockResolvedValue(true);
    apiServiceMock.isAuthenticated.mockReturnValue(false);

    component.ngOnInit();

    expect(navigateSpy).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
    expect(apiServiceMock.getRanking).not.toHaveBeenCalled();
  });

  it('should load and map ranking players from object format', () => {
    apiServiceMock.getRanking.mockReturnValue(of({
      players: [
        { id: 1, email: 'a@test.com', score: '10' },
        { id: 2, name: 'B', email: 'b@test.com', score: 5, attempts: 2, date: '2026-03-25' },
      ],
    }));

    component.loadRanking();

    expect(component.players.length).toBe(2);
    expect(component.players[0].name).toBe('a@test.com');
    expect(component.players[0].score).toBe(10);
    expect(component.players[1].name).toBe('B');
  });

  it('should load ranking from direct array response', () => {
    apiServiceMock.getRanking.mockReturnValue(of([
      { id: 1, name: 'Alice', email: 'alice@test.com', score: 20, attempts: 3, date: '2026-03-25' },
    ]));

    component.loadRanking();

    expect(component.players.length).toBe(1);
    expect(component.players[0].name).toBe('Alice');
    expect(component.players[0].score).toBe(20);
  });

  it('should use email as name fallback when name is missing', () => {
    apiServiceMock.getRanking.mockReturnValue(of([
      { id: 5, email: 'fallback@test.com', score: null, attempts: null, date: null },
    ]));

    component.loadRanking();

    expect(component.players[0].name).toBe('fallback@test.com');
    expect(component.players[0].email).toBe('fallback@test.com');
    expect(component.players[0].score).toBe(0);
    expect(component.players[0].attempts).toBe(0);
    expect(component.players[0].date).toBe('');
  });

  it('should use id-based name fallback when name and email are missing', () => {
    apiServiceMock.getRanking.mockReturnValue(of([
      { id: 42, score: 7 },
      { score: 3 },
    ]));

    component.loadRanking();

    expect(component.players[0].name).toBe('user-42');
    expect(component.players[0].email).toBe('');
    expect(component.players[1].name).toBe('user-??');
  });

  it('should handle object response without players property', () => {
    apiServiceMock.getRanking.mockReturnValue(of({}));

    component.loadRanking();

    expect(component.players).toEqual([]);
    expect(component.isLoading).toBe(false);
  });

  it('should set error message when ranking request fails', () => {
    apiServiceMock.getRanking.mockReturnValue(throwError(() => ({ status: 500 })));

    component.loadRanking();

    expect(component.isLoading).toBe(false);
    expect(component.message).toContain('Erro ao buscar o ranking');
  });

  it('should return medals for top 3', () => {
    expect(component.getMedal(0)).toBe('🥇');
    expect(component.getMedal(1)).toBe('🥈');
    expect(component.getMedal(2)).toBe('🥉');
    expect(component.getMedal(3)).toBe('');
  });

  it('should logout and navigate to login', () => {
    const navigateSpy = vi.spyOn((component as any).router, 'navigate').mockResolvedValue(true);
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem');

    component.logout();

    expect(apiServiceMock.logout).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith('user');
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
  });

  it('should navigate to login on logout error', () => {
    const navigateSpy = vi.spyOn((component as any).router, 'navigate').mockResolvedValue(true);
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem');
    apiServiceMock.logout.mockReturnValue(throwError(() => ({ status: 500 })));

    component.logout();

    expect(removeSpy).toHaveBeenCalledWith('user');
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
  });

  it('should navigate to dashboard on backToDashboard', () => {
    fixture.detectChanges();
    const navigateSpy = vi.spyOn((component as any).router, 'navigate').mockResolvedValue(true);

    component.backToDashboard();

    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should show loading spinner in template when isLoading is true', () => {
    apiServiceMock.getRanking.mockReturnValue(NEVER);
    fixture.detectChanges();

    const spinner = fixture.nativeElement.querySelector('.spinner');
    expect(spinner).toBeTruthy();
  });
});
