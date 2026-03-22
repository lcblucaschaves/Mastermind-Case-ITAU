from database.database import SessionLocal, engine, Base
from database.models import Game

# Criar tabelas no banco de dados
Base.metadata.create_all(bind=engine)

class GameRepository:
    def __init__(self):
        self.SessionLocal = SessionLocal

    def save_game(self, game: dict) -> dict:
        """
        Salva um novo jogo ou atualiza um existente no SQLite
        """
        db = self.SessionLocal()
        try:
            db_game = db.query(Game).filter(Game.id == game['id']).first()
            
            if db_game:
                # Atualizar jogo existente
                db_game.secret_code = game['secret_code']
                db_game.attempts = game['attempts']
                db_game.max_attempts = game['max_attempts']
                db_game.status = game['status']
            else:
                # Criar novo jogo
                db_game = Game(
                    id=game['id'],
                    secret_code=game['secret_code'],
                    attempts=game['attempts'],
                    max_attempts=game['max_attempts'],
                    status=game['status']
                )
                db.add(db_game)
            
            db.commit()
            db.refresh(db_game)
            result = self._game_to_dict(db_game)
        finally:
            db.close()
        
        return result

    def get_game(self, game_id: str):
        """
        Busca um jogo pelo ID no SQLite
        """
        db = self.SessionLocal()
        try:
            db_game = db.query(Game).filter(Game.id == game_id).first()
            if db_game:
                return self._game_to_dict(db_game) 
            return None
        finally:
            db.close()

    def _game_to_dict(self, db_game: Game) -> dict:
        """
        Converte um objeto Game ORM para dicionário
        """
        return {
            'id': db_game.id,
            'secret_code': db_game.secret_code,
            'attempts': db_game.attempts,
            'max_attempts': db_game.max_attempts,
            'status': db_game.status
        }
