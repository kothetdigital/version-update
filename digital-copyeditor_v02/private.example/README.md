# Private configuration template

Copy `.env.example` to `../private/.env` for local proxy development. The `private/` directory is ignored by Git and must never contain committed secrets.

For deployment, use the hosting provider's secret manager or environment settings instead of copying this file into production.
