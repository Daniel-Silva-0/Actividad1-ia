# Imagen base ligera de Python
FROM python:3.11-slim

# Evita archivos .pyc y muestra los logs inmediatamente
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Instala primero las dependencias para aprovechar la caché de Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Ejecuta la aplicación con un usuario sin privilegios
RUN useradd --create-home --uid 10001 app
COPY --chown=app:app . .
USER app

# Puerto que expone la API
EXPOSE 8000

# Inicia FastAPI escuchando en todas las interfaces del contenedor
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]