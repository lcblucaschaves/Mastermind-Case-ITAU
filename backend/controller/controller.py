from fastapi import FastAPI, HTTPException, Request, Depends, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List
import time
import logging
from service.service import GameService, AuthService
from repository.repository import GameRepository, UserRepository
from database.database import init_db

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Inicializar banco de dados
init_db()

game_repo = GameRepository()
user_repo = UserRepository()
game_service = GameService(game_repo, user_repo)
auth_service = AuthService(user_repo)

security = HTTPBearer(auto_error=False)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware de Logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    logger.info(f"{request.method} {request.url.path} - Status: {response.status_code} - Duração: {process_time:.3f}s")
    return response

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token necessário")
    user_id = auth_service.verify_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    user = user_repo.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado")
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

@app.post(
    "/register",
    responses={
        status.HTTP_400_BAD_REQUEST: {"description": "Email já existente ou dados inválidos"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"description": "Erro interno do servidor"}
    }
)
def register(req: RegisterRequest):
    """Registra um novo usuário com email, senha e nome."""
    try:
        logger.info(f"Registro de usuário iniciado: email={req.email}")
        
        existing_user = user_repo.get_user_by_email(req.email)
        if existing_user:
            logger.warning(f"Tentativa de registro com email já existente: {req.email}")
            raise ValueError("Usuário já existe")
        
        user = auth_service.register(req.email, req.password, req.name)
        
        logger.info(f"Usuário registrado com sucesso: id={user['id']}, email={user['email']}, nome={user['name']}")
        
        return user
    except ValueError as e:
        logger.warning(f"Erro na validação do registro: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Erro ao registrar usuário: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno do servidor")


@app.post(
    "/login",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": "Credenciais inválidas"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"description": "Erro interno do servidor"}
    }
)
def login(req: LoginRequest):
    """Autentica o usuário e retorna um token de acesso."""
    try:
        logger.info(f"Tentativa de login: email={req.email}")
        
        token = auth_service.login(req.email, req.password)
        
        user = user_repo.get_user_by_email(req.email)
        logger.info(f"Login realizado com sucesso: id={user['id']}, email={user['email']}")
        
        return {"access_token": token, "token_type": "bearer", "id": user['id'], "email": user['email'], "name": user['name']}
    except ValueError as e:
        logger.warning(f"Falha no login - credenciais inválidas: email={req.email}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except Exception as e:
        logger.error(f"Erro ao fazer login: email={req.email}, erro={str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno do servidor")


@app.post(
    "/games",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": "Token necessário ou inválido"}
    }
)
def start_game(user: dict = Depends(get_current_user)):
    """Inicia um novo jogo para o usuário autenticado."""
    return game_service.create_new_game(user['id'])


@app.post(
    "/users/change-password",
    responses={
        status.HTTP_400_BAD_REQUEST: {"description": "Senha antiga inválida ou dados inválidos"},
        status.HTTP_401_UNAUTHORIZED: {"description": "Token necessário ou inválido"}
    }
)
def change_password(req: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    """Altera a senha do usuário autenticado."""
    try:
        auth_service.change_password(user['id'], req.old_password, req.new_password)
        return {"message": "Senha alterada com sucesso"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@app.delete(
    "/users/{email}",
    responses={
        status.HTTP_400_BAD_REQUEST: {"description": "Email inválido ou permissão negada"},
        status.HTTP_401_UNAUTHORIZED: {"description": "Token necessário ou inválido"}
    }
)
def delete_user(email: str, user: dict = Depends(get_current_user)):
    """Deleta o usuário autenticado, verificando se o email corresponde ao do token."""
    try:
        auth_service.delete_user(email, user['id'])
        return {"message": "Usuário deletado"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@app.post(
    "/logout",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": "Token necessário ou inválido"}
    }
)
def logout(response: Response, user: dict = Depends(get_current_user)):
    """Realiza logout do usuário, invalidando o token e removendo o cookie."""
    response.delete_cookie(key="access_token", httponly=True, samesite="lax", secure=False)
    logger.info(f"Logout realizado: id={user['id']}, email={user['email']}")
    return {"message": "Logout realizado com sucesso"}


@app.post(
    "/users/reset-score",
    responses={
        status.HTTP_400_BAD_REQUEST: {"description": "Falha ao resetar pontuação"},
        status.HTTP_401_UNAUTHORIZED: {"description": "Token necessário ou inválido"}
    }
)
def reset_score(user: dict = Depends(get_current_user)):
    """Reseta a pontuação do usuário autenticado para zero."""
    ok = user_repo.reset_user_score(user['id'])
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Falha ao resetar pontuação")
    return {"message": "Pontuação resetada", "score": 0}


@app.get("/leaderboard")
def leaderboard():
    """Retorna até `limit` usuários com maior pontuação (decrescente)."""
    limit = 10
    limit = max(1, min(100, limit))
    top = user_repo.get_top_users()
    return {"leaderboard": top}

@app.post(
    "/games/{game_id}/guess",
    responses={
        status.HTTP_404_NOT_FOUND: {"description": "Jogo não encontrado ou já finalizado"},
        status.HTTP_401_UNAUTHORIZED: {"description": "Token necessário ou inválido"}
    }
)
def make_guess(game_id: str, guess: GuessRequest, user: dict = Depends(get_current_user)):
    """Processa uma tentativa de adivinhação para o jogo especificado."""
    game, result = game_service.process_guess(game_id, guess.colors)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result)

    correct, wrong = result
    return {
        "correct_position": correct,
        "wrong_position": wrong,
        "status": game['status'],
        "message": f"Tentativa {game['attempts']}/{game['max_attempts']}"
    }

@app.get(
    "/games/{game_id}",
    responses={
        status.HTTP_404_NOT_FOUND: {"description": "Jogo não encontrado"}
    }
)
def get_status(game_id: str):
    """Retorna o status do jogo especificado."""
    game = game_repo.get_game(game_id)
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jogo não encontrado")
    return game

