// Tests for the anonymous site statistics and the admin password check. Run with `npm test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStats } from '../scripts/stats.mjs';

const req = (ip, ua = 'Mozilla/5.0 (Windows NT 10.0)', auth) => ({ headers: { 'x-forwarded-for': ip, 'user-agent': ua, host: 'site.example', ...(auth ? { authorization: auth } : {}) }, socket: {} });
const make = (env = {}, t = Date.UTC(2026, 10, 15, 6)) => {
  const clock = { t };
  const s = createStats({ env: { STATS_FILE: join(mkdtempSync(join(tmpdir(), 'tmt-')), 's.json'), ...env }, now: () => clock.t });
  return { s, clock };
};

test('counts views, unique visitors per day, runs and AI use', () => {
  const { s, clock } = make();
  s.record({ t: 'view', v: 'build', r: 'https://www.linkedin.com/feed' }, req('1.1.1.1'));
  s.record({ t: 'view', v: 'report' }, req('1.1.1.1'));
  s.record({ t: 'view', v: 'build' }, req('2.2.2.2', 'Mozilla/5.0 (iPhone; Mobile)'));
  s.record({ t: 'run', k: 'legs', tpl: 'straddle', d: 'synthetic' }, req('1.1.1.1'));
  s.record({ t: 'ai', a: 'explain', p: 'anthropic' }, req('1.1.1.1'));
  s.record({ t: 'upload' }, req('2.2.2.2', 'Mozilla/5.0 (iPhone; Mobile)'));
  let snap = s.snapshot(), d = snap.days[snap.today];
  assert.equal(d.views, 3); assert.equal(d.visitors, 2); assert.equal(d.runs, 1); assert.equal(d.ai, 1); assert.equal(d.uploads, 1);
  assert.deepEqual(d.device, { computer: 1, phone: 1 });
  assert.deepEqual(d.refs, { 'linkedin.com': 1 });
  assert.equal(d.kinds.legs, 1); assert.equal(d.tpls.straddle, 1); assert.equal(d.aiActs.explain, 1);
  assert.equal(snap.liveNow, 2);
  clock.t += 24 * 3600e3; // next day: the same person counts as a visitor again
  s.record({ t: 'view', v: 'build' }, req('1.1.1.1'));
  snap = s.snapshot();
  assert.equal(snap.days[snap.today].visitors, 1);
  assert.equal(snap.total.visitors, 3);
  assert.equal(snap.liveNow, 1, 'visitors idle for more than 5 minutes are no longer live');
});

test('stores no IP addresses or browser strings, and ignores unknown or junk events', () => {
  const { s } = make();
  assert.equal(s.record({ t: 'view', v: '<script>' }, req('9.9.9.9')), false);
  assert.equal(s.record({ t: 'hack', v: 'build' }, req('9.9.9.9')), false);
  assert.equal(s.record({ t: 'run', k: 'x'.repeat(500), tpl: 'zzz' }, req('9.9.9.9')), true);
  s.record({ t: 'view', v: 'build', r: 'javascript:alert(1)' }, req('9.9.9.9', 'SecretBrowser/1.0'));
  const text = JSON.stringify(s.snapshot());
  assert.ok(!text.includes('9.9.9.9') && !text.includes('SecretBrowser') && !text.includes('xxxx') && !text.includes('zzz') && !text.includes('javascript'));
});

test('one visitor cannot flood the counts', () => {
  const { s } = make();
  for (let i = 0; i < 500; i++) s.record({ t: 'view', v: 'build' }, req('5.5.5.5'));
  assert.equal(s.snapshot().days[s.snapshot().today].views, 60);
});

test('counts survive a restart through the saved file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tmt-')), env = { STATS_FILE: join(dir, 's.json') };
  const a = createStats({ env });
  a.record({ t: 'run', k: 'orb', d: 'own' }, req('3.3.3.3'));
  await a.save();
  const b = createStats({ env });
  await b.load();
  assert.equal(b.snapshot().total.runs, 1);
});

test('admin page is off without a strong ADMIN_TOKEN, and checks the password', () => {
  assert.equal(make().s.checkAdmin(req('4.4.4.4', 'x', 'Bearer anything')).status, 404);
  assert.equal(make({ ADMIN_TOKEN: 'short' }).s.checkAdmin(req('4.4.4.4', 'x', 'Bearer short')).status, 404);
  const { s } = make({ ADMIN_TOKEN: 'correct-horse-battery' });
  assert.equal(s.checkAdmin(req('4.4.4.4', 'x', 'Bearer correct-horse-battery')).ok, true);
  assert.equal(s.checkAdmin(req('4.4.4.4', 'x', 'Bearer wrong')).status, 401);
  assert.equal(s.checkAdmin(req('4.4.4.4', 'x')).status, 401);
});

test('admin login locks out after repeated wrong passwords', () => {
  const { s, clock } = make({ ADMIN_TOKEN: 'correct-horse-battery' });
  for (let i = 0; i < 8; i++) s.checkAdmin(req('6.6.6.6', 'x', 'Bearer guess' + i));
  assert.equal(s.checkAdmin(req('6.6.6.6', 'x', 'Bearer correct-horse-battery')).status, 429);
  clock.t += 16 * 60000;
  assert.equal(s.checkAdmin(req('6.6.6.6', 'x', 'Bearer correct-horse-battery')).ok, true);
});
