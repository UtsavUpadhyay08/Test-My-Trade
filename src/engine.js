/* Simulation engine. Pure functions, no DOM. */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussFrom(r) {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}
function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}
function optionPrice(S, K, T, sigma, isCall) {
  const sq = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + 0.5 * sigma * sigma * T) / sq;
  const call = S * normCdf(d1) - K * normCdf(d1 - sq);
  return Math.max(isCall ? call : call - S + K, 0.05);
}
const SYN_TIMES = (function () {
  const out = [];
  for (let i = 0; i < 75; i++) {
    const m = 9 * 60 + 20 + 5 * i;
    out.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
  }
  return out;
})();
const REGIMES = {
  up: { drift: 0.0007, vol: 0.009, mr: 0 },
  down: { drift: -0.0007, vol: 0.010, mr: 0 },
  range: { drift: 0, vol: 0.0065, mr: 0.08 },
  volatile: { drift: 0, vol: 0.017, mr: 0 }
};
function genMarket(seed, type, nDays) {
  const r = rng(seed);
  let price = 20000, left = 0, reg = REGIMES.range, anchor = price, v = 1;
  const trendDir = r() < 0.5 ? 'up' : 'down';
  const days = [];
  for (let d = 0; d < nDays; d++) {
    if (left <= 0) {
      let key;
      if (type === 'trend') key = trendDir;
      else if (type === 'range') key = 'range';
      else if (type === 'volatile') key = 'volatile';
      else key = ['up', 'down', 'range', 'range', 'volatile'][Math.floor(r() * 5)];
      reg = REGIMES[key];
      anchor = price;
      left = 15 + Math.floor(r() * 25);
    }
    const dayVol = reg.vol * (0.8 + 0.4 * r());
    price *= 1 + gaussFrom(r) * dayVol * 0.35;
    const bars = new Array(75);
    for (let i = 0; i < 75; i++) {
      const u = 0.7 + 0.6 * Math.abs(i - 37) / 37;
      const sb = dayVol / Math.sqrt(75) * u * v;
      const pull = reg.mr ? reg.mr / 75 * (price - anchor) / anchor : 0;
      price *= 1 + reg.drift / 75 + sb * gaussFrom(r) - pull;
      v = 0.94 * v + 0.06 * (0.6 + 0.8 * r());
      bars[i] = price;
    }
    days.push({ label: 'Day ' + (d + 1), dte: 4 - (d % 5), vol: dayVol, bars: bars, times: SYN_TIMES });
    left--;
  }
  return days;
}
function parseDate(s) {
  let m = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/.exec(s);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/.exec(s);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return null;
}
/* Turns CSV text into day objects. Throws Error with a plain message on bad input. */
function parseOwnData(text, expiryDow) {
  const lines = text.split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
  if (lines.length < 20) throw new Error('The file has too few rows to run a simulation.');
  const delim = lines[0].indexOf('\t') >= 0 ? '\t' : (lines[0].indexOf(';') >= 0 ? ';' : ',');
  const head = lines[0].split(delim).map(function (h) { return h.trim().toLowerCase().replace(/"/g, ''); });
  const ci = function (names) { for (let i = 0; i < head.length; i++) if (names.indexOf(head[i]) >= 0) return i; return -1; };
  const iDate = ci(['date', 'datetime', 'timestamp', 'date_time']);
  const iTime = ci(['time']);
  const iClose = ci(['close', 'c', 'ltp']);
  if (iDate < 0 || iClose < 0) throw new Error('The first row must name the columns, including "date" and "close".');
  const byDay = new Map();
  for (let n = 1; n < lines.length; n++) {
    const c = lines[n].split(delim);
    let ds = (c[iDate] || '').trim().replace(/"/g, ''), ts = iTime >= 0 ? (c[iTime] || '').trim().replace(/"/g, '') : '';
    if (!ts) { const sp = ds.split(/[ T]/); ds = sp[0]; ts = sp[1] || ''; }
    const close = parseFloat(c[iClose]);
    const tm = /^(\d{1,2}):(\d{2})/.exec(ts);
    if (!ds || !tm || !isFinite(close) || close <= 0) continue;
    if (!byDay.has(ds)) byDay.set(ds, []);
    byDay.get(ds).push({ t: tm[1].padStart(2, '0') + ':' + tm[2], c: close });
  }
  const days = [];
  byDay.forEach(function (rows, ds) {
    const dt = parseDate(ds);
    if (!dt || rows.length < 6) return;
    rows.sort(function (a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : 0; });
    days.push({ date: dt, label: ds, bars: rows.map(function (x) { return x.c; }), times: rows.map(function (x) { return x.t; }) });
  });
  if (days.length < 10) throw new Error('No usable intraday data found. The file needs a date, a time and a close price on each row, with several rows per day.');
  days.sort(function (a, b) { return a.date - b.date; });
  const rets = [];
  for (let i = 0; i < days.length; i++) {
    const cl = days[i].bars[days[i].bars.length - 1];
    if (i > 0) { const pc = days[i - 1].bars[days[i - 1].bars.length - 1]; rets.push(Math.log(cl / pc)); }
    const win = rets.slice(Math.max(0, rets.length - 20));
    let vol = 0.01;
    if (win.length >= 5) {
      const mean = win.reduce(function (a, b) { return a + b; }, 0) / win.length;
      vol = Math.sqrt(win.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (win.length - 1));
    }
    days[i].vol = Math.min(Math.max(vol, 0.003), 0.06);
    const cal = (expiryDow - days[i].date.getUTCDay() + 7) % 7;
    days[i].dte = Math.round(cal * 5 / 7);
  }
  return days;
}
function newResult() {
  return { daily: [], gross: 0, net: 0, cost: { brokerage: 0, stt: 0, exchange: 0, sebi: 0, slippage: 0, gst: 0, stamp: 0 }, trades: 0, wins: 0, stopped: 0, skipped: 0 };
}
function addCosts(out, c, m) {
  const total = (c.brokerage + c.stt + c.exchange + c.sebi + c.gst + c.stamp + c.slippage) * m;
  Object.keys(c).forEach(function (k) { out.cost[k] += c[k] * m; });
  return total;
}
function finish(out) {
  out.totalCost = out.gross - out.net;
  let eq = 0, peak = 0, dd = 0, eqG = 0;
  out.eqNet = [0]; out.eqGross = [0];
  for (let i = 0; i < out.daily.length; i++) {
    eq += out.daily[i].net; eqG += out.daily[i].gross;
    out.eqNet.push(eq); out.eqGross.push(eqG);
    if (eq > peak) peak = eq;
    if (peak - eq > dd) dd = peak - eq;
  }
  out.maxDD = dd;
  return out;
}
function simSwing(days, st, costs, opt) {
  const out = newResult(), m = opt.costMult || 1, qty = st.lots * st.lotSize;
  const N = Math.max(2, st.lookN + (opt.nDelta || 0)), M = Math.max(2, st.exitM), sl = Math.max(0.1, st.sl + (opt.slDelta || 0)) / 100;
  const cl = days.map(function (d) { return d.bars[d.bars.length - 1]; });
  let entry = null;
  for (let d = 0; d < days.length; d++) {
    let gross = 0, net = 0;
    if (d >= Math.max(N, M)) {
      if (entry === null) {
        if (cl[d] > Math.max.apply(null, cl.slice(d - N, d))) entry = cl[d];
      } else {
        const stopHit = cl[d] <= entry * (1 - sl);
        if (stopHit || cl[d] < Math.min.apply(null, cl.slice(d - M, d)) || d === days.length - 1) {
          const x = cl[d], turn = (entry + x) * qty;
          gross = (x - entry) * qty;
          const brokerage = 2 * costs.brok, exchange = costs.exchFut / 100 * turn, sebi = costs.sebi / 100 * turn;
          const c = { brokerage: brokerage, stt: costs.sttFut / 100 * x * qty, exchange: exchange, sebi: sebi, gst: costs.gst / 100 * (brokerage + exchange + sebi), stamp: costs.stampFut / 100 * entry * qty, slippage: costs.slipFut / 100 * turn };
          net = gross - addCosts(out, c, m);
          out.trades++; if (net > 0) out.wins++; if (stopHit) out.stopped++;
          entry = null;
        }
      }
    }
    out.gross += gross; out.net += net;
    out.daily.push({ label: days[d].label, gross: gross, net: net });
  }
  return finish(out);
}
function simulate(days, st, costs, opt) {
  opt = opt || {};
  if (st.kind === 'swing') return simSwing(days, st, costs, opt);
  const out = newResult(), m = opt.costMult || 1, slip = costs.slip / 100;
  const kF = 2 / (Math.max(2, st.fast + (opt.fastDelta || 0)) + 1), kS = 2 / (st.slow + 1);
  let emaF = null, emaS = null;
  for (let d = 0; d < days.length; d++) {
    const day = days[d], n = day.bars.length;
    let xi = -1, ei = -1, re = -1;
    for (let i = 0; i < n; i++) {
      if (ei < 0 && day.times[i] >= st.entry) ei = i;
      if (day.times[i] <= st.exit) xi = i;
      if (day.times[i] <= st.orbEnd) re = i;
    }
    const eligible = !(st.days === 'expiry' && day.dte !== 0);
    const iv = day.vol * Math.sqrt(252) * 1.15;
    const T = function (i) { return (day.dte + (n - 1 - i) / n + 0.02) / 252; };
    const atm = function (i) { return Math.round(day.bars[i] / st.step) * st.step; };
    const pos = [];
    if (st.kind === 'legs') {
      if (ei >= 0) ei = Math.min(Math.max(ei + (opt.entryShift || 0), 0), n - 1);
      if (eligible && ei >= 0 && xi > ei) st.legs.forEach(function (l) { pos.push({ sell: l.action === 'sell', isCall: l.type === 'call', K: atm(ei) + l.offset * st.step, lots: l.lots, sl: l.sl, target: l.target, ei: ei }); });
    } else if (st.kind === 'orb') {
      re = Math.max(re + (opt.entryShift || 0), 1);
      if (eligible && re < xi) {
        let hi = -Infinity, lo = Infinity;
        for (let i = 0; i <= re; i++) { if (day.bars[i] > hi) hi = day.bars[i]; if (day.bars[i] < lo) lo = day.bars[i]; }
        for (let i = re + 1; i < xi; i++) {
          if (day.bars[i] > hi || day.bars[i] < lo) { pos.push({ sell: false, isCall: day.bars[i] > hi, K: atm(i), lots: st.lots, sl: st.sl, target: st.target, ei: i }); break; }
        }
      }
    } else if (st.kind === 'ema') {
      let found = false;
      for (let i = 0; i < n; i++) {
        const p = day.bars[i];
        if (emaF === null) { emaF = p; emaS = p; continue; }
        const before = emaF - emaS;
        emaF += kF * (p - emaF); emaS += kS * (p - emaS);
        const after = emaF - emaS;
        if (!found && eligible && i >= 1 && i < xi && ((before <= 0 && after > 0) || (before >= 0 && after < 0))) { found = true; pos.push({ sell: false, isCall: after > 0, K: atm(i), lots: st.lots, sl: st.sl, target: st.target, ei: i }); }
      }
    }
    if (!eligible) continue;
    if (xi < 1) { out.skipped++; continue; }
    let gross = 0, sellVal = 0, buyVal = 0, slipCost = 0, stopHit = false;
    pos.forEach(function (p) {
      const qty = p.lots * st.lotSize, p0 = optionPrice(day.bars[p.ei], p.K, T(p.ei), iv, p.isCall);
      const sl = p.sl > 0 ? Math.max(1, p.sl + (opt.slDelta || 0)) / 100 : 0, tg = p.target > 0 ? p.target / 100 : 0;
      let px = p0;
      for (let i = p.ei + 1; i <= xi; i++) {
        px = optionPrice(day.bars[i], p.K, T(i), iv, p.isCall);
        const up = px / p0 - 1;
        if (p.sell) { if (sl && up >= sl) { stopHit = true; break; } if (tg && -up >= tg) break; }
        else { if (sl && -up >= sl) { stopHit = true; break; } if (tg && up >= tg) break; }
      }
      gross += (p.sell ? p0 - px : px - p0) * qty;
      sellVal += (p.sell ? p0 : px) * qty; buyVal += (p.sell ? px : p0) * qty;
      slipCost += (p0 + px) * slip * qty;
    });
    let net = 0;
    if (pos.length) {
      const brokerage = 2 * pos.length * costs.brok, exchange = costs.exch / 100 * (sellVal + buyVal), sebi = costs.sebi / 100 * (sellVal + buyVal);
      const c = { brokerage: brokerage, stt: costs.stt / 100 * sellVal, exchange: exchange, sebi: sebi, gst: costs.gst / 100 * (brokerage + exchange + sebi), stamp: costs.stamp / 100 * buyVal, slippage: slipCost };
      net = gross - addCosts(out, c, m);
      out.trades++; if (net > 0) out.wins++; if (stopHit) out.stopped++;
    }
    out.gross += gross; out.net += net;
    out.daily.push({ label: day.label, gross: gross, net: net });
  }
  return finish(out);
}
const VARIANTS = {
  legs: [{ entryShift: -2 }, { entryShift: 2 }, { slDelta: -5 }, { slDelta: 5 }],
  orb: [{ entryShift: -2 }, { entryShift: 2 }, { slDelta: -5 }, { slDelta: 5 }],
  ema: [{ fastDelta: -1 }, { fastDelta: 1 }, { slDelta: -5 }, { slDelta: 5 }],
  swing: [{ nDelta: -2 }, { nDelta: 2 }, { slDelta: -1 }, { slDelta: 1 }]
};
function runChecks(days, st, costs, base, synth) {
  const c = {};
  c.cost150 = simulate(days, st, costs, { costMult: 1.5 }).net;
  const nets = VARIANTS[st.kind].map(function (o) { return simulate(days, st, costs, o).net; }).concat([base.net]);
  c.sensMin = Math.min.apply(null, nets); c.sensMax = Math.max.apply(null, nets);
  const pos = base.daily.map(function (x) { return x.net; }).filter(function (x) { return x > 0; }).sort(function (a, b) { return b - a; });
  const posSum = pos.reduce(function (a, b) { return a + b; }, 0);
  c.top5Share = posSum > 0 ? pos.slice(0, 5).reduce(function (a, b) { return a + b; }, 0) / posSum : 0;
  if (synth) {
    const s = [];
    for (let k = 1; k <= 5; k++) s.push(simulate(genMarket(synth.seed + k * 7919, synth.market, synth.days), st, costs).net);
    c.seedMin = Math.min.apply(null, s); c.seedMax = Math.max.apply(null, s);
    c.seedProfitable = s.filter(function (x) { return x > 0; }).length;
  }
  return c;
}
if (typeof module !== 'undefined') module.exports = { genMarket: genMarket, simulate: simulate, runChecks: runChecks, parseOwnData: parseOwnData, optionPrice: optionPrice, SYN_TIMES: SYN_TIMES };
