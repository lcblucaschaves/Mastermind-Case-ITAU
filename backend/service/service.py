import random
import uuid
import secrets
from typing import List
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt
from repository.repository import GameRepository, UserRepository

# Simple JWT settings (change SECRET_KEY for production)
SECRET_KEY = "change-me-in-prod"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


class AuthService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    def hash_password(self, password: str) -> str:
        return pwd_context.hash(password)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    def create_access_token(self, user_id: int) -> str:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode = {"sub": str(user_id), "exp": expire}
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    def verify_token(self, token: str) -> int:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return int(payload.get("sub"))
        except Exception:
            return None

    def register(self, email: str, password: str) -> dict:
        if self.user_repo.get_user_by_email(email):
            raise ValueError("Usuário já existe")
        # keep it simple: basic length limit
        password = (password or "")[:128]
        hashed = self.hash_password(password)
        user = self.user_repo.create_user(email, hashed)
        return user

    def login(self, email: str, password: str) -> str:
        user = self.user_repo.get_user_by_email(email)
        if not user:
            raise ValueError("Credenciais inválidas")
        password = (password or "")[:128]
        if not self.verify_password(password, user['password_hash']):
            raise ValueError("Credenciais inválidas")
        token = self.create_access_token(user['id'])
        return token

    def change_password(self, user_id: int, old_password: str, new_password: str) -> bool:
        user = self.user_repo.get_user_by_id(user_id)
        if not user:
            raise ValueError("Usuário não encontrado")
        # fetch full user to get password_hash
        full = self.user_repo.get_user_by_email(user['email'])
        if not full:
            raise ValueError("Usuário não encontrado")
        old_password = (old_password or "")[:128]
        if not self.verify_password(old_password, full['password_hash']):
            raise ValueError("Senha antiga inválida")
        new_password = (new_password or "")[:128]
        new_hash = self.hash_password(new_password)
        ok = self.user_repo.update_user_password(user_id, new_hash)
        if not ok:
            raise ValueError("Falha ao atualizar senha")
        return True

    def delete_user(self, email: str, requester_id: int) -> bool:
        # only allow deleting own account for simplicity
        requester = self.user_repo.get_user_by_id(requester_id)
        if not requester:
            raise ValueError("Usuário solicitante não encontrado")
        if requester['email'] != email:
            raise ValueError("Só é possível deletar seu próprio usuário")
        ok = self.user_repo.delete_user_by_email(email)
        if not ok:
            raise ValueError("Usuário não encontrado")
        return True


class GameService:
    def __init__(self, repository: GameRepository, user_repo: UserRepository = None):
        self.repo = repository
        self.user_repo = user_repo or UserRepository()
        self.available_colors = ['red', 'green', 'blue', 'yellow', 'orange', 'purple']

    def create_new_game(self, user_id: int) -> dict:
        new_game = {
            'id': str(uuid.uuid4()),
            'secret_code': random.sample(self.available_colors, 4),
            'attempts': 0,
            'history': [],
            'max_attempts': 10,
            'status': 'active',
            'user_id': user_id
        }

        self.repo.save_game(new_game)
        new_game.pop('secret_code')  # Remove o código secreto para a resposta pública
        return new_game

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

        # registre a tentativa no histórico
        game.setdefault('history', [])
        attempt_number = game.get('attempts', 0) + 1
        attempt_record = {
            'guess': guess_colors,
            'correct_pos': correct_pos,
            'wrong_pos': wrong_pos,
            'attempt_number': attempt_number,
            'points': 0
        }

        # Pontuação só se o jogo for vencido
        points_awarded = 0
        if correct_pos == 4:
            # 1ª tentativa -> 10 pontos, 2ª -> 9, ..., 10ª -> 1
            points_awarded = max(0, 11 - attempt_number)
            attempt_record['points'] = points_awarded

        game['history'].append(attempt_record)

        game['attempts'] = attempt_number

        if correct_pos == 4:
            game['status'] = 'won'
        elif game['attempts'] >= game['max_attempts']:
            game['status'] = 'lost'

        self.repo.save_game(game)

        # Atualiza pontuação do usuário (somente soma, nunca subtrai)
        if points_awarded and game.get('user_id'):
            try:
                self.user_repo.add_score_to_user(game['user_id'], points_awarded)
            except Exception:
                pass

        return game, (correct_pos, wrong_pos)
