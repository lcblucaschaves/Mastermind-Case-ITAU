from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import pytest

from repository.repository import UserRepository, GameRepository


def _build_db_with_user(user_obj=None):
    db = MagicMock()
    query = db.query.return_value
    filtered = query.filter.return_value
    filtered.first.return_value = user_obj
    return db


def _build_db_with_game(game_obj=None):
    db = MagicMock()
    query = db.query.return_value
    filtered = query.filter.return_value
    filtered.first.return_value = game_obj
    return db


class TestUserRepository:
    def test_create_user_sucesso(self):
        repo = UserRepository()
        db = MagicMock()
        repo.session_local = MagicMock(return_value=db)

        with patch('repository.repository.User') as MockUser:
            db_user = SimpleNamespace(id=1, email='u@x.com', name='User', score=0)
            MockUser.return_value = db_user
            db.refresh.side_effect = lambda x: None

            result = repo.create_user('u@x.com', 'hash', 'User')

        assert result['id'] == 1
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.close.assert_called_once()

    def test_create_user_excecao(self):
        repo = UserRepository()
        db = MagicMock()
        db.commit.side_effect = Exception('db error')
        repo.session_local = MagicMock(return_value=db)

        with patch('repository.repository.User'):
            with pytest.raises(Exception):
                repo.create_user('u@x.com', 'hash', 'User')

        db.close.assert_called_once()

    def test_get_user_by_email_sucesso(self):
        repo = UserRepository()
        user = SimpleNamespace(id=1, email='a@a.com', name='A', password_hash='h', score=10)
        db = _build_db_with_user(user)
        repo.session_local = MagicMock(return_value=db)

        result = repo.get_user_by_email('a@a.com')

        assert result['email'] == 'a@a.com'
        db.close.assert_called_once()

    def test_get_user_by_email_none(self):
        repo = UserRepository()
        db = _build_db_with_user(None)
        repo.session_local = MagicMock(return_value=db)

        result = repo.get_user_by_email('x@x.com')

        assert result is None

    def test_get_user_by_id_sucesso(self):
        repo = UserRepository()
        user = SimpleNamespace(id=2, email='b@b.com', name='B', score=20)
        db = _build_db_with_user(user)
        repo.session_local = MagicMock(return_value=db)

        result = repo.get_user_by_id(2)

        assert result['id'] == 2

    def test_get_user_by_id_none(self):
        repo = UserRepository()
        db = _build_db_with_user(None)
        repo.session_local = MagicMock(return_value=db)

        assert repo.get_user_by_id(999) is None

    def test_update_user_password_sucesso(self):
        repo = UserRepository()
        user = SimpleNamespace(id=1)
        db = _build_db_with_user(user)
        repo.session_local = MagicMock(return_value=db)

        ok = repo.update_user_password(1, 'new')

        assert ok is True
        assert user.password_hash == 'new'
        db.commit.assert_called_once()

    def test_update_user_password_usuario_inexistente(self):
        repo = UserRepository()
        db = _build_db_with_user(None)
        repo.session_local = MagicMock(return_value=db)

        ok = repo.update_user_password(1, 'new')

        assert ok is False

    def test_delete_user_by_email_sucesso(self):
        repo = UserRepository()
        user = SimpleNamespace(id=1)
        db = _build_db_with_user(user)
        repo.session_local = MagicMock(return_value=db)

        ok = repo.delete_user_by_email('a@a.com')

        assert ok is True
        db.delete.assert_called_once_with(user)
        db.commit.assert_called_once()

    def test_delete_user_by_email_usuario_inexistente(self):
        repo = UserRepository()
        db = _build_db_with_user(None)
        repo.session_local = MagicMock(return_value=db)

        ok = repo.delete_user_by_email('x@x.com')

        assert ok is False

    def test_delete_user_by_email_excecao(self):
        repo = UserRepository()
        user = SimpleNamespace(id=1)
        db = _build_db_with_user(user)
        db.commit.side_effect = Exception('db')
        repo.session_local = MagicMock(return_value=db)

        with pytest.raises(Exception):
            repo.delete_user_by_email('a@a.com')

    def test_add_score_to_user_sucesso(self):
        repo = UserRepository()
        user = SimpleNamespace(id=1, score=5)
        db = _build_db_with_user(user)
        repo.session_local = MagicMock(return_value=db)

        ok = repo.add_score_to_user(1, 10)

        assert ok is True
        assert user.score == 15

    def test_add_score_to_user_sem_score_previo(self):
        repo = UserRepository()
        user = SimpleNamespace(id=1, score=None)
        db = _build_db_with_user(user)
        repo.session_local = MagicMock(return_value=db)

        ok = repo.add_score_to_user(1, 7)

        assert ok is True
        assert user.score == 7

    def test_add_score_to_user_inexistente(self):
        repo = UserRepository()
        db = _build_db_with_user(None)
        repo.session_local = MagicMock(return_value=db)

        ok = repo.add_score_to_user(1, 10)

        assert ok is False

    def test_add_score_to_user_excecao(self):
        repo = UserRepository()
        user = SimpleNamespace(id=1, score=0)
        db = _build_db_with_user(user)
        db.commit.side_effect = Exception('db')
        repo.session_local = MagicMock(return_value=db)

        with pytest.raises(Exception):
            repo.add_score_to_user(1, 10)

    def test_reset_user_score_sucesso(self):
        repo = UserRepository()
        user = SimpleNamespace(id=1, score=50)
        db = _build_db_with_user(user)
        repo.session_local = MagicMock(return_value=db)

        ok = repo.reset_user_score(1)

        assert ok is True
        assert user.score == 0

    def test_reset_user_score_inexistente(self):
        repo = UserRepository()
        db = _build_db_with_user(None)
        repo.session_local = MagicMock(return_value=db)

        ok = repo.reset_user_score(1)

        assert ok is False

    def test_get_top_users(self):
        repo = UserRepository()
        db = MagicMock()
        rows = [
            SimpleNamespace(id=1, email='a@a.com', name='A', score=10),
            SimpleNamespace(id=2, email='b@b.com', name='B', score=5),
        ]
        db.query.return_value.order_by.return_value.limit.return_value.all.return_value = rows
        repo.session_local = MagicMock(return_value=db)

        result = repo.get_top_users()

        assert len(result) == 2
        assert result[0]['score'] == 10


class TestGameRepository:
    def test_save_game_novo(self):
        repo = GameRepository()
        db = _build_db_with_game(None)
        repo.session_local = MagicMock(return_value=db)

        with patch('repository.repository.Game') as MockGame:
            db_game = SimpleNamespace(
                id='g1', secret_code=['red'], history=[], attempts=0, max_attempts=10, status='active', user_id=1
            )
            MockGame.return_value = db_game
            db.refresh.side_effect = lambda x: None

            result = repo.save_game({
                'id': 'g1',
                'secret_code': ['red', 'green', 'blue', 'yellow'],
                'history': [],
                'attempts': 0,
                'max_attempts': 10,
                'status': 'active',
                'user_id': 1,
            })

        assert result['id'] == 'g1'
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_save_game_atualiza_existente_com_history(self):
        repo = GameRepository()
        existing = SimpleNamespace(
            id='g1', secret_code=['x'], history=[], attempts=1, max_attempts=10, status='active', user_id=1
        )
        db = _build_db_with_game(existing)
        repo.session_local = MagicMock(return_value=db)

        result = repo.save_game({
            'id': 'g1',
            'secret_code': ['red', 'green', 'blue', 'yellow'],
            'history': [{'attempt_number': 1}],
            'attempts': 2,
            'max_attempts': 10,
            'status': 'active',
            'user_id': 1,
        })

        assert result['attempts'] == 2
        assert existing.history == [{'attempt_number': 1}]

    def test_save_game_atualiza_existente_sem_history(self):
        repo = GameRepository()
        existing = SimpleNamespace(
            id='g1', secret_code=['x'], history=[{'old': 1}], attempts=1, max_attempts=10, status='active', user_id=1
        )
        db = _build_db_with_game(existing)
        repo.session_local = MagicMock(return_value=db)

        repo.save_game({
            'id': 'g1',
            'secret_code': ['red', 'green', 'blue', 'yellow'],
            'attempts': 3,
            'max_attempts': 10,
            'status': 'lost',
            'user_id': 1,
        })

        assert existing.history == [{'old': 1}]
        assert existing.status == 'lost'

    def test_save_game_excecao(self):
        repo = GameRepository()
        db = _build_db_with_game(None)
        db.commit.side_effect = Exception('db')
        repo.session_local = MagicMock(return_value=db)

        with patch('repository.repository.Game'):
            with pytest.raises(Exception):
                repo.save_game({
                    'id': 'g1',
                    'secret_code': ['red', 'green', 'blue', 'yellow'],
                    'history': [],
                    'attempts': 0,
                    'max_attempts': 10,
                    'status': 'active',
                    'user_id': 1,
                })

    def test_get_game_sucesso(self):
        repo = GameRepository()
        db_game = SimpleNamespace(
            id='g1', secret_code=['red'], history=[], attempts=1, max_attempts=10, status='active', user_id=1
        )
        db = _build_db_with_game(db_game)
        repo.session_local = MagicMock(return_value=db)

        result = repo.get_game('g1')

        assert result['id'] == 'g1'

    def test_get_game_none(self):
        repo = GameRepository()
        db = _build_db_with_game(None)
        repo.session_local = MagicMock(return_value=db)

        assert repo.get_game('g-x') is None

    def test_get_game_excecao(self):
        repo = GameRepository()
        db = MagicMock()
        db.query.side_effect = Exception('db')
        repo.session_local = MagicMock(return_value=db)

        with pytest.raises(Exception):
            repo.get_game('g1')

    def test_game_to_dict_sem_history_e_sem_user_id(self):
        repo = GameRepository()
        obj = SimpleNamespace(id='g1', secret_code=['r'], attempts=1, max_attempts=10, status='active')

        result = repo._game_to_dict(obj)

        assert result['history'] == []
        assert result['user_id'] is None
