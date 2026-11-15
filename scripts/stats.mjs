// Anonymous, aggregate site statistics. No cookies, no IP addresses and no personal data are stored.
// A visitor is counted once a day using a hash of (IP + browser + a random salt that changes every day
// and is never saved), so the hash cannot be turned back into an IP, even by us.
// Counts are kept in memory and saved to Upstash Redis (free tier) when UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are set, otherwise to a local JSON file (fine on your laptop; on Render's free
// plan that file is wiped whenever the service sleeps or redeploys).
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const VIEWS = ['build', 'data', 'review', 'report', 'stats', 'learn', 'rates', 'ai', 'disclaimer', 'privacy', 'terms'];
const KINDS = ['legs', 'orb', 'ema', 'swing'];
const TPLS = ['straddle', 'condor', 'orb', 'ema', 'swing', 'blank', 'custom', 'ai'];
const DATA = ['synthetic', 'own'];
const AI_ACTS = ['build', 'explain', 'report', 'ask'];
const PROVS = ['anthropic', 'xai'];
const KEEP_DAYS = 90;
const KEY = 'tmt:stats:v1';

const day = (t = Date.now()) => new Date(t + 5.5 * 3600e3).toISOString().slice(0, 10); // India date
const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
const emptyDay = () => ({ views: 0, visitors: 0, runs: 0, ai: 0, uploads: 0, device: {}, screens: {}, kinds: {}, tpls: {}, data: {}, aiActs: {}, provs: {}, refs: {} });

export function createStats(opt = {}) {
  const env = opt.env || process.env, now = opt.now || Date.now;
  const upUrl = env.UPSTASH_REDIS_REST_URL, upTok = env.UPSTASH_REDIS_REST_TOKEN;
  const file = env.STATS_FILE || opt.file || '.data/stats.json';
  const store = upUrl && upTok ? 'upstash' : 'file';
  let data = { since: day(now()), total: { views: 0, visitors: 0, runs: 0, ai: 0, uploads: 0 }, days: {} };
  let salt = { day: '', value: '' }, seen = new Set(), live = new Map(), rate = new Map(), fails = new Map();
  let dirty = false, lastSave = null, lastError = '', timer = null;

  async function upstash(cmd) {
    const r = await fetch(upUrl, { method: 'POST', headers: { authorization: 'Bearer ' + upTok, 'content-type': 'application/json' }, body: JSON.stringify(cmd) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || 'Upstash returned ' + r.status);
    return j.result;
  }
  async function load() {
    try {
      const raw = store === 'upstash' ? await upstash(['GET', KEY]) : await readFile(file, 'utf8');
      if (raw) { const d = JSON.parse(raw); if (d && d.days && d.total) data = d; }
    } catch (e) { if (e.code !== 'ENOENT') lastError = 'Could not load saved stats: ' + e.message; }
  }
  async function save() {
    if (!dirty) return;
    dirty = false;
    const keys = Object.keys(data.days).sort();
    while (keys.length > KEEP_DAYS) delete data.days[keys.shift()];
    const body = JSON.stringify(data);
    try {
      if (store === 'upstash') await upstash(['SET', KEY, body]);
      else { await mkdir(dirname(file), { recursive: true }); await writeFile(file, body); }
      lastSave = new Date(now()).toISOString(); lastError = '';
    } catch (e) { dirty = true; lastError = 'Could not save stats: ' + e.message; }
  }
  function start(everyMs = 120000) { timer = setInterval(save, everyMs); timer.unref && timer.unref(); }
  async function stop() { clearInterval(timer); await save(); }

  function visitorId(req) {
    const d = day(now());
    if (salt.day !== d) { salt = { day: d, value: randomBytes(16).toString('hex') }; seen = new Set(); }
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    return createHash('sha256').update(salt.value + '|' + ip + '|' + (req.headers['user-agent'] || '')).digest('hex').slice(0, 16);
  }
  const pick = (v, list) => (typeof v === 'string' && list.includes(v) ? v : null);
  function refDomain(r) {
    try { const h = new URL(r).hostname.replace(/^www\./, '').toLowerCase(); return /^[a-z0-9.-]{3,60}$/.test(h) ? h : null; } catch { return null; }
  }

  // Record one event from the app. Returns false if it was ignored.
  function record(ev, req) {
    if (!ev || typeof ev !== 'object') return false;
    const id = visitorId(req), t = now();
    const r = rate.get(id) || { start: t, n: 0 };
    if (t - r.start > 60000) { r.start = t; r.n = 0; }
    if (++r.n > 60) return false; // more than 60 events a minute from one visitor: ignore
    rate.set(id, r);
    if (rate.size > 5000) rate.clear();
    const d = day(t), D = data.days[d] || (data.days[d] = emptyDay());
    live.set(id, t);
    if (ev.t === 'view') {
      const v = pick(ev.v, VIEWS); if (!v) return false;
      D.views++; data.total.views++; bump(D.screens, v);
      if (!seen.has(id)) {
        seen.add(id); D.visitors++; data.total.visitors++;
        bump(D.device, /mobi|android|iphone|ipad/i.test(req.headers['user-agent'] || '') ? 'phone' : 'computer');
        const ref = refDomain(ev.r); if (ref && ref !== String(req.headers.host || '').split(':')[0]) bump(D.refs, ref);
      }
    } else if (ev.t === 'run') {
      D.runs++; data.total.runs++;
      const k = pick(ev.k, KINDS), tp = pick(ev.tpl, TPLS), dd = pick(ev.d, DATA);
      if (k) bump(D.kinds, k); if (tp) bump(D.tpls, tp); if (dd) bump(D.data, dd);
    } else if (ev.t === 'ai') {
      const a = pick(ev.a, AI_ACTS); if (!a) return false;
      D.ai++; data.total.ai++; bump(D.aiActs, a); const p = pick(ev.p, PROVS); if (p) bump(D.provs, p);
    } else if (ev.t === 'upload') {
      D.uploads++; data.total.uploads++;
    } else return false;
    dirty = true;
    return true;
  }

  function snapshot() {
    const t = now();
    for (const [k, v] of live) if (t - v > 5 * 60000) live.delete(k);
    return { ...data, today: day(t), liveNow: live.size, store, lastSave, lastError, unsaved: dirty };
  }

  // Admin password check: constant-time compare, and lock out a visitor after 8 wrong tries for 15 minutes.
  function checkAdmin(req) {
    const want = env.ADMIN_TOKEN || '';
    if (want.length < 12) return { ok: false, status: 404, error: 'The admin page is turned off. Set ADMIN_TOKEN (12 characters or more) to turn it on.' };
    const id = visitorId(req), t = now(), f = fails.get(id);
    if (f && f.n >= 8 && t - f.at < 15 * 60000) return { ok: false, status: 429, error: 'Too many wrong passwords. Try again in 15 minutes.' };
    const got = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const a = createHash('sha256').update(got).digest(), b = createHash('sha256').update(want).digest();
    if (got && timingSafeEqual(a, b)) { fails.delete(id); return { ok: true }; }
    fails.set(id, { n: (f && t - f.at < 15 * 60000 ? f.n : 0) + 1, at: t });
    return { ok: false, status: 401, error: 'Wrong password.' };
  }

  return { load, save, start, stop, record, snapshot, checkAdmin, store };
}
