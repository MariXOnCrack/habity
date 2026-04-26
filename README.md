# Habity

Mobile-first habit and objective tracker with:

- React/Vite frontend
- Express API
- Postgres persistence
- Photo uploads stored in a Docker volume

## Run With Docker Compose

```sh
docker compose up --build
```

Then open:

```txt
http://localhost:3000
```

Data is persisted in two Docker volumes:

- `postgres-data` stores habits, objectives, and progress records.
- `uploads-data` stores objective proof photos.

## Local Development

Start Postgres yourself or use the Compose `db` service, then run the API with:

```sh
$env:DATABASE_URL="postgres://habity:habity@localhost:5432/habity"
npm run dev:api
```

In another terminal:

```sh
npm run dev
```

The Vite dev server proxies `/api` and `/uploads` to `http://127.0.0.1:3000`.
