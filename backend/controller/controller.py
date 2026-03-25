from fastapi import FastAPI, HTTPException, Request, Depends, Header, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import time
from service.service import GameService, AuthService
from repository.repository import GameRepository, UserRepository
from database.database import init_db

app = FastAPI()

# Inicializar banco de dados
init_db()

game_repo = GameRepository()
user_repo = UserRepository()
game_service = GameService(game_repo, user_repo)
auth_service = AuthService(user_repo)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    print(f"\n[{request.method}] {request.url.path}")
    print(f"   └─ Status: {response.status_code} | Tempo: {process_time:.3f}s")
    return response

def get_current_user(authorization: str = Header(None, alias="Authorization")):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token necessário")
    parts = authorization.split()
    if len(parts) == 1:
        token_value = parts[0]
    else:
        token_value = parts[1] if parts[0].lower() in ("bearer", "token") else parts[-1]

    user_id = auth_service.verify_token(token_value)
    if not user_id:
        raise HTTPException(status_code=401, detail="Token inválido")
    user = user_repo.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return user


class RegisterRequest(BaseModel):
    email: str
    password: str    
    name: str 

class LoginRequest(BaseModel):
    email: str
    password: str


class GuessRequest(BaseModel):
    colors: List[str]


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

@app.post("/register")
def register(req: RegisterRequest):
    try:
        print(f"\n [REGISTER] Iniciando registro...")
        print(f"   └─ Email: {req.email}")
        
        # Verificar se usuário já existe
        existing_user = user_repo.get_user_by_email(req.email)
        if existing_user:
            print(f"   └─  Email já registrado!")
            raise ValueError("Usuário já existe")
        
        # Registrar novo usuário
        user = auth_service.register(req.email, req.password, req.name)
        
        print(f"   └─ ✅ Usuário criado com sucesso!")
        print(f"      ID: {user['id']}")
        print(f"      Email: {user['email']}")
        print(f"      Name: {user['name']}")
        print(f"      Score: {user['score']}")
        
        return user
    except ValueError as e:
        print(f"   └─ ❌ Erro de validação: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"   └─ ❌ Erro inesperado: {str(e)}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")


@app.post("/login")
def login(req: LoginRequest):
    try:
        print(f"\n [LOGIN] Iniciando login...")
        print(f"   └─ Email: {req.email}")
        
        token = auth_service.login(req.email, req.password)
        
        # fetch user info to return basic profile
        user = user_repo.get_user_by_email(req.email)
        print(f"   └─ ✅ Login bem-sucedido!")
        print(f"      Token: {token[:20]}...")
        
        return {"access_token": token, "token_type": "bearer", "id": user['id'], "email": user['email'], "name": user['name']}
    except ValueError as e:
        print(f"   └─ ❌ Credenciais inválidas: {str(e)}")
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        print(f"   └─ ❌ Erro inesperado: {str(e)}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")


@app.post("/games")
def start_game(user: dict = Depends(get_current_user)):
    return game_service.create_new_game(user['id'])


@app.post("/users/change-password")
def change_password(req: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    try:
        auth_service.change_password(user['id'], req.old_password, req.new_password)
        return {"message": "Senha alterada com sucesso"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/users/{email}")
def delete_user(email: str, user: dict = Depends(get_current_user)):
    try:
        auth_service.delete_user(email, user['id'])
        return {"message": "Usuário deletado"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/logout")
def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie(key="access_token", httponly=True, samesite="lax", secure=False)
    print('[LOGOUT] Logout realizado para usuário:', user['email'])
    return {"message": "Logout realizado com sucesso"}


@app.post("/users/reset-score")
def reset_score(user: dict = Depends(get_current_user)):
    """Reseta a pontuação do usuário autenticado para zero."""
    ok = user_repo.reset_user_score(user['id'])
    if not ok:
        raise HTTPException(status_code=400, detail="Falha ao resetar pontuação")
    return {"message": "Pontuação resetada", "score": 0}


@app.get("/leaderboard")
def leaderboard():
    """Retorna até `limit` usuários com maior pontuação (decrescente)."""
    limit = 10  # pode ser parametrizado via query string se desejado, mas cuidado com limites abusivos
    limit = max(1, min(100, limit))
    top = user_repo.get_top_users()
    return {"leaderboard": top}

@app.post("/games/{game_id}/guess")
def make_guess(game_id: str, guess: GuessRequest, user: dict = Depends(get_current_user)):
    game, result = game_service.process_guess(game_id, guess.colors)
    if game is None:
        raise HTTPException(status_code=404, detail=result)

    correct, wrong = result
    return {
        "correct_position": correct,
        "wrong_position": wrong,
        "status": game['status'],
        "message": f"Tentativa {game['attempts']}/{game['max_attempts']}"
    }

@app.get("/games/{game_id}")
def get_status(game_id: str):
    game = game_repo.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Jogo não encontrado")
    return game

