'use strict';
/* Admin dashboard. Reads /api/admin/stats with the admin password; the password is kept only for this tab. */
const $ = function (id) { return document.getElementById(id); };
const esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
const fmt = function (n) { return Math.round(n).toLocaleString('en-IN'); };
const LABELS = {
  build: 'Strategy', data: 'Data', review: 'Run', report: 'Report', stats: 'Statistics', learn: 'Learn', rates: 'Rates', ai: 'AI helper', disclaimer: 'Disclaimer', privacy: 'Privacy', terms: 'Terms',
  legs: 'Option legs', orb: 'Opening range breakout', ema: 'Moving-average cross', swing: 'Futures swing',
  straddle: 'Short straddle', condor: 'Iron condor', blank: 'Blank', custom: 'Edited or AI-built', synthetic: 'Synthetic', own: 'Own file',
  anthropic: 'Claude', xai: 'Grok', phone: 'Phone', computer: 'Computer'
};
const AI_LABELS = { build: 'Build from words', explain: 'Explain strategy', report: 'Explain report', ask: 'Ask a question' };
let token = sessionStorage.getItem('tmt_admin') || '', range = Number(sessionStorage.getItem('tmt_range')) || 30, snap = null, timer = null;

function setTheme(t) { document.documentElement.setAttribute('data-theme', t); $('theme').textContent = t === 'light' ? 'Dark mode' : 'Light mode'; try { localStorage.setItem('fye_theme', t); } catch (e) { /* private mode */ } }
try { setTheme(localStorage.getItem('fye_theme') === 'light' ? 'light' : 'dark'); } catch (e) { setTheme('dark'); }

async function load() {
  const r = await fetch('api/admin/stats', { headers: { authorization: 'Bearer ' + token }, cache: 'no-store' });
  const j = await r.json().catch(function () { return { error: 'The server sent an unreadable answer (' + r.status + ').' }; });
  if (!r.ok) throw new Error(j.error || 'Error ' + r.status);
  return j;
}
function showLogin(msg) { clearInterval(timer); $('dash').hidden = true; $('login').hidden = false; $('err').textContent = msg || ''; $('pw').focus(); }
async function refresh() {
  try { snap = await load(); $('login').hidden = true; $('dash').hidden = false; draw(); }
  catch (e) { if (/password|turned off|Too many/i.test(e.message)) { sessionStorage.removeItem('tmt_admin'); token = ''; showLogin(e.message); } else $('status').textContent = 'Could not refresh: ' + e.message; }
}

function days() {
  const out = [], end = new Date(snap.today + 'T00:00:00Z');
  for (let i = range - 1; i >= 0; i--) { const d = new Date(end - i * 864e5).toISOString().slice(0, 10); out.push({ date: d, d: snap.days[d] || {} }); }
  return out;
}
function sumMaps(list, key) {
  const m = {};
  list.forEach(function (x) { const o = x.d[key] || {}; Object.keys(o).forEach(function (k) { m[k] = (m[k] || 0) + o[k]; }); });
  return Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
}
function sum(list, key) { return list.reduce(function (s, x) { return s + (x.d[key] || 0); }, 0); }
function bars(target, rows, labels, max) {
  rows = rows.slice(0, max || 10);
  if (!rows.length) { $(target).innerHTML = '<p class="empty">Nothing yet in this period.</p>'; return; }
  const top = rows[0][1] || 1;
  $(target).innerHTML = '<div class="list">' + rows.map(function (r) { return '<div class="li"><span>' + esc((labels || LABELS)[r[0]] || r[0]) + '</span><div class="track"><div style="width:' + Math.max(r[1] / top * 100, 2).toFixed(1) + '%"></div></div><span class="n">' + fmt(r[1]) + '</span></div>'; }).join('') + '</div>';
}
function chart(target, list, barKey, lineKey, cls, width) {
  const W = width || 760, H = 230, L = 44, R = 10, T = 12, B = 30, n = list.length;
  const bv = list.map(function (x) { return x.d[barKey] || 0; }), lv = lineKey ? list.map(function (x) { return x.d[lineKey] || 0; }) : [];
  const top = Math.max.apply(null, bv.concat(lv)), steps = Math.max(1, Math.min(4, top)), hi = Math.max(1, Math.ceil(top / steps) * steps), bw = (W - L - R) / n;
  const Y = function (v) { return T + (H - T - B) * (1 - v / hi); };
  let g = '';
  for (let k = 0; k <= steps; k++) { const v = hi * k / steps; g += '<line class="g" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/><text class="ax" x="' + (L - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + fmt(v) + '</text>'; }
  const every = Math.ceil(n / 10);
  list.forEach(function (x, i) {
    const v = bv[i], h = Y(0) - Y(v);
    g += '<rect class="' + cls + '" x="' + (L + i * bw + bw * 0.15).toFixed(1) + '" y="' + Y(v).toFixed(1) + '" width="' + Math.max(bw * 0.7, 1).toFixed(1) + '" height="' + Math.max(h, v ? 1 : 0).toFixed(1) + '" rx="2"><title>' + x.date + ': ' + v + (lineKey ? ' visitors, ' + lv[i] + ' views' : '') + '</title></rect>';
    if (i % every === 0 || i === n - 1) g += '<text class="ax" x="' + (L + i * bw + bw / 2).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + x.date.slice(8) + '/' + x.date.slice(5, 7) + '</text>';
  });
  if (lineKey) g += '<polyline class="lv" points="' + lv.map(function (v, i) { return (L + i * bw + bw / 2).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ') + '"/>';
  $(target).innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(barKey + ' per day for ' + n + ' days') + '">' + g + '</svg>';
}
function draw() {
  const list = days(), today = snap.days[snap.today] || {};
  document.querySelectorAll('[data-range]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-range')) === range)); });
  $('sub').textContent = 'Counting since ' + snap.since + '. Dates are India time. Last ' + range + ' days shown.';
  const tile = function (label, v, sub, cls) { return '<div class="card tile' + (cls ? ' ' + cls : '') + '"><span class="muted small">' + label + '</span><span class="v">' + v + '</span><span class="muted small">' + sub + '</span></div>'; };
  $('tiles').innerHTML = tile('<span class="dot"></span>On the site now', fmt(snap.liveNow), 'active in the last 5 minutes', 'live') +
    tile('Visitors', fmt(sum(list, 'visitors')), fmt(today.visitors || 0) + ' today · ' + fmt(snap.total.visitors) + ' all time') +
    tile('Page views', fmt(sum(list, 'views')), fmt(today.views || 0) + ' today · ' + fmt(snap.total.views) + ' all time') +
    tile('Simulations run', fmt(sum(list, 'runs')), fmt(today.runs || 0) + ' today · ' + fmt(snap.total.runs) + ' all time') +
    tile('AI helper uses', fmt(sum(list, 'ai')), fmt(snap.total.ai) + ' all time') +
    tile('Own files tested', fmt(sum(list, 'uploads')), fmt(snap.total.uploads) + ' all time');
  chart('c-traffic', list, 'visitors', 'views', 'bv');
  chart('c-runs', list, 'runs', null, 'br', 520);
  bars('l-screens', sumMaps(list, 'screens'));
  bars('l-kinds', sumMaps(list, 'kinds'));
  bars('l-tpls', sumMaps(list, 'tpls'));
  bars('l-data', sumMaps(list, 'data'));
  bars('l-ai', sumMaps(list, 'aiActs'), AI_LABELS);
  bars('l-device', sumMaps(list, 'device'));
  bars('l-refs', sumMaps(list, 'refs'), {}, 10);
  const st = $('status');
  st.classList.toggle('warn', snap.store !== 'upstash' || !!snap.lastError);
  st.innerHTML = (snap.store === 'upstash' ? 'Counts are saved to Upstash' : '<strong>Counts are saved to a local file.</strong> On Render’s free plan that file is wiped when the service sleeps or redeploys. Add the two UPSTASH settings (see the README) to keep them.') +
    (snap.lastSave ? ' Last saved ' + new Date(snap.lastSave).toLocaleString('en-IN') + '.' : ' Not saved yet; counts are saved every 2 minutes.') + (snap.lastError ? ' <span style="color:var(--bad)">' + esc(snap.lastError) + '</span>' : '') +
    ' Visitors are counted once a day without cookies or stored IP addresses, so the number is approximate.';
}
function csv() {
  const rows = [['date', 'visitors', 'page_views', 'simulations', 'ai_uses', 'own_files']].concat(days().map(function (x) { return [x.date, x.d.visitors || 0, x.d.views || 0, x.d.runs || 0, x.d.ai || 0, x.d.uploads || 0]; }));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rows.map(function (r) { return r.join(','); }).join('\n')], { type: 'text/csv' }));
  a.download = 'test-my-trade-stats-' + snap.today + '.csv'; document.body.appendChild(a); a.click(); a.remove();
}

$('login').addEventListener('submit', function (e) { e.preventDefault(); token = $('pw').value; sessionStorage.setItem('tmt_admin', token); $('pw').value = ''; refresh().then(function () { if (!$('dash').hidden) { clearInterval(timer); timer = setInterval(refresh, 60000); } }); });
document.addEventListener('click', function (e) {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-range')) { range = Number(b.getAttribute('data-range')); sessionStorage.setItem('tmt_range', range); if (snap) draw(); }
  else if (b.id === 'refresh') refresh();
  else if (b.id === 'csv' && snap) csv();
  else if (b.id === 'theme') setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
  else if (b.id === 'out') { sessionStorage.removeItem('tmt_admin'); token = ''; snap = null; showLogin('Signed out.'); }
});
if (token) refresh().then(function () { timer = setInterval(refresh, 60000); }); else showLogin('');
