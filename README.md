# SmartLife

SmartLife is a SaaS platform for wedding planning and personal finance.

## Stack
- Angular frontend
- FastAPI backend
- PostgreSQL with SQLAlchemy and the cross-platform pg8000 driver
- Docker Compose for local deployment

## Recommended local stack

Run the app and PostgreSQL together. PostgreSQL listens on `5432` inside the Compose network, where the backend connects to `db:5432`. Its port is not published to the host, so it will not conflict with a local PostgreSQL service already using `5432`.

```bash
docker compose up --build
```

The web app is available at `http://localhost:4200` and the API docs at `http://localhost:8000/docs`.

## Run the backend on the host

If running FastAPI outside Docker, `localhost:5432` refers to your local PostgreSQL service, not the Compose database. `backend/.env.example` deliberately uses `CHANGE_ME`; replace it in `backend/.env` with the password configured for your local PostgreSQL `postgres` user. To use the Compose database from a host-run backend, publish its port in `docker-compose.yml` and ensure nothing else is listening on host port `5432`.

```bash
docker compose up -d db
cd backend
python -m venv venv
# Windows
# venv\Scripts\activate
# macOS/Linux
# source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env
# Edit backend/.env and replace CHANGE_ME with the actual local PostgreSQL password.
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Frontend setup
```bash
cd frontend
npm install
npm start
```

## Docker
```bash
docker compose up --build
```

## Testing
```bash
cd backend
pytest
```
