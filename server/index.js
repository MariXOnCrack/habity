import compression from "compression";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import multer from "multer";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "dist");
const uploadDir = process.env.UPLOAD_DIR || path.join(rootDir, "uploads");
const port = Number(process.env.PORT || 3560);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
});

const app = express();
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_request, file, callback) => {
      const safeExt = extensionFor(file.mimetype, file.originalname);
      callback(null, `${randomUUID()}${safeExt}`);
    },
  }),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    callback(null, file.mimetype.startsWith("image/"));
  },
});

app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(uploadDir, { maxAge: "1d" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/state", async (_request, response, next) => {
  try {
    response.json(await serializeState());
  } catch (error) {
    next(error);
  }
});

app.post("/api/items", async (request, response, next) => {
  try {
    const type = String(request.body.type || "").trim();
    const name = String(request.body.name || "").trim();

    if (!["habit", "objective"].includes(type)) {
      return response.status(400).send("Invalid item type");
    }
    if (!name) {
      return response.status(400).send("Name is required");
    }

    const sortResult = await pool.query("select coalesce(max(sort_order), -1) + 1 as next_sort from items");
    await pool.query(
      "insert into items (id, type, name, created_at, sort_order) values ($1, $2, $3, current_date, $4)",
      [randomUUID(), type, name, sortResult.rows[0].next_sort],
    );

    response.status(201).json(await serializeState());
  } catch (error) {
    next(error);
  }
});

app.post("/api/habits/:id/toggle", async (request, response, next) => {
  try {
    const id = request.params.id;
    const date = parseDateParam(request.body.date);
    const item = await getItem(id);

    if (!item) return response.status(404).send("Habit not found");
    if (item.type !== "habit") return response.status(400).send("Item is not a habit");

    const existing = await pool.query("select completed from records where item_id = $1 and record_date = $2", [id, date]);
    if (existing.rowCount > 0) {
      await pool.query("delete from records where item_id = $1 and record_date = $2", [id, date]);
    } else {
      await pool.query(
        `insert into records (item_id, record_date, completed, updated_at)
         values ($1, $2, true, now())
         on conflict (item_id, record_date)
         do update set completed = true, photo_path = null, updated_at = now()`,
        [id, date],
      );
    }

    response.json(await serializeState());
  } catch (error) {
    next(error);
  }
});

app.post("/api/objectives/:id/proof", upload.single("photo"), async (request, response, next) => {
  try {
    const id = request.params.id;
    const date = parseDateParam(request.body.date);
    const item = await getItem(id);

    if (!item) return response.status(404).send("Objective not found");
    if (item.type !== "objective") return response.status(400).send("Item is not an objective");
    if (!request.file) return response.status(400).send("Photo is required");

    await pool.query(
      `insert into records (item_id, record_date, completed, photo_path, updated_at)
       values ($1, $2, true, $3, now())
       on conflict (item_id, record_date)
       do update set completed = true, photo_path = excluded.photo_path, updated_at = now()`,
      [id, date, request.file.filename],
    );

    response.json(await serializeState());
  } catch (error) {
    next(error);
  }
});

app.delete("/api/data", async (_request, response, next) => {
  try {
    const photoResult = await pool.query("select photo_path from records where photo_path is not null");
    const photoPaths = photoResult.rows.map((row) => row.photo_path);

    await pool.query("delete from records");
    await pool.query("delete from items");
    await removeUploadedFiles(photoPaths);

    response.json(await serializeState());
  } catch (error) {
    next(error);
  }
});

app.use(express.static(publicDir));
app.get("*", (_request, response) => {
  response.sendFile(path.join(publicDir, "index.html"));
});

app.use((error, _request, response, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return response.status(413).send("Image is too large");
  }
  response.status(500).send("Internal server error");
});

await start();

async function start() {
  await fs.mkdir(uploadDir, { recursive: true });
  await waitForDatabase();
  await migrate();

  app.listen(port, () => {
    console.log(`Habity listening on http://0.0.0.0:${port}`);
  });
}

async function waitForDatabase() {
  const attempts = 30;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await pool.query("select 1");
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      await delay(1000);
    }
  }
}

async function migrate() {
  await pool.query(`
    create table if not exists items (
      id uuid primary key,
      type text not null check (type in ('habit', 'objective')),
      name text not null,
      created_at date not null default current_date,
      sort_order integer not null default 0
    );

    create table if not exists records (
      item_id uuid not null references items(id) on delete cascade,
      record_date date not null,
      completed boolean not null default true,
      photo_path text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (item_id, record_date)
    );
  `);
}

async function serializeState() {
  const itemsResult = await pool.query("select id, type, name, created_at, sort_order from items order by sort_order, created_at, name");
  const recordsResult = await pool.query(
    "select item_id, record_date, completed, photo_path, created_at from records order by record_date asc",
  );

  const recordsByItem = new Map();
  for (const row of recordsResult.rows) {
    const key = formatDateKey(row.record_date);
    const record = {
      completed: row.completed,
      at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
    if (row.photo_path) {
      record.photo = `/uploads/${row.photo_path}`;
    }

    if (!recordsByItem.has(row.item_id)) recordsByItem.set(row.item_id, {});
    recordsByItem.get(row.item_id)[key] = record;
  }

  return {
    items: itemsResult.rows.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      createdAt: formatDateKey(row.created_at),
      sort: row.sort_order,
      records: recordsByItem.get(row.id) || {},
    })),
  };
}

async function removeUploadedFiles(fileNames) {
  const uploadsRoot = path.resolve(uploadDir);
  const uniqueNames = [...new Set(fileNames.filter(Boolean))];

  await Promise.all(
    uniqueNames.map(async (fileName) => {
      const target = path.resolve(uploadsRoot, fileName);
      if (!target.startsWith(`${uploadsRoot}${path.sep}`)) return;

      try {
        await fs.unlink(target);
      } catch (error) {
        if (error.code !== "ENOENT") console.warn(`Could not remove uploaded file ${fileName}`, error);
      }
    }),
  );
}

async function getItem(id) {
  const result = await pool.query("select id, type from items where id = $1", [id]);
  return result.rows[0];
}

function parseDateParam(value) {
  const candidate = String(value || dateKey(new Date()));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    throw new Error("Invalid date");
  }
  return candidate;
}

function extensionFor(mimeType, originalName) {
  const known = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };
  if (known[mimeType]) return known[mimeType];
  const ext = path.extname(originalName || "").toLowerCase();
  return ext && ext.length <= 8 ? ext : ".jpg";
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateKey(value) {
  if (value instanceof Date) return dateKey(value);
  return String(value).slice(0, 10);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
