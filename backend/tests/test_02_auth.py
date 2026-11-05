"""Registro, inicio de sesión, tokens, roles y auditoría."""
import pytest

from helpers import (
    CLAVE_PRUEBA,
    api_get,
    api_put,
    crear_usuario,
    iniciar_sesion,
    nombre_unico,
    registrar,
)


def test_registro_crea_cuenta_con_rol_usuario():
    nombre = nombre_unico("nuevo")
    assert registrar(nombre).status_code == 201
    r = iniciar_sesion(nombre)
    assert r.status_code == 200
    assert r.json()["role"] == "usuario"


def test_registro_duplicado_devuelve_409():
    nombre = nombre_unico("repetido")
    assert registrar(nombre).status_code == 201
    assert registrar(nombre).status_code == 409


@pytest.mark.parametrize(
    "username, password",
    [
        ("ab", CLAVE_PRUEBA),                 # nombre demasiado corto
        ("nombre con espacios", CLAVE_PRUEBA),  # caracteres no permitidos
        ("clave_corta_ok", "1234567"),        # contraseña de menos de 8 caracteres
    ],
    ids=["nombre_corto", "nombre_con_espacios", "clave_corta"],
)
def test_registro_con_datos_invalidos_devuelve_422(username, password):
    assert registrar(username, password).status_code == 422


def test_login_correcto_devuelve_token_y_rol(usuario):
    r = iniciar_sesion(usuario["username"])
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["access_token"]
    assert cuerpo["token_type"].lower() == "bearer"
    assert cuerpo["role"] == "usuario"


def test_login_con_clave_incorrecta_devuelve_401(usuario):
    assert iniciar_sesion(usuario["username"], "otra-clave-123").status_code == 401


def test_ruta_protegida_sin_token_devuelve_401():
    assert api_get("/sources").status_code == 401


def test_token_invalido_devuelve_401():
    assert api_get("/sources", "esto.no.es.un.token").status_code == 401


def test_usuario_no_puede_listar_usuarios(usuario):
    assert api_get("/auth/users", usuario["token"]).status_code == 403


def test_admin_lista_usuarios_sin_hash_de_contrasena(admin_token, usuario):
    r = api_get("/auth/users", admin_token)
    assert r.status_code == 200
    assert usuario["username"] in r.text
    assert "password_hash" not in r.text


def test_admin_cambia_el_rol_de_un_usuario(admin_token):
    cuenta = crear_usuario(admin_token, "usuario", "ascenso")
    r = api_put(f"/auth/users/{cuenta['username']}/role", admin_token, json={"role": "operador"})
    assert r.status_code == 200
    assert iniciar_sesion(cuenta["username"]).json()["role"] == "operador"


def test_rol_invalido_devuelve_422(admin_token, usuario):
    r = api_put(f"/auth/users/{usuario['username']}/role", admin_token, json={"role": "superman"})
    assert r.status_code == 422


def test_usuario_no_puede_cambiar_roles(usuario):
    r = api_put(f"/auth/users/{usuario['username']}/role", usuario["token"], json={"role": "admin"})
    assert r.status_code == 403


def test_auditoria_solo_para_admin(admin_token, usuario):
    assert api_get("/audit", usuario["token"]).status_code == 403
    r = api_get("/audit", admin_token, params={"limit": 500})
    assert r.status_code == 200
    assert "login" in r.text
