// Run with `npm test`. Uses Node's built-in test runner, no dependencies.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine.js');

const costs = { brok: 20, stt: 0.15, exch: 0.03553, sebi: 0.0001, gst: 18, stamp: 0.003, slip: 0.5, sttFut: 0.05, exchFut: 0.00183, stampFut: 0.002, slipFut: 0.02 };
const base = { entry: '09:20', exit: '15:15', orbEnd: '09:45', lots: 1, lotSize: 65, step: 50, days: 'all', sl: 30, target: 60, fast: 9, slow: 21, lookN: 20, exitM: 10, legs: [] };
const leg = (action, type, offset, sl) => ({ action, type, offset, lots: 1, sl, target: 0 });
const strategies = {
  straddle: { ...base, kind: 'legs', legs: [leg('sell', 'call', 0, 25), leg('sell', 'put', 0, 25)] },
  condor: { ...base, kind: 'legs', legs: [leg('sell', 'call', 2, 50), leg('sell', 'put', -2, 50), leg('buy', 'call', 6, 0), leg('buy', 'put', -6, 0)] },
  orb: { ...base, kind: 'orb' },
  ema: { ...base, kind: 'ema' },
  swing: { ...base, kind: 'swing', sl: 3 }
};

test('synthetic market is repeatable for the same seed and differs across seeds', () => {
  const a = E.genMarket(42, 'mixed', 30), b = E.genMarket(42, 'mixed', 30), c = E.genMarket(43, 'mixed', 30);
  assert.equal(a.length, 30);
  assert.equal(a[0].bars.length, 75);
  assert.deepEqual(a[29].bars, b[29].bars);
  assert.notDeepEqual(a[29].bars, c[29].bars);
  assert.ok(a.every(d => d.bars.every(p => p > 0 && Number.isFinite(p))));
});

test('option prices obey put-call parity and are never below the floor', () => {
  const S = 20010, K = 20000, T = 3 / 252, v = 0.15;
  const call = E.optionPrice(S, K, T, v, true), put = E.optionPrice(S, K, T, v, false);
  assert.ok(Math.abs((call - put) - (S - K)) < 0.01);
  assert.ok(E.optionPrice(20000, 25000, 1 / 252, 0.1, true) >= 0.05);
});

for (const [name, st] of Object.entries(strategies)) {
  test(name + ': costs add up and the result is consistent', () => {
    const days = E.genMarket(20261114, 'mixed', 120);
    const r = E.simulate(days, st, costs);
    const costSum = Object.values(r.cost).reduce((x, y) => x + y, 0);
    assert.ok(Math.abs(costSum - r.totalCost) < 0.5, 'cost lines must sum to the total');
    assert.ok(Math.abs(r.gross - r.totalCost - r.net) < 0.5);
    assert.equal(r.eqNet.length, r.daily.length + 1);
    assert.ok(Math.abs(r.eqNet[r.eqNet.length - 1] - r.net) < 0.5);
    assert.ok(r.wins <= r.trades && r.stopped <= r.trades && r.maxDD >= 0);
    assert.ok(E.simulate(days, st, costs, { costMult: 1.5 }).net <= r.net + 0.5, 'higher costs can never help');
  });
}

test('with zero costs, the result before and after costs is identical', () => {
  const zero = Object.fromEntries(Object.keys(costs).map(k => [k, 0]));
  const r = E.simulate(E.genMarket(7, 'range', 60), strategies.straddle, zero);
  assert.ok(Math.abs(r.gross - r.net) < 1e-6);
});

test('checks return a range that contains the base result', () => {
  const days = E.genMarket(1, 'trend', 80), r = E.simulate(days, strategies.straddle, costs);
  const c = E.runChecks(days, strategies.straddle, costs, r, { seed: 1, market: 'trend', days: 80 });
  assert.ok(c.sensMin <= r.net && r.net <= c.sensMax);
  assert.ok(c.top5Share >= 0 && c.top5Share <= 1);
  assert.ok(c.seedProfitable >= 0 && c.seedProfitable <= 5);
});

test('own-data parser reads a CSV and rejects bad files with a plain message', () => {
  const days = E.genMarket(5, 'mixed', 15);
  let csv = 'date,time,open,high,low,close,volume\n', d = new Date(Date.UTC(2024, 0, 1)), k = 0;
  while (k < 15) {
    if (d.getUTCDay() % 6 !== 0) { const ds = d.toISOString().slice(0, 10); days[k].bars.forEach((b, i) => { csv += `${ds},${E.SYN_TIMES[i]},0,0,0,${b.toFixed(2)},0\n`; }); k++; }
    d = new Date(d.getTime() + 864e5);
  }
  const parsed = E.parseOwnData(csv, 2);
  assert.equal(parsed.length, 15);
  assert.equal(parsed[0].bars.length, 75);
  assert.ok(parsed.every(x => x.vol > 0 && x.dte >= 0 && x.dte <= 4));
  assert.ok(E.simulate(parsed, strategies.straddle, costs).trades > 0);
  assert.throws(() => E.parseOwnData('a,b\n1,2', 2), /too few rows/);
  assert.throws(() => E.parseOwnData('x,y\n' + '1,2\n'.repeat(30), 2), /date/);
});

test('statistics agree with the simulation and are internally consistent', () => {
  for (const [name, st] of Object.entries(strategies)) {
    const r = E.simulate(E.genMarket(11, 'mixed', 180), st, costs), s = E.computeStats(r);
    assert.equal(s.trades, r.trades, name + ' trade count');
    assert.equal(s.wins, r.wins, name + ' win count');
    assert.equal(s.wins + s.losses, s.trades);
    assert.equal(s.hist.reduce((a, b) => a + b.count, 0), s.trades, name + ' histogram covers every trade');
    assert.ok(Math.abs(s.months.reduce((a, m) => a + m.net, 0) - r.net) < 1e-6, name + ' monthly results add up');
    if (s.trades) assert.ok(Math.abs(s.expectancy * s.trades - r.net) < 1e-6, name + ' average per trade');
    assert.ok(Math.min(...s.under) >= -r.maxDD - 1e-9 && Math.abs(Math.min(...s.under) + r.maxDD) < 1e-6, name + ' underwater depth equals drawdown');
    assert.ok(s.maxLossStreak <= s.losses && s.maxWinStreak <= s.wins);
  }
});

test('statistics group own data by calendar month', () => {
  const rows = ['date,time,close'];
  for (let d = 1; d <= 70; d++) {
    const day = new Date(Date.UTC(2025, 0, 1) + d * 86400000);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    const ds = day.toISOString().slice(0, 10);
    for (let m = 0; m < 75; m++) { const t = 9 * 60 + 15 + 5 * m; rows.push(ds + ',' + String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0') + ',' + (22000 + 40 * Math.sin(d + m / 9)).toFixed(2)); }
  }
  const parsed = E.parseOwnData(rows.join('\n'), 4);
  const days = parsed.days || parsed;
  const s = E.computeStats(E.simulate(days, strategies.straddle, costs));
  assert.ok(s.dated);
  assert.deepEqual(s.months.map(m => m.label), ['2025-01', '2025-02', '2025-03']);
});
