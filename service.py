import random
import uuid
from typing import List
from repository import GameRepository

class GameService:
    def __init__(self, repository: GameRepository):
        self.repo = repository
        self.available_colors = ['red', 'green', 'blue', 'yellow', 'orange', 'purple']

    def create_new_game(self) -> dict:
        new_game = {
            'id': str(uuid.uuid4()),
            'secret_code': random.sample(self.available_colors, 4),
            'attempts': 0,
            'max_attempts': 10,
            'status': 'active'
        }
        return self.repo.save_game(new_game)

    def process_guess(self, game_id: str, guess_colors: List[str]):
        game = self.repo.get_game(game_id)
        if not game or game.get('status') != 'active':
            return None, 'Jogo não encontrado ou já finalizado.'

        # Lógica do Mastermind 
        # 1) Cores na posição correta
        matches_na_posicao = [g == s for g, s in zip(guess_colors, game['secret_code'])]
        correct_pos = matches_na_posicao.count(True)

        # 2) Cores corretas em qualquer lugar (máximo 1 contagem por ocorrência)
        total_matches = 0
        for color in self.available_colors:
            total_matches += min(guess_colors.count(color), game['secret_code'].count(color))

        # 3) Cores corretas mas em posição errada
        wrong_pos = total_matches - correct_pos

        game['attempts'] += 1

        if correct_pos == 4:
            game['status'] = 'won'
        elif game['attempts'] >= game['max_attempts']:
            game['status'] = 'lost'

        self.repo.save_game(game)
        return game, (correct_pos, wrong_pos)
