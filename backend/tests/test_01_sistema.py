"""Estado del sistema, documentación OpenAPI e interfaz web."""
import requests

from helpers import AI_URL, ID_INEXISTENTE, api_get


def test_health_api_mongo_e_ia_ok():
    r = api_get("/health")
    assert r.status_code == 200
    estado = r.json()
    assert estado["api"] == "ok"
    assert estado["mongo"] == "ok"
    assert estado["ai_service"] == "ok"


def test_servicio_de_ia_responde():
    r = requests.get(AI_URL + "/health", timeout=10)
    assert r.status_code == 200


def test_openapi_describe_los_endpoints_principales():
    r = api_get("/openapi.json")
    assert r.status_code == 200
    rutas = r.json()["paths"]
    for ruta in ["/health", "/auth/login", "/auth/register", "/sources", "/jobs", "/counts/summary", "/counts/series"]:
        assert ruta in rutas, f"Falta {ruta} en la especificación OpenAPI"


def test_swagger_ui_disponible():
    r = api_get("/docs")
    assert r.status_code == 200
    assert "swagger" in r.text.lower()


def test_la_raiz_redirige_a_la_interfaz_web():
    r = api_get("/")
    assert r.status_code == 200
    assert "/app" in r.url


def test_la_interfaz_web_se_sirve():
    r = api_get("/app/")
    assert r.status_code == 200
    assert "<html" in r.text.lower()


def test_evaluaciones_se_pueden_consultar(usuario):
    r = api_get("/evaluations", usuario["token"])
    assert r.status_code == 200
    # En la base de pruebas puede no haber evaluaciones todavía.
    assert api_get("/evaluations/latest", usuario["token"]).status_code in (200, 404)


def test_evaluacion_inexistente_devuelve_404(usuario):
    r = api_get(f"/evaluations/{ID_INEXISTENTE}", usuario["token"])
    assert r.status_code == 404
