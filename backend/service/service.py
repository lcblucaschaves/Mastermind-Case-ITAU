import random
import uuid
import logging
import os
from typing import List
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from passlib.context import CryptContext
from jose import jwt
from repository.repository import GameRepository, UserRepository

load_dotenv()

logger = logging.getLogger(__name__)


SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


class AuthService:
    """Serviço de autenticação e gerenciamento de usuários."""
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    def hash_password(self, password: str) -> str:
        return pwd_context.hash(password)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    def create_access_token(self, user_id: int) -> str:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode = {"sub": str(user_id), "exp": expire}
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    def verify_token(self, token: str) -> int | None:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return int(payload.get("sub"))
        except Exception:
            return None

    def register(self, email: str, password: str, name: str) -> dict:
        if self.user_repo.get_user_by_email(email):
            logger.warning(f"Falha no registro - email já existe: {email}")
            raise ValueError("Usuário já existe")
        password = (password or "")[:128]
        hashed = self.hash_password(password)
        user = self.user_repo.create_user(email, hashed, name=name)
        logger.info(f"Usuário registrado com sucesso: id={user['id']}, email={user['email']}, nome={user['name']}")
        return user

    def login(self, email: str, password: str) -> str:
        user = self.user_repo.get_user_by_email(email)
        if not user:
            logger.warning(f"Falha no login - usuário não encontrado: {email}")
            raise ValueError("Credenciais inválidas")
        password = (password or "")[:128]
        if not self.verify_password(password, user['password_hash']):
            logger.warning(f"Falha no login - senha inválida: {email}")
            raise ValueError("Credenciais inválidas")
        token = self.create_access_token(user['id'])
        logger.info(f"Login realizado com sucesso: id={user['id']}, email={user['email']}")
        return token

    def change_password(self, user_id: int, old_password: str, new_password: str) -> bool:
        user = self.user_repo.get_user_by_id(user_id)
        if not user:
            logger.warning(f"Falha ao alterar senha - usuário não encontrado: id={user_id}")
            raise ValueError("Usuário não encontrado")
        full = self.user_repo.get_user_by_email(user['email'])
        if not full:
            logger.warning(f"Falha ao alterar senha - usuário não encontrado: email={user['email']}")
            raise ValueError("Usuário não encontrado")
        old_password = (old_password or "")[:128]
        if not self.verify_password(old_password, full['password_hash']):
            logger.warning(f"Falha ao alterar senha - senha antiga inválida: user_id={user_id}")
            raise ValueError("Senha antiga inválida")
        new_password = (new_password or "")[:128]
        new_hash = self.hash_password(new_password)
        ok = self.user_repo.update_user_password(user_id, new_hash)
        if not ok:
            logger.error(f"Falha ao alterar senha - erro ao atualizar banco de dados: user_id={user_id}")
            raise ValueError("Falha ao atualizar senha")
        logger.info(f"Senha alterada com sucesso: user_id={user_id}")
        return True

    def delete_user(self, email: str, requester_id: int) -> bool:
        requester = self.user_repo.get_user_by_id(requester_id)
        if not requester:
            logger.warning(f"Falha ao deletar usuário - solicitante não encontrado: requester_id={requester_id}")
            raise ValueError("Usuário solicitante não encontrado")
        if requester['email'] != email:
            logger.warning(f"Falha ao deletar usuário - permissão negada: solicitante={requester['email']}, alvo={email}")
            raise ValueError("Só é possível deletar seu próprio usuário")
        ok = self.user_repo.delete_user_by_email(email)
        if not ok:
            logger.warning(f"Falha ao deletar usuário - usuário não encontrado: email={email}")
            raise ValueError("Usuário não encontrado")
        logger.info(f"Usuário deletado com sucesso: email={email}")
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
        logger.info(f"Novo jogo criado com sucesso: game_id={new_game['id']}, user_id={user_id}")
        new_game.pop('secret_code')
        return new_game

    def process_guess(self, game_id: str, guess_colors: List[str]):
        """Processa uma tentativa de adivinhação no jogo Mastermind.
        
        Valida a tentativa, calcula as cores corretas (posição correta e errada),
        registra o histórico, atualiza o status do jogo e a pontuação do usuário.

        Args:
            game_id (str): Identificador único do jogo.
            guess_colors (List[str]): Lista com 4 cores da tentativa do jogador.

        Returns:
            tuple: (game, result) onde:
                - game (dict): Estado atualizado do jogo ou None se jogo não encontrado.
                - result (tuple | str): Se game é None, retorna mensagem de erro.
                  Caso contrário, retorna (correct_pos, wrong_pos) com a contagem
                  de acertos na posição correta e cores corretas em posição errada.
        """
        game = self.repo.get_game(game_id)
        if not game or game.get('status') != 'active':
            logger.warning(f"Falha ao processar tentativa - jogo não está ativo: game_id={game_id}")
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

        # Registra a tentativa no histórico
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
            points_awarded = max(0, 1100 - attempt_number * 100)
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
                logger.info(f"Pontuação do usuário atualizada: user_id={game['user_id']}, pontos={points_awarded}")
            except Exception as e:
                logger.error(f"Falha ao atualizar pontuação: user_id={game['user_id']}, erro={str(e)}")
        
        game_status = game['status']
        logger.info(f"Tentativa processada: game_id={game_id}, tentativa={attempt_number}, corretas_posição={correct_pos}, corretas_posição_errada={wrong_pos}, status={game_status}")
        return game, (correct_pos, wrong_pos)
