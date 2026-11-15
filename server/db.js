// =====================================================================
// db.js — SQLite database (Node ka built-in "node:sqlite", koi native package nahi).
// Kaam: tables banana, pehli baar demo data daalna, aur rows ko JS objects mein badalna.
// =====================================================================
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { demoData } from "../src/data.js";

// Teen tables. FOREIGN KEY ... ON DELETE CASCADE → customer delete hote hi
// uske leads/tasks database khud hata deta hai (orphan records nahi bachte).
// CHECK constraints → galat stage/status/priority database level par hi reject.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT NOT NULL DEFAULT '',
  company    TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL CHECK (status IN ('Active','Inactive')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leads (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  stage       TEXT NOT NULL CHECK (stage IN ('New','Contacted','In Progress','Won','Lost')),
  value       REAL NOT NULL CHECK (value >= 0),
  created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  priority    TEXT NOT NULL CHECK (priority IN ('Low','Medium','High')),
  due_date    TEXT NOT NULL,
  completed   INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS leads_customer ON leads(customer_id);
CREATE INDEX IF NOT EXISTS tasks_customer ON tasks(customer_id);
`;

// Har table ke columns: JS naam (camelCase) → SQL column (snake_case)
export const COLUMNS = {
  customers: {
    id: "id",
    name: "name",
    email: "email",
    phone: "phone",
    company: "company",
    status: "status",
    createdAt: "created_at",
  },
  leads: {
    id: "id",
    title: "title",
    customerId: "customer_id",
    stage: "stage",
    value: "value",
    createdAt: "created_at",
  },
  tasks: {
    id: "id",
    title: "title",
    customerId: "customer_id",
    priority: "priority",
    dueDate: "due_date",
    completed: "completed",
    createdAt: "created_at",
  },
};

// Database row → frontend wala object. completed 0/1 → false/true, null customer → ""
export function fromRow(kind, row) {
  if (!row) return null;
  const out = {};
  for (const [key, col] of Object.entries(COLUMNS[kind])) out[key] = row[col];
  if (kind === "tasks") {
    out.completed = out.completed === 1;
    out.customerId = out.customerId ?? "";
  }
  return out;
}

// Frontend object → SQL parameters ({ id: ..., customer_id: ... })
export function toParams(kind, record) {
  const params = {};
  for (const [key, col] of Object.entries(COLUMNS[kind]))
    params[col] = record[key];
  if (kind === "tasks") {
    params.completed = record.completed ? 1 : 0;
    params.customer_id = record.customerId || null;
  }
  return params;
}

export function insert(db, kind, record) {
  const cols = Object.values(COLUMNS[kind]);
  db.prepare(
    `INSERT INTO ${kind} (${cols.join(", ")}) VALUES (${cols.map((c) => ":" + c).join(", ")})`,
  ).run(toParams(kind, record));
}

// Sab tables saaf karke demo data daalo (ek transaction mein — ya sab, ya kuch nahi)
export function seed(db, data = demoData()) {
  transaction(db, () => {
    db.exec("DELETE FROM tasks; DELETE FROM leads; DELETE FROM customers;");
    for (const kind of ["customers", "leads", "tasks"])
      for (const record of data[kind]) insert(db, kind, record);
  });
}

export function transaction(db, fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// Database kholo (file na ho to ban jaati hai). ":memory:" = sirf RAM mein (tests ke liye).
// Bilkul naya database ho to demo data seed karo. Khaali kiya hua workspace khaali hi rehta hai.
export function openDb(path = ":memory:") {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  const isNew = !db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='customers'",
    )
    .get();
  db.exec(SCHEMA);
  if (isNew) seed(db);
  return db;
}
