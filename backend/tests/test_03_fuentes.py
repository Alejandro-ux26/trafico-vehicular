"""Fuentes de video: permisos, creación, consulta, actualización y validaciones."""
import pytest

from helpers import ID_INEXISTENTE, LINEA_HORIZONTAL, api_get, api_post, api_put, crear_fuente, nombre_unico


def _cuerpo(**cambios):
    cuerpo = {"name": nombre_unico("Fuente"), "description": "prueba", "line": LINEA_HORIZONTAL, "authorized": True}
    cuerpo.update(cambios)
    return cuerpo


def test_usuario_no_puede_crear_fuentes(usuario):
    assert api_post("/sources", usuario["token"], json=_cuerpo()).status_code == 403


def test_operador_crea_y_consulta_una_fuente(operador, usuario):
    fuente = crear_fuente(operador["token"])
    r = api_get(f"/sources/{fuente['id']}", usuario["token"])
    assert r.status_code == 200
    detalle = r.json()
    assert detalle["name"] == fuente["name"]
    assert detalle["line"] == LINEA_HORIZONTAL
    assert detalle["authorized"] is True
    assert fuente["id"] in api_get("/sources", usuario["token"]).text


def test_operador_actualiza_una_fuente(operador):
    fuente = crear_fuente(operador["token"])
    nuevo = _cuerpo(name=nombre_unico("Renombrada"), line=[0.5, 0.3, 0.5, 0.65])
    r = api_put(f"/sources/{fuente['id']}", operador["token"], json=nuevo)
    assert r.status_code == 200
    detalle = api_get(f"/sources/{fuente['id']}", operador["token"]).json()
    assert detalle["name"] == nuevo["name"]
    assert detalle["line"] == [0.5, 0.3, 0.5, 0.65]


def test_fuente_inexistente_devuelve_404(usuario):
    assert api_get(f"/sources/{ID_INEXISTENTE}", usuario["token"]).status_code == 404


@pytest.mark.parametrize(
    "cambios",
    [
        {"line": [0.5, 0.5, 0.5, 0.5]},  # los dos puntos son iguales
        {"line": [0.0, 0.0, 1.5, 1.0]},  # un valor fuera del rango 0 a 1
        {"line": [0.1, 0.5, 0.9]},       # solo tres números
        {"name": "a"},                   # nombre demasiado corto
    ],
    ids=["puntos_iguales", "fuera_de_rango", "tres_numeros", "nombre_corto"],
)
def test_fuente_con_datos_invalidos_devuelve_422(operador, cambios):
    assert api_post("/sources", operador["token"], json=_cuerpo(**cambios)).status_code == 422
