# Dialer Backend

This is the standalone HTTP API for the Expo dialer. It uses Node's built-in
HTTP server and persists call records in `backend/data/store.json`, so no
database dependency is required for local development.

## Run

From the repository root:

```sh
npm run backend
```

The API listens on `http://localhost:4000`.

## Endpoints

- `GET /health`
- `GET /api/bootstrap`
- `POST /api/calls`
- `PATCH /api/calls/:id/controls`
- `POST /api/calls/:id/dtmf`
- `POST /api/calls/:id/end`
- `PATCH /api/calls/:id`

The server manages the app's demo call lifecycle. For carrier audio, incoming
calls, and real transfer behavior, replace the provider adapter with Twilio,
SIP/WebRTC, or another telephony provider.
