# Pruebas automáticas de la API

Pruebas de API e integración (pytest + requests) contra un **backend de pruebas** con su propia base de datos
(`trafico_test`), para no mezclar datos con los de la aplicación.

Qué cubren: estado del sistema y OpenAPI, autenticación y roles, fuentes, validaciones de trabajos y el flujo
completo (subir video → servicio de IA → MongoDB → conteos) con ambos métodos, más un video corrupto.

## Cómo ejecutarlas (Anaconda Prompt, entorno `trafico`)

Antes: MongoDB encendido y el servicio de IA corriendo en el puerto 8001.

Consola A, backend de pruebas:

    set DATA_DIR=RUTA_PROYECTO\data
    set MONGO_DB=trafico_test
    cd RUTA_PROYECTO\backend
    uvicorn app.main:app --port 8010

Consola B, pruebas:

    cd RUTA_PROYECTO\backend
    pip install -r requirements-dev.txt
    pytest --junitxml=tests\resultados\junit.xml

Solo las rápidas (sin procesar videos): `pytest -m "not integracion"`.
