# After The Last Page

After The Last Page is a calm, Kindle-inspired reading instrument with a social layer that activates *after* you finish a book.

Repo: `https://github.com/V-Rytham/After-The-Last-Page`

## Vision

Most readers finish a great book and immediately want to talk about it—but rarely find someone who:

- has read the same book
- finished it recently
- wants to discuss it deeply

This project bridges that gap while keeping the interface quiet, typographic, and “paper-first”.

## Core Features

### 1) Book Reading (Kindle-style)

- Read books from the in-app library
- Reader UI aims for Kindle / Apple Books quality: calm layout, strong typography, minimal chrome
- Themes (Light / Sepia / Dark) tuned for long sessions

### 2) Meet People (USP)

Once a reader genuinely completes a book, they can meet other readers who completed the same book recently via:

- Text
- Voice
- Video

Privacy rule: users remain anonymous to each other (from our end) to reduce social friction and protect identity.

Integrity rule (anti-spam + quality): meeting access is gated by:

- Minimum read time (per book), or
- A short book quiz (5 questions; “near-right” is acceptable—this verifies familiarity, not perfection)

Quality rule: user rating + limits on rapid switching help keep conversations respectful and worth returning to.

### 3) BookThread

Per-book discussion rooms (in the spirit of Reddit/Discord) where readers can:

- create threads
- reply to ongoing threads

Threads unlock after the reader passes the quiz gate (same “genuine reader” principle).

### 4) Merchandise Creation (“Wizard”)

Readers can generate and customize book-referenced merch (t-shirts / hoodies) via an AI assistant (“Wizard”):

- turn a reader’s idea into a design
- prepare it for fulfillment
- ship to their address

## Tech Stack

- Frontend: Vite + React + React Router
- Backend: Node.js + Express + MongoDB (Mongoose)
- Realtime: Socket.IO

## Local Development

### Prerequisites

- Node.js (recent LTS recommended)
- MongoDB running locally (default `mongodb://localhost:27017/after_the_last_page`)

### 1) Install dependencies

Frontend:

```bash
cd "D:\After The Last Page"
npm install
```

Backend:

```bash
cd "D:\After The Last Page\server"
npm install
```

### 2) Configure environment

Copy the example env:

```bash
copy "D:\After The Last Page\server\.env.example" "D:\After The Last Page\server\.env"
```

Edit values if needed (JWT secret, DB URL, etc).

### 3) Run

Backend (API):

```bash
cd "D:\After The Last Page"
node server\index.js
```

Frontend:

```bash
cd "D:\After The Last Page"
npm run dev -- --host
```

Or run both together:

```bash
cd "D:\After The Last Page"
npm run dev:full
```

Run all three services (main API + BookFriend API + frontend):

```bash
cd "D:\After The Last Page"
npm run dev:all
```

The frontend will infer the API host automatically (useful for iPad/tablets on the same Wi‑Fi). You can also set `VITE_API_URL` explicitly if you prefer.

## Project Notes

- Design system + tokens: `DESIGN_SYSTEM.md`
- Reader goals and constraints: `READING_INTERFACE.md`
- Library goals and constraints: `LIBRARY_INTERFACE.md`
- BookThread notes: `BOOKTHREAD_INTERFACE.md`

## Deployment note (SPA refresh)

If you deploy the frontend as a static site, you must configure a rewrite so deep links like `/read/:bookId` serve `index.html` on refresh (otherwise you will see a plain `Not Found`).

- Render Blueprint: see `render.yaml` (rewrite `/*` → `/index.html`).
- Static hosts that support it: `public/_redirects` is included and will be copied into `dist/` on build.

## Roadmap (High-level)

- Expand book catalog + real pagination content pipeline
- Production-grade auth + deployment configs
- Meeting: matching rules, anti-abuse, session UX for text/voice/video
- Wizard merch: generation pipeline + ordering + shipping integration

## BookFriend Agent Server

BookFriend is implemented as a separate service in `bookfriend-server/` and integrated through proxy endpoints in the main API (`/api/agent/*`).

- See `BOOKFRIEND_INTERFACE.md` for API contracts, architecture, memory policy, and env setup.
- Main server forwards to `BOOKFRIEND_SERVER_URL` (default `http://127.0.0.1:5050`).

### Free local LLM option (recommended)

For zero API cost, run BookFriend with Ollama locally:

```bash
ollama pull llama3.1:8b-instruct-q4_K_M
```

Then in `bookfriend-server/.env`:

```env
BOOKFRIEND_LLM_PROVIDER=ollama
BOOKFRIEND_OLLAMA_URL=http://127.0.0.1:11434/api/chat
BOOKFRIEND_OLLAMA_MODEL=llama3.1:8b-instruct-q4_K_M
```

BookFriend retrieval uses a local in-memory vector index with deterministic hashed embeddings, so no paid vector database is required.
