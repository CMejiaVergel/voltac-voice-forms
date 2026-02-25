# Voltac Voice Forms

## Cursor Cloud specific instructions

### Overview

Single Next.js 14 (App Router) frontend that captures lead info via voice or text fallback and POSTs to an external N8N webhook. No local database or backend service is needed.

### Running the app

```bash
npm run dev       # http://localhost:3000
```

The voice form is at `/formulario`. The landing page (`/`) has a CTA that links to it.

### Standard commands

| Task   | Command          |
|--------|------------------|
| Dev    | `npm run dev`    |
| Build  | `npm run build`  |
| Lint   | `npm run lint`   |
| Start  | `npm run start`  |

See `README.md` for full details (written in Spanish).

### Gotchas

- **ESLint must be installed separately.** The original `package.json` does not list `eslint` or `eslint-config-next` as dependencies. The update script installs `eslint@8` and `eslint-config-next@14` (matching Next.js 14). An `.eslintrc.json` extending `next/core-web-vitals` is also required — this was added to the repo.
- **No automated test suite.** There is no `test` script or testing framework configured. The only automated check is `npm run lint`.
- **Voice input requires Chromium.** Web Speech API only works in Chrome/Edge/Brave. A text fallback field is available for non-Chromium environments.
- **External webhook.** Form submission POSTs to `NEXT_PUBLIC_N8N_WEBHOOK_URL` (configured in `.env.local`). The webhook is hosted externally; submissions will fail if the external N8N service is unreachable, but the UI itself works fine without it.
