# Library Client

A small React + TypeScript offline-first web client for the personal library API.

## Architecture

IndexedDB is the source of truth for the library screen. Components read and write through `src/db`; local creates, edits, and tombstone deletes also create records in the `pending_changes` outbox. The sync engine in `src/sync/sync.ts` pushes queued mutations, pulls changes since the stored server revision, applies authoritative remote records locally, then advances the revision. Outbox records are only removed after the complete push/pull cycle succeeds, so a failed network request is retryable and idempotent through `client_mutation_id`.

The UI opens from local data immediately. It does not fetch the library on page load. Sync runs from the manual button and the browser `online` event; network failures leave the library usable and the outbox intact. Server conflict resolution is authoritative: pulled records overwrite their local counterparts.

## Run

1. Copy `.env.example` to `.env` and set `VITE_API_URL` to the backend URL.
2. Install dependencies with `npm install`.
3. Start the client with `npm run dev`.
4. Run checks with `npm test` and `npm run build`.

For Windows local testing, `npm run dev:all` starts both the backend from `../personal-library` and the client. Press `Ctrl+C` in that terminal to stop both processes. Use `-BackendPath` with `scripts\start-local.ps1` if the backend is stored elsewhere.

The client expects the documented bearer-token endpoints under `/api/auth` and `/api/sync`. Authentication tokens are kept in local storage and are never rendered.

## Local integration testing

The backend is a separate repository. From a terminal, start it using its own instructions:

```powershell
cd ..\personal-library
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

In a second terminal, start this client:

```powershell
cd ..\library-client
Copy-Item .env.example .env
npm run dev
```

Open the client URL and:

1. Register a test account, then log in.
2. Verify the initial synchronization completes and the indicator says `Online / synced`.
3. Add, edit, and delete a book.
4. Stop the backend process.
5. Refresh the client and verify the library still works from IndexedDB.
6. Make another change while offline and confirm the indicator shows `Offline` or pending changes.
7. Restart the backend.
8. Press `Sync` and confirm the indicator returns to `Online / synced`.
9. Verify the change reaches the server by syncing another client or checking the backend's library endpoint.

The client sends the backend's exact auth and sync shapes: `{username, password}`, bearer tokens, `{mutations: [...]}`, and `/api/sync/pull?since=<revision>`. Failed sync requests leave outbox records intact for retry; server pull/push results are authoritative and the successful pull revision is stored locally.
