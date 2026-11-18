# Security and GitHub upload guide

## Public and private boundaries

Safe to publish:

- `src/` — frontend source, tests, and non-secret provider adapters.
- `public/` — browser-delivered logo and font assets.
- `extension/` — public Chrome extension code and bundled assets. It must not contain API keys.
- `server/` — proxy implementation. It reads secrets at runtime and does not embed them.
- `docs/`, configuration files, and the empty `private/.gitkeep` marker.

Never publish:

- `private/.env` or any file created under `private/`.
- Root `.env` files containing anything beyond public `VITE_*` settings.
- API keys, access tokens, passwords, certificates, private keys, credentials JSON, logs, or local databases.
- `node_modules/`, `dist/`, `.pnpm-store/`, or machine-specific files.

## Local setup

```bash
cp .env.example .env
cp private.example/.env.example private/.env
```

Put provider secrets only in `private/.env`. The browser build receives only `VITE_PROVIDER_PROXY_URL`; variables prefixed with `VITE_` are public after bundling.

## Before pushing to GitHub

1. Run `git status --short --ignored` and confirm `private/.env` is ignored.
2. Search staged files for `AIza`, `sk-`, `Bearer `, `PRIVATE KEY`, and credential filenames.
3. Run `pnpm check`.
4. Enable GitHub secret scanning and push protection in repository settings.
5. Use GitHub Actions only with the minimum required permissions.

If a secret is ever committed, revoke and rotate it immediately. Removing the file in a later commit does not remove it from Git history.
