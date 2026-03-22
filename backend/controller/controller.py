from fastapi import FastAPI, HTTPException #type: ignore
from pydantic import BaseModel #type: ignore
from typing import List
from service.service import GameService
from repository.repository import GameRepository

app = FastAPI()
repo = GameRepository()
service = GameService(repo)

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

