# ShiftSync — Setup Guide

## What you need to set up (one time, ~20 minutes)

### 1. Supabase database

1. Go to [supabase.com](https://supabase.com) → Sign up → New project
2. Choose a project name, strong password, region (eu-central-1 for Lithuania)
3. Once created: **Project Settings → Database → Connection string → URI**
4. Copy the connection string — it looks like:
   `postgresql://postgres.xxx:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`

### 2. Google OAuth credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
4. Application type: **Web application**
5. Authorized redirect URIs — add:
   - `http://localhost:3000/api/auth/callback/google` (for local dev)
   - `https://your-vercel-domain.vercel.app/api/auth/callback/google` (for production)
6. Copy the **Client ID** and **Client Secret**

### 3. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local`:
```
DATABASE_URL="postgresql://postgres.xxx:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
AUTH_SECRET="run: openssl rand -base64 32"
AUTH_GOOGLE_ID="xxx.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="GOCSPX-xxx"
```

### 4. Run database migrations

```bash
npx prisma migrate dev --name init
```

This creates all tables in your Supabase database.

### 5. Run locally

```bash
npm run dev
```

Open http://localhost:3000

### 6. Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import project → Select repo
3. Add the same environment variables in Vercel's project settings
4. Change `AUTH_SECRET` to a fresh value for production
5. Deploy

---

## First use

1. Sign in with Google → you'll land on `/onboarding`
2. Create your company (you become Admin)
3. Go to **Admin → Settings** to generate invite codes
4. Share the code with employees — they sign in with Google and enter the code

## Tech stack

- **Next.js 16** — fullstack React framework
- **Auth.js v5** — Google OAuth, secure sessions
- **Prisma 7** + **PostgreSQL** on Supabase — type-safe DB
- **Tailwind CSS** — styling
- **Vercel** — hosting

## Lithuanian payroll rates (2024/2025)

All rates are stored in the database per company and can be edited in Admin → Settings:

| Tax | Rate |
|-----|------|
| GPM (income tax) | 20% (32% above €101,094/year) |
| Sodra (employee) | 19.5% |
| Sodra (employer) | 1.77% |
| NPD base | €747/month |
| Minimum wage (MMA) | €1,038/month |

Update rates annually or when legislation changes — no code changes needed.
