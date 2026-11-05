"""Fixtures de las pruebas. Se crean cuentas y fuentes nuevas en cada ejecución."""
from urllib.parse import urlparse
import os

import pytest
import requests

from helpers import (
    ADMIN_PASSWORD,
    ADMIN_USER,
    API_URL,
    crear_fuente,
    crear_usuario,
    crear_video,
    token_de,
)


@pytest.fixture(scope="session", autouse=True)
def entorno_de_pruebas():
    """Se asegura de no tocar la base de datos real y de que el backend de pruebas esté sano."""
    if urlparse(API_URL).port == 8000 and os.getenv("PERMITIR_BD_REAL") != "1":
        pytest.exit(
            "Estas pruebas escriben datos. Usa el backend de pruebas (puerto 8010, MONGO_DB=trafico_test), "
            "no el de la aplicación (puerto 8000).",
            returncode=2,
        )
    try:
        r = requests.get(API_URL + "/health", timeout=10)
        estado = r.json()
    except Exception as e:  # noqa: BLE001
        pytest.exit(f"No se pudo consultar {API_URL}/health. ¿Está encendido el backend de pruebas? ({e})", returncode=2)
    if estado.get("mongo") != "ok" or estado.get("ai_service") != "ok":
        pytest.exit(f"El backend responde, pero no está sano: {estado}", returncode=2)


@pytest.fixture(scope="session")
def admin_token():
    return token_de(ADMIN_USER, ADMIN_PASSWORD)


@pytest.fixture(scope="session")
def usuario(admin_token):
    return crear_usuario(admin_token, "usuario", "usuario")


@pytest.fixture(scope="session")
def operador(admin_token):
    return crear_usuario(admin_token, "operador", "operador")


@pytest.fixture(scope="session")
def fuente(operador):
    return crear_fuente(operador["token"])


@pytest.fixture(scope="session")
def video_prueba(tmp_path_factory):
    return crear_video(tmp_path_factory.mktemp("videos") / "prueba_sintetica.avi")
