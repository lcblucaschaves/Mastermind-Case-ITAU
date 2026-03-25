from unittest.mock import patch
from database.database import init_db


def test_init_db_chama_create_all():
    with patch('database.database.Base.metadata.create_all') as mock_create_all:
        init_db()

    mock_create_all.assert_called_once()
