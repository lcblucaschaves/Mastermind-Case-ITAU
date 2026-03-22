from fastapi import FastAPI, HTTPException, Request #type: ignore
from fastapi.middleware.cors import CORSMiddleware #type: ignore
from pydantic import BaseModel #type: ignore
from typing import List
import time
from service.service import GameService
from repository.repository import GameRepository

app = FastAPI()
repo = GameRepository()
service = GameService(repo)

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

class GuessRequest(BaseModel):
    colors: List[str]

@app.post("/games")
def start_game():
    return service.create_new_game()

@app.post("/games/{game_id}/guess")
def make_guess(game_id: str, guess: GuessRequest):
    game, result = service.process_guess(game_id, guess.colors)
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
    game = repo.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Jogo não encontrado")
    return game

