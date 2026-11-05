FROM python:3.10-slim
ENV PYTHONUNBUFFERED=1 PYTHONPATH=/app
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 && rm -rf /var/lib/apt/lists/*
# PyTorch solo-CPU (evita descargar los paquetes CUDA, que pesan varios GB)
RUN pip install --no-cache-dir typing-extensions filelock sympy networkx jinja2 fsspec setuptools
RUN pip install --no-cache-dir --no-deps torch==2.14.1+cpu torchvision==0.29.2+cpu --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
# OpenCV necesita libGL (si falta: "libGL.so.1: cannot open shared object file")
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 && rm -rf /var/lib/apt/lists/*
COPY app /app/app
# Los pesos (yolo26n.pt) se descargan solos al primer uso en /models (volumen)
WORKDIR /models
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
