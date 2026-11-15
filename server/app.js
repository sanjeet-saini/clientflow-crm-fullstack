// =====================================================================
// app.js — Express REST API. Database bahar se milta hai (createApp(db)),
// isliye tests in-memory database ke saath app chala sakte hain.
//
//   GET    /api/health             server zinda hai?
//   GET    /api/data               { customers, leads, tasks } ek saath
//   GET    /api/:kind              ek list (kind = customers | leads | tasks)
//   GET    /api/:kind/:id          ek record
//   POST   /api/:kind              naya record
//   PUT    /api/:kind/:id          poora record update
//   PATCH  /api/:kind/:id          kuch fields update (jaise stage ya completed)
//   DELETE /api/:kind/:id          delete (customer → leads/tasks bhi, CASCADE)
//   POST   /api/reset              demo data wapas
// =====================================================================
import express from "express";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { COLUMNS, fromRow, insert, seed, toParams } from "./db.js";
import { validate } from "./validate.js";

const KINDS = ["customers", "leads", "tasks"];

export function createApp(db, { staticDir } = {}) {
  const app = express();
  app.use(express.json({ limit: "100kb" }));

  // Dev mein Vite (alag port) se call aate hain — CORS allow karo
  app.use("/api", (req, res, next) => {
    res.set("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
    res.set(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // Naye records upar (created_at DESC); same time wale apne insert order mein
  const list = (kind) =>
    db
      .prepare(`SELECT * FROM ${kind} ORDER BY created_at DESC, rowid ASC`)
      .all()
      .map((r) => fromRow(kind, r));
  const find = (kind, id) =>
    fromRow(kind, db.prepare(`SELECT * FROM ${kind} WHERE id = ?`).get(id));
  const customerExists = (id) =>
    !!id && !!db.prepare("SELECT 1 FROM customers WHERE id = ?").get(id);
  const allData = () => Object.fromEntries(KINDS.map((k) => [k, list(k)]));

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.get("/api/data", (req, res) => res.json(allData()));
  app.post("/api/reset", (req, res) => {
    seed(db);
    res.json(allData());
  });

  // Galat kind (/api/abc) → 404
  app.param("kind", (req, res, next, kind) =>
    KINDS.includes(kind)
      ? next()
      : res.status(404).json({ error: "Unknown resource." }),
  );

  app.get("/api/:kind", (req, res) => res.json(list(req.params.kind)));

  app.get("/api/:kind/:id", (req, res) => {
    const record = find(req.params.kind, req.params.id);
    record
      ? res.json(record)
      : res.status(404).json({ error: "Record not found." });
  });

  app.post("/api/:kind", (req, res) => {
    const { kind } = req.params;
    const { record, error } = validate(kind, req.body, customerExists);
    if (error) return res.status(400).json({ error });
    // Client apna id bhej sakta hai (optimistic UI), warna server banata hai
    const id =
      typeof req.body.id === "string" && req.body.id.trim()
        ? req.body.id.trim()
        : randomUUID();
    if (find(kind, id))
      return res
        .status(409)
        .json({ error: "A record with this id already exists." });
    const createdAt = !Number.isNaN(Date.parse(req.body.createdAt))
      ? req.body.createdAt
      : new Date().toISOString();
    insert(db, kind, { ...record, id, createdAt });
    res.status(201).json(find(kind, id));
  });

  // PUT aur PATCH dono: purane record par naye fields merge karo, phir poora validate.
  // id aur createdAt kabhi nahi badalte.
  const update = (req, res) => {
    const { kind, id } = req.params;
    const existing = find(kind, id);
    if (!existing) return res.status(404).json({ error: "Record not found." });
    const body = req.body && typeof req.body === "object" ? req.body : null;
    const { record, error } = validate(
      kind,
      body && { ...existing, ...body },
      customerExists,
    );
    if (error) return res.status(400).json({ error });
    const params = toParams(kind, {
      ...record,
      id,
      createdAt: existing.createdAt,
    });
    const sets = Object.values(COLUMNS[kind]).filter(
      (c) => c !== "id" && c !== "created_at",
    );
    const { created_at, ...rest } = params;
    db.prepare(
      `UPDATE ${kind} SET ${sets.map((c) => `${c} = :${c}`).join(", ")} WHERE id = :id`,
    ).run(rest);
    res.json(find(kind, id));
  };
  app.put("/api/:kind/:id", update);
  app.patch("/api/:kind/:id", update);

  app.delete("/api/:kind/:id", (req, res) => {
    const { changes } = db
      .prepare(`DELETE FROM ${req.params.kind} WHERE id = ?`)
      .run(req.params.id);
    changes
      ? res.sendStatus(204)
      : res.status(404).json({ error: "Record not found." });
  });

  app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

  // Production: built frontend (dist/) bhi yahi server serve kare — ek hi URL par app + API
  if (staticDir && existsSync(staticDir)) app.use(express.static(staticDir));

  // Kharab JSON ya koi aur error → saaf JSON message (stack trace bahar nahi)
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed")
      return res.status(400).json({ error: "Invalid JSON body." });
    console.error(err);
    res.status(500).json({ error: "Internal server error." });
  });

  return app;
}
