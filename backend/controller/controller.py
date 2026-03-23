from fastapi import FastAPI, HTTPException, Request, Depends, Header, Response #type: ignore
from fastapi.middleware.cors import CORSMiddleware #type: ignore
from pydantic import BaseModel #type: ignore
from typing import List
import time
from service.service import GameService, AuthService
from repository.repository import GameRepository, UserRepository

app = FastAPI()
game_repo = GameRepository()
user_repo = UserRepository()
game_service = GameService(game_repo)
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
    print(f"[{request.method}] {request.url.path} - Tempo: {process_time:.3f}s")
    return response

def get_current_user(authorization: str = Header(None, alias="Authorization")):
    # log incoming header for debugging
    print("Authorization header received:", repr(authorization))
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
        return auth_service.register(req.email, req.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/login")
def login(req: LoginRequest):
    try:
        token = auth_service.login(req.email, req.password)
        return {"access_token": token, "token_type": "bearer"}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


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
    return {"message": "Logout realizado com sucesso"}

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

