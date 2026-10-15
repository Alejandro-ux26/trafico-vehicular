FROM python:3.10-slim
ENV PYTHONUNBUFFERED=1 PYTHONPATH=/app
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 && rm -rf /var/lib/apt/lists/*
# PyTorch solo-CPU (evita descargar los paquetes CUDA, que pesan varios GB)
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY app /app/app
# Los pesos (yolo26n.pt) se descargan solos al primer uso en /models (volumen)
WORKDIR /models
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
