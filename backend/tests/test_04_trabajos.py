"""Trabajos de procesamiento: validaciones y flujo completo (backend + servicio de IA + MongoDB)."""
import pytest

from helpers import (
    ID_INEXISTENTE,
    api_get,
    buscar_lista,
    crear_fuente,
    esperar_trabajo,
    extraer_id,
    subir_video,
)


def test_usuario_no_puede_subir_videos(usuario, fuente, video_prueba):
    assert subir_video(usuario["token"], fuente["id"], video_prueba).status_code == 403


def test_fuente_inexistente_devuelve_404(operador, video_prueba):
    assert subir_video(operador["token"], ID_INEXISTENTE, video_prueba).status_code == 404


def test_fuente_no_autorizada_devuelve_403(operador, video_prueba):
    fuente = crear_fuente(operador["token"], autorizada=False)
    assert subir_video(operador["token"], fuente["id"], video_prueba).status_code == 403


def test_metodo_invalido_devuelve_422(operador, fuente, video_prueba):
    assert subir_video(operador["token"], fuente["id"], video_prueba, metodo="magia").status_code == 422


@pytest.mark.parametrize("intervalo", [0, 3601], ids=["cero", "mayor_a_3600"])
def test_intervalo_fuera_de_rango_devuelve_422(operador, fuente, video_prueba, intervalo):
    assert subir_video(operador["token"], fuente["id"], video_prueba, intervalo=intervalo).status_code == 422


def test_extension_no_permitida_devuelve_422(operador, fuente, tmp_path):
    archivo = tmp_path / "notas.txt"
    archivo.write_text("esto no es un video")
    assert subir_video(operador["token"], fuente["id"], archivo).status_code == 422


@pytest.mark.integracion
@pytest.mark.parametrize("metodo", ["baseline", "yolo26"])
def test_flujo_completo_de_un_video(metodo, operador, usuario, fuente, video_prueba):
    token = operador["token"]

    # 1. Se sube el video y el backend responde de inmediato con 202.
    r = subir_video(token, fuente["id"], video_prueba, metodo=metodo)
    assert r.status_code == 202, r.text
    cuerpo = r.json()
    job_id = extraer_id(cuerpo)
    if "status" in cuerpo:
        assert cuerpo["status"] == "pendiente"

    # 2. El trabajo termina como completado y guarda los metadatos de la IA.
    trabajo = esperar_trabajo(token, job_id)
    assert trabajo.get("status") == "completado", trabajo.get("error")
    meta = trabajo["ai_meta"]
    assert meta["method"] == metodo
    assert meta["frames_processed"] > 0
    totales = trabajo["totals"]
    assert isinstance(totales, dict)
    assert all(valor >= 0 for valor in totales.values())

    # 3. Los conteos por intervalo coinciden con los totales del trabajo.
    r = api_get(f"/jobs/{job_id}/intervals", usuario["token"])
    assert r.status_code == 200
    intervalos = r.json()
    assert intervalos["interval_seconds"] == 10
    assert sum(item["count"] for item in buscar_lista(intervalos)) == sum(totales.values())

    # 4. El trabajo aparece en los listados y en las consultas de conteos.
    assert job_id in api_get("/jobs", usuario["token"]).text
    assert job_id in api_get("/jobs", usuario["token"], params={"source_id": fuente["id"]}).text
    assert api_get("/counts/summary", usuario["token"], params={"job_id": job_id}).status_code == 200
    assert api_get("/counts/series", usuario["token"], params={"job_id": job_id, "unit": "minute"}).status_code == 200


@pytest.mark.integracion
def test_video_corrupto_termina_en_error_sin_tumbar_el_sistema(operador, fuente, tmp_path):
    archivo = tmp_path / "corrupto.mp4"
    archivo.write_bytes(b"esto no es un video")
    r = subir_video(operador["token"], fuente["id"], archivo)
    assert r.status_code == 202, r.text
    trabajo = esperar_trabajo(operador["token"], extraer_id(r.json()), timeout=90)
    assert trabajo.get("status") == "error"
    assert trabajo.get("error")
    assert api_get("/health").json()["api"] == "ok"


@pytest.mark.integracion
def test_auditoria_registra_la_creacion_y_el_resultado_de_los_trabajos(admin_token):
    r = api_get("/audit", admin_token, params={"limit": 500})
    assert r.status_code == 200
    assert "create_job" in r.text
    assert "job_completed" in r.text
    assert "job_failed" in r.text
