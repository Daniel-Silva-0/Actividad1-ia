# PROYECTO ARTMONIA

Aplicación local para la gestión de productos, inventario, ventas, compras,
vendedores, clientes, proveedores y liquidación de comisiones.

## Requisitos

- Python 3.11 o posterior.
- Node.js compatible con Vite 8 (Node.js 20.19+ o 22.12+).
- Git para clonar el repositorio.
- Docker Desktop, solo si se desea ejecutar el backend con Docker Compose.

## Descargar el proyecto

```bash
git clone https://github.com/Daniel-Silva-0/Actividad1-ia.git
cd Actividad1-ia
```

La base de datos de desarrollo está en `back/artmonia.db`. El backend la usa
por defecto y la conserva entre ejecuciones.

## Ejecución local sin Docker

Ejecuta cada parte en una terminal independiente.

### 1. Backend (FastAPI)

Desde la carpeta raíz del proyecto:

**Windows PowerShell**

```powershell
cd back
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Si PowerShell bloquea la activación del entorno virtual, puedes omitirla y
usar directamente:

```powershell
cd back
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

**macOS / Linux**

```bash
cd back
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

La API queda disponible en <http://localhost:8000> y su documentación
interactiva en <http://localhost:8000/docs>.

### 2. Frontend (React + Vite)

En una segunda terminal, desde la raíz del proyecto:

```bash
cd frontend
npm ci
npm run dev
```

Abre la dirección que muestre Vite; normalmente es
<http://localhost:5173>. El frontend se conecta por defecto a
`http://localhost:8000`.

Para usar otra dirección de API, crea `frontend/.env.local` con:

```dotenv
VITE_API_URL=http://localhost:8000
```

Reinicia Vite después de cambiar variables `VITE_*`.

### Datos de prueba

El repositorio incluye la base SQLite de desarrollo. Si necesitas cargar de
nuevo los registros de ejemplo, ejecuta desde `back/` con el entorno virtual
activo:

```bash
python seed_db.py
```

El script agrega los registros de ejemplo que falten; no reemplaza los
existentes.

## Ejecución con Docker Compose

Docker Compose inicia el backend. Desde la raíz:

```bash
docker compose up --build
```

La API estará en <http://localhost:8000/docs>. Para detenerla, pulsa `Ctrl+C`
y ejecuta:

```bash
docker compose down
```

Compose no inicia el frontend. Para usar la interfaz junto con el backend de
Docker, ejecuta en otra terminal:

```bash
cd frontend
npm ci
npm run dev
```

Abre <http://localhost:5173>. Compose monta `back/artmonia.db` dentro del
contenedor para conservar los datos de desarrollo.

## Comandos útiles del frontend

Desde `frontend/`:

```bash
npm run lint
npm run build
```
