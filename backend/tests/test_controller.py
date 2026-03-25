import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from fastapi.security import HTTPAuthorizationCredentials


# Patch do init_db e das dependências de banco antes de importar o controller
with patch('database.database.init_db'), \
     patch('database.database.SessionLocal'), \
     patch('repository.repository.SessionLocal'):
    from controller.controller import app, get_current_user


# -------------------------------------------------------------------
# Usuário fictício reutilizável nos testes autenticados
# -------------------------------------------------------------------

USUARIO_MOCK = {'id': 1, 'email': 'teste@exemplo.com', 'name': 'Usuário Teste', 'score': 0}


def override_get_current_user():
    return USUARIO_MOCK


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = override_get_current_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def client_sem_auth():
    """Cliente sem override de autenticação."""
    app.dependency_overrides.clear()
    with TestClient(app) as c:
        yield c


# -------------------------------------------------------------------
# Registro
# -------------------------------------------------------------------

class TestEndpointRegistro:
    def test_registro_sucesso(self, client):
        with patch('controller.controller.user_repo') as mock_user_repo, \
             patch('controller.controller.auth_service') as mock_auth:
            mock_user_repo.get_user_by_email.return_value = None
            mock_auth.register.return_value = {
                'id': 1, 'email': 'novo@exemplo.com', 'name': 'Novo', 'score': 0
            }

            resposta = client.post('/register', json={
                'email': 'novo@exemplo.com',
                'password': 'senha123',
                'name': 'Novo'
            })

        assert resposta.status_code == 200
        assert resposta.json()['email'] == 'novo@exemplo.com'

    def test_registro_email_duplicado(self, client):
        with patch('controller.controller.user_repo') as mock_user_repo:
            mock_user_repo.get_user_by_email.return_value = {'id': 1}

            resposta = client.post('/register', json={
                'email': 'existente@exemplo.com',
                'password': 'senha123',
                'name': 'Teste'
            })

        assert resposta.status_code == 400


# -------------------------------------------------------------------
# Login
# -------------------------------------------------------------------

class TestEndpointLogin:
    def test_login_sucesso(self, client):
        with patch('controller.controller.auth_service') as mock_auth, \
             patch('controller.controller.user_repo') as mock_user_repo:
            mock_auth.login.return_value = 'token-jwt-fake'
            mock_user_repo.get_user_by_email.return_value = USUARIO_MOCK

            resposta = client.post('/login', json={
                'email': 'teste@exemplo.com',
                'password': 'senha123'
            })

        assert resposta.status_code == 200
        dados = resposta.json()
        assert 'access_token' in dados
        assert dados['token_type'] == 'bearer'

    def test_login_credenciais_invalidas(self, client):
        with patch('controller.controller.auth_service') as mock_auth:
            mock_auth.login.side_effect = ValueError('Credenciais inválidas')

            resposta = client.post('/login', json={
                'email': 'teste@exemplo.com',
                'password': 'senha_errada'
            })

        assert resposta.status_code == 401


# -------------------------------------------------------------------
# Jogos
# -------------------------------------------------------------------

class TestEndpointJogos:
    def test_iniciar_jogo(self, client):
        with patch('controller.controller.game_service') as mock_game_service:
            mock_game_service.create_new_game.return_value = {
                'id': 'jogo-123', 'status': 'active', 'attempts': 0, 'max_attempts': 10
            }

            resposta = client.post('/games')

        assert resposta.status_code == 200
        assert resposta.json()['status'] == 'active'

    def test_buscar_status_jogo(self, client):
        with patch('controller.controller.game_repo') as mock_game_repo:
            mock_game_repo.get_game.return_value = {
                'id': 'jogo-123', 'status': 'active', 'attempts': 2, 'max_attempts': 10
            }

            resposta = client.get('/games/jogo-123')

        assert resposta.status_code == 200
        assert resposta.json()['id'] == 'jogo-123'

    def test_buscar_jogo_nao_encontrado(self, client):
        with patch('controller.controller.game_repo') as mock_game_repo:
            mock_game_repo.get_game.return_value = None

            resposta = client.get('/games/id-inexistente')

        assert resposta.status_code == 404

    def test_tentativa_valida(self, client):
        with patch('controller.controller.game_service') as mock_game_service:
            mock_game_service.process_guess.return_value = (
                {'id': 'jogo-123', 'status': 'active', 'attempts': 1, 'max_attempts': 10},
                (2, 1)
            )

            resposta = client.post('/games/jogo-123/guess', json={
                'colors': ['red', 'green', 'blue', 'yellow']
            })

        assert resposta.status_code == 200
        dados = resposta.json()
        assert dados['correct_position'] == 2
        assert dados['wrong_position'] == 1

    def test_tentativa_jogo_nao_encontrado(self, client):
        with patch('controller.controller.game_service') as mock_game_service:
            mock_game_service.process_guess.return_value = (None, 'Jogo não encontrado ou já finalizado.')

            resposta = client.post('/games/id-inexistente/guess', json={
                'colors': ['red', 'green', 'blue', 'yellow']
            })

        assert resposta.status_code == 404

    def test_iniciar_jogo_sem_token(self, client_sem_auth):
        resposta = client_sem_auth.post('/games')
        assert resposta.status_code == 401


# -------------------------------------------------------------------
# Leaderboard
# -------------------------------------------------------------------

class TestEndpointLeaderboard:
    def test_leaderboard_retorna_lista(self, client):
        with patch('controller.controller.user_repo') as mock_user_repo:
            mock_user_repo.get_top_users.return_value = [
                {'id': 1, 'email': 'top@exemplo.com', 'name': 'Top', 'score': 500}
            ]

            resposta = client.get('/leaderboard')

        assert resposta.status_code == 200
        assert 'leaderboard' in resposta.json()
        assert len(resposta.json()['leaderboard']) == 1


# -------------------------------------------------------------------
# Logout
# -------------------------------------------------------------------

class TestEndpointLogout:
    def test_logout_sucesso(self, client):
        resposta = client.post('/logout')

        assert resposta.status_code == 200
        assert resposta.json()['message'] == 'Logout realizado com sucesso'


# -------------------------------------------------------------------
# Alteração de senha
# -------------------------------------------------------------------

class TestEndpointAlteracaoSenha:
    def test_alteracao_senha_sucesso(self, client):
        with patch('controller.controller.auth_service') as mock_auth:
            mock_auth.change_password.return_value = True

            resposta = client.post('/users/change-password', json={
                'old_password': 'senha_atual',
                'new_password': 'nova_senha'
            })

        assert resposta.status_code == 200
        assert resposta.json()['message'] == 'Senha alterada com sucesso'

    def test_alteracao_senha_invalida(self, client):
        with patch('controller.controller.auth_service') as mock_auth:
            mock_auth.change_password.side_effect = ValueError('Senha antiga inválida')

            resposta = client.post('/users/change-password', json={
                'old_password': 'senha_errada',
                'new_password': 'nova_senha'
            })

        assert resposta.status_code == 400


class TestFluxosDeErroController:
    def test_registro_erro_inesperado(self, client):
        with patch('controller.controller.user_repo') as mock_user_repo, \
             patch('controller.controller.auth_service') as mock_auth:
            mock_user_repo.get_user_by_email.return_value = None
            mock_auth.register.side_effect = Exception('falha inesperada')

            resposta = client.post('/register', json={
                'email': 'novo@exemplo.com',
                'password': 'senha123',
                'name': 'Novo'
            })

        assert resposta.status_code == 500

    def test_login_erro_inesperado(self, client):
        with patch('controller.controller.auth_service') as mock_auth:
            mock_auth.login.side_effect = Exception('falha inesperada')

            resposta = client.post('/login', json={
                'email': 'teste@exemplo.com',
                'password': 'senha123'
            })

        assert resposta.status_code == 500

    def test_delete_user_regra_negocio(self, client):
        with patch('controller.controller.auth_service') as mock_auth:
            mock_auth.delete_user.side_effect = ValueError('Só é possível deletar seu próprio usuário')

            resposta = client.delete('/users/outro@exemplo.com')

        assert resposta.status_code == 400

    def test_delete_user_sucesso(self, client):
        with patch('controller.controller.auth_service') as mock_auth:
            mock_auth.delete_user.return_value = True

            resposta = client.delete('/users/teste@exemplo.com')

        assert resposta.status_code == 200
        assert resposta.json()['message'] == 'Usuário deletado'


class TestGetCurrentUser:
    def test_sem_header_authorization(self):
        with pytest.raises(Exception) as exc:
            get_current_user(None)
        assert exc.value.status_code == 401

    def test_token_invalido(self):
        mock_creds = MagicMock(spec=HTTPAuthorizationCredentials)
        mock_creds.credentials = 'token-invalido'

        with patch('controller.controller.auth_service') as mock_auth:
            mock_auth.verify_token.return_value = None

            with pytest.raises(Exception) as exc:
                get_current_user(mock_creds)

        assert exc.value.status_code == 401

    def test_usuario_nao_encontrado(self):
        mock_creds = MagicMock(spec=HTTPAuthorizationCredentials)
        mock_creds.credentials = 'token-valido'

        with patch('controller.controller.auth_service') as mock_auth, \
             patch('controller.controller.user_repo') as mock_user_repo:
            mock_auth.verify_token.return_value = 99
            mock_user_repo.get_user_by_id.return_value = None

            with pytest.raises(Exception) as exc:
                get_current_user(mock_creds)

        assert exc.value.status_code == 401

    def test_token_valido(self):
        mock_creds = MagicMock(spec=HTTPAuthorizationCredentials)
        mock_creds.credentials = 'token-valido'

        with patch('controller.controller.auth_service') as mock_auth, \
             patch('controller.controller.user_repo') as mock_user_repo:
            mock_auth.verify_token.return_value = 1
            mock_user_repo.get_user_by_id.return_value = USUARIO_MOCK

            user = get_current_user(mock_creds)

        assert user['id'] == 1


# -------------------------------------------------------------------
# Reset de pontuação
# -------------------------------------------------------------------

class TestEndpointResetScore:
    def test_reset_score_sucesso(self, client):
        with patch('controller.controller.user_repo') as mock_user_repo:
            mock_user_repo.reset_user_score.return_value = True

            resposta = client.post('/users/reset-score')

        assert resposta.status_code == 200
        assert resposta.json()['score'] == 0

    def test_reset_score_falha(self, client):
        with patch('controller.controller.user_repo') as mock_user_repo:
            mock_user_repo.reset_user_score.return_value = False

            resposta = client.post('/users/reset-score')

        assert resposta.status_code == 400
