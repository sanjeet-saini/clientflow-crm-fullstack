# ClientFlow CRM

A responsive CRM for a fictional web agency: manage customers, sales opportunities and follow-ups in a calm green workspace.

## Live demo
| Link | What runs there |
| --- | --- |
| **Full stack (Render):** https://clientflow-crm-fullstack.onrender.com | Frontend + Express API + SQLite database. Top bar shows "Synced to server". |
| **Frontend only (GitHub Pages):** https://sanjeet-saini.github.io/clientflow-crm-fullstack/ | Static build, no backend. Data stays in the browser (localStorage). Top bar shows "Browser workspace". |

The Render free instance sleeps after inactivity, so the first visit can take 30–50 seconds. Its database resets to the demo records on every restart or redeploy. Use fictional data only.

## Run locally
Requires Node.js 22.13+ (backend uses the built-in `node:sqlite`) and npm.

```sh
npm install
npm run server   # terminal 1: API + SQLite on http://localhost:4000/api
npm run dev      # terminal 2: Vite, proxies /api to the server
```

Open the Local URL printed by Vite. `npm start` builds the frontend and serves app + API together from one server on port 4000. Env vars: `PORT`, `DB_PATH` (default `server/data/crm.db`, created and seeded with demo data on first run), `VITE_API_URL` (build-time, if the API lives on another origin), `CORS_ORIGIN`. `npm run build` generates `dist/`; `npm run preview` previews that production build. `npm test` checks core data rules.

## Features
- Dashboard totals derived from the current data, pipeline value/stage breakdown, recent opportunities and pending follow-ups.
- Customers: create, edit, delete with confirmation, search name/email/company, status filter and alphabetical sorting.
- Leads: create/edit/delete, five-stage pipeline, stage selection, INR values and stage filters.
- Tasks: create/edit/delete, complete/reopen, optional customer, priority, due date and overdue marker.
- Versioned localStorage key, fictional first-run demo records, invalid-data fallback, visible storage failure warning and confirmed demo reset.
- Responsive navigation, scrollable tables/pipeline, native accessible dialogs and labeled controls.

## Stack and structure
React, Vite, JavaScript, React Router, Lucide icons and plain CSS. Backend: Node.js, Express 5, SQLite (`node:sqlite`).

| File | Responsibility |
| --- | --- |
| `src/App.jsx` | Shared layout, routes, page components, forms and CRUD actions |
| `src/data.js` | Fictional records, IDs, formatting, validation and data rules |
| `src/useCRM.js` | Load data from the API (or localStorage fallback) and save every change |
| `server/db.js` | SQLite schema (foreign keys, cascade, CHECK rules), seeding, row mapping |
| `server/validate.js` | Server-side validation for every record type |
| `server/app.js` | Express REST API: `/api/data`, `/api/{customers,leads,tasks}[/:id]` (GET/POST/PUT/PATCH/DELETE), `/api/reset` |
| `server/index.js` | Starts the server |
| `tests/api.test.js` | API + database tests against an in-memory SQLite DB |
| `src/main.jsx` | React entry and HashRouter |
| `src/styles.css` | Layout, visual system and responsive breakpoints |
| `tests/data.test.js` | Data integrity and calculated metrics tests |

## Data rules
Deleting a customer also deletes their linked leads and tasks; confirmation names the linked record count. Dashboard totals are calculated rather than stored separately. Blank names/titles, invalid emails/phone formats and negative deal values are rejected. Data is seeded only when storage is missing or invalid; a valid empty workspace stays empty.

## Deployment
Static build output: `dist`. HashRouter uses URLs such as `/#/customers`, so refreshing a page works on static hosts without rewrite rules. `vite.config.js` sets `base: './'`, so the same build works on a GitHub Pages project subpath and on Netlify/Vercel (publish `dist`).

- **Render (full stack):** web service on the free plan, build `npm install && npm run build`, start `npm run server`. Every push to `main` redeploys automatically.
- **GitHub Pages (frontend only):** published from the `gh-pages` branch. To update it, run `npm run build` and then `npx gh-pages -d dist -o fullstack`.

## Backend and fallback
With the server running, every create/edit/delete is sent to the API and stored in SQLite; the UI updates immediately and reloads from the server if a save is rejected. The top bar shows "Synced to server". If no API is reachable (e.g. the static GitHub Pages build), the app falls back to the old localStorage mode and shows "Browser workspace".

## Limitations
This is a portfolio project, not a production CRM. There is no authentication or authorization, so anyone who can reach the API can change the data. The GitHub Pages demo has no backend and keeps data in localStorage only. Concurrent edits are last-write-wins (no conflict resolution). Use fictional data only. Google Fonts needs internet; system sans-serif is the fallback.

Future: authentication, authorization, cloud storage, pagination, CSV export and automated browser regression tests.
