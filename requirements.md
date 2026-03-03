# Insomnia Web v0.1 --- Internal Test Requirements

## 1) Goal and Non-Goals

### Goal

Build a web-based API client ("Insomnia Web") that supports the most
common Insomnia workflows: - Create and organize REST requests -
Configure environments and variables - Send requests, view responses,
debug failures - Use an AI assistant to create and iterate on requests
and collections via natural language

This is **v0.1 for internal testing**: prioritize speed, robustness, and
extensibility.

### Non-Goals (Out of Scope for v0.1)

-   GraphQL client UI (optional stretch)
-   gRPC, WebSockets, SSE streaming UI
-   Advanced scripting (pre-request/post-response JS), test suites, CI
    runners
-   Real-time multi-user collaboration
-   Plugin ecosystem
-   Full desktop parity

------------------------------------------------------------------------

## 2) Target Workflows

1.  Quickly hit an endpoint with a token and view the response.
2.  Organize requests into collections with shared auth and base URL
    variables.
3.  Import an OpenAPI spec and immediately call endpoints.
4.  Debug responses with headers, body, status, and timing.
5.  Prompt the AI to create and refine API interactions.

------------------------------------------------------------------------

## 3) Product Principles

-   Local-first by default (browser storage + export).
-   Deterministic, serializable request model.
-   AI is additive, not required.
-   AI changes must be reviewable before applying.

------------------------------------------------------------------------

## 4) Core Features

### 4.1 Workspace & Collection Model

Must support: - Create workspace - Tree structure (folders + requests) -
CRUD operations - Basic search/filter

Minimum Data Model:

Workspace: - id - name - createdAt - updatedAt

Folder: - id - workspaceId - name - parentId (optional) - sortOrder

Request: - id - workspaceId - folderId (optional) - name - method -
url - headers\[\] - queryParams\[\] - body - auth - settings

Environment: - id - workspaceId - name - variables (key-value) -
parentId (optional)

------------------------------------------------------------------------

### 4.2 Request Editor (REST)

Must support: - Methods: GET, POST, PUT, PATCH, DELETE - Variable
interpolation: {{var}} - Sections: Params, Headers, Auth, Body - Body
types: none, JSON, form-urlencoded (optional), raw text - Send request -
Copy as cURL

Nice-to-have: - JSON auto-format - Quick header rows

------------------------------------------------------------------------

### 4.3 Authentication

Must support: - None - Bearer token - Basic auth - Variables in auth
fields

Nice-to-have: - API key auth

------------------------------------------------------------------------

### 4.4 Environments & Variables

Must support: - Base + active environment - Variable interpolation
across fields - Resolved preview before send - Unresolved variable
handling (consistent behavior)

Nice-to-have: - Nested environment inheritance

------------------------------------------------------------------------

### 4.5 Request Execution & Response Viewer

Must support: - Execute requests - Display: - Status code - Time (ms) -
Response size - Headers - Body (Pretty JSON + Raw) - Debug view (final
URL + headers) - History (last 50 executions)

Relay Service Requirements: - POST /relay endpoint - HTTPS support -
Custom headers - Binary-safe responses - Internal authentication - SSRF
protections

------------------------------------------------------------------------

### 4.6 Import / Export

Must support: - Import OpenAPI 3.x (JSON/YAML) - Convert operations to
folders + requests - Export workspace JSON - Import exported JSON

Nice-to-have: - Import cURL command

------------------------------------------------------------------------

## 5) AI Assistant (OpenAI)

### 5.1 UX

-   Right-side panel
-   Conversation thread
-   Apply changes flow

AI context includes: - Active request - Environment variables (redacted
secrets) - Workspace tree - Last response (capped size)

------------------------------------------------------------------------

### 5.2 Core Capabilities

Must support: 1. Create request from prompt 2. Modify current request 3.
Suggest environment variables 4. Troubleshoot responses

------------------------------------------------------------------------

### 5.3 Structured Edits Contract

AI must return structured JSON:

{ "explanation": "...", "operations": \[ { "op": "create_request", ...
}, { "op": "update_request", ... }, { "op": "set_env_vars", ... } \] }

UI shows diff before applying.

------------------------------------------------------------------------

### 5.4 OpenAI Integration

Must: - Server-side API calls - Context packing with limits - Secret
redaction by default - Internal logging

------------------------------------------------------------------------

## 6) Security

Must: - Internal authentication - Masked secrets - AI secret toggle
(explicit opt-in) - Relay rate limiting - SSRF protection (block
metadata IPs)

------------------------------------------------------------------------

## 7) Observability

Must: - Client error boundary - Relay logs (no secrets) - Basic metrics
(requests, errors, latency) - Debug bundle export

------------------------------------------------------------------------

## 8) Technical Architecture

Frontend: - React + TypeScript - IndexedDB or localStorage - Optional
Monaco/CodeMirror

Backend: - Node + TypeScript - Endpoints: - POST /api/relay - POST
/api/ai - POST /api/import/openapi

Deployment: - Docker compose for internal runs

------------------------------------------------------------------------

## 9) Acceptance Criteria

Core: - Workspace creation - Request creation + execution - Env vars -
OpenAPI import - Export/import

AI: - Create full workspace via prompt - Propose structured changes -
Troubleshoot 401s

Security: - Protected relay - Masked secrets - Logs available

------------------------------------------------------------------------

## 10) Suggested Milestones

1.  Data model + tree UI
2.  Request editor + interpolation
3.  Relay + response viewer
4.  OpenAPI import/export
5.  AI assistant + structured ops
6.  Security hardening
