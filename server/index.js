// =====================================================================
// index.js — server start karta hai. Chalane ke liye: npm run server
// Env: PORT (default 4000), DB_PATH (default server/data/crm.db)
// =====================================================================
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { openDb } from "./db.js";

const root = (p) => fileURLToPath(new URL(p, import.meta.url));
const port = Number(process.env.PORT) || 4000;
const dbPath = process.env.DB_PATH || root("./data/crm.db");

const db = openDb(dbPath);
const app = createApp(db, { staticDir: root("../dist") });

app.listen(port, () => {
  console.log(
    `ClientFlow API running on http://localhost:${port}/api (db: ${dbPath})`,
  );
});
