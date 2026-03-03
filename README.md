# Hypersomnia v0.1

A web-based API client built on Kong's design language. Supports the most common API testing workflows: create and organize REST requests, configure environments, send requests and view responses, and use an AI assistant to create and iterate on collections via natural language.

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- npm

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and set OPENAI_API_KEY if you want AI features
npm install
npm run dev        # Starts on http://localhost:3001
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # Starts on http://localhost:5173
```

Open http://localhost:5173 — the frontend proxies `/api/*` to the backend automatically.

---

## Docker Compose (Production)

```bash
# Create a .env file in the project root
echo "OPENAI_API_KEY=your_key_here" > .env

docker-compose up --build
```

Opens on http://localhost:80.

---

## Features

### Workspaces & Collections
- Create multiple workspaces
- Organize requests into nested folders
- Search/filter across requests
- Rename, duplicate, delete requests and folders
- Export workspace to JSON / Import from JSON

### Request Editor
- HTTP methods: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- Query params, headers, auth, and body tabs
- **Variable interpolation** — use `{{variableName}}` anywhere (URL, headers, body, auth)
- Body types: None, JSON (with CodeMirror syntax highlighting + Format), Form URL-Encoded, Raw
- Authentication: None, Bearer Token, Basic Auth, API Key (header or query)
- Copy as cURL

### Environments & Variables
- Create multiple environments per workspace
- Active environment selector
- Variable editor with secret masking (auto-detects keys matching `token|secret|password|key`)
- Unresolved `{{vars}}` highlighted in red in the URL bar preview

### Response Viewer
- Status code badge (color-coded), response time (ms), response size
- Body viewer: Pretty JSON (CodeMirror) or Raw text
- Headers table
- Debug view: full request details, headers sent, response metadata
- Request history (last 50 executions) with click-to-restore

### OpenAPI Import
- Import OpenAPI 3.x specs (JSON or YAML)
- Tags → Folders, operations → Requests
- Example request bodies auto-generated from schema

### AI Assistant (requires `OPENAI_API_KEY`)
- Right-side chat panel (toggle with the ✦ button)
- Context-aware: knows about your active request, environment variables (secrets redacted), workspace tree, and last response
- Structured operations: AI proposes changes as reviewable diffs — create requests, update requests, create folders, set env vars
- Apply individual operations or all at once

---

## Architecture

```
frontend/       React 18 + TypeScript + Vite + Zustand + Tailwind CSS
backend/        Node.js + TypeScript + Express
  POST /api/relay           HTTP proxy with SSRF protection
  POST /api/ai              OpenAI chat completion
  POST /api/import/openapi  OpenAPI 3.x spec parser
```

All workspace data is stored in **browser localStorage** — local-first, no account required.

---

## Environment Variables (Backend)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend port |
| `OPENAI_API_KEY` | — | Required for AI assistant |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model to use |

---

## Security Notes

- **SSRF protection**: The relay blocks private RFC1918 ranges, loopback, link-local (169.254.x.x), and known metadata endpoints
- **Secret masking**: Environment variables matching sensitive key names are masked in the UI and redacted from AI context by default
- **Authorization headers** are masked in the Debug view

---

## Development

```bash
# Frontend type check
cd frontend && npx tsc --noEmit

# Backend type check
cd backend && npx tsc --noEmit

# Frontend production build
cd frontend && npm run build
```
