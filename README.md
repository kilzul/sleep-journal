# Snoozely: Sleep Journal

A web app for logging your sleep, searching your past entries, and seeing statistics about how you're doing against your own sleep goal.

**Live site:** https://snoozely.onrender.com/

> Free hosting puts the app to sleep when it's idle, so the first load can take up to a minute.
---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Testing](#testing)
- [Deployment](#deployment)
- [Frontend notes](#frontend-notes)
- [Accessibility](#accessibility)
- [Security](#security)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Team](#team)

---

## Features

**Accounts**
- Sign up with name, email, and password, with live validation in the browser (12+ characters, upper and lower case, matching confirmation)
- Log in, log out, and stay logged in across page reloads (7-day sessions)
- Delete your account and all your journals (password required)

**Journals**
- Log a night: date, bedtime, wake time, a 1-5 mood face, and notes (200 characters max)
- Live feedback while you type, including total sleep time and a warning for unlikely durations
- Delete entries
- Live search across date, hours slept, and notes
- Entries shown as a 3x3 grid of cards, nine per page, with snap-in-place scrolling between pages

**Overview and statistics**
- Overview with your entry count, first entry date, and total hours slept
- Statistics for the last 7 days, 30 days, or year, compared against your own sleep goal

**Settings**
- Change your name, sleep goal (hours), and target wake-up time

**Other**
- Creator link menus (GitHub, LinkedIn, email)
- Loading screen while data loads
- Specific, friendly error messages instead of generic failures

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JavaScript (ES modules), HTML, CSS. No framework, UI library, or build step |
| Icons and fonts | Font Awesome, DynaPuff, Chewy |
| Backend | Python 3.13, FastAPI, Uvicorn |
| Database | Supabase (PostgreSQL), accessed with psycopg 3 |
| Passwords | Argon2 through pwdlib |
| Sessions | Server-side sessions in an HttpOnly cookie |
| Hosting | Render (one web service serves both the API and the frontend) |
| Tests | unittest, httpx, Playwright |

---

## How it works

The frontend and backend are served by one FastAPI app, so they share a single origin. That is what lets the session cookie travel with every request without any CORS configuration.

**Frontend**

1. The app is a single-page application. Each screen is a `<section class="page">` in `static/index.html`, and only one is visible at a time.
2. `showPage(page)` hides every page, shows the requested one, and runs that page's loader (overview, journals, statistics, or settings).
3. Protected pages check a `loggedIn` flag. If you aren't logged in, you're sent to the login screen with a message, then on to the page you wanted once you log in.
4. On start-up the app calls `GET /api/me`, so refreshing the page doesn't log you out.
5. All data requests go through one `api()` helper (`static/js/api.js`) that sends the request, reads the response, and turns server errors into readable messages.
6. Journal cards are built with DOM methods (`createElement`, `textContent`), so text typed by users is never treated as HTML.
7. Cards are split into pages of nine. Each page is a 3x3 CSS grid inside a scroll-snap container, and searching rebuilds the pages from the matching entries.

**Backend**

1. `main.py` defines the routes and serves the static files.
2. `backend/db.py` holds the database queries, password hashing, and account logic.
3. `backend/sessions.py` creates, checks, and revokes sessions and checks the origin of write requests.
4. `backend/stats.py` turns a user's journals into the overview and statistics numbers.

---

## Project structure

```
sleep-journal/
├── main.py                 # FastAPI app: routes and static files
├── backend/
│   ├── db.py               # queries, password hashing, account logic
│   ├── sessions.py         # sessions, cookies, request-origin checks
│   └── stats.py            # overview and statistics calculations
├── static/
│   ├── index.html          # every screen
│   ├── css/style.css
│   ├── js/
│   │   ├── app.js          # router, forms, journals, settings
│   │   ├── api.js          # the real API helper
│   │   ├── api.fake.js     # fake API backed by localStorage (UI development only)
│   │   └── stats.js        # overview and statistics pages
│   └── fonts/
├── tests/
│   ├── test_integration.py # API tests
│   └── browser_smoke.py    # end-to-end browser test
├── render.yaml             # Render blueprint
├── DEPLOYMENT.txt          # step-by-step deployment notes
├── requirements.txt
├── requirements-dev.txt
├── .python-version         # 3.13
├── .env.example
└── README.md
```

---

## Getting started

### Prerequisites

- Python 3.13
- A Supabase project with the tables described in [Database](#database)
- A modern browser (the journals grid expects a window about 1,100px wide or wider)

### Run it locally

```bash
git clone https://github.com/kilzul/sleep-journal.git
cd sleep-journal
git checkout integration/frontend-backend

python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env             # then fill in the values (see Configuration)

uvicorn main:app --reload
```

Open `http://127.0.0.1:8000`. Interactive API docs are at `/docs`.

Always open the app through the FastAPI address, not a separate static file server, so the frontend and API share an origin and the session cookie works.

### Work on the UI without the backend

1. In `static/js/app.js`, import `api` from `./api.fake.js` and set `DEV_BYPASS = true`.
2. Serve the `static/` folder with any static server (for example, VS Code's Live Server extension).
3. Log in with any values. Entries are kept in your browser's `localStorage`.

Set `DEV_BYPASS` back to `false` and import from `./api.js` before committing. With the bypass on, anyone can get past the login screen.

---

## Configuration

Copy `.env.example` to `.env`. Never commit `.env`.

| Variable | Purpose |
|---|---|
| `SUPABASE_DB_URL` | PostgreSQL connection string from Supabase (Connect, then Session pooler, with `sslmode=require`). This is the database URL, not an API key |
| `APP_URL` | The exact origin the app is served from, such as `http://127.0.0.1:8000` locally or `https://your-app.onrender.com` in production. It turns on secure cookies and is checked against the origin of every write |

### Database

The app expects these tables in the `public` schema: `users`, `journals`, and `user_sessions`, with `sleep_goal_hours` and `target_wake_time` columns on `users`. The deployment does not create or change tables. A schema file isn't in the repo yet, so a new database has to be set up by hand first.

---

## API reference

All routes are under `/api`. Write requests send form data (not JSON) and receive JSON. Authentication is the session cookie, so no token is handled in JavaScript.

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Health check, returns `{"status": "ok"}` |
| POST | `/api/signup` | Create an account (`name`, `email`, `password`) |
| POST | `/api/login` | Log in (`email`, `password`) and set the session cookie |
| GET | `/api/me` | The current user, or 401 if there's no valid session |
| POST | `/api/logout` | End the session and clear the cookie |
| GET | `/api/entries` | The user's journals, newest first |
| POST | `/api/entries` | Add a journal. Returns 201 with the saved entry |
| DELETE | `/api/entries/{id}` | Delete one of the user's journals. Returns 204 |
| GET | `/api/overview` | Entry count, first entry date, total hours slept |
| GET | `/api/stats?days=30` | Statistics for the last 1-365 days |
| GET | `/api/settings` | Name, email, sleep goal, and target wake time |
| PUT | `/api/settings` | Update name, sleep goal, and target wake time |
| DELETE | `/api/account` | Delete the account and everything in it (`password` required). Returns 204 |

### Journal entry

| Field | Type | Notes |
|---|---|---|
| `id` | number | Assigned by the server |
| `sleep_date` | `YYYY-MM-DD` | The date of the night's bedtime |
| `bedtime` | `HH:MM` | Local time, no timezone |
| `wake_time` | `HH:MM` | Local time. An earlier time than bedtime means the next day |
| `quality` | 1-5 | Mood face rating |
| `notes` | text | Optional, 200 characters max |

Bedtime and wake time can't be the same.

### Settings

| Field | Rule |
|---|---|
| `username` | 1-100 characters, unique |
| `sleep_goal_hours` | 1-16 |
| `target_wake_time` | Local time |

### Errors

Errors return JSON with a `detail` message, which the frontend shows directly. The status codes in use:

| Status | Meaning |
|---|---|
| 401 | Not logged in or session expired |
| 403 | Request came from another origin, or the wrong password was given when deleting the account |
| 404 | Journal not found (or it belongs to someone else) |
| 409 | Name or email already registered |
| 422 | Invalid input |
| 503 | Database unavailable |

---

## Testing

```bash
pip install -r requirements-dev.txt
python -m unittest discover -s tests -v

playwright install chromium
python tests/browser_smoke.py
```

The API tests cover protected endpoints, the overview and stats calculations (including sleep that crosses midnight), settings, cross-site write rejection, the journal form contract, and the wrong-password case for account deletion.

The browser smoke test is a live end-to-end run. It creates its own temporary account in the configured database and deletes the account and its entries afterwards, so don't point it at data you care about.

---

## Deployment

The app runs as one Render web service that serves both the API and the frontend, with Supabase as the database. `render.yaml` and `DEPLOYMENT.txt` have the full steps.

1. Deploy the combined branch (`integration/frontend-backend`, or `main` after merging it).
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Health check path: `/healthz`
5. Set `SUPABASE_DB_URL` and `APP_URL` (the exact public HTTPS URL Render assigns).

Troubleshooting:
- Writes return 403: `APP_URL` doesn't match the origin in the browser.
- Logged-in requests return 503: check the database URL and password, and that you used the Session pooler URL if your host is IPv4-only.
- Slow first load: free instances sleep when idle.

---

## Frontend notes

- **No dependencies or build step.** The frontend is plain HTML, CSS, and JavaScript modules.
- **Hiding and showing** uses the `hidden` attribute, with a `[hidden] { display: none !important; }` rule so layout styles can't override it.
- **Validation** uses the browser's built-in constraint validation plus custom rules (`setCustomValidity`), so errors can be styled, announced, and shown next to the field.
- **Sleep duration** is calculated from `HH:MM` times and wraps past midnight, so a 23:30 bedtime and 07:00 wake-up counts as 7.5 hours.
- **Animations** use `transform` and `opacity`, and are turned off for people who ask for reduced motion.

---

## Accessibility

What's been done:

- Every form field has a visible label connected with `for` and `id`
- Errors and status messages use `role="alert"`, `role="status"`, or `aria-live`, so screen readers announce them
- The creator link menus are real buttons with `aria-expanded`, and close with Escape or a click outside
- The mood picker is built from radio inputs, with hidden text labels for screen readers and a visible keyboard focus outline
- Animations respect `prefers-reduced-motion`
- Form errors appear next to their field, and focus moves to the first problem

Not done yet, and not claimed: a formal accessibility audit and full keyboard access to the sidebar.

---

## Security

- Passwords are hashed with Argon2 and never stored or logged in plain text
- Sessions use a random token in an HttpOnly cookie (`SameSite=Lax`, and `Secure` over HTTPS). Only a SHA-256 hash of the token is stored in the database, and sessions expire after 7 days
- A session is replaced on login, and logging out revokes it on the server
- Write requests are rejected when they come from another origin (checked with the `Sec-Fetch-Site`, `Origin`, and `Referer` headers)
- Login errors don't reveal whether an email exists, and a dummy hash is checked for unknown emails so response times don't give it away
- SQL uses parameterized queries, and every journal query is filtered by the logged-in user
- User-entered text is inserted with `textContent`, never `innerHTML`
- The database URL lives in an environment variable and is never committed

---

## Known limitations

- The Calendar page is a placeholder
- Password rules (12+ characters, upper and lower case) are enforced in the browser only. The server doesn't re-check them yet
- There's no rate limiting on login attempts
- Sidebar items are not yet reachable with the keyboard
- The journals grid expects a wide screen and isn't responsive for phones
- The database schema isn't included in the repo
- The first request after the free instance has been idle is slow

---

## Roadmap

- Server-side password validation and login rate limiting
- A schema file so a fresh database can be set up in one step
- Build out the Calendar
- Keyboard-accessible sidebar and a responsive layout
- Charts on the statistics page
- Edit existing entries
- Accessibility audit and Lighthouse pass

---

## Team

| Role | Name | Links |
|---|---|---|
| Frontend | Raheil Bryce | [GitHub](https://github.com/kilzul) · [LinkedIn](https://www.linkedin.com/in/raheil-bryce-ba894b269) |
| Backend | Eli Levasseur | [GitHub](https://github.com/EliLevasseur) · [LinkedIn](https://www.linkedin.com/in/eli-levasseur-3a627b388) |
