# Ko Thet Digital _ Copy Editor

Single React/Vite project for Burmese copy editing.

## Run

```bash
pnpm install
pnpm dev
```

Quality checks:

```bash
pnpm check
```

## Repository layout

- `public/` contains browser-delivered assets that are safe to publish.
- `private/` is local-only runtime configuration and is ignored by Git.
- `private.example/` contains empty templates for the private configuration shape.
- `server/` contains the proxy code; its secrets are loaded from `private/.env` at runtime.
- `extension/` contains the public Chrome extension bundle and its public assets.

Never put API keys, tokens, credentials, or private files in `public/`, `src/`, `extension/`, or any `VITE_*` variable.

This runs the secret scan, TypeScript checking, Vitest tests, formatting validation, and the production build.

The editor opens without an account. Proofreading requires a configured Gemini or Custom API key. To enable the local login/register screens:

```env
VITE_AUTH_ENABLED=true
```

## Secure provider proxy

For production-style provider configuration, keep public browser settings in `.env` and server-only provider secrets in `private/.env`:

```bash
cp .env.example .env
cp private.example/.env.example private/.env
# Edit private/.env and add provider secrets.
pnpm proxy
pnpm dev
```

When the proxy URL is set, browser settings do not store or send API keys. The proxy reads `GEMINI_API_KEY`, `CUSTOM_API_KEY`, and `CUSTOM_ENDPOINT` only from `private/.env`, applies request limits, and does not log source text. See [`SECURITY.md`](./SECURITY.md) for the GitHub upload checklist.

## Chrome extension

The standalone Chrome Manifest V3 extension is in [extension](./extension). It adds a right-click action and popup for sending selected Myanmar text into the editor.

Load `extension` as an unpacked extension from `chrome://extensions`, then set the popup App URL if Vite is running on a different port. See [extension/README.md](./extension/README.md) for installation and usage.
