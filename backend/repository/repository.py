from database.database import SessionLocal, engine, Base
from database.models import Game, User

# Criar tabelas no banco de dados
Base.metadata.create_all(bind=engine)

class UserRepository:
    def __init__(self):
        self.SessionLocal = SessionLocal

    def create_user(self, email: str, password_hash: str) -> dict:
        db = self.SessionLocal()
        try:
            db_user = User(email=email, password_hash=password_hash)
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
            return {'id': db_user.id, 'email': db_user.email}
        finally:
            db.close()

    def get_user_by_email(self, email: str) -> dict:
        db = self.SessionLocal()
        try:
            db_user = db.query(User).filter(User.email == email).first()
            if db_user:
                return {'id': db_user.id, 'email': db_user.email, 'password_hash': db_user.password_hash}
            return None
        finally:
            db.close()

    def get_user_by_id(self, user_id: int) -> dict:
        db = self.SessionLocal()
        try:
            db_user = db.query(User).filter(User.id == user_id).first()
            if db_user:
                return {'id': db_user.id, 'email': db_user.email}
            return None
        finally:
            db.close()
    
    def update_user_password(self, user_id: int, new_password_hash: str) -> bool:
        db = self.SessionLocal()
        try:
            db_user = db.query(User).filter(User.id == user_id).first()
            if not db_user:
                return False
            db_user.password_hash = new_password_hash
            db.commit()
            return True
        finally:
            db.close()

    def delete_user_by_email(self, email: str) -> bool:
        db = self.SessionLocal()
        try:
            db_user = db.query(User).filter(User.email == email).first()
            if not db_user:
                return False
            db.delete(db_user)
            db.commit()
            return True
        finally:
            db.close()

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
                    status=game['status'],
                    user_id=game.get('user_id')
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
            'status': db_game.status,
            'user_id': getattr(db_game, 'user_id', None)
        }
