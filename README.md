# Test My Trade

A free, educational practice tool for trading strategies in the Indian market. Users build a strategy, run it on synthetic prices or their own price file, and read a plain report. It gives no advice and cannot place trades.

It is a static site: HTML, CSS and JavaScript only. There is no server, no database and no accounts. Everything runs in the visitor's browser.

## What you need

- [Node.js](https://nodejs.org) version 18 or newer. Check with `node --version`.
- Nothing else. There are no packages to install.

## Run it on your computer

Open PowerShell and run:

```powershell
cd "C:\Users\utsav\Documents\find your edge"
npm start
```

Then open <http://localhost:5173> in your browser. Press Ctrl+C in PowerShell to stop it.

`npm start` builds the site into the `dist` folder and serves it with the same security headers the live site will use. After you change a file in `src`, stop it and run `npm start` again.

To use a different port: `$env:PORT=8080; npm start`

## Test it

**Automated tests** (the simulation engine):

```powershell
npm test
```

All 18 tests should pass. They check that costs add up, results are repeatable, higher costs never improve a result, bad price files are rejected with a clear message, the Statistics page numbers agree with the simulation, the site counts never store IP addresses, and the admin password check and lockout work.

**Manual checks** in the browser, in this order:

1. The guide cat starts by itself, hops between parts, and sleeps in the corner when done.
2. Each of the five templates runs and produces a report.
3. In the legs table, add a leg, change it, remove it. "Your rules, in words" updates as you type.
4. On the Data step, choose "Use my own data" and try to continue without a file or without ticking the terms. Both should stop you with a message.
5. Load a real CSV with `date`, `time` and `close` columns and run it.
6. Open **Statistics** after a run: three tables, the monthly bars, the spread chart and the below-the-high chart should all show. Run again with different settings and check both runs appear in "Compare your runs".
7. Run four simulations. The fourth should be refused by the daily limit.
8. Switch to light mode, reload, and confirm it stays light.
9. Narrow the browser window to phone width and repeat steps 1 and 2.
10. AI helper: paste a real Anthropic or xAI (Grok) API key and press Save. You should not have to choose a model. Confirm the cat gets its hat, the wizard shows "Automatic (model name)", and try all four actions. Then enter a wrong key and confirm you get a clear error.

To reset the run limit and the guide while testing, open Privacy policy and press "Clear what this browser keeps".

## Project layout

| Path | What it is |
| --- | --- |
| `src/index.html` | Page structure, styles and the cat drawing |
| `src/engine.js` | Simulation engine: synthetic data, option pricing, strategies, costs, checks, statistics |
| `src/ui.js` | Screens, guide cat, Explain panel, AI helper, Statistics page |
| `src/admin.html`, `src/admin.js` | The private admin dashboard at `/admin` |
| `src/_headers` | Security headers for local hosting and hosts that support this file format |
| `test/engine.test.js`, `test/stats.test.mjs` | Automated tests |
| `scripts/build.mjs` | Builds `dist` |
| `scripts/serve.mjs` | The server, locally and on Render: pages, security headers, Grok relay, usage counts, admin data |
| `scripts/stats.mjs` | Anonymous usage counting and the admin password check |
| `render.yaml` | Render Blueprint |
| `dist/` | The built site. This folder is what gets deployed |

Things you will edit most often, all near the top of `src/ui.js`:

- `SITE`: the site name.
- `RUN_CAP`: runs allowed per day.
- `CHECKED` and the `costs` values in `S`: the charge rates and the date they were last checked. Update both together when a rate changes.
- `GLOSSARY`: the Explain entries.
- `GUIDE`: what the cat says on each screen.

## Deploy it on Render

The root-level `render.yaml` is a Render Blueprint. It creates one **free Node web service** called `test-my-trade-app` that:

- runs the tests, then builds `dist/` (`npm test && npm run build`), so a broken build never goes live;
- starts `node scripts/serve.mjs`, which serves the site with its security headers (CSP and friends) and runs the Grok relay;
- uses `/healthz` as the health check.

### Steps

1. Push this project to GitHub (already done if `git push` works):

   ```powershell
   git add .
   git commit -m "Stats page, automatic AI model, Render web service"
   git push
   ```

2. Sign in at <https://dashboard.render.com> with GitHub.
3. Click **New → Blueprint**, pick this repository, and click **Apply**. Render reads `render.yaml` and creates the service.
   - If you already created a Static Site from the old `render.yaml`, delete that one first (Settings → Delete), or the names clash.
4. Wait for the first deploy (2–3 minutes). Your site is live at `https://test-my-trade-app.onrender.com` (Render adds a suffix if the name is taken).
5. Every `git push` to `main` redeploys automatically.

No environment variables or secrets are needed: visitors bring their own AI keys, and the server never stores them.

**Without a Blueprint:** New → Web Service → pick the repo → Runtime **Node**, Build command `npm test && npm run build`, Start command `node scripts/serve.mjs`, Instance type **Free**.

### The free plan sleeps

A free web service spins down after 15 minutes with no visitors. The next visitor waits about a minute while it wakes; after that it is fast again. That is fine for a portfolio project. If you want it always on, either:

- upgrade the service to the Starter instance, or
- switch to a Static Site (always on, free) by changing `render.yaml` to `runtime: static`, `buildCommand: npm run build`, `staticPublishPath: ./dist`. Claude keys keep working; Grok keys may not, because a static site has no relay, and you would need to add the security headers under the site's **Headers** settings.

### Your own domain

Buy the domain from any registrar, then add it in your Render site's **Settings → Custom Domains** and follow Render's DNS instructions. Render sets up HTTPS for you.

## Admin page: your site statistics

Open `/admin` on your site (for example `https://test-my-trade-app.onrender.com/admin`) and enter your admin password. It shows:

- visitors on the site right now, visitors and page views per day, and simulations run per day;
- the most-visited screens, strategy types and templates used, synthetic vs own data, AI helper use, phone vs computer, and which websites sent visitors (LinkedIn, GitHub and so on);
- a 7, 30 or 90-day view, and a **Download CSV** button for your own records.

How counting works (also explained on the site's Privacy policy page): the app sends a tiny event when a screen is opened, a simulation runs, a file is loaded or the AI helper is used. No cookies, no stored IP addresses and nothing a visitor typed. Visitors are counted once a day with a hash that uses a random value that changes daily and is never saved, so the number is approximate. Browsers with Do Not Track or Global Privacy Control are not counted. Counts are kept as daily totals for 90 days.

### Turn it on

1. **Pick an admin password** (12 characters or more). The page stays switched off until `ADMIN_TOKEN` is set.
2. **Create a free Upstash database** so counts survive restarts. Render's free web service wipes its own disk whenever it sleeps or redeploys.
   1. Sign up at <https://console.upstash.com> (free, no card).
   2. **Create database** → Redis → pick the region nearest Singapore → Free plan.
   3. On the database page, find the **REST API** section and copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. **Give the three values to Render.** Applying the Blueprint asks for them. If the service already exists, open it → **Environment** → add `ADMIN_TOKEN`, `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` → **Save, rebuild and deploy**.

The server saves counts at most every 2 minutes and again when Render puts it to sleep, about 20,000 Upstash commands a month, well inside the free 500,000.

**On your computer:** counts go to `.data/stats.json` (ignored by Git). To try the admin page locally:

```powershell
$env:ADMIN_TOKEN = "pick-a-long-password"
npm start
```

Then open <http://localhost:5173/admin>. Your own local visits are counted too, so start the live site with a fresh database.

## Before you go live

- [ ] Have a lawyer review the Disclaimer, Privacy policy and Terms of use. They are marked as drafts on the site. Remove the draft lines in `src/ui.js` once approved.
- [ ] Add the operator name, address and a contact email to the Terms and Privacy pages.
- [ ] Confirm every rate on the Rates page against your broker and the exchange, and update `CHECKED`.
- [ ] Check that the name and domain are free to use.
- [ ] Test the AI helper with a real key on the live address.
- [ ] Set `ADMIN_TOKEN` and the two Upstash values on Render, open `/admin`, and check your own visit shows up.
- [ ] Do the manual checks above on a real phone.

## How the AI helper works

- The visitor pastes their own API key. The provider (Anthropic or xAI) is detected from the key, and **the model is chosen automatically**: the site asks the provider which models the key can use, ranks them (Claude Sonnet, then Haiku, then Opus; Grok 4.7, then Grok 4), skips image, voice and embedding models, and falls back to the next model if one is not available. Visitors never type a model name. A model can still be picked by hand under **Advanced**.
- The key is saved only in the visitor's browser. Claude calls go straight from the browser to `api.anthropic.com`.
- Grok relay: the page first calls xAI directly. If the browser is refused, it falls back to `relay/xai/...` on the same site, served by `scripts/serve.mjs` (locally and on Render). The relay forwards the request and never stores or logs the key. The privacy policy on the site says so.
