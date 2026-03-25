import pytest
from unittest.mock import MagicMock
import copy
from service.service import GameService


@pytest.fixture
def game_repo():
    return MagicMock()


@pytest.fixture
def user_repo():
    return MagicMock()


@pytest.fixture
def game_service(game_repo, user_repo):
    return GameService(game_repo, user_repo)


@pytest.fixture
def jogo_ativo():
    return {
        'id': 'jogo-123',
        'secret_code': ['red', 'green', 'blue', 'yellow'],
        'attempts': 0,
        'history': [],
        'max_attempts': 10,
        'status': 'active',
        'user_id': 1
    }


# -------------------------------------------------------------------
# Criação de jogo
# -------------------------------------------------------------------

class TestCriacaoJogo:
    def test_cria_jogo_com_sucesso(self, game_service, game_repo):
        game_repo.save_game.return_value = {}

        jogo = game_service.create_new_game(user_id=1)

        assert 'id' in jogo
        assert 'secret_code' not in jogo
        assert jogo['status'] == 'active'
        assert jogo['attempts'] == 0
        assert jogo['max_attempts'] == 10
        game_repo.save_game.assert_called_once()

    def test_cria_jogo_com_4_cores(self, game_service, game_repo):
        capturado = {}

        def save_side_effect(game):
            capturado.update(copy.deepcopy(game))
            return {}

        game_repo.save_game.side_effect = save_side_effect
        game_service.create_new_game(user_id=1)

        assert len(capturado['secret_code']) == 4
        assert len(set(capturado['secret_code'])) == 4


# -------------------------------------------------------------------
# Processamento de tentativas
# -------------------------------------------------------------------

class TestProcessamentoTentativa:
    def test_jogo_nao_encontrado(self, game_service, game_repo):
        game_repo.get_game.return_value = None

        jogo, resultado = game_service.process_guess('id-inexistente', ['red', 'green', 'blue', 'yellow'])

        assert jogo is None
        assert 'não encontrado' in resultado.lower()

    def test_jogo_ja_finalizado(self, game_service, game_repo, jogo_ativo):
        jogo_ativo['status'] = 'won'
        game_repo.get_game.return_value = jogo_ativo

        jogo, resultado = game_service.process_guess('jogo-123', ['red', 'green', 'blue', 'yellow'])

        assert jogo is None
        assert 'não encontrado' in resultado.lower()

    def test_acerto_total(self, game_service, game_repo, jogo_ativo):
        game_repo.get_game.return_value = jogo_ativo
        game_repo.save_game.return_value = {}

        jogo, (corretas, erradas) = game_service.process_guess(
            'jogo-123', ['red', 'green', 'blue', 'yellow']
        )

        assert corretas == 4
        assert erradas == 0
        assert jogo['status'] == 'won'

    def test_nenhum_acerto(self, game_service, game_repo, jogo_ativo):
        game_repo.get_game.return_value = jogo_ativo
        game_repo.save_game.return_value = {}

        _, (corretas, erradas) = game_service.process_guess(
            'jogo-123', ['purple', 'purple', 'purple', 'purple']
        )

        assert corretas == 0
        assert erradas == 0

    def test_cores_em_posicao_errada(self, game_service, game_repo, jogo_ativo):
        # secret: ['red', 'green', 'blue', 'yellow']
        # guess:  ['green', 'red', 'yellow', 'blue'] → 0 corretas, 4 erradas
        game_repo.get_game.return_value = jogo_ativo
        game_repo.save_game.return_value = {}

        _, (corretas, erradas) = game_service.process_guess(
            'jogo-123', ['green', 'red', 'yellow', 'blue']
        )

        assert corretas == 0
        assert erradas == 4

    def test_acerto_parcial(self, game_service, game_repo, jogo_ativo):
        # secret: ['red', 'green', 'blue', 'yellow']
        # guess:  ['red', 'green', 'purple', 'orange'] → 2 corretas, 0 erradas
        game_repo.get_game.return_value = jogo_ativo
        game_repo.save_game.return_value = {}

        _, (corretas, erradas) = game_service.process_guess(
            'jogo-123', ['red', 'green', 'purple', 'orange']
        )

        assert corretas == 2
        assert erradas == 0

    def test_historico_registrado(self, game_service, game_repo, jogo_ativo):
        game_repo.get_game.return_value = jogo_ativo
        game_repo.save_game.return_value = {}

        game_service.process_guess('jogo-123', ['red', 'green', 'purple', 'orange'])

        jogo_salvo = game_repo.save_game.call_args[0][0]
        assert len(jogo_salvo['history']) == 1
        assert jogo_salvo['history'][0]['attempt_number'] == 1

    def test_derrota_apos_tentativas_maximas(self, game_service, game_repo, jogo_ativo):
        jogo_ativo['attempts'] = 9  # próxima é a 10ª e última
        game_repo.get_game.return_value = jogo_ativo
        game_repo.save_game.return_value = {}

        jogo, _ = game_service.process_guess(
            'jogo-123', ['purple', 'purple', 'purple', 'purple']
        )

        assert jogo['status'] == 'lost'


# -------------------------------------------------------------------
# Pontuação
# -------------------------------------------------------------------

class TestPontuacao:
    def test_pontuacao_na_primeira_tentativa(self, game_service, game_repo, jogo_ativo):
        game_repo.get_game.return_value = jogo_ativo
        game_repo.save_game.return_value = {}

        game_service.process_guess('jogo-123', ['red', 'green', 'blue', 'yellow'])

        jogo_salvo = game_repo.save_game.call_args[0][0]
        assert jogo_salvo['history'][0]['points'] == 1000  # 1100 - 1*100

    def test_pontuacao_na_decima_tentativa(self, game_service, game_repo, jogo_ativo):
        jogo_ativo['attempts'] = 9
        game_repo.get_game.return_value = jogo_ativo
        game_repo.save_game.return_value = {}

        game_service.process_guess('jogo-123', ['red', 'green', 'blue', 'yellow'])

        jogo_salvo = game_repo.save_game.call_args[0][0]
        assert jogo_salvo['history'][0]['points'] == 100  # 1100 - 10*100

    def test_sem_pontuacao_em_tentativa_errada(self, game_service, game_repo, jogo_ativo):
        game_repo.get_game.return_value = jogo_ativo
        game_repo.save_game.return_value = {}

        game_service.process_guess('jogo-123', ['purple', 'purple', 'purple', 'purple'])

        jogo_salvo = game_repo.save_game.call_args[0][0]
        assert jogo_salvo['history'][0]['points'] == 0

    def test_score_do_usuario_atualizado_ao_vencer(self, game_service, game_repo, user_repo, jogo_ativo):
        game_repo.get_game.return_value = jogo_ativo
        game_repo.save_game.return_value = {}

        game_service.process_guess('jogo-123', ['red', 'green', 'blue', 'yellow'])

        user_repo.add_score_to_user.assert_called_once_with(1, 1000)

    def test_score_nao_atualizado_em_derrota(self, game_service, game_repo, user_repo, jogo_ativo):
        game_repo.get_game.return_value = jogo_ativo
        game_repo.save_game.return_value = {}

        game_service.process_guess('jogo-123', ['purple', 'purple', 'purple', 'purple'])

        user_repo.add_score_to_user.assert_not_called()

    def test_erro_ao_atualizar_score_nao_interrompe_fluxo(self, game_service, game_repo, user_repo, jogo_ativo):
        game_repo.get_game.return_value = jogo_ativo
        game_repo.save_game.return_value = {}
        user_repo.add_score_to_user.side_effect = Exception('falha ao salvar score')

        jogo, resultado = game_service.process_guess('jogo-123', ['red', 'green', 'blue', 'yellow'])

        assert jogo['status'] == 'won'
        assert resultado == (4, 0)
