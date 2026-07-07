# Supabase Hosted Setup

This project uses a project-local Supabase CLI installed through pnpm. Do not use a global npm install.

## Private Environment Files

The repository may have a private root `.env` containing hosted Supabase values. The app-specific files are generated from it:

- `apps/web/.env.local`
- `apps/admin/.env.local`
- `supabase/functions/.env.local`
- `supabase/functions/.env.hosted.local`

Frontend env files must contain only:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=development
```

The service-role key must never be copied into frontend env files, source files, Vercel frontend variables, or browser bundles.

## CLI Authentication

Authenticate the project-local CLI:

```bash
pnpm exec supabase login
```

Do not paste access tokens into chat or commit them to the repo.

## Link Hosted Project

The project ref is derived from the hosted Supabase URL and stored in ignored temp metadata. After login:

```bash
pnpm exec supabase link --project-ref "$(cat supabase/.temp/project-ref)"
```

If the CLI prompts for database credentials, enter them locally. Do not share them in chat.

## Migration Safety

Do not run destructive hosted reset commands.

Allowed hosted flow:

```bash
pnpm exec supabase migration list
pnpm exec supabase db push
```

Do not run:

```bash
pnpm exec supabase db reset --linked
```

Use `db pull` only if remote schema changes already exist and must be preserved.

Before pushing, inspect the linked migration table and dry-run the push:

```bash
pnpm exec supabase migration list --linked
pnpm exec supabase db push --linked --dry-run
```

The hosted API schema config must include the private schema so Edge Functions can call private RPCs through the service-role client. Apply config changes with:

```bash
pnpm exec supabase config push
```

On the current DEV hosted project, this command applied the needed Auth/API changes but ended with a storage vector-bucket paid-tier warning. That warning is not a blocker for the current MVP unless vector storage is introduced.

## Hosted Function Secrets

Hosted Edge Functions receive Supabase platform credentials from Supabase. Configure only custom app secrets and URLs in the hosted function secret store.

Required custom values:

```env
WALLET_NONCE_SECRET=
APP_URL=https://playsoltower.fun
ADMIN_URL=https://admin.playsoltower.fun
APP_ENV=development
```

Use the custom-only hosted env file. Do not use `supabase/functions/.env.local` for hosted secrets because that local file includes platform keys for local serving.

```bash
pnpm exec supabase secrets set --env-file supabase/functions/.env.hosted.local
```

For production, use production URLs and a production secret value managed outside source control.

## Deploy Existing Edge Functions

Deploy only the existing functions under `supabase/functions`:

```bash
pnpm exec supabase functions deploy
```

Do not add new game systems during hosted activation.

## Hosted Smoke Tests

After migrations and functions are deployed, verify:

- player bootstrap Edge Function can run with a valid session
- Marky seed data exists if the project is confirmed DEV_MODE
- starter ledger exists
- anonymous/spectator access cannot mutate balances
- RLS blocks direct player balance updates from the anon client
- Edge Functions can read required server-side data
- frontend anon key works without service-role exposure
- at least one safe Edge Function invocation succeeds
