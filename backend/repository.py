import json
import os

class GameRepository:
    def __init__(self, filename="database.json"):
        self.filename = filename
        if not os.path.exists(self.filename):
            with open(self.filename, 'w') as f:
                json.dump({}, f)

    def _load(self):
        try:
            with open(self.filename, 'r') as f:
                content = f.read().strip()
                if not content:
                    return {}
                return json.loads(content)
        except (json.JSONDecodeError, FileNotFoundError):
            return {}

    def _save(self, data):
        with open(self.filename, 'w') as f:
            json.dump(data, f, indent=4)

    def save_game(self, game: dict):
        data = self._load()
        data[game['id']] = game
        self._save(data)
        return game

    def get_game(self, game_id: str):
        data = self._load()
        return data.get(game_id)
