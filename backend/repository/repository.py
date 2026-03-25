import logging
from database.database import SessionLocal, engine, Base
from database.models import Game, User

logger = logging.getLogger(__name__)

class UserRepository:
    def __init__(self):
        self.session_local = SessionLocal

    def create_user(self, email: str, password_hash: str, name: str) -> dict:
        db = self.session_local()
        try:
            db_user = User(email=email, password_hash=password_hash, name=name)
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
            return {'id': db_user.id, 'email': db_user.email, 'name': db_user.name, 'score': db_user.score}
        except Exception as e:
            logger.error(f"Falha ao criar usuário: email={email}, erro={str(e)}")
            raise
        finally:
            db.close()

    def get_user_by_email(self, email: str) -> dict | None:
        db = self.session_local()
        try:
            db_user = db.query(User).filter(User.email == email).first()
            if db_user:
                return {'id': db_user.id, 'email': db_user.email, 'name': db_user.name, 'password_hash': db_user.password_hash, 'score': db_user.score}
            return None
        finally:
            db.close()

    def get_user_by_id(self, user_id: int) -> dict | None:
        db = self.session_local()
        try:
            db_user = db.query(User).filter(User.id == user_id).first()
            if db_user:
                return {'id': db_user.id, 'email': db_user.email, 'name': db_user.name, 'score': db_user.score}
            return None
        finally:
            db.close()
    
    def update_user_password(self, user_id: int, new_password_hash: str) -> bool:
        db = self.session_local()
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
        db = self.session_local()
        try:
            db_user = db.query(User).filter(User.email == email).first()
            if not db_user:
                return False
            db.delete(db_user)
            db.commit()
            return True
        except Exception as e:
            logger.error(f"Falha ao deletar usuário: email={email}, erro={str(e)}")
            raise
        finally:
            db.close()

    def add_score_to_user(self, user_id: int, points: int) -> bool:
        db = self.session_local()
        try:
            db_user = db.query(User).filter(User.id == user_id).first()
            if not db_user:
                return False
            current = getattr(db_user, 'score', 0) or 0
            db_user.score = current + int(points)
            db.commit()
            return True
        except Exception as e:
            logger.error(f"Falha ao adicionar pontuação: user_id={user_id}, pontos={points}, erro={str(e)}")
            raise
        finally:
            db.close()

    def reset_user_score(self, user_id: int) -> bool:
        db = self.session_local()
        try:
            db_user = db.query(User).filter(User.id == user_id).first()
            if not db_user:
                return False
            db_user.score = 0
            db.commit()
            return True
        finally:
            db.close()

    def get_top_users(self) -> list:
        db = self.session_local()
        limit = 10
        try:
            rows = db.query(User).order_by(User.score.desc()).limit(limit).all()
            result = []
            for u in rows:
                result.append({'id': u.id, 'email': u.email, 'name': u.name, 'score': u.score})
            return result
        finally:
            db.close()

class GameRepository:
    def __init__(self):
        self.session_local = SessionLocal

    def save_game(self, game: dict) -> dict:
        """
        Salva um novo jogo ou atualiza um existente no SQLite
        """
        db = self.session_local()
        try:
            db_game = db.query(Game).filter(Game.id == game['id']).first()
            
            if db_game:
                # Atualizar jogo existente
                db_game.secret_code = game['secret_code']
                db_game.attempts = game['attempts']
                db_game.max_attempts = game['max_attempts']
                db_game.status = game['status']
                # atualiza histórico caso exista
                if 'history' in game:
                    db_game.history = game['history']
            else:
                # Criar novo jogo
                db_game = Game(
                    id=game['id'],
                    secret_code=game['secret_code'],
                    history=game.get('history', []),
                    attempts=game['attempts'],
                    max_attempts=game['max_attempts'],
                    status=game['status'],
                    user_id=game.get('user_id')
                )
                db.add(db_game)
            
            db.commit()
            db.refresh(db_game)
            result = self._game_to_dict(db_game)
        except Exception as e:
            logger.error(f"Falha ao salvar jogo: game_id={game.get('id')}, erro={str(e)}")
            raise
        finally:
            db.close()
        
        return result

    def get_game(self, game_id: str):
        """
        Busca um jogo pelo ID no SQLite
        """
        db = self.session_local()
        try:
            db_game = db.query(Game).filter(Game.id == game_id).first()
            if db_game:
                return self._game_to_dict(db_game) 
            return None
        except Exception as e:
            logger.error(f"Falha ao buscar jogo: game_id={game_id}, erro={str(e)}")
            raise
        finally:
            db.close()

    def _game_to_dict(self, db_game: Game) -> dict:
        """
        Converte um objeto Game ORM para dicionário
        """
        return {
            'id': db_game.id,
            'secret_code': db_game.secret_code,
            'history': getattr(db_game, 'history', []) or [],
            'attempts': db_game.attempts,
            'max_attempts': db_game.max_attempts,
            'status': db_game.status,
            'user_id': getattr(db_game, 'user_id', None)
        }
