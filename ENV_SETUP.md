# Production Database Setup — Netlify + Supabase

How to format `DATABASE_URL` (and friends) in Netlify / Supabase so Prisma and
node-postgres never throw `invalid domain character in database URL`.

## 1. Why the error happens

Supabase publishes a connection string like:

```
postgresql://postgres.xxxx:YOUR_PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres
```

If the password contains **special characters** (`@`, `:`, `/`, `#`, `$`, `%`,
`+`, space, etc.) they must be *percent-encoded* inside the URL. an unescaped
`@` (or `#`, `%`) confuses the URL parser and it reports:

```
Error parsing connection string: invalid domain character in database URL
```

## 2. The correct format

URL-encode **only the password** (and username, if it has odd chars). Do not
encode the host/port/path.

| Raw character | Encoded |
|---------------|---------|
| `@`           | `%40`   |
| `:`           | `%3A`   |
| `/`           | `%2F`   |
| `#`           | `%23`   |
| `$`           | `%24`   |
| `%`           | `%25`   |
| `+`           | `%2B`   |
| space         | `%20`   |

**Example** — password `myP@ss#2026` becomes `myP%40ss%232026`:

```
postgresql://postgres.xxxx:myP%40ss%232026@aws-0-region.pooler.supabase.com:6543/postgres
```

> ⚠️ Supabase often already returns `%25`-encoded values (a `%25` literally means
> the character `%`). Do **not** encode an already-encoded string again or you
> get double-encoding. If you copy the value straight from the Supabase
> dashboard **Settings → Database → Connection string**, it is already correct.

## 3. Netlify environment variables

Set these in **Netlify → Site configuration → Environment variables**:

| Key                             | Value / notes                                             |
|---------------------------------|-----------------------------------------------------------|
| `DATABASE_URL`                  | The **pooled** URL: `...pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` (optional)         | The direct URL (host `db.….supabase.co:5432`) if you run CLI migrations |
| `AUTH_SECRET`                   | Long random string (generate with `openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL`           | `https://your-site.netlify.app`                            |

- Prefer the **Transaction pooler** (port `6543`) for `DATABASE_URL` — it
  handles many serverless connections.
- After editing variables, **redeploy** the site (Deploys → Trigger deploy) —
  env vars only take effect on a fresh build.

> If the password ever contains a literal `@`, the provider may give you a URL
> that still parses because the parser uses the *last* `@` as the separator, but
> to be safe always store it `%40`-encoded.

## 4. Security notes

- Never commit real credentials. They belong only in Netlify/Supabase env vars
  (`.env.local` is git-ignored).
- After a public launch, **rotate** the database password and any shared tokens.
- The app now sanitizes DB/connection errors server-side, so raw connection
  strings never reach the browser — but the secrets above still must stay out of
  the repo and out of client bundles.
