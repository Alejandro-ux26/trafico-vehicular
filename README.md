# Plataforma de análisis de tráfico vehicular (Proyecto 14)

Cuenta vehículos por categoría (car, motorcycle, bus, truck) en videos de fuentes autorizadas, sin
identificar personas, y analiza el flujo en el tiempo. IA: YOLO26 + ByteTrack (CPU) frente a un
baseline OpenCV (MOG2).

```
Frontend (React, en /app) -> Backend FastAPI -> MongoDB (series temporales)
                                    |
                                    v
                         Servicio IA FastAPI (YOLO26 | baseline)
```

## Estructura
- `backend/`    API, autenticación JWT, roles (usuario/operador/admin), fuentes, trabajos, conteos, auditoría.
- `ai-service/` Microservicio de IA: `/process` devuelve conteos + metadatos (versión, parámetros, FPS).
- `frontend/`   Interfaz web (React 18 sin compilación), servida por el backend en `/app`.
- `notebooks/`  Notebook de evaluación (Jupyter): compara realidad vs baseline vs YOLO26 y registra todo en MongoDB.
- `docs/`       Requisitos, diagramas, informe. Ver `docs/ENTREGABLES.md`.
- `data/`       Videos subidos (no se versiona). `models/` pesos de YOLO26 (no se versiona).

## Arranque rápido con Docker
```
copy .env.example .env      # edita los secretos
docker compose up --build
```
- API + docs interactivas: http://localhost:8000/docs
- Servicio IA:            http://localhost:8001/docs
- Al primer uso, el servicio IA descarga `yolo26n.pt` (necesita internet) en `./models`.

## Desarrollo local (sin Docker para los servicios)
```
docker compose up mongo -d
conda create -n trafico python=3.10 -y && conda activate trafico
pip install "numpy<2"
pip install -r ai-service/requirements.txt -r backend/requirements.txt
set DATA_DIR=C:\ruta\absoluta\al\repo\data           (PowerShell: $env:DATA_DIR="...")
cd ai-service && uvicorn app.main:app --port 8001
cd backend    && uvicorn app.main:app --port 8000     (en otra terminal, mismo DATA_DIR)
```
Pruebas del servicio IA: `pip install -r ai-service/requirements-dev.txt` y `cd ai-service && pytest`.

## Flujo principal (para la demo)
1. `POST /auth/login` con el admin del `.env` -> token.
2. `POST /sources` con el nombre y la línea de conteo `[x1,y1,x2,y2]` normalizada (0..1).
3. `POST /jobs` (multipart: `source_id`, `method` = yolo26|baseline, archivo de video).
4. `GET /jobs/{id}` hasta que `status` sea `completado` (o `error`, con el motivo).
5. `GET /counts/summary` y `GET /counts/series?unit=minute` alimentan el dashboard.

## Estado
- [x] Lógica de conteo y tracker, con pruebas unitarias (7 pasan).
- [x] Servicio IA (YOLO26 y baseline), backend con roles, auditoría y series temporales.
- [ ] Probar el flujo completo con sus videos y ajustar la línea de conteo.
- [ ] Anotar conteos manuales (verdad de terreno) y medir error de conteo, mAP, FPS, MAE.
- [ ] Frontend, pruebas de API/integración, CI, informe y demo.

## Notebook de evaluación (Jupyter)
`notebooks/Notebook_Trafico_Vehicular.ipynb` lee de MongoDB los trabajos ya procesados, los compara con el
conteo manual (verdad de terreno) y guarda la evaluación en `evaluations` (también `ground_truth` y `model_versions`).
Las gráficas y los CSV quedan en `notebooks/resultados/`.
```
conda activate trafico
pip install -r notebooks\requirements-notebook.txt
docker compose up mongo -d
jupyter notebook
```
Abre el notebook y ejecuta las celdas en orden. Para sumar videos, procésalos con la plataforma (yolo26 y baseline),
cuéntalos a mano y agrégalos a `GROUND_TRUTH` (sección 3).

## Interfaz web
Con el backend encendido, abre **http://127.0.0.1:8000/app/** (también `http://127.0.0.1:8000/`).
Entra con el administrador del `.env` (por defecto `admin` / `admin12345`) o crea una cuenta.
Pantallas: procesar video, trabajos, dashboard, evaluación del modelo y administración. Detalles en `frontend/README.md`.
