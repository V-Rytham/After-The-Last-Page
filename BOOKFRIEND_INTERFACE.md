# BookFriend Agent Integration

## New Service: `bookfriend-server/`

BookFriend runs as an independent Node/Express service so AI orchestration and retrieval logic stay outside the core app server.

```
bookfriend-server/
  config/db.js
  controllers/agentController.js
  models/Book.js
  prompts/systemPrompt.js
  retrieval/bookRepository.js
  retrieval/retrievalService.js
  routes/agentRoutes.js
  services/llmService.js
  services/promptService.js
  services/sessionStore.js
  utils/text.js
  server.js
```

## Session and Memory Policy

- Sessions are kept in an in-memory `Map` keyed by `session_id`.
- During chat, message history is stored temporarily as `{ role, content, timestamp }`.
- `POST /agent/end` immediately deletes the whole session from memory.
- No persistent conversation logging is implemented.

## Retrieval Strategy (RAG scaffold)

Current retrieval is lightweight and local:

1. Load book metadata + chapters from MongoDB.
2. Convert chapter HTML into plain text chunks.
3. Score relevance by lexical overlap between question tokens and chunk tokens.
4. Inject top chunks into prompt payload.

This is implemented behind retrieval services so it can be swapped with a vector database later.

## API (BookFriend server)

### `POST /agent/start`
Body:
```json
{ "user_id": "...", "book_id": "..." }
```
Response:
```json
{ "session_id": "..." }
```

### `POST /agent/message`
Body:
```json
{ "session_id": "...", "message": "...", "chapter_progress": 4 }
```
Response:
```json
{ "response": "..." }
```

### `POST /agent/end`
Body:
```json
{ "session_id": "..." }
```
Response:
```json
{ "message": "Session deleted." }
```

## Main server proxy API

The main backend now exposes authenticated proxy endpoints:

- `POST /api/agent/start`
- `POST /api/agent/message`
- `POST /api/agent/end`

The frontend only talks to these existing backend endpoints; the core server forwards requests to `BOOKFRIEND_SERVER_URL`.

## Meet flow update

In the Meet page:

- User starts matchmaking as usual.
- After 30 seconds with no match, UI offers **Talk to BookFriend**.
- Clicking it starts a text-only BookFriend chat.
- Ending chat calls `/api/agent/end` to delete memory immediately.

## Environment Variables

### Main server (`server/.env`)
- `BOOKFRIEND_SERVER_URL` (default: `http://127.0.0.1:5050`)

### BookFriend server (`bookfriend-server/.env`)
- `PORT` (default: `5050`)
- `MONGODB_URI`
- `BOOKFRIEND_LLM_PROVIDER` (`mock` or `openai`)
- `BOOKFRIEND_OPENAI_MODEL` (when OpenAI is used)
- `OPENAI_API_KEY` (when OpenAI is used)
- `BOOKFRIEND_MAX_HISTORY`
- `BOOKFRIEND_RETRIEVAL_LIMIT`

## Local run

```bash
npm install
npm --prefix server install
npm --prefix bookfriend-server install
npm run dev:all
```

Or run each service separately with:

```bash
npm run server
npm run bookfriend
npm run dev -- --host
```
