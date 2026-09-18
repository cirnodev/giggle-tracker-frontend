# Giggle Tracker frontend

React and TypeScript frontend for the private Giggle Tracker beta. It presents the current daily/weekly leaderboard and supports direct UUID lookup for Giggles profiles and posts.

## Local development

1. Copy `.env.example` to `.env`.
2. Set `VITE_API_BASE_URL` to the backend address, normally `http://localhost:3000`.
3. Run `npm install`, then `npm run dev`.

The backend must allow the frontend origin through `CORS_ORIGINS`; its local default already allows Vite at `http://localhost:5173`.

Requests have a 15-second deadline covering both the connection and response body. Automatic refresh waits until the previous request finishes, then waits 30 seconds, and runs only while the tab is visible. Failed refreshes retain data only for the same resource.

Rate-limit responses pause requests across views in the current tab and display a retry countdown. The frontend honors `Retry-After` on 429 and 503 responses; a 429 without a usable header uses a 30-second pause.

Response shapes are validated before rendering. Unexpected rendering errors are contained within the current view, leaving navigation available. Carousel-only posts use their first image as a preview.

## Commands

- `npm run dev` — run the local Vite server
- `npm run build` — type-check and create a production build
- `npm test` — run the frontend test suite
- `npm run lint` — lint the source

## Deployment

Set `VITE_API_BASE_URL` to the deployed HTTPS backend URL at build time. Configure the backend's `CORS_ORIGINS` with the exact deployed frontend origin. The invite-only URL is not authentication; use provider access controls or backend authentication before sharing outside the intended beta group.
