"""Utilidades compartidas por las pruebas de la API (backend FastAPI + servicio de IA + MongoDB)."""
import os
import time
import uuid
from pathlib import Path

import requests

# Backend de PRUEBAS: puerto 8010 y base de datos aparte (trafico_test).
API_URL = os.getenv("API_URL", "http://127.0.0.1:8010").rstrip("/")
AI_URL = os.getenv("AI_URL", "http://127.0.0.1:8001").rstrip("/")
ADMIN_USER = os.getenv("TEST_ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("TEST_ADMIN_PASSWORD", "admin12345")

CLAVE_PRUEBA = "Prueba12345"
ID_INEXISTENTE = "000000000000000000000000"
LINEA_HORIZONTAL = [0.1, 0.5, 0.9, 0.5]
TIMEOUT = 30


def _preparar(token, kwargs):
    if token:
        kwargs["headers"] = {**kwargs.get("headers", {}), "Authorization": f"Bearer {token}"}
    kwargs.setdefault("timeout", TIMEOUT)
    return kwargs


def api_get(ruta, token=None, **kwargs):
    return requests.get(API_URL + ruta, **_preparar(token, kwargs))


def api_post(ruta, token=None, **kwargs):
    return requests.post(API_URL + ruta, **_preparar(token, kwargs))


def api_put(ruta, token=None, **kwargs):
    return requests.put(API_URL + ruta, **_preparar(token, kwargs))


def nombre_unico(prefijo):
    return f"{prefijo}_{uuid.uuid4().hex[:8]}"


def extraer_id(cuerpo):
    """Devuelve el identificador de una respuesta (id, job_id, source_id o _id)."""
    for clave in ("id", "job_id", "source_id", "_id"):
        if cuerpo.get(clave):
            return str(cuerpo[clave])
    raise AssertionError(f"La respuesta no trae un identificador: {cuerpo}")


def buscar_lista(cuerpo):
    """Devuelve la lista de elementos (diccionarios) que viene dentro de una respuesta."""
    if isinstance(cuerpo, list):
        return cuerpo
    for valor in cuerpo.values():
        if isinstance(valor, list) and (not valor or isinstance(valor[0], dict)):
            return valor
    return []


def registrar(username, password=CLAVE_PRUEBA):
    return api_post("/auth/register", json={"username": username, "password": password})


def iniciar_sesion(username, password=CLAVE_PRUEBA):
    return api_post("/auth/login", data={"username": username, "password": password})


def token_de(username, password=CLAVE_PRUEBA):
    r = iniciar_sesion(username, password)
    assert r.status_code == 200, f"No se pudo iniciar sesión como {username}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def crear_usuario(admin_token, rol="usuario", prefijo="usuario"):
    """Crea una cuenta nueva, le asigna el rol pedido y devuelve sus datos con un token."""
    username = nombre_unico(prefijo)
    r = registrar(username)
    assert r.status_code == 201, r.text
    if rol != "usuario":
        r = api_put(f"/auth/users/{username}/role", admin_token, json={"role": rol})
        assert r.status_code == 200, r.text
    return {"username": username, "password": CLAVE_PRUEBA, "token": token_de(username)}


def crear_fuente(token, nombre=None, autorizada=True, linea=None):
    cuerpo = {
        "name": nombre or nombre_unico("Fuente prueba"),
        "description": "Fuente creada por las pruebas automáticas",
        "line": linea or LINEA_HORIZONTAL,
        "authorized": autorizada,
    }
    r = api_post("/sources", token, json=cuerpo)
    assert r.status_code == 201, r.text
    return {"id": extraer_id(r.json()), "name": cuerpo["name"], "line": cuerpo["line"]}


def crear_video(ruta, segundos=6, fps=15, ancho=320, alto=240):
    """Genera un video sintético: un rectángulo blanco que cruza la pantalla de arriba a abajo."""
    import cv2
    import numpy as np

    ruta = Path(ruta)
    escritor = cv2.VideoWriter(str(ruta), cv2.VideoWriter_fourcc(*"MJPG"), fps, (ancho, alto))
    if not escritor.isOpened():
        raise RuntimeError("OpenCV no pudo crear el video de prueba")
    total = int(segundos * fps)
    inicio = int(total * 0.25)
    for i in range(total):
        fotograma = np.full((alto, ancho, 3), 90, dtype=np.uint8)
        if i >= inicio:
            progreso = (i - inicio) / max(1, total - inicio)
            y = int(-80 + progreso * (alto + 80))
            cv2.rectangle(fotograma, (110, y), (190, y + 80), (255, 255, 255), -1)
        escritor.write(fotograma)
    escritor.release()
    return ruta


def subir_video(token, fuente_id, ruta, metodo="baseline", intervalo=10):
    ruta = Path(ruta)
    with open(ruta, "rb") as archivo:
        return api_post(
            "/jobs",
            token,
            data={"source_id": fuente_id, "method": metodo, "interval_seconds": str(intervalo)},
            files={"file": (ruta.name, archivo)},
            timeout=120,
        )


def esperar_trabajo(token, job_id, timeout=240):
    """Consulta el trabajo cada 2 s hasta que termina (completado o error)."""
    limite = time.time() + timeout
    ultimo = None
    while time.time() < limite:
        r = api_get(f"/jobs/{job_id}", token)
        assert r.status_code == 200, r.text
        ultimo = r.json()
        if ultimo.get("status") in ("completado", "error"):
            return ultimo
        time.sleep(2)
    raise AssertionError(f"El trabajo no terminó en {timeout} s. Último estado: {ultimo}")
