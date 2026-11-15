// =====================================================================
// API tests — asli Express server + in-memory SQLite database.
// Har test apna naya database leta hai, isliye tests ek doosre ko affect nahi karte.
// =====================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { openDb } from "../server/db.js";
import { isValidData, metrics } from "../src/data.js";

// Server port 0 par chalao (OS khaali port deta hai), test ke baad band
async function withServer(fn) {
  const db = openDb(":memory:");
  const server = createApp(db).listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const api = async (path, method = "GET", body) => {
    const res = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body:
        body === undefined
          ? undefined
          : typeof body === "string"
            ? body
            : JSON.stringify(body),
    });
    return {
      status: res.status,
      body: res.status === 204 ? null : await res.json(),
    };
  };
  try {
    await fn(api, db);
  } finally {
    server.close();
    db.close();
  }
}

test("new database is seeded with valid demo data", () =>
  withServer(async (api) => {
    assert.deepEqual((await api("/health")).body, { ok: true });
    const { status, body } = await api("/data");
    assert.equal(status, 200);
    assert.equal(isValidData(body), true);
    assert.deepEqual(metrics(body), {
      customers: 6,
      leads: 8,
      active: 5,
      won: 2,
      revenue: 83000,
    });
    assert.equal(body.customers[0].id, "c1");
    assert.equal(typeof body.tasks[3].completed, "boolean");
  }));

test("customer CRUD round-trips through the database", () =>
  withServer(async (api) => {
    const created = await api("/customers", "POST", {
      id: "client-1",
      name: "  Tara Joshi ",
      email: "tara@example.com",
      phone: "98200 11111",
      company: "Kite Labs",
      status: "Active",
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.name, "Tara Joshi"); // trim hua
    assert.equal(created.body.id, "client-1");

    const dup = await api("/customers", "POST", {
      id: "client-1",
      name: "X",
      email: "x@example.com",
    });
    assert.equal(dup.status, 409);

    const updated = await api("/customers/client-1", "PATCH", {
      status: "Inactive",
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.status, "Inactive");
    assert.equal(updated.body.email, "tara@example.com"); // baaki fields wahi
    assert.equal(updated.body.createdAt, created.body.createdAt);

    const put = await api("/customers/client-1", "PUT", {
      ...updated.body,
      company: "Kite Labs Pvt",
    });
    assert.equal(put.body.company, "Kite Labs Pvt");

    assert.equal(
      (await api("/customers/client-1")).body.company,
      "Kite Labs Pvt",
    );
    assert.equal((await api("/customers/client-1", "DELETE")).status, 204);
    assert.equal((await api("/customers/client-1")).status, 404);
    assert.equal((await api("/customers/client-1", "DELETE")).status, 404);
  }));

test("deleting a customer cascades to linked leads and tasks", () =>
  withServer(async (api) => {
    await api("/customers/c1", "DELETE");
    const data = (await api("/data")).body;
    assert.equal(data.customers.length, 5);
    assert.ok(data.leads.every((l) => l.customerId !== "c1"));
    assert.ok(data.tasks.every((t) => t.customerId !== "c1"));
    assert.equal(isValidData(data), true);
  }));

test("lead stage and task completion can be patched", () =>
  withServer(async (api) => {
    const lead = await api("/leads/l1", "PATCH", { stage: "Won" });
    assert.equal(lead.body.stage, "Won");
    const task = await api("/tasks/t1", "PATCH", { completed: true });
    assert.equal(task.body.completed, true);
    const data = (await api("/data")).body;
    assert.equal(metrics(data).revenue, 168000);
    assert.equal(data.tasks.find((t) => t.id === "t1").completed, true);
  }));

test("tasks may be unlinked; leads may not", () =>
  withServer(async (api) => {
    const task = await api("/tasks", "POST", {
      title: "Write notes",
      customerId: "",
      priority: "Low",
      dueDate: "2026-12-01",
    });
    assert.equal(task.status, 201);
    assert.equal(task.body.customerId, "");
    assert.equal(task.body.completed, false);

    const lead = await api("/leads", "POST", {
      title: "Orphan deal",
      customerId: "",
      stage: "New",
      value: 100,
    });
    assert.equal(lead.status, 400);
  }));

test("invalid input is rejected with 400 and nothing is saved", () =>
  withServer(async (api) => {
    const bad = [
      ["/customers", { name: "   ", email: "a@b.co" }],
      ["/customers", { name: "A", email: "not-an-email" }],
      ["/customers", { name: "A", email: "a@b.co", phone: "abc" }],
      ["/customers", { name: "A", email: "a@b.co", status: "Maybe" }],
      ["/leads", { title: "Deal", customerId: "c1", value: -5 }],
      ["/leads", { title: "Deal", customerId: "c1", value: "" }],
      ["/leads", { title: "Deal", customerId: "missing", value: 10 }],
      ["/leads", { title: "Deal", customerId: "c1", value: 10, stage: "Done" }],
      ["/tasks", { title: "Call", priority: "Urgent", dueDate: "2026-01-01" }],
      ["/tasks", { title: "Call", dueDate: "tomorrow" }],
      ["/tasks", { title: "Call", dueDate: "2026-01-01", completed: "yes" }],
    ];
    for (const [path, body] of bad) {
      const res = await api(path, "POST", body);
      assert.equal(res.status, 400, `${path} ${JSON.stringify(body)}`);
      assert.equal(typeof res.body.error, "string");
    }
    assert.equal((await api("/leads/l1", "PATCH", { value: -1 })).status, 400);
    assert.equal((await api("/customers", "POST", "{broken json")).status, 400);
    assert.equal((await api("/nope")).status, 404);
    assert.equal((await api("/nope/1", "DELETE")).status, 404);
    assert.deepEqual(metrics((await api("/data")).body).customers, 6);
  }));

test("reset restores demo data and empty workspace stays empty", () =>
  withServer(async (api, db) => {
    for (const c of (await api("/customers")).body)
      await api(`/customers/${c.id}`, "DELETE");
    assert.deepEqual((await api("/data")).body, {
      customers: [],
      leads: [],
      tasks: [],
    });
    const reset = await api("/reset", "POST");
    assert.equal(reset.body.customers.length, 6);
    assert.equal(isValidData(reset.body), true);
  }));

test("SQL-looking input is stored as plain text", () =>
  withServer(async (api) => {
    const name = "Robert'); DROP TABLE customers;--";
    const res = await api("/customers", "POST", {
      name,
      email: "bobby@example.com",
    });
    assert.equal(res.body.name, name);
    assert.equal((await api("/customers")).body.length, 7);
  }));
