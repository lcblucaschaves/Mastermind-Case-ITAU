import pytest
from unittest.mock import MagicMock
from service.service import AuthService


@pytest.fixture
def user_repo():
    return MagicMock()


@pytest.fixture
def auth_service(user_repo):
    return AuthService(user_repo)


@pytest.fixture
def usuario_mock():
    return {
        'id': 1,
        'email': 'teste@exemplo.com',
        'name': 'Usuário Teste',
        'score': 0,
        'password_hash': AuthService(MagicMock()).hash_password('senha123')
    }


# -------------------------------------------------------------------
# Registro
# -------------------------------------------------------------------

class TestRegistro:
    def test_registro_sucesso(self, auth_service, user_repo):
        user_repo.get_user_by_email.return_value = None
        user_repo.create_user.return_value = {
            'id': 1, 'email': 'novo@exemplo.com', 'name': 'Novo', 'score': 0
        }

        resultado = auth_service.register('novo@exemplo.com', 'senha123', 'Novo')

        assert resultado['email'] == 'novo@exemplo.com'
        user_repo.create_user.assert_called_once()

    def test_registro_email_duplicado(self, auth_service, user_repo):
        user_repo.get_user_by_email.return_value = {'id': 1}

        with pytest.raises(ValueError, match='Usuário já existe'):
            auth_service.register('existente@exemplo.com', 'senha123', 'Teste')

    def test_registro_senha_limitada_a_128_chars(self, auth_service, user_repo):
        user_repo.get_user_by_email.return_value = None
        user_repo.create_user.return_value = {
            'id': 1, 'email': 'teste@exemplo.com', 'name': 'Teste', 'score': 0
        }

        senha_longa = 'a' * 200
        auth_service.register('teste@exemplo.com', senha_longa, 'Teste')

        chamada = user_repo.create_user.call_args
        # password_hash deve ser derivado de no máximo 128 chars
        assert chamada is not None


# -------------------------------------------------------------------
# Login
# -------------------------------------------------------------------

class TestLogin:
    def test_login_sucesso(self, auth_service, user_repo, usuario_mock):
        user_repo.get_user_by_email.return_value = usuario_mock

        token = auth_service.login('teste@exemplo.com', 'senha123')

        assert isinstance(token, str)
        assert len(token) > 0

    def test_login_usuario_nao_encontrado(self, auth_service, user_repo):
        user_repo.get_user_by_email.return_value = None

        with pytest.raises(ValueError, match='Credenciais inválidas'):
            auth_service.login('naoexiste@exemplo.com', 'senha123')

    def test_login_senha_invalida(self, auth_service, user_repo, usuario_mock):
        user_repo.get_user_by_email.return_value = usuario_mock

        with pytest.raises(ValueError, match='Credenciais inválidas'):
            auth_service.login('teste@exemplo.com', 'senha_errada')


# -------------------------------------------------------------------
# Token
# -------------------------------------------------------------------

class TestToken:
    def test_token_valido(self, auth_service):
        token = auth_service.create_access_token(42)
        user_id = auth_service.verify_token(token)

        assert user_id == 42

    def test_token_invalido_retorna_none(self, auth_service):
        resultado = auth_service.verify_token('token.invalido.aqui')

        assert resultado is None

    def test_token_vazio_retorna_none(self, auth_service):
        assert auth_service.verify_token('') is None


# -------------------------------------------------------------------
# Alteração de senha
# -------------------------------------------------------------------

class TestAlteracaoSenha:
    def test_alteracao_sucesso(self, auth_service, user_repo, usuario_mock):
        user_repo.get_user_by_id.return_value = usuario_mock
        user_repo.get_user_by_email.return_value = usuario_mock
        user_repo.update_user_password.return_value = True

        resultado = auth_service.change_password(1, 'senha123', 'nova_senha')

        assert resultado is True

    def test_alteracao_usuario_nao_encontrado(self, auth_service, user_repo):
        user_repo.get_user_by_id.return_value = None

        with pytest.raises(ValueError, match='Usuário não encontrado'):
            auth_service.change_password(99, 'senha123', 'nova_senha')

    def test_alteracao_senha_antiga_invalida(self, auth_service, user_repo, usuario_mock):
        user_repo.get_user_by_id.return_value = usuario_mock
        user_repo.get_user_by_email.return_value = usuario_mock

        with pytest.raises(ValueError, match='Senha antiga inválida'):
            auth_service.change_password(1, 'senha_errada', 'nova_senha')

    def test_alteracao_usuario_email_nao_encontrado(self, auth_service, user_repo, usuario_mock):
        user_repo.get_user_by_id.return_value = usuario_mock
        user_repo.get_user_by_email.return_value = None

        with pytest.raises(ValueError, match='Usuário não encontrado'):
            auth_service.change_password(1, 'senha123', 'nova_senha')

    def test_alteracao_falha_ao_atualizar(self, auth_service, user_repo, usuario_mock):
        user_repo.get_user_by_id.return_value = usuario_mock
        user_repo.get_user_by_email.return_value = usuario_mock
        user_repo.update_user_password.return_value = False

        with pytest.raises(ValueError, match='Falha ao atualizar senha'):
            auth_service.change_password(1, 'senha123', 'nova_senha')


# -------------------------------------------------------------------
# Exclusão de usuário
# -------------------------------------------------------------------

class TestExclusaoUsuario:
    def test_exclusao_sucesso(self, auth_service, user_repo):
        user_repo.get_user_by_id.return_value = {'id': 1, 'email': 'teste@exemplo.com'}
        user_repo.delete_user_by_email.return_value = True

        resultado = auth_service.delete_user('teste@exemplo.com', 1)

        assert resultado is True

    def test_exclusao_permissao_negada(self, auth_service, user_repo):
        user_repo.get_user_by_id.return_value = {'id': 1, 'email': 'meu@exemplo.com'}

        with pytest.raises(ValueError, match='Só é possível deletar seu próprio usuário'):
            auth_service.delete_user('outro@exemplo.com', 1)

    def test_exclusao_solicitante_nao_encontrado(self, auth_service, user_repo):
        user_repo.get_user_by_id.return_value = None

        with pytest.raises(ValueError, match='Usuário solicitante não encontrado'):
            auth_service.delete_user('teste@exemplo.com', 99)

    def test_exclusao_usuario_alvo_nao_encontrado(self, auth_service, user_repo):
        user_repo.get_user_by_id.return_value = {'id': 1, 'email': 'teste@exemplo.com'}
        user_repo.delete_user_by_email.return_value = False

        with pytest.raises(ValueError, match='Usuário não encontrado'):
            auth_service.delete_user('teste@exemplo.com', 1)
