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

All 10 tests should pass. They check that costs add up, results are repeatable, higher costs never improve a result, and bad price files are rejected with a clear message.

**Manual checks** in the browser, in this order:

1. The guide cat starts by itself, hops between parts, and sleeps in the corner when done.
2. Each of the five templates runs and produces a report.
3. In the legs table, add a leg, change it, remove it. "Your rules, in words" updates as you type.
4. On the Data step, choose "Use my own data" and try to continue without a file or without ticking the terms. Both should stop you with a message.
5. Load a real CSV with `date`, `time` and `close` columns and run it.
6. Run four simulations. The fourth should be refused by the daily limit.
7. Switch to light mode, reload, and confirm it stays light.
8. Narrow the browser window to phone width and repeat steps 1 and 2.
9. AI helper: add a real Anthropic or xAI (Grok) API key, confirm the cat gets its hat, and try all four actions. This is the one path that has only been tested against a simulated provider, so test it carefully. Then enter a wrong key and confirm you get a clear error.

To reset the run limit and the guide while testing, open Privacy policy and press "Clear what this browser keeps".

## Project layout

| Path | What it is |
| --- | --- |
| `src/index.html` | Page structure, styles and the cat drawing |
| `src/engine.js` | Simulation engine: synthetic data, option pricing, strategies, costs, checks |
| `src/ui.js` | Screens, guide cat, Explain panel, AI helper |
| `src/_headers` | Security headers for Netlify and Cloudflare Pages |
| `test/engine.test.js` | Automated tests |
| `scripts/build.mjs` | Builds `dist` |
| `scripts/serve.mjs` | Local server |
| `dist/` | The built site. This folder is what gets deployed |

Things you will edit most often, all near the top of `src/ui.js`:

- `SITE`: the site name.
- `RUN_CAP`: runs allowed per day.
- `CHECKED` and the `costs` values in `S`: the charge rates and the date they were last checked. Update both together when a rate changes.
- `GLOSSARY`: the Explain entries.
- `GUIDE`: what the cat says on each screen.

## Deploy it

The site is the `dist` folder. Any static host works. Three options, easiest first.

### Option 1: Netlify, drag and drop (no Git needed)

1. Run `npm run build`.
2. Sign in at <https://app.netlify.com>, open "Sites", and drag the `dist` folder onto the page.
3. Netlify gives you a live address. The security headers in `dist/_headers` are applied automatically.

### Option 2: Netlify or Cloudflare Pages from GitHub (rebuilds on every push)

1. Put this folder in a GitHub repository:

   ```powershell
   git init
   git add .
   git commit -m "First version"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/find-your-edge.git
   git push -u origin main
   ```

2. Netlify: "Add new site", "Import an existing project", pick the repository. `netlify.toml` already sets the build command and folder.
3. Cloudflare Pages: "Create a project", pick the repository, set the build command to `node scripts/build.mjs` and the output folder to `dist`.

Vercel also works: import the repository and it reads `vercel.json`.

### Option 3: GitHub Pages

1. Push the folder to GitHub as in option 2.
2. In the repository, open Settings, Pages, and set Source to "GitHub Actions".
3. Create the folders `.github\workflows` in the project and move `github-pages-workflow.yml` into them, renamed to `deploy.yml`. (It is saved at the top level because that folder could not be written for you.) Commit and push.
4. The workflow then runs the tests, builds and publishes on every push to `main`.

GitHub Pages cannot send custom security headers, so the `_headers` file is ignored there. The site still works, but prefer Netlify or Cloudflare Pages for the live site.

### Your own domain

Buy the domain from any registrar, then add it in your host's "Domains" settings and follow its DNS instructions. HTTPS is set up for you by all three hosts.

## Before you go live

- [ ] Have a lawyer review the Disclaimer, Privacy policy and Terms of use. They are marked as drafts on the site. Remove the draft lines in `src/ui.js` once approved.
- [ ] Add the operator name, address and a contact email to the Terms and Privacy pages.
- [ ] Confirm every rate on the Rates page against your broker and the exchange, and update `CHECKED`.
- [ ] Check that the name and domain are free to use.
- [ ] Test the AI helper with a real key on the live address.
- [ ] Do the manual checks above on a real phone.

## How the AI helper works

- The visitor picks a provider, Anthropic (Claude) or xAI (Grok), pastes their own API key and picks a model. The key is saved only in their browser and sent only to that provider (`api.anthropic.com` or `api.x.ai`).
- Grok relay: the page first calls xAI directly. If the browser is refused, it falls back to `relay/xai/...` on the same site. The local server (`scripts/serve.mjs`) includes this relay, so Grok works on localhost. A static host has no relay: if direct calls are refused there, you must add a small serverless function that forwards `models` and `chat/completions` to `https://api.x.ai/v1`, and update the privacy policy to say the key passes through your relay without being stored.
- The Grok path has been tested only against a simulated xAI server. Test it with a real key before launch. If xAI refuses calls made straight from a browser, it will need a small relay server.
- The security headers allow the page to connect to those two addresses and nowhere else. To support another provider, add its address to `connect-src` in `src/_headers`, `vercel.json` and `scripts/serve.mjs`.
- The model name is editable on the AI helper page, because model names change over time.
- If a call cannot reach the provider, the visitor sees an error. (Inside the Claude preview there was a built-in fallback. It does not exist on your own site, and the code simply skips it.)

## What is not built yet

Tradebook analysis, accounts and saved runs, the rule-change re-run, RSI and Supertrend templates, and a free AI allowance. Accounts and a free AI allowance both need a server, which this version deliberately does not have.
