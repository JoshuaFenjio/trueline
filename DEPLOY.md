# Trueline — setup & deploy

Two parts: the **Python pipeline** (scrapes jobs → Supabase) and the **web app**
(`/web`, Next.js → Vercel). Everything below stays on free tiers.

---

## 1. Supabase (one-time)

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste the contents of [`schema.sql`](schema.sql) and click **Run**. This creates
   `companies`, `job_postings`, `submissions` and the row-level-security policies.
3. Get your keys from **Project Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` secret → `SUPABASE_SERVICE_KEY` (server only, never in the browser)
   - `anon` `public` → `SUPABASE_ANON_KEY` (safe for the website)

## 2. Migrate local data up

```bash
cd ~/trueline
source venv/bin/activate
# .env holds SUPABASE_URL + SUPABASE_SERVICE_KEY
python3 migrate.py
```

It upserts every row from `trueline.db` and prints local-vs-Supabase counts. Re-runnable.

## 3. Run the web app locally

```bash
cd ~/trueline/web
cp .env.local.example .env.local     # then fill SUPABASE_URL + SUPABASE_ANON_KEY
npm install
npm run dev                          # http://localhost:3000
```

## 4. Push to GitHub

```bash
cd ~/trueline
git init
git add .
git commit -m "Trueline: pipeline + web"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/trueline.git
git push -u origin main
```

## 5. Deploy the site on Vercel (free Hobby tier)

1. Go to **vercel.com → Add New → Project → Import** your `trueline` repo.
2. **Root Directory:** set to `web` (important — the Next.js app lives there).
3. Framework preset auto-detects **Next.js**. Leave build/output defaults.
4. **Environment Variables** — add both:
   - `SUPABASE_URL` = your project URL
   - `SUPABASE_ANON_KEY` = your anon public key
   (Do **not** add the service key here.)
5. Click **Deploy**. You'll get `https://<project>.vercel.app`.
6. (Optional) update the `SITE` / `BASE` constant in `web/app/layout.tsx` and
   `web/app/sitemap.ts` to your real domain for correct OG tags + sitemap URLs.

## 6. Auto-refresh every 6 hours (free)

The scraper runs via **GitHub Actions** (already committed at
`.github/workflows/refresh.yml`) — a Vercel cron can't run a multi-minute Python
scrape within free serverless limits, so Actions is the right, free home for it.

In your GitHub repo → **Settings → Secrets and variables → Actions**, add:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

It then runs automatically every 6 hours (and on-demand from the Actions tab).
Because the site reads Supabase live, new data shows up with no redeploy.

---

## Cost summary (all free tier)
- **Supabase** free: 500MB DB — this dataset is a few MB.
- **Vercel** Hobby: plenty for a read-mostly Next.js site.
- **GitHub Actions**: free minutes cover a 6-hourly job comfortably.
