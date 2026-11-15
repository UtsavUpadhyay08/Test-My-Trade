/* Interface. Depends on engine.js being loaded first. */
const SITE = 'Test My Trade';
const RUN_CAP = 3;
const CHECKED = '14 Nov 2026';
const RATES = [
  { k: 'stt', label: 'STT on option sales', unit: '% of sell premium', since: '1 Apr 2026', step: 0.005 },
  { k: 'exch', label: 'NSE transaction charge, options', unit: '% of premium, each side', since: '1 Mar 2026', step: 0.001 },
  { k: 'stamp', label: 'Stamp duty, options', unit: '% of buy premium', since: '', step: 0.001 },
  { k: 'sttFut', label: 'STT on futures sales', unit: '% of sell value', since: '1 Apr 2026', step: 0.005 },
  { k: 'exchFut', label: 'NSE transaction charge, futures', unit: '% of value, each side', since: '', step: 0.0001 },
  { k: 'stampFut', label: 'Stamp duty, futures', unit: '% of buy value', since: '', step: 0.001 },
  { k: 'sebi', label: 'SEBI turnover fee', unit: '% of turnover (₹10 per crore)', since: '', step: 0.0001 },
  { k: 'gst', label: 'GST', unit: '% of brokerage, exchange charge and SEBI fee', since: '', step: 1 },
  { k: 'brok', label: 'Brokerage', unit: '₹ per order, set by your broker', since: '', step: 1 },
  { k: 'slip', label: 'Slippage, options', unit: '% of premium per order (an assumption)', since: '', step: 0.1 },
  { k: 'slipFut', label: 'Slippage, futures', unit: '% of price per order (an assumption)', since: '', step: 0.01 }
];
const leg = function (action, type, offset, sl) { return { action: action, type: type, offset: offset, lots: 1, sl: sl, target: 0 }; };
const TPL = [
  { id: 'straddle', name: 'Short straddle', sub: 'Sell a call and a put at one strike', kind: 'legs', legs: function () { return [leg('sell', 'call', 0, 25), leg('sell', 'put', 0, 25)]; } },
  { id: 'condor', name: 'Iron condor', sub: 'Range trade with a capped loss', kind: 'legs', legs: function () { return [leg('sell', 'call', 2, 50), leg('sell', 'put', -2, 50), leg('buy', 'call', 6, 0), leg('buy', 'put', -6, 0)]; } },
  { id: 'orb', name: 'Opening range breakout', sub: 'Buy an option when the first range breaks', kind: 'orb' },
  { id: 'ema', name: 'Moving average crossover', sub: 'Buy an option when two averages cross', kind: 'ema' },
  { id: 'swing', name: 'Swing momentum', sub: 'Hold index futures for days after a breakout', kind: 'swing' },
  { id: 'blank', name: 'Start blank', sub: 'Add your own legs', kind: 'legs', legs: function () { return [leg('buy', 'call', 0, 30)]; } }
];
const S = {
  tpl: 'straddle',
  strat: { kind: 'legs', name: 'Short straddle', entry: '09:20', exit: '15:15', orbEnd: '09:45', lots: 1, lotSize: 65, step: 50, days: 'all', sl: 30, target: 60, fast: 9, slow: 21, lookN: 20, exitM: 10, legs: TPL[0].legs() },
  costs: { brok: 20, stt: 0.15, exch: 0.03553, sebi: 0.0001, gst: 18, stamp: 0.003, slip: 0.5, sttFut: 0.05, exchFut: 0.00183, stampFut: 0.002, slipFut: 0.02 },
  data: { kind: 'synthetic', market: 'mixed', seed: 20261114, days: 250 },
  own: null, agreed: false, result: null, memRuns: 0, explainTab: 'screen', openTerm: null, ai: null, history: []
};
const store = {
  get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
};
const today = function () { return new Date().toISOString().slice(0, 10); };
function runsUsed() { const r = store.get('fye_runs'); return r && r.date === today() ? r.count : S.memRuns; }
function addRun() { S.memRuns = runsUsed() + 1; store.set('fye_runs', { date: today(), count: S.memRuns }); }
const esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
const inr = function (n, sign) { const a = Math.round(Math.abs(n)).toLocaleString('en-IN'); return (n < 0 ? '−' : (sign ? '+' : '')) + '₹' + a; };
const pct = function (x) { return Math.round(x * 100) + '%'; };
const nw = function (t) { return t.replace(/([+−]?₹[\d,]+)/g, '<span class="nw">$1</span>'); };
const term = function (id, label) { return '<button type="button" class="term" data-term="' + id + '">' + label + '</button>'; };
const $ = function (id) { return document.getElementById(id); };

const GLOSSARY = [
  { id: 'leg', title: 'Leg', kind: 'Term', short: 'One option position inside a strategy',
    what: 'A strategy can hold several option positions at once. Each one is called a leg. A leg says whether you buy or sell, a call or a put, at which strike, and how many lots.',
    example: 'A short straddle has two legs: one sold call and one sold put.', risk: 'Every leg adds its own brokerage, taxes and slippage, so more legs mean higher costs.', rel: ['strike', 'lot', 'straddle'] },
  { id: 'straddle', title: 'Short straddle', kind: 'Strategy', short: 'Selling a call and a put at the same strike',
    what: 'You sell a call and a put at the same strike on the same day. You are paid a premium for both, and you keep it if the market stays close to that strike.',
    example: 'You sell the call for ₹100 and the put for ₹100, so you collect ₹200 per unit. If the index ends within 200 points of the strike you keep part of that. Beyond 200 points either way you lose, and the loss grows the further it moves.',
    risk: 'The profit is capped at the premium, but the loss is not capped. One large move can wipe out many small wins.', rel: ['premium', 'strike', 'stoploss'] },
  { id: 'condor', title: 'Iron condor', kind: 'Strategy', short: 'Selling two options and buying two further out',
    what: 'You sell a call above the market and a put below it, then buy a call even higher and a put even lower. The bought options cap how much you can lose.',
    example: 'With the index at 20,000 you sell the 20,100 call and 19,900 put, and buy the 20,300 call and 19,700 put. The most you can lose is the 200-point gap minus the premium you collected.',
    risk: 'Four legs mean four sets of costs. The capped loss is still several times larger than the most you can make.', rel: ['leg', 'straddle', 'strike'] },
  { id: 'orb', title: 'Opening range breakout', kind: 'Strategy', short: 'Trading a move out of the first minutes’ range',
    what: 'The tool notes the highest and lowest price in the first part of the day. If the price later moves above that range it buys a call, and if it moves below it buys a put.',
    example: 'The range by 09:45 is 19,950 to 20,030. At 10:20 the index trades at 20,040, so a call is bought.', risk: 'Many breakouts reverse. A bought option also loses value every minute it is held.', rel: ['premium', 'stoploss', 'target'] },
  { id: 'ema', title: 'Moving average crossover', kind: 'Strategy', short: 'Trading when a fast average crosses a slow one',
    what: 'A moving average smooths recent prices. The tool keeps a fast one and a slow one. When the fast average crosses above the slow one it buys a call, and when it crosses below it buys a put.',
    example: 'With 9-bar and 21-bar averages on 5-minute bars, the fast one reacts in about 45 minutes and the slow one in about 105.', risk: 'In a sideways market the averages cross back and forth, producing a string of small losses.', rel: ['premium', 'stoploss', 'sensitivity'] },
  { id: 'swing', title: 'Swing momentum', kind: 'Strategy', short: 'Holding for days after a breakout',
    what: 'The tool buys index futures when the daily close is higher than every close in the lookback period. It sells when the close falls below the exit lookback or the stop-loss is hit.',
    example: 'With a 20-day lookback, a close above the highest close of the last 20 days starts a trade.', risk: 'Futures gain or lose on every point of movement and can gap overnight past your stop-loss.', rel: ['lot', 'stoploss', 'drawdown'] },
  { id: 'strike', title: 'Strike and strike step', kind: 'Term', short: 'The price written into an option contract',
    what: 'Every option names a price, called the strike. A call gains value when the market rises above it, and a put gains value when the market falls below it. Strikes are spaced at a fixed step.',
    example: 'With the index at 20,010 and a step of 50, nearby strikes are 19,950, 20,000 and 20,050.', risk: 'The step differs by instrument, so set it to match yours.', rel: ['atm', 'premium'] },
  { id: 'atm', title: 'At the money', kind: 'Term', short: 'The strike closest to the current price',
    what: 'The at-the-money strike is the one nearest to where the market is trading. "ATM + 2 steps" means two strikes higher, and "ATM − 2 steps" means two strikes lower.',
    example: 'With the index at 20,010 and a step of 50, the at-the-money strike is 20,000 and ATM + 2 steps is 20,100.', risk: 'At-the-money options carry the most time value, so they move fastest when the market moves.', rel: ['strike', 'straddle'] },
  { id: 'premium', title: 'Premium', kind: 'Term', short: 'The price of an option',
    what: 'The premium is what a buyer pays and a seller receives for an option. It falls as expiry approaches if the market stays still, and rises when the market moves towards the strike or becomes more volatile.',
    example: 'A premium of ₹100 on a lot of 65 units is worth ₹6,500.', risk: 'In this tool premiums are estimated with a standard pricing model. Real premiums differ, sometimes by a lot.', rel: ['lot', 'expiry'] },
  { id: 'lot', title: 'Lot and lot size', kind: 'Term', short: 'The fixed number of units in one contract',
    what: 'Options and futures trade in lots. One lot is a fixed number of units set by the exchange, and you can only trade whole lots.',
    example: 'With a lot size of 65, a ₹10 move in the premium changes your result by ₹650 per lot.', risk: 'Exchanges change lot sizes from time to time. The default here is the Nifty 50 lot size in force since January 2026. Set it to match your instrument.', rel: ['premium'] },
  { id: 'stoploss', title: 'Stop-loss', kind: 'Setting', short: 'The level at which a position is closed to limit the loss',
    what: 'A stop-loss closes a position once the loss reaches a set level. For an option you sold, it triggers when the premium rises by that percentage. For an option you bought, it triggers when the premium falls by that percentage.',
    example: 'You sell at ₹100 with a 25% stop. If the premium reaches ₹125, that leg is bought back.', risk: 'A stop does not guarantee the exit price. In a fast market the fill can be worse than the stop level.', rel: ['target', 'slippage'] },
  { id: 'target', title: 'Target', kind: 'Setting', short: 'The level at which a position is closed to take profit',
    what: 'A target closes a position once the profit reaches a set percentage of the premium. Zero means no target, so the position runs until the stop-loss or the exit time.',
    example: 'You buy at ₹100 with a 60% target. If the premium reaches ₹160, the option is sold.', risk: 'A tight target cuts winners short. A wide one is rarely reached.', rel: ['stoploss'] },
  { id: 'expiry', title: 'Expiry', kind: 'Term', short: 'The day an option stops existing',
    what: 'Every option has a last day. After it, the option is settled and disappears. The closer the expiry, the faster the time value drains away.',
    example: 'An option with one day left loses time value much faster than one with five days left.', risk: 'Prices can swing sharply on expiry day. Exchanges also change expiry days, so check the current schedule for your instrument.', rel: ['premium'] },
  { id: 'slippage', title: 'Slippage', kind: 'Cost', short: 'The gap between the price you expect and the price you get',
    what: 'Orders rarely fill at the exact price on the screen. Slippage is that difference, and it always works against you.',
    example: 'With 0.5% slippage, an option you expected to sell at ₹100 is sold at ₹99.50.', risk: 'Slippage is an assumption here. In thin or fast markets the real figure can be several times larger.', rel: ['charges'] },
  { id: 'charges', title: 'Brokerage, taxes and charges', kind: 'Cost', short: 'Fees taken on every trade',
    what: 'Each trade carries brokerage, securities transaction tax (STT), exchange charges, a SEBI fee, GST on the fees and stamp duty. They are small per trade and large over a year.',
    example: 'STT on option sales is 0.15% of the premium, so selling ₹6,500 of premium costs ₹9.75 in STT alone.', risk: 'The Rates page shows when each rate was last checked. Rates change, so confirm them with your broker before relying on a result.', rel: ['slippage', 'netgross'] },
  { id: 'netgross', title: 'Before and after costs', kind: 'Report', short: 'The result with and without fees',
    what: 'Before costs is what the price moves alone produced. After costs subtracts slippage, brokerage, taxes and charges. Only the after-costs figure is money you would keep.',
    example: 'A strategy that makes ₹1,00,000 before costs and pays ₹60,000 in costs nets ₹40,000.', risk: 'Many strategies that look profitable before costs lose money after them.', rel: ['charges', 'slippage'] },
  { id: 'drawdown', title: 'Maximum drawdown', kind: 'Report', short: 'The largest fall from a peak',
    what: 'Drawdown measures how far the running total fell from its highest point before recovering. The maximum is the worst such fall in the period.',
    example: 'If the total climbs to ₹50,000 and then drops to −₹10,000, the drawdown is ₹60,000.', risk: 'This is the pain you would have had to sit through. The next drawdown can be deeper than any in the test.', rel: ['winrate'] },
  { id: 'winrate', title: 'Winning trades', kind: 'Report', short: 'How often a trade ended in profit',
    what: 'The share of trades that ended with a profit after costs. For intraday strategies, all the legs opened on one day count as one trade.',
    example: '150 winning trades out of 250 is 60%.', risk: 'A high share says little alone. A strategy can win often and still lose money if the losses are much larger.', rel: ['drawdown', 'outlier'] },
  { id: 'profitfactor', title: 'Profit factor', kind: 'Statistic', short: 'Money won on winning trades divided by money lost on losing trades',
    what: 'Add up every winning trade, add up every losing trade, and divide the first by the second. Above 1 means winners brought in more than losers took away, after costs.',
    example: 'Winners total \u20b960,000 and losers total \u20b940,000, so the profit factor is 1.5.', risk: 'A few large winners can lift it. With only a handful of trades it can swing a lot from one run to the next.', rel: ['expectancy', 'payoff'] },
  { id: 'expectancy', title: 'Average per trade', kind: 'Statistic', short: 'The average result of one trade, after costs',
    what: 'The total after-costs result divided by the number of trades. It combines how often you win with how much you win or lose each time.',
    example: '\u20b912,000 over 60 trades is \u20b9200 per trade.', risk: 'An average hides the spread. Two strategies with the same average can have very different worst trades.', rel: ['profitfactor', 'payoff'] },
  { id: 'payoff', title: 'Win/loss size ratio', kind: 'Statistic', short: 'How big the average win is compared with the average loss',
    what: 'The average winning trade divided by the average losing trade. Read it together with the share of winning trades.',
    example: 'An average win of \u20b93,000 and an average loss of \u20b91,500 gives a ratio of 2.', risk: 'A low ratio needs a high win rate to break even, and a high ratio can live with a low one. Neither is good or bad alone.', rel: ['winrate', 'expectancy'] },
  { id: 'streak', title: 'Losing streak', kind: 'Statistic', short: 'The most losing trades in a row',
    what: 'The longest run of trades that each ended in a loss after costs. Winning streaks are counted the same way.',
    example: 'Loss, loss, loss, win is a losing streak of 3.', risk: 'Long streaks happen by chance even with sound rules. The next streak can be longer than any in the test.', rel: ['drawdown', 'winrate'] },
  { id: 'sharpe', title: 'Sharpe and Sortino ratios', kind: 'Statistic', short: 'Average daily result compared with how much it bounced around',
    what: 'The Sharpe ratio is the average daily result divided by how much daily results vary, scaled to a year of about 252 trading days. The Sortino ratio is the same but counts only the down days as variation.',
    example: 'Two strategies earn the same total; the one with steadier days has the higher ratio.', risk: 'These ratios assume results are spread out evenly. Option selling often looks steady until one very bad day, which these numbers can understate.', rel: ['drawdown', 'recovery'] },
  { id: 'recovery', title: 'Recovery factor', kind: 'Statistic', short: 'Total result divided by the largest drawdown',
    what: 'The after-costs total divided by the maximum drawdown. It asks how much the strategy made for each rupee of the worst fall you would have sat through.',
    example: 'A total of \u20b930,000 with a worst fall of \u20b910,000 gives 3.', risk: 'It uses only the single worst fall in this test. A deeper fall can come later.', rel: ['drawdown', 'sharpe'] },
  { id: 'sensitivity', title: 'Sensitivity to settings', kind: 'Check', short: 'How much the result changes when rules change slightly',
    what: 'The tool re-runs your rules four times with one setting nudged slightly each time, then shows the lowest and highest result.',
    example: 'A result of ₹40,000 that ranges from −₹20,000 to ₹90,000 under small changes depends heavily on the exact settings.', risk: 'A result that only holds for one exact setting is usually luck, not a rule that works.', rel: ['outlier'] },
  { id: 'outlier', title: 'Dependence on the best days', kind: 'Check', short: 'How much of the profit came from a few days',
    what: 'The share of all winning-day profit that came from the five best days.',
    example: 'If five days out of 250 produced 40% of the profit, the result leans on rare events.', risk: 'Results that rest on a handful of days are fragile, because those days may not come again.', rel: ['sensitivity'] },
  { id: 'practice', title: 'Practice run and synthetic data', kind: 'Data', short: 'A simulation on invented prices',
    what: 'Synthetic data is a price series made by a computer to behave like a market index. It is not real or historical data. A run on it is a practice run.',
    example: 'You can test whether your stop-loss and exit rules behave the way you intended before using them anywhere else.', risk: 'A practice run cannot tell you whether a strategy would have made money in the real market. It only shows how the rules behave.', rel: ['owndata'] },
  { id: 'owndata', title: 'Using your own data', kind: 'Data', short: 'Running on a price file you hold',
    what: 'You can load a CSV file of intraday prices. It is read inside your browser, used for that run only, never sent to a server, and gone when you close or reload the page.',
    example: 'A file with date, time and close columns, several rows per trading day.', risk: 'You are responsible for having the right to use the data. Option premiums are still estimated by a model from your prices, so results remain approximate.', rel: ['practice', 'premium'] }
];
const G = {}; GLOSSARY.forEach(function (g) { G[g.id] = g; });
const SCREEN_TERMS = {
  build: ['leg', 'straddle', 'condor', 'orb', 'ema', 'swing', 'atm', 'strike', 'lot', 'stoploss', 'target', 'expiry'],
  data: ['practice', 'owndata', 'premium'], review: ['charges', 'slippage', 'netgross'],
  report: ['netgross', 'drawdown', 'winrate', 'charges', 'slippage', 'sensitivity', 'outlier', 'practice'],
  stats: ['profitfactor', 'expectancy', 'payoff', 'streak', 'sharpe', 'recovery', 'drawdown', 'winrate'],
  learn: [], ai: [], rates: ['charges', 'slippage', 'lot'], disclaimer: ['practice'], privacy: ['owndata'], terms: ['owndata']
};
const VIEWS = ['build', 'data', 'review', 'report', 'stats', 'learn', 'rates', 'ai', 'disclaimer', 'privacy', 'terms'];
const STEPS = [['build', 'Strategy'], ['data', 'Data'], ['review', 'Run'], ['report', 'Report']];
function current() { const h = location.hash.replace('#', ''); return VIEWS.indexOf(h) >= 0 ? h : 'build'; }

/* ---------- strategy helpers ---------- */
function rulesWords() {
  const s = S.strat, when = s.days === 'expiry' ? 'On expiry days' : 'Every trading day';
  if (s.kind === 'swing') return 'Buy ' + s.lots + ' lot' + (s.lots > 1 ? 's' : '') + ' of index futures when the daily close is the highest of the last ' + s.lookN + ' days. Sell when the close is the lowest of the last ' + s.exitM + ' days, or ' + s.sl + '% below the entry price.';
  const exits = function (sl, tg) { return (sl > 0 ? ' Stop-loss ' + sl + '%.' : ' No stop-loss.') + (tg > 0 ? ' Target ' + tg + '%.' : ''); };
  if (s.kind === 'orb') return when + ', note the high and low up to ' + s.orbEnd + '. If the price then breaks above, buy ' + s.lots + ' lot of the at-the-money call. If it breaks below, buy the put.' + exits(s.sl, s.target) + ' Close everything at ' + s.exit + '.';
  if (s.kind === 'ema') return when + ', when the ' + s.fast + '-bar average crosses above the ' + s.slow + '-bar average, buy ' + s.lots + ' lot of the at-the-money call. When it crosses below, buy the put. First signal of the day only.' + exits(s.sl, s.target) + ' Close everything at ' + s.exit + '.';
  const off = function (o) { return o === 0 ? 'at-the-money' : (o > 0 ? o + ' steps above' : -o + ' steps below'); };
  return when + ' at ' + s.entry + ': ' + s.legs.map(function (l) { return l.action + ' ' + l.lots + ' lot of the ' + off(l.offset) + ' ' + l.type + (l.sl > 0 ? ' (stop ' + l.sl + '%' + (l.target > 0 ? ', target ' + l.target + '%' : '') + ')' : (l.target > 0 ? ' (target ' + l.target + '%)' : '')); }).join('; ') + '. Close everything at ' + s.exit + '.';
}
function validate() {
  const s = S.strat, pos = function (x) { return isFinite(x) && x > 0; };
  if (!pos(s.lotSize) || !pos(s.step)) return 'Lot size and strike step must be above zero.';
  if (s.kind === 'swing') { if (!(s.lookN >= 2) || !(s.exitM >= 2) || !pos(s.sl) || !pos(s.lots)) return 'Lookbacks must be at least 2 days, and stop-loss and lots above zero.'; return ''; }
  if (s.kind === 'legs') {
    if (!s.legs.length) return 'Add at least one leg.';
    if (s.entry >= s.exit) return 'The exit time must be later than the entry time.';
    if (s.legs.some(function (l) { return !pos(l.lots) || !(l.sl >= 0) || !(l.target >= 0); })) return 'Each leg needs lots above zero. Stop-loss and target cannot be negative.';
    return '';
  }
  if (!pos(s.lots) || !(s.sl >= 0) || !(s.target >= 0)) return 'Lots must be above zero. Stop-loss and target cannot be negative.';
  if (s.kind === 'orb' && s.orbEnd >= s.exit) return 'The exit time must be later than the end of the opening range.';
  if (s.kind === 'ema' && (!(s.fast >= 2) || !(s.slow > s.fast))) return 'The slow average must be longer than the fast one, and both at least 2 bars.';
  return '';
}
function pickTemplate(id) {
  const t = TPL.filter(function (x) { return x.id === id; })[0];
  S.tpl = id; S.strat.kind = t.kind; S.strat.name = t.id === 'blank' ? 'My strategy' : t.name;
  if (t.legs) S.strat.legs = t.legs();
  S.strat.sl = t.kind === 'swing' ? 3 : 30; S.strat.target = 60; S.strat.lots = 1;
}

const ico = function (inner) { return '<svg viewBox="0 0 44 32" width="44" height="32">' + inner + '</svg>'; };
const TICON = {
  straddle: ico('<path class="m" d="M2 20h40"/><path d="M2 29L22 5l20 24"/>'),
  condor: ico('<path class="m" d="M2 18h40"/><path d="M2 27h8l6-18h12l6 18h8"/>'),
  orb: ico('<path class="m" d="M3 12h17v10H3z"/><path d="M4 18l7-3 6 4 7-6 6-5 10-4"/>'),
  ema: ico('<path class="m" d="M2 11c14 2 24 8 40 11"/><path d="M2 25c12 0 20-15 40-19"/>'),
  swing: ico('<path d="M2 27l8-4 4 2 8-10 4 3 8-9 8-4"/>'),
  blank: ico('<path d="M22 8v16M14 16h16"/>')
};
function payoffSvg() {
  try {
    const s = S.strat;
    if (s.kind !== 'legs' || !s.legs.length || !(s.step > 0) || !(s.lotSize > 0)) return '<p class="muted small">Add a leg to see the sketch.</p>';
    const S0 = 20000, legs = s.legs.map(function (l) { const K = S0 + l.offset * s.step, call = l.type === 'call'; return { sg: l.action === 'sell' ? -1 : 1, call: call, K: K, q: (l.lots > 0 ? l.lots : 0) * s.lotSize, p: optionPrice(S0, K, 1 / 252, 0.14, call) }; });
    const far = Math.max.apply(null, s.legs.map(function (l) { return Math.abs(l.offset); })), span = (far + 5) * s.step;
    const W = 560, H = 210, L = 10, R = 10, T = 16, B = 30, N = 120, pts = [];
    let lo = 0, hi = 0;
    for (let i = 0; i <= N; i++) { const x = S0 - span + 2 * span * i / N; let v = 0; legs.forEach(function (g) { v += g.sg * (Math.max(g.call ? x - g.K : g.K - x, 0) - g.p) * g.q; }); pts.push([x, v]); if (v < lo) lo = v; if (v > hi) hi = v; }
    if (hi - lo < 1) hi = lo + 1;
    const X = function (x) { return L + (W - L - R) * (x - S0 + span) / (2 * span); }, Y = function (v) { return T + (H - T - B) * (hi - v) / (hi - lo); };
    const line = pts.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' '), yz = Y(0).toFixed(1);
    const area = L + ',' + yz + ' ' + line + ' ' + (W - R) + ',' + yz, f = function (n) { return Math.round(n).toLocaleString('en-IN'); };
    return '<svg class="payoff" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Payoff sketch. Best result in the range shown ' + inr(hi, true) + ', worst ' + inr(lo, true) + '."><defs><clipPath id="cu"><rect x="0" y="0" width="' + W + '" height="' + yz + '"/></clipPath><clipPath id="cd"><rect x="0" y="' + yz + '" width="' + W + '" height="' + (H - yz) + '"/></clipPath></defs>' +
      '<polygon class="pu" clip-path="url(#cu)" points="' + area + '"/><polygon class="pd" clip-path="url(#cd)" points="' + area + '"/><line class="z" x1="' + L + '" x2="' + (W - R) + '" y1="' + yz + '" y2="' + yz + '"/><line class="sk" x1="' + X(S0) + '" x2="' + X(S0) + '" y1="' + T + '" y2="' + (H - B) + '"/><polyline class="pl" points="' + line + '"/>' +
      '<text class="ax" x="' + L + '" y="' + (H - 8) + '">' + f(S0 - span) + '</text><text class="ax" x="' + X(S0) + '" y="' + (H - 8) + '" text-anchor="middle">Index at exit: ' + f(S0) + '</text><text class="ax" x="' + (W - R) + '" y="' + (H - 8) + '" text-anchor="end">' + f(S0 + span) + '</text></svg>' +
      '<p class="muted small">Best in this range <span class="nw pos">' + inr(hi, true) + '</span>, worst <span class="nw neg">' + inr(lo, true) + '</span>. A sketch for an index at 20,000 with one day to expiry, before costs and stop-losses. Premiums are estimated.</p>';
  } catch (e) { return ''; }
}
function strip(r) {
  const n = r.daily.length, W = 720, L = 70, R = 12, mid = 32;
  let mx = 0, bars = '', up = 0, dn = 0;
  r.daily.forEach(function (d) { if (Math.abs(d.net) > mx) mx = Math.abs(d.net); });
  if (!n || !mx) return '';
  const bw = (W - L - R) / n;
  r.daily.forEach(function (d, i) { if (!d.net) return; const h = Math.max(Math.abs(d.net) / mx * 28, 1); if (d.net > 0) up++; else dn++; bars += '<rect class="' + (d.net > 0 ? 'bu' : 'bd') + '" x="' + (L + i * bw).toFixed(1) + '" y="' + (d.net > 0 ? mid - h : mid).toFixed(1) + '" width="' + Math.max(bw - 0.6, 0.8).toFixed(1) + '" height="' + h.toFixed(1) + '"/>'; });
  return '<h3 class="h4">Each day, after costs</h3><svg viewBox="0 0 ' + W + ' 64" role="img" aria-label="Daily results after costs: ' + up + ' days up and ' + dn + ' days down.">' + bars + '<line class="z" x1="' + L + '" x2="' + (W - R) + '" y1="' + mid + '" y2="' + mid + '"/></svg>';
}

/* ---------- views ---------- */
function stepper(v) {
  const idx = STEPS.map(function (s) { return s[0]; }).indexOf(v);
  if (idx < 0) return '';
  return '<ol class="steps" aria-label="Steps">' + STEPS.map(function (s, i) { return '<li class="' + (i <= idx ? 'done' : '') + '"' + (i === idx ? ' aria-current="step"' : '') + '><a href="#' + s[0] + '"><span class="dot">' + (i < idx ? '\u2713' : (i + 1)) + '</span><span>' + s[1] + '</span></a></li>'; }).join('') + '</ol>';
}
function fld(id, label, input, t) { return '<div class="field"><div class="lab"><label for="' + id + '">' + label + '</label>' + (t ? term(t, 'What is this?') : '') + '</div>' + input + '</div>'; }
function num(id, k, v, min, max, step) { return '<input id="' + id + '" data-k="' + k + '" data-num type="number" min="' + min + '" max="' + max + '" step="' + (step || 1) + '" value="' + v + '">'; }
function timeSel(id, k, sel) { return '<select id="' + id + '" data-k="' + k + '">' + SYN_TIMES.map(function (t) { return '<option' + (t === sel ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>'; }
function legsTable() {
  const offs = []; for (let o = -10; o <= 10; o++) offs.push(o);
  const sel = function (i, f, opts, cur, lab) { return '<select aria-label="' + lab + '" data-leg="' + i + '" data-f="' + f + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'; };
  const n = function (i, f, v, lab) { return '<input aria-label="' + lab + '" data-leg="' + i + '" data-f="' + f + '" type="number" min="0" max="500" step="' + (f === 'lots' ? 1 : 5) + '" value="' + v + '">'; };
  const offLab = function (o) { return o === 0 ? 'At the money' : 'ATM ' + (o > 0 ? '+ ' + o : '− ' + (-o)) + ' steps'; };
  return '<div class="scroll"><table class="legs"><thead><tr><th scope="col">Action</th><th scope="col">Type</th><th scope="col">Strike</th><th scope="col">Lots</th><th scope="col">Stop-loss %</th><th scope="col">Target %</th><th scope="col"><span class="vh">Remove</span></th></tr></thead><tbody>' +
    S.strat.legs.map(function (l, i) {
      const lab = 'Leg ' + (i + 1) + ' ';
      return '<tr><td>' + sel(i, 'action', [['sell', 'Sell'], ['buy', 'Buy']], l.action, lab + 'action') + '</td><td>' + sel(i, 'type', [['call', 'Call'], ['put', 'Put']], l.type, lab + 'type') + '</td><td>' + sel(i, 'offset', offs.map(function (o) { return [o, offLab(o)]; }), l.offset, lab + 'strike') + '</td><td>' + n(i, 'lots', l.lots, lab + 'lots') + '</td><td>' + n(i, 'sl', l.sl, lab + 'stop-loss percent') + '</td><td>' + n(i, 'target', l.target, lab + 'target percent') + '</td><td><button type="button" class="icon" data-act="leg-del" data-i="' + i + '" aria-label="Remove leg ' + (i + 1) + '"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" fill="none"/></svg></button></td></tr>';
    }).join('') + '</tbody></table></div><div class="row"><button type="button" class="btn dashed" data-act="leg-add"' + (S.strat.legs.length >= 8 ? ' disabled' : '') + '>Add a leg</button><span class="muted small">' + term('leg', 'What is a leg?') + ' &nbsp; ' + term('atm', 'What does ATM mean?') + ' &nbsp; Zero means no stop-loss or target.</span></div>';
}
function vBuild() {
  const s = S.strat;
  let form;
  if (s.kind === 'legs') form = '<div class="fgrid">' + fld('f-entry', 'Entry time', timeSel('f-entry', 'entry', s.entry)) + fld('f-exit', 'Exit time', timeSel('f-exit', 'exit', s.exit)) + fld('f-days', 'Trade on', '<select id="f-days" data-k="days"><option value="all"' + (s.days === 'all' ? ' selected' : '') + '>Every trading day</option><option value="expiry"' + (s.days === 'expiry' ? ' selected' : '') + '>Expiry day only</option></select>', 'expiry') + '</div><h3 class="h4">Legs</h3>' + legsTable();
  else if (s.kind === 'orb') form = '<div class="fgrid">' + fld('f-orb', 'Opening range ends at', timeSel('f-orb', 'orbEnd', s.orbEnd), 'orb') + fld('f-exit', 'Exit time', timeSel('f-exit', 'exit', s.exit)) + fld('f-lots', 'Lots', num('f-lots', 'lots', s.lots, 1, 50), 'lot') + fld('f-sl', 'Stop-loss (% of premium)', num('f-sl', 'sl', s.sl, 0, 100, 5), 'stoploss') + fld('f-tg', 'Target (% of premium)', num('f-tg', 'target', s.target, 0, 500, 5), 'target') + '</div>';
  else if (s.kind === 'ema') form = '<div class="fgrid">' + fld('f-fast', 'Fast average (bars)', num('f-fast', 'fast', s.fast, 2, 100), 'ema') + fld('f-slow', 'Slow average (bars)', num('f-slow', 'slow', s.slow, 3, 300), 'ema') + fld('f-exit', 'Exit time', timeSel('f-exit', 'exit', s.exit)) + fld('f-lots', 'Lots', num('f-lots', 'lots', s.lots, 1, 50), 'lot') + fld('f-sl', 'Stop-loss (% of premium)', num('f-sl', 'sl', s.sl, 0, 100, 5), 'stoploss') + fld('f-tg', 'Target (% of premium)', num('f-tg', 'target', s.target, 0, 500, 5), 'target') + '</div>';
  else form = '<div class="fgrid">' + fld('f-n', 'Breakout lookback (days)', num('f-n', 'lookN', s.lookN, 2, 200), 'swing') + fld('f-m', 'Exit lookback (days)', num('f-m', 'exitM', s.exitM, 2, 200), 'swing') + fld('f-sl', 'Stop-loss (% of price)', num('f-sl', 'sl', s.sl, 0.5, 50, 0.5), 'stoploss') + fld('f-lots', 'Lots', num('f-lots', 'lots', s.lots, 1, 50), 'lot') + '</div>';
  return '<div class="cols"><section id="tpl-list" class="tpls" aria-label="Templates"><h1>Build your strategy</h1><h2 class="label">Start from a template</h2>' +
    TPL.map(function (t) { return '<button type="button" class="tpl' + (t.id === 'blank' ? ' dashed' : '') + '" data-act="tpl" data-id="' + t.id + '" aria-pressed="' + (S.tpl === t.id) + '"><span class="tico" aria-hidden="true">' + TICON[t.id] + '</span><span class="ttxt"><strong>' + t.name + '</strong><span>' + t.sub + '</span></span></button>'; }).join('') + '</section>' +
    '<section class="grow stackgap"><div id="rules-card" class="card"><div class="fgrid">' + fld('f-name', 'Strategy name', '<input id="f-name" data-k="name" type="text" maxlength="60" value="' + esc(s.name) + '">') + fld('f-lot', 'Lot size (units)', num('f-lot', 'lotSize', s.lotSize, 1, 5000), 'lot') + (s.kind === 'swing' ? '' : fld('f-step', 'Strike step (points)', num('f-step', 'step', s.step, 1, 1000), 'strike')) + '</div>' + form + '</div>' +
    (s.kind === 'legs' ? '<div class="card"><div class="headrow"><h2 class="h4">Payoff sketch</h2><span class="pill">Updates as you edit</span></div><div id="payoff">' + payoffSvg() + '</div></div>' : '') + '<div id="words-card" class="words"><h2 class="label">Your rules, in words</h2><p id="words">' + esc(rulesWords()) + '</p></div>' +
    '<p id="msg" class="msg" role="status"></p><div class="row end"><a id="next-btn" class="btn primary" href="#data" data-act="next-build">Next: choose data</a></div></section></div>';
}
function vData() {
  const own = S.data.kind === 'own';
  return '<h1>Choose market data</h1><p class="muted">Indian market. This site does not supply real market prices.</p>' +
    '<div id="opt-syn" class="opt' + (own ? '' : ' on') + '"><label><input type="radio" name="src" value="synthetic"' + (own ? '' : ' checked') + '><span><strong class="block">Use synthetic data</strong><span>Computer-generated prices that behave like a market index and its options. They are not real market prices. Use them to check that your rules work and to see what costs do to them. ' + term('practice', 'More') + '</span></span></label>' +
    '<div class="inset"' + (own ? ' hidden' : '') + '>' + fld('syn-market', 'Market type', '<select id="syn-market">' + [['mixed', 'Mixed conditions'], ['trend', 'Trending'], ['range', 'Range-bound'], ['volatile', 'High volatility']].map(function (o) { return '<option value="' + o[0] + '"' + (S.data.market === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>') + '<p class="muted small">Runs on synthetic data are labelled practice runs.</p></div></div>' +
    '<div id="opt-own" class="opt' + (own ? ' on' : '') + '"><label><input type="radio" name="src" value="own"' + (own ? ' checked' : '') + '><span><strong class="block">Use my own data</strong><span>Use a price file you already hold. It is read in your browser and never leaves your device. ' + term('owndata', 'More') + '</span></span></label>' +
    '<div class="inset"' + (own ? '' : ' hidden') + '>' + fld('own-dow', 'Weekly expiry day of your instrument (set this before choosing the file)', '<select id="own-dow">' + ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(function (d, i) { return '<option value="' + (i + 1) + '"' + (i === 1 ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select>') +
    '<div id="drop" class="drop"><span class="stack"><strong>Drop a CSV file here</strong><span class="muted small mono">date, time, close (other columns are ignored)</span></span><button type="button" class="btn small" data-act="pick-file">Choose a file</button><input id="own-file" type="file" accept=".csv,.txt,text/csv" hidden></div>' +
    '<p id="own-msg" class="msg" role="status">' + (S.own ? 'Loaded: ' + esc(S.own.name) + ', ' + S.own.days.length + ' trading days.' : '') + '</p>' +
    '<div class="termsbox"><strong>Terms for using your own data</strong><ol><li>I have the right to use this data for my own analysis in a third-party tool.</li><li>I will not use this site to publish, share or redistribute this data.</li><li>The site does not check the data and is not responsible for errors in it or in results based on it.</li><li>Option premiums are estimated by a model from my prices. Results are an analysis, not investment advice.</li></ol>' +
    '<strong>How your data is stored and used</strong><ul><li><strong>Where it goes:</strong> nowhere. The file is opened inside your browser and stays on your device.</li><li><strong>What we store:</strong> nothing from the file.</li><li><strong>What we use it for:</strong> only to calculate this one run for you.</li><li><strong>Who else sees it:</strong> no one. It is not shared, sold or sent to any AI service.</li><li><strong>When it is gone:</strong> as soon as you close or reload the page.</li></ul>' +
    '<label class="agree"><input id="own-agree" type="checkbox"' + (S.agreed ? ' checked' : '') + '><span>I accept these terms and the <a href="#terms">Terms of use</a>.</span></label></div></div></div>' +
    '<p id="msg" class="msg" role="status"></p><div class="row end"><a class="btn" href="#build">Back</a><a id="next-btn" class="btn primary" href="#review" data-act="next-data">Next: review and run</a></div>';
}
function dataText() {
  const names = { mixed: 'mixed conditions', trend: 'trending', range: 'range-bound', volatile: 'high volatility' };
  return S.data.kind === 'own' && S.own ? 'Your own file: ' + S.own.name + ', ' + S.own.days.length + ' trading days. Read in your browser only.' : 'Synthetic data, ' + names[S.data.market] + ', ' + S.data.days + ' trading days. This will be a practice run.';
}
function vReview() {
  const left = Math.max(RUN_CAP - runsUsed(), 0), fut = S.strat.kind === 'swing', c = S.costs;
  const rows = (fut ? [['STT on futures sales', c.sttFut + '%'], ['NSE transaction charge', c.exchFut + '% each side'], ['Stamp duty', c.stampFut + '% of buy value'], ['Slippage', c.slipFut + '% per order']] : [['STT on option sales', c.stt + '% of premium'], ['NSE transaction charge', c.exch + '% each side'], ['Stamp duty', c.stamp + '% of buy premium'], ['Slippage', c.slip + '% per order']]).concat([['SEBI fee', '₹10 per crore'], ['GST', c.gst + '% on fees'], ['Brokerage', '₹' + c.brok + ' per order']]);
  return '<h1>Review and run</h1><div class="cols"><section class="grow stackgap"><div class="card"><h2 class="label">Strategy</h2><p><strong>' + esc(S.strat.name || 'Untitled strategy') + '</strong></p><p class="soft">' + esc(rulesWords()) + '</p><a href="#build">Change the strategy</a></div>' +
    '<div class="card"><h2 class="label">Market data</h2><p class="soft">' + esc(dataText()) + '</p><a href="#data">Change the data</a></div></section>' +
    '<aside class="side"><div id="rates-card" class="card"><div class="headrow"><h2 class="label">Costs applied ' + term('charges', 'Explain') + '</h2><span class="pill">Checked ' + CHECKED + '</span></div><table class="kv"><tbody>' + rows.map(function (r) { return '<tr><th scope="row">' + r[0] + '</th><td>' + r[1] + '</td></tr>'; }).join('') + '</tbody></table><a href="#rates">See or change the rates</a></div>' +
    '<div class="card"><p id="msg" class="msg" role="status"></p><button type="button" id="run-btn" class="btn primary block" data-act="run"' + (left ? '' : ' disabled') + '>Run the simulation</button><p class="muted small">' + (left ? left + ' of ' + RUN_CAP + ' runs left today. The result is an analysis, not a recommendation to trade.' : 'You have used today’s ' + RUN_CAP + ' runs. They reset at midnight.') + '</p></div></aside></div>';
}
function chart(r) {
  const W = 720, H = 280, L = 70, R = 12, T = 14, B = 34, n = r.eqNet.length, all = r.eqNet.concat(r.eqGross);
  let lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
  if (hi === lo) hi = lo + 1;
  const X = function (i) { return L + (W - L - R) * i / (n - 1); }, Y = function (v) { return T + (H - T - B) * (hi - v) / (hi - lo); };
  const line = function (arr) { return arr.map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' '); };
  let grid = '';
  for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4; grid += '<line class="g" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text x="' + (L - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" class="ax">' + inr(v) + '</text>'; }
  const zero = lo < 0 && hi > 0 ? '<line class="z" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(0) + '" y2="' + Y(0) + '"/>' : '';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Running total over ' + (n - 1) + ' trading days. Before costs it ends at ' + inr(r.gross, true) + ' and after costs at ' + inr(r.net, true) + '.">' + '<defs><linearGradient id="ga" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--blue);stop-opacity:.3"/><stop offset="1" style="stop-color:var(--blue);stop-opacity:0"/></linearGradient></defs>' + grid + zero + '<polygon fill="url(#ga)" points="' + L + ',' + (H - B) + ' ' + line(r.eqNet) + ' ' + (W - R) + ',' + (H - B) + '"/><polyline class="lg" points="' + line(r.eqGross) + '"/><polyline class="ln" points="' + line(r.eqNet) + '"/><text x="' + L + '" y="' + (H - 10) + '" class="ax">Day 1</text><text x="' + (W - R) + '" y="' + (H - 10) + '" text-anchor="end" class="ax">Day ' + (n - 1) + '</text></svg>';
}
const SENS_TEXT = { legs: 'Shifting the entry by two bars or each stop-loss by 5 points', orb: 'Moving the end of the opening range by two bars or the stop-loss by 5 points', ema: 'Changing the fast average by one bar or the stop-loss by 5 points', swing: 'Changing the breakout lookback by 2 days or the stop-loss by 1 point' };
function vReport() {
  const R = S.result;
  if (!R) return '<h1>Report</h1><div class="card"><p>No run yet. Build a strategy and run it to see a report here.</p><div><a class="btn primary" href="#build">Build a strategy</a></div></div>';
  const r = R.res, c = R.checks, synth = R.kind === 'synthetic';
  const banner = synth ? '<strong>Practice run on synthetic data.</strong> These prices are computer-generated, not real market prices. The result shows how your rules behave, not how they would have performed.' : '<strong>Run on your own data.</strong> Index prices come from your file. Option premiums are estimated by a pricing model, so the result is approximate and is not a record of real option prices.';
  const costShare = r.gross > 0 ? r.totalCost / r.gross : null;
  const tile = function (label, val, sub, t, cls) { return '<div class="card tile' + (cls ? ' hero ' + cls : '') + '"><span class="muted small">' + label + ' ' + term(t, 'Explain') + '</span><span class="big">' + val + '</span><span class="muted small">' + sub + '</span></div>'; };
  const costRows = [['Slippage', r.cost.slippage], ['Brokerage', r.cost.brokerage], ['STT', r.cost.stt], ['Exchange charges', r.cost.exchange], ['GST', r.cost.gst], ['Stamp duty', r.cost.stamp], ['SEBI fee', r.cost.sebi]].sort(function (a, b) { return b[1] - a[1]; });
  const maxC = costRows[0][1] || 1;
  const check = function (flag, title, text, t) { return '<li><span class="badge ' + (flag ? 'warn' : 'ok') + '">' + (flag ? '! Caution' : '✓ Note') + '</span><span><strong>' + title + '</strong> ' + term(t, 'Explain') + '<span class="block muted">' + nw(text) + '</span></span></li>'; };
  let checks = '';
  if (!r.trades) checks = '<li class="muted">These rules never opened a trade on this data, so there is nothing to check. Try different settings.</li>';
  else {
    checks += check(costShare === null || costShare > 0.4, 'What costs do', r.gross > 0 ? (costShare > 1 ? 'Costs of ' + inr(r.totalCost) + ' are larger than the whole before-costs profit of ' + inr(r.gross) + ', so the rules lose money.' : 'Costs take ' + pct(costShare) + ' of the before-costs result.') + ' With costs 50% higher, the result would be ' + inr(c.cost150, true) + '.' : 'The rules lost money before any costs, and costs add ' + inr(r.totalCost) + ' to the loss.', 'netgross');
    checks += check((c.sensMin < 0) !== (c.sensMax < 0) || Math.abs(c.sensMax - c.sensMin) > Math.abs(r.net), 'Small changes to settings', SENS_TEXT[R.stratKind] + ' moves the result between ' + inr(c.sensMin, true) + ' and ' + inr(c.sensMax, true) + '.', 'sensitivity');
    checks += check(c.top5Share > 0.3, 'Dependence on the best days', 'The five best days produced ' + pct(c.top5Share) + ' of all winning-day profit.', 'outlier');
    if (synth) checks += check(c.seedProfitable < 4, 'Other synthetic markets', 'On 5 other synthetic markets of the same type, the result ranged from ' + inr(c.seedMin, true) + ' to ' + inr(c.seedMax, true) + ', and was positive in ' + c.seedProfitable + ' of 5.', 'practice');
  }
  return '<div class="note" role="note">' + banner + '</div><div class="headrow"><div><h1>' + esc(R.name) + '</h1><p class="muted small">' + esc(R.words) + '</p><p class="muted small">' + r.daily.length + ' trading days simulated, ' + r.trades + ' trades' + (r.skipped ? ', ' + r.skipped + ' days skipped for missing times' : '') + '. ' + esc(R.dataText) + ' Rates checked ' + CHECKED + '.</p></div><div class="row"><a class="btn" href="#stats">Full statistics</a><a class="btn" href="#build">Edit strategy</a></div></div>' +
    '<section id="tiles" class="tiles">' + tile('After costs', inr(r.net, true), 'Before costs ' + inr(r.gross, true), 'netgross', r.net >= 0 ? 'pos' : 'neg') + tile('Maximum drawdown', inr(-r.maxDD), 'Largest fall from a peak', 'drawdown') + tile('Winning trades', r.trades ? pct(r.wins / r.trades) : '0%', r.wins + ' of ' + r.trades + ' trades', 'winrate') + tile('Stopped out', String(r.stopped), 'of ' + r.trades + ' trades hit a stop-loss', 'stoploss') + '</section>' +
    '<div class="cols"><section id="chart-card" class="card grow"><div class="headrow"><h2 class="h3">Running total</h2><span class="legend"><span><i class="l1"></i>After costs</span><span><i class="l2"></i>Before costs</span></span></div>' + chart(r) + strip(r) + '</section><section id="checks-card" class="card side"><h2 class="h3">What the checks show</h2><ul class="checks">' + checks + '</ul></section></div>' +
    '<div class="cols"><section class="card grow"><h2 class="h3">Where the costs went ' + term('charges', 'Explain') + '</h2><p class="muted small">' + nw(inr(r.totalCost)) + ' in total' + (costShare !== null && costShare <= 1 ? ', ' + pct(costShare) + ' of the before-costs result' : '') + '. Rates are on the <a href="#rates">Rates</a> page.</p><div class="bars">' + costRows.map(function (x) { return '<div class="bar"><span>' + x[0] + '</span><div class="track"><div style="width:' + Math.max(x[1] / maxC * 100, 1).toFixed(1) + '%"></div></div><span class="mono">' + inr(x[1]) + '</span></div>'; }).join('') + '</div></section>' +
    '<section class="card side"><h2 class="h3">What this cannot tell you</h2><ul class="plain"><li>Whether these rules would have made money in the real market.</li><li>What will happen in the future.</li><li>What you should trade. That decision is yours alone.</li></ul><p class="muted small">Premiums, slippage and charges are modelled assumptions. See the <a href="#disclaimer">Disclaimer</a>.</p></section></div>';
}
function entryHtml(g, open) {
  if (!open) return '<li><button type="button" class="gl" data-open="' + g.id + '" aria-expanded="false"><strong>' + g.title + '</strong><span>' + g.short + '</span></button></li>';
  return '<li><article class="entry"><div class="headrow"><h3>' + g.title + '</h3><span class="pill">' + g.kind + '</span></div><p>' + nw(g.what) + '</p><h4>A worked example</h4><p>' + nw(g.example) + '</p><h4>What to watch for</h4><p>' + nw(g.risk) + '</p><p class="rel">Related: ' + g.rel.map(function (id) { return '<button type="button" class="term" data-open="' + id + '">' + G[id].title + '</button>'; }).join(' ') + '</p></article></li>';
}
function barSvg(items, label) {
  const W = 720, H = 220, L = 70, R = 12, T = 12, B = 40, n = items.length;
  let lo = Math.min(0, Math.min.apply(null, items.map(function (x) { return x.v; }))), hi = Math.max(0, Math.max.apply(null, items.map(function (x) { return x.v; })));
  if (hi === lo) hi = lo + 1;
  const Y = function (v) { return T + (H - T - B) * (hi - v) / (hi - lo); }, bw = (W - L - R) / n, every = Math.ceil(n / 12);
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4; g += '<line class="g" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/><text x="' + (L - 8) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end" class="ax">' + inr(v) + '</text>'; }
  items.forEach(function (x, i) {
    const y0 = Y(Math.max(x.v, 0)), h = Math.max(Math.abs(Y(x.v) - Y(0)), 1);
    g += '<rect class="' + (x.v >= 0 ? 'bu' : 'bd') + '" x="' + (L + i * bw + bw * 0.12).toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + Math.max(bw * 0.76, 1).toFixed(1) + '" height="' + h.toFixed(1) + '"><title>' + esc(x.label) + ': ' + inr(x.v, true) + '</title></rect>';
    if (i % every === 0) g += '<text x="' + (L + i * bw + bw / 2).toFixed(1) + '" y="' + (H - B + 16) + '" text-anchor="middle" class="ax">' + esc(x.short || x.label) + '</text>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label) + '">' + g + '<line class="z" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '"/></svg>';
}
function histSvg(h) {
  const W = 720, H = 200, L = 40, R = 12, T = 12, B = 40, n = h.length, mx = Math.max.apply(null, h.map(function (b) { return b.count; })) || 1, bw = (W - L - R) / n;
  let g = '';
  h.forEach(function (b, i) {
    const bh = (H - T - B) * b.count / mx, mid = (b.from + b.to) / 2;
    g += '<rect class="' + (mid >= 0 ? 'bu' : 'bd') + '" x="' + (L + i * bw + 1).toFixed(1) + '" y="' + (H - B - bh).toFixed(1) + '" width="' + Math.max(bw - 2, 1).toFixed(1) + '" height="' + Math.max(bh, b.count ? 1 : 0).toFixed(1) + '"><title>' + inr(b.from, true) + ' to ' + inr(b.to, true) + ': ' + b.count + ' trades</title></rect>';
    if (b.count) g += '<text x="' + (L + i * bw + bw / 2).toFixed(1) + '" y="' + (H - B - bh - 4).toFixed(1) + '" text-anchor="middle" class="ax">' + b.count + '</text>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Spread of trade results from ' + inr(h[0].from, true) + ' to ' + inr(h[n - 1].to, true) + '.">' + g + '<line class="z" x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '"/><text x="' + L + '" y="' + (H - B + 18) + '" class="ax">' + inr(h[0].from, true) + '</text><text x="' + (W - R) + '" y="' + (H - B + 18) + '" text-anchor="end" class="ax">' + inr(h[n - 1].to, true) + '</text></svg>';
}
function underSvg(u) {
  const W = 440, H = 200, L = 66, R = 8, T = 10, B = 22, n = u.length, lo = Math.min.apply(null, u) || -1;
  const X = function (i) { return L + (W - L - R) * i / Math.max(n - 1, 1); }, Y = function (v) { return T + (H - T - B) * v / lo; };
  const pts = u.map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ');
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Distance below the previous high, deepest ' + inr(lo, true) + '."><line class="g" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(lo).toFixed(1) + '" y2="' + Y(lo).toFixed(1) + '"/><text x="' + (L - 8) + '" y="' + (Y(lo) + 4).toFixed(1) + '" text-anchor="end" class="ax">' + inr(lo, true) + '</text><text x="' + (L - 8) + '" y="' + (T + 4) + '" text-anchor="end" class="ax">₹0</text><polygon class="uw" points="' + L + ',' + T + ' ' + pts + ' ' + X(n - 1).toFixed(1) + ',' + T + '"/><line class="z" x1="' + L + '" x2="' + (W - R) + '" y1="' + T + '" y2="' + T + '"/></svg>';
}
function vStats() {
  const R = S.result;
  if (!R) return '<h1>Statistics</h1><div class="card"><p>No run yet. Build a strategy and run it, then the full statistics appear here.</p><div><a class="btn primary" href="#build">Build a strategy</a></div></div>';
  const r = R.res, st = computeStats(r);
  const ratio = function (x, d) { return x === null ? '—' : x.toFixed(d === undefined ? 2 : d); };
  const row = function (label, val, t, cls) { return '<tr><th>' + label + (t ? ' ' + term(t, 'Explain') : '') + '</th><td' + (cls ? ' class="' + cls + '"' : '') + '>' + val + '</td></tr>'; };
  const sign = function (v) { return v > 0 ? 'pos' : (v < 0 ? 'neg' : ''); };
  const card = function (title, rows) { return '<section class="card"><h2 class="h3">' + title + '</h2><table class="kv">' + rows + '</table></section>'; };
  const short = function (lbl) { if (!st.dated) return lbl.replace('Days ', '').split('–')[0]; const p = lbl.split('-'); return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(p[1]) - 1] + ' ' + p[0].slice(2); };
  const months = st.months.map(function (m) { return { label: m.label + ' (' + m.trades + ' trades)', short: short(m.label), v: m.net }; });
  const upM = st.months.filter(function (m) { return m.net > 0; }).length;
  const hist = st.hist.length ? histSvg(st.hist) : '<p class="muted">No trades, so there is nothing to plot.</p>';
  const cmp = S.history.length ? '<div class="tablewrap"><table class="cmp"><thead><tr><th>Run</th><th>Data</th><th>After costs</th><th>Trades</th><th>Winning</th><th>Profit factor</th><th>Max drawdown</th><th>Sharpe</th></tr></thead><tbody>' + S.history.map(function (h, i) { return '<tr' + (i === 0 ? ' class="now"' : '') + '><td>' + esc(h.name) + (i === 0 ? ' <span class="pill">latest</span>' : '') + '</td><td>' + esc(h.data) + '</td><td class="' + sign(h.net) + '">' + inr(h.net, true) + '</td><td>' + h.trades + '</td><td>' + pct(h.winRate) + '</td><td>' + ratio(h.pf) + '</td><td>' + inr(-h.maxDD) + '</td><td>' + ratio(h.sharpe) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted">Runs you make in this visit appear here.</p>';
  return '<div class="note" role="note"><strong>' + (R.kind === 'synthetic' ? 'Practice run on synthetic data.' : 'Run on your own data.') + '</strong> These statistics describe how the rules behaved in this simulation. They do not predict results and are not advice.</div>' +
    '<div class="headrow"><div><h1>Statistics</h1><p class="muted small">' + esc(R.name) + '. ' + r.daily.length + ' trading days, ' + st.trades + ' trades. ' + esc(R.dataText) + '</p></div><div class="row"><a class="btn" href="#report">Back to report</a><a class="btn" href="#build">Edit strategy</a></div></div>' +
    '<div id="st-cards" class="grid3">' +
    card('Trades', row('Trades', String(st.trades)) + row('Winning trades', st.trades ? pct(st.winRate) + ' (' + st.wins + ')' : '—', 'winrate') + row('Average per trade', inr(st.expectancy, true), 'expectancy', sign(st.expectancy)) + row('Average win', inr(st.avgWin, true), '', 'pos') + row('Average loss', inr(-st.avgLoss, true), '', st.avgLoss ? 'neg' : '') + row('Win/loss size ratio', ratio(st.payoff), 'payoff') + row('Best trade', inr(st.best, true), '', sign(st.best)) + row('Worst trade', inr(st.worst, true), '', sign(st.worst))) +
    card('Risk', row('Maximum drawdown', inr(-st.maxDD), 'drawdown', st.maxDD ? 'neg' : '') + row('Longest time below a high', st.longestDD + ' days', 'drawdown') + row('Longest losing streak', st.maxLossStreak + ' trades', 'streak') + row('Longest winning streak', st.maxWinStreak + ' trades', 'streak') + row('Sharpe ratio (yearly)', ratio(st.sharpe), 'sharpe') + row('Sortino ratio (yearly)', ratio(st.sortino), 'sharpe') + row('Recovery factor', ratio(st.recovery), 'recovery')) +
    card('Money', row('After costs', inr(r.net, true), 'netgross', sign(r.net)) + row('Before costs', inr(r.gross, true), 'netgross', sign(r.gross)) + row('Profit factor', ratio(st.profitFactor), 'profitfactor') + row('Total costs', inr(r.totalCost), 'charges') + row('Costs per trade', inr(st.costPerTrade), 'charges') + row('Costs as share of before-costs', st.costShare === null ? '—' : pct(st.costShare), 'charges') + row(st.dated ? 'Months in profit' : 'Blocks in profit', upM + ' of ' + st.months.length)) +
    '</div>' +
    '<section id="st-months" class="card"><div class="headrow"><h2 class="h3">' + (st.dated ? 'Result by month' : 'Result by block of 21 trading days') + '</h2><span class="muted small">After costs</span></div>' + barSvg(months, (st.dated ? 'Monthly' : 'Block') + ' results after costs: ' + upM + ' of ' + st.months.length + ' positive.') + '</section>' +
    '<div class="cols"><section id="st-hist" class="card grow"><h2 class="h3">How trade results are spread</h2><p class="muted small">Each bar counts the trades that ended in that range, after costs.</p>' + hist + '</section>' +
    '<section class="card side"><h2 class="h3">Below the high ' + term('drawdown', 'Explain') + '</h2><p class="muted small">How far the running total sat under its best level so far. Flat at zero means a new high.</p>' + underSvg(st.under) + '</section></div>' +
    '<section id="st-compare" class="card"><h2 class="h3">Compare your runs</h2><p class="muted small">Kept only while this page is open. These figures are not saved or sent.</p>' + cmp + '</section>';
}
function vLearn() { return '<h1>Learn</h1><p class="lead">Every term, setting and report figure used on this site, explained in plain words. These explanations teach concepts. They never tell you what to trade.</p><ul class="gllist wide">' + GLOSSARY.map(function (g) { return entryHtml(g, S.openTerm === g.id); }).join('') + '</ul>'; }
function vRates() {
  return '<h1>Rates</h1><p class="lead">The charges applied to every simulation. They were last checked against public sources on ' + CHECKED + ' and are re-checked every month. You can change any of them.</p><section class="card"><div class="scroll"><table class="rates"><thead><tr><th scope="col">Charge</th><th scope="col">Rate</th><th scope="col">Charged on</th><th scope="col">In force since</th></tr></thead><tbody>' +
    RATES.map(function (r) { return '<tr><th scope="row"><label for="c-' + r.k + '">' + r.label + '</label></th><td><input id="c-' + r.k + '" data-c="' + r.k + '" type="number" min="0" step="' + r.step + '" value="' + S.costs[r.k] + '"></td><td class="soft">' + r.unit + '</td><td class="soft">' + (r.since || 'Unchanged in 2026') + '</td></tr>'; }).join('') +
    '</tbody></table></div><p class="muted small">Sources: Union Budget 2026 for STT, NSE circulars for transaction charges and lot sizes, and broker charge pages. Brokerage and slippage are not official rates. Confirm all rates with your broker before relying on a result. ' + term('charges', 'What are these charges?') + '</p></section>' +
    '<section class="card"><h2 class="h3">Lot size</h2><p class="soft">New strategies start with a lot size of 65, the Nifty 50 lot size in force since January 2026. Set it on the Strategy step to match your instrument.</p></section>';
}
function vDisclaimer() {
  return '<h1>Disclaimer</h1><p class="draft">Draft, pending legal review.</p><section class="card"><ol class="legal">' +
    '<li><strong>No advice or recommendations.</strong> Nothing on ' + SITE + ' is a recommendation to buy, sell or hold any security, derivative or other instrument. Reports describe how a set of rules behaved under stated assumptions.</li>' +
    '<li><strong>Not registered with SEBI.</strong> The operator is not registered with the Securities and Exchange Board of India as an Investment Adviser, Research Analyst, stock broker or algo provider, and offers no service that requires such registration.</li>' +
    '<li><strong>No order execution.</strong> ' + SITE + ' cannot place, modify or cancel orders, connects to no broker and has no access to your funds or holdings.</li>' +
    '<li><strong>Simulated results do not predict future results.</strong> Simulations rely on assumptions about prices, option premiums, costs and slippage that may not hold in live markets. Rules that look good here can still lose money.</li>' +
    '<li><strong>Synthetic data is not market data.</strong> The built-in prices are generated by a computer. A price file you load is used exactly as you supply it, and we do not check it. Option premiums are always estimated by a model.</li>' +
    '<li><strong>Rates may be out of date.</strong> Charges are checked monthly against public sources but can change at any time.</li>' +
    '<li><strong>Explanations are education.</strong> The guide, the Explain panel and the Learn page teach concepts. They are not advice and may contain errors.</li>' +
    '<li><strong>AI answers can be wrong.</strong> The optional AI helper is run by a third-party AI provider using your own key. Its answers are generated automatically, may be inaccurate, and are never investment advice.</li>' +
    '<li><strong>Trading carries risk.</strong> Trading in securities and derivatives can result in losses greater than you expect. SEBI’s own studies report that most individual traders in equity derivatives lose money.</li>' +
    '<li><strong>Your decisions are your own.</strong> You alone are responsible for any trading decision you make and for complying with your broker’s terms and the law.</li></ol></section>';
}
function vPrivacy() {
  return '<h1>Privacy policy</h1><p class="draft">Draft for this preview version, pending legal review.</p><section class="card"><h2 class="h3">The short version</h2><ul class="plain"><li>We never sell your data.</li><li>We show no ads.</li><li>This version has no accounts and sends none of your inputs or results to a server.</li><li>We count visits and feature use anonymously, without cookies, to see how the site is used.</li></ul></section>' +
    '<section class="card"><h2 class="h3">Anonymous usage counts</h2><ul class="plain"><li><strong>What is counted:</strong> which screens are opened, how many simulations are run and which strategy type and data type they used, how often the AI helper is used, whether the device is a phone or a computer, and the website a visitor came from.</li><li><strong>What is not counted:</strong> your strategy settings, results, file name or contents, AI questions or answers, your key, or anything that names you.</li><li><strong>No cookies, no stored IP address:</strong> to count a visitor once a day, the server combines the IP address and browser type with a random value that changes every day and is never saved, and keeps only the scrambled result for that day. It cannot be turned back into an IP address.</li><li><strong>Opting out:</strong> turn on Do Not Track or Global Privacy Control in your browser and nothing is counted.</li><li><strong>Where counts are kept:</strong> as totals per day, for up to 90 days, on the site\u2019s server and its database provider. They are never sold or shared.</li></ul></section>' +
    '<section class="card"><h2 class="h3">What stays in your browser</h2><ul class="plain"><li><strong>Run count:</strong> today’s date and how many runs you have used, to apply the daily limit.</li><li><strong>Guide progress:</strong> which screens the guide has already shown you.</li><li><strong>Theme:</strong> whether you chose light or dark mode.</li><li><strong>AI key:</strong> only if you add one. It is sent to your AI provider. For xAI (Grok) the request may pass through this site\u2019s relay, which forwards it without storing or logging the key.</li></ul><div><button type="button" class="btn" data-act="reset">Clear what this browser keeps</button></div><p id="reset-msg" class="msg" role="status"></p></section>' +
    '<section class="card"><h2 class="h3">Your own price file</h2><ul class="plain"><li><strong>Where it goes:</strong> nowhere. It is opened inside your browser and stays on your device.</li><li><strong>What we store:</strong> nothing from the file.</li><li><strong>What we use it for:</strong> only to calculate that one run for you.</li><li><strong>Who else sees it:</strong> no one. It is not shared, sold or sent to any AI service.</li><li><strong>When it is gone:</strong> as soon as you close or reload the page.</li></ul></section>' +
    '<section class="card"><h2 class="h3">AI helper</h2><ul class="plain"><li>AI features work only if you add your own key from an AI provider.</li><li><strong>Sent to your provider:</strong> the text you type, your strategy rules and summary figures from your report, under your own agreement with that provider.</li><li><strong>Never sent:</strong> your price file, your name or account details.</li></ul></section>' +
    '<section class="card"><h2 class="h3">What we never ask for</h2><p class="soft">Your broker login, password, PIN, one-time codes, API keys, PAN, Aadhaar, or bank and demat details.</p></section>';
}
function vTerms() {
  return '<h1>Terms of use</h1><p class="draft">Draft, pending legal review. Operator and contact details will be added before launch.</p><section class="card"><ol class="legal">' +
    '<li><strong>Agreement.</strong> By using ' + SITE + ' you accept these terms, the Privacy policy and the Disclaimer.</li><li><strong>Who can use it.</strong> You must be at least 18.</li>' +
    '<li><strong>What it does.</strong> ' + SITE + ' is an educational tool for testing your own trading rules on simulated or self-supplied prices. It gives no investment advice, recommends no trades and cannot place orders.</li>' +
    '<li><strong>Free service and limits.</strong> The site is free. Daily run limits apply and may change.</li>' +
    '<li><strong>Your own data.</strong> If you use your own data, you confirm that you have the right to use it for your own analysis in a third-party tool. The file is opened and read inside your browser for that run only. It is not uploaded to our servers, not stored by us, not shared with anyone, not used for advertising and not used to train any model. When you close or reload the page it is gone from the site. We do not supply market data and do not tell you where to obtain it.</li>' +
    '<li><strong>Acceptable use.</strong> Do not use the site to give tips or advice to others, present its output as a recommendation, redistribute data through it, evade limits, or disrupt it.</li>' +
    '<li><strong>No warranty.</strong> The site is provided as it is. Calculations, estimates, rates and explanations may contain errors.</li>' +
    '<li><strong>Limit of liability.</strong> To the extent the law allows, the operator is not liable for any trading loss or other loss arising from your use of the site.</li><li><strong>Law.</strong> These terms are governed by the laws of India.</li></ol></section>';
}
function vAi() {
  const has = !!S.ai, prov = curProv(), same = has && S.ai.provider === prov, cur = same ? S.ai.model : 'auto', auto = cur === 'auto';
  const now = same ? (S.ai.used || candidates()[0]) : '';
  return '<h1>AI helper</h1><p class="lead">Add your own AI key and the guide cat puts on a wizard hat. It can then turn a plain-English description into a strategy, explain your strategy, and explain your report. It teaches. It never tells you what to trade.</p>' +
    '<section class="card"><h2 class="h3">Your key</h2><p class="soft">' + (has ? 'Saved in this browser: ' + PROVIDERS[S.ai.provider].name + ' key (ending ' + esc(S.ai.key.slice(-4)) + '). The cat is wearing its hat.' : 'No key saved yet. Paste a key and the site works out the provider and the model for you.') + '</p><div class="fgrid">' +
    '<div class="field"><label for="ai-key">API key</label><input id="ai-key" type="password" autocomplete="off" spellcheck="false" placeholder="' + (has ? 'Enter a new key to replace it' : 'Paste your key') + '"></div>' +
    '<div class="field"><label for="ai-prov">AI provider</label><select id="ai-prov">' + Object.keys(PROVIDERS).map(function (k) { return '<option value="' + k + '"' + (k === prov ? ' selected' : '') + '>' + PROVIDERS[k].name + '</option>'; }).join('') + '</select></div></div>' +
    '<p class="muted small">Model: <strong>chosen automatically</strong>' + (same && now ? ' (now ' + esc(now) + ')' : '') + '. The site picks a fast, capable model your key can use, and moves to the next one if it is not available. You do not need to type a model name.</p>' +
    '<details class="adv"' + (auto ? '' : ' open') + '><summary>Advanced: pick the model yourself</summary><div class="field"><label for="ai-model">Model</label><select id="ai-model">' + modelOptions(cur) + '</select></div><p class="muted small">' + (same && S.ai.models ? 'This list came from your own account.' : 'A starter list. After you save a key, it shows the models your account can use.') + '</p></details>' +
    '<p id="msg" class="msg" role="status"></p><div class="row"><button type="button" class="btn primary" data-act="ai-save">Save key</button>' + (has ? '<button type="button" class="btn" data-act="ai-open">Open the wizard cat</button><button type="button" class="btn" data-act="ai-remove">Remove key</button>' : '') + '</div>' +
    '<p class="muted small">You get a key from your AI provider\u2019s own console, and the provider bills you for what you use. Set a spending limit on the key.</p></section>' +
    '<section class="card"><h2 class="h3">Where your key and your data go</h2><ul class="plain"><li><strong>Your key:</strong> saved only in this browser on this device. It is sent to your AI provider. If xAI refuses a direct call from the browser, the request passes through this site\u2019s relay on its way to xAI; the relay forwards it and never stores or logs the key. Remove it here at any time.</li><li><strong>What is sent to the AI:</strong> the text you type, your strategy rules, and summary figures from your report.</li><li><strong>What is never sent:</strong> your price file, your name or any account details.</li><li><strong>What the AI may do:</strong> explain and convert. It is told never to recommend trades or predict results, and answers that look like advice are hidden.</li><li><strong>It can be wrong.</strong> Treat every answer as a starting point and check it.</li></ul></section>';
}
const RENDER = { stats: vStats, ai: vAi, build: vBuild, data: vData, review: vReview, report: vReport, learn: vLearn, rates: vRates, disclaimer: vDisclaimer, privacy: vPrivacy, terms: vTerms };
function render() {
  const v = current();
  $('view').innerHTML = stepper(v) + RENDER[v]();
  if (S.lastView !== v) { track(S.lastView ? { t: 'view', v: v } : { t: 'view', v: v, r: document.referrer }); S.lastView = v; }
  document.querySelectorAll('[data-nav]').forEach(function (a) { const on = a.getAttribute('data-nav') === v || (a.getAttribute('data-nav') === 'build' && STEPS.some(function (s) { return s[0] === v; })); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  renderExplain();
}

/* ---------- explain drawer ---------- */
function renderExplain() {
  const v = current(), q = ($('ex-q').value || '').trim().toLowerCase();
  let list;
  if (q) list = GLOSSARY.filter(function (g) { return (g.title + ' ' + g.short + ' ' + g.what).toLowerCase().indexOf(q) >= 0; });
  else if (S.explainTab === 'screen') list = (SCREEN_TERMS[v] || []).map(function (id) { return G[id]; });
  else list = GLOSSARY;
  if (S.openTerm && !q && list.indexOf(G[S.openTerm]) < 0) list = [G[S.openTerm]].concat(list);
  $('ex-list').innerHTML = list.length ? list.map(function (g) { return entryHtml(g, S.openTerm === g.id); }).join('') : '<li class="muted">' + (q ? 'No entry matches that search.' : 'No terms are specific to this screen. Try All topics.') + '</li>';
  document.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === S.explainTab)); });
}
function openExplain(id) {
  if (id) { S.openTerm = id; if ((SCREEN_TERMS[current()] || []).indexOf(id) < 0) S.explainTab = 'all'; }
  $('ex-q').value = ''; $('explain').hidden = false; renderExplain(); $('ex-close').focus();
}
function closeExplain() { $('explain').hidden = true; }

/* ---------- the guide cat ---------- */
const GUIDE = {
  build: [['#tpl-list', 'Hello. I am your guide. Start here: a template is a ready-made set of rules. Pick any one.'], ['#rules-card', 'Change anything you like here: times, legs, stop-loss. The dotted blue links explain each term.'], ['#words-card', 'This box repeats your rules in plain words. Check it says what you mean.'], ['#next-btn', 'When the rules look right, go on to choose your data.']],
  data: [['#opt-syn', 'Synthetic data is invented by a computer. It is safe for practice, but it is not the real market.'], ['#opt-own', 'Or use a price file you already hold. It stays in your browser and is never uploaded.'], ['#next-btn', 'Then move on to review everything before the run.']],
  review: [['#rates-card', 'These are the taxes and fees applied to every trade. They are re-checked every month.'], ['#run-btn', 'Press this to run the simulation. You get ' + RUN_CAP + ' runs a day.']],
  report: [['.note', 'Read this first. It says what kind of run this was and what it cannot prove.'], ['#tiles', 'The headline numbers. "After costs" is the only one that would be money in your pocket.'], ['#chart-card', 'The running total, day by day. The gap between the two lines is what costs took.'], ['#checks-card', 'These checks show how fragile the result is. Tap any "Explain" link to learn more. I will nap in the corner now.']]
};
GUIDE.stats = [['#st-cards', 'These are the same trades as the report, measured in more ways. Tap Explain on any number.'], ['#st-months', 'Each bar is one month, or one block of 21 trading days for synthetic data. Look for whether the result comes from a few bars or from many.'], ['#st-hist', 'How the trade results are spread. A long tail on the left means rare but large losses.'], ['#st-compare', 'Every run you make in this visit is listed here, so you can compare settings side by side.']];
const Cat = { steps: null, i: 0, el: null, view: null };
function seen() { return store.get('fye_guide') || S.memGuide || {}; }
function catPlace(x, y) { const c = $('cat'); c.style.left = Math.round(x) + 'px'; c.style.top = Math.round(y) + 'px'; c.classList.remove('hop'); void c.offsetWidth; c.classList.add('hop'); }
function catSleep() {
  if (Cat.el) Cat.el.classList.remove('guide-on');
  Cat.steps = null; Cat.el = null;
  $('bubble').hidden = true;
  const c = $('cat'); c.classList.add('sleep'); c.setAttribute('aria-label', 'The guide cat is asleep. Press to replay the guide for this screen.');
  catPlace(window.innerWidth - 84, window.innerHeight - 72);
}
function catPosition() {
  if (!Cat.steps) { if ($('cat').classList.contains('sleep')) { const c = $('cat'); c.style.left = (window.innerWidth - 84) + 'px'; c.style.top = (window.innerHeight - 72) + 'px'; } return; }
  const r = Cat.el.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, b = $('bubble');
  if (vw < 720) {
    b.style.left = '8px'; b.style.right = '8px'; b.style.width = 'auto'; b.style.top = 'auto'; b.style.bottom = '8px';
    const br = b.getBoundingClientRect();
    $('cat').style.left = '20px'; $('cat').style.top = Math.round(br.top - 50) + 'px';
    return;
  }
  const cx = Math.min(Math.max(r.left + 16, 8), vw - 76), cy = Math.min(Math.max(r.top - 50, S.ai ? 30 : 8), vh - 64);
  $('cat').style.left = Math.round(cx) + 'px'; $('cat').style.top = Math.round(cy) + 'px';
  b.style.right = 'auto'; b.style.bottom = 'auto'; b.style.width = '340px';
  const bh = b.offsetHeight, bw = 340, clampY = function (y) { return Math.min(Math.max(y, 8), vh - bh - 8); };
  let bx, by;
  if (r.right + 16 + bw <= vw - 8) { bx = r.right + 16; by = clampY(r.top); }
  else if (r.width < 420 && r.left - 16 - bw >= 8) { bx = r.left - 16 - bw; by = clampY(r.top); }
  else if (r.bottom + 14 + bh <= vh - 8) { bx = Math.min(Math.max(r.left + 90, 8), vw - bw - 8); by = r.bottom + 14; }
  else if (r.top - 14 - bh >= 8) { bx = Math.min(Math.max(r.left + 90, 8), vw - bw - 8); by = r.top - 14 - bh; }
  else { bx = Math.min(cx + 78, vw - bw - 8); by = clampY(cy - 6); }
  b.style.left = Math.round(bx) + 'px'; b.style.top = Math.round(by) + 'px';
}
function catStep() {
  if (Cat.el) Cat.el.classList.remove('guide-on');
  const st = Cat.steps[Cat.i];
  Cat.el = st[0];
  Cat.el.classList.add('guide-on');
  Cat.el.scrollIntoView({ block: 'center' });
  $('bubble-count').textContent = (Cat.i + 1) + ' of ' + Cat.steps.length;
  $('bubble-text').textContent = st[1];
  $('bubble-next').textContent = Cat.i === Cat.steps.length - 1 ? 'Done' : 'Next';
  $('bubble').hidden = false;
  const c = $('cat'); c.classList.remove('sleep'); c.setAttribute('aria-label', 'Guide cat');
  catPosition(); c.classList.remove('hop'); void c.offsetWidth; c.classList.add('hop');
  $('bubble-next').focus({ preventScroll: true });
}
function startGuide(force) {
  const v = current();
  if (Cat.el) Cat.el.classList.remove('guide-on');
  const steps = (GUIDE[v] || []).map(function (s) { return [document.querySelector(s[0]), s[1]]; }).filter(function (s) { return s[0]; });
  if (!steps.length || (!force && seen()[v])) { catSleep(); return; }
  Cat.steps = steps; Cat.i = 0; Cat.view = v; catStep();
}
function guideDone(all) {
  const s = seen();
  if (all) Object.keys(GUIDE).forEach(function (k) { s[k] = true; }); else s[Cat.view] = true;
  store.set('fye_guide', s); S.memGuide = s; catSleep();
}

/* ---------- actions ---------- */
/* Anonymous usage counts (see the Privacy policy). Nothing is sent when the browser asks not to be tracked. */
function track(ev) {
  try {
    if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true || window.claude || !/^https?:$/.test(location.protocol)) return;
    navigator.sendBeacon('api/e', new Blob([JSON.stringify(ev)], { type: 'application/json' }));
  } catch (e) { /* counting must never break the site */ }
}
function setMsg(t) { const m = $('msg'); if (m) m.textContent = t; }
function syncData() {
  const own = document.querySelector('input[name="src"]:checked').value === 'own';
  S.data.kind = own ? 'own' : 'synthetic';
  render();
  if (Cat.steps) catSleep();
}
function readFile(file) {
  const msg = $('own-msg');
  if (!file) return;
  if (file.size > 60 * 1024 * 1024) { msg.textContent = 'That file is larger than 60 MB. Use a smaller date range.'; return; }
  msg.textContent = 'Reading the file in your browser…';
  const fr = new FileReader();
  fr.onload = function () {
    try { const days = parseOwnData(String(fr.result), Number($('own-dow').value)); S.own = { name: file.name, days: days }; track({ t: 'upload' }); msg.textContent = 'Loaded: ' + file.name + ', ' + days.length + ' trading days. Nothing was sent anywhere.'; }
    catch (e) { S.own = null; msg.textContent = e.message; }
  };
  fr.onerror = function () { msg.textContent = 'The file could not be read.'; };
  fr.readAsText(file);
}
function dataProblem() {
  if (S.data.kind !== 'own') return '';
  if (!S.own) return 'Choose a price file first, or switch to synthetic data.';
  if (!S.agreed) return 'Tick the box to accept the terms for using your own data.';
  return '';
}
function run() {
  if (runsUsed() >= RUN_CAP) return setMsg('You have used today’s runs.');
  const bad = validate() || dataProblem();
  if (bad) return setMsg(bad);
  const s = S.strat, synth = S.data.kind !== 'own';
  const days = synth ? genMarket(S.data.seed, S.data.market, S.data.days) : S.own.days;
  const res = simulate(days, s, S.costs);
  if (!res.daily.length) return setMsg('No trading day in the data matched these rules. Check the times.');
  S.result = { res: res, checks: res.trades ? runChecks(days, s, S.costs, res, synth ? S.data : null) : {}, kind: synth ? 'synthetic' : 'own', stratKind: s.kind, name: s.name || 'Untitled strategy', words: rulesWords(), dataText: synth ? 'Synthetic data, seed ' + S.data.seed + '.' : 'Your file: ' + S.own.name + '.' };
  track({ t: 'run', k: s.kind, tpl: S.tpl || 'custom', d: synth ? 'synthetic' : 'own' });
  const st = computeStats(res);
  S.history.unshift({ name: S.result.name, data: synth ? 'Synthetic, seed ' + S.data.seed : 'Your file', net: res.net, trades: st.trades, winRate: st.winRate, pf: st.profitFactor, maxDD: res.maxDD, sharpe: st.sharpe });
  S.history = S.history.slice(0, 10);
  addRun();
  location.hash = 'report';
}
function setTheme(t) { document.documentElement.setAttribute('data-theme', t); $('theme-btn').textContent = t === 'light' ? 'Dark mode' : 'Light mode'; store.set('fye_theme', t); }

document.addEventListener('click', function (e) {
  const t = e.target.closest('[data-act],[data-term],[data-open],[data-tab]');
  if (!t) return;
  if (t.hasAttribute('data-term')) return openExplain(t.getAttribute('data-term'));
  if (t.hasAttribute('data-open')) { const id = t.getAttribute('data-open'); S.openTerm = S.openTerm === id ? null : id; if (t.closest('#explain')) renderExplain(); else render(); return; }
  if (t.hasAttribute('data-tab')) { S.explainTab = t.getAttribute('data-tab'); $('ex-q').value = ''; return renderExplain(); }
  const a = t.getAttribute('data-act');
  if (a === 'explain') openExplain();
  else if (a === 'explain-close') closeExplain();
  else if (a === 'tpl') { const guiding = !!Cat.steps; pickTemplate(t.getAttribute('data-id')); render(); if (guiding) { startGuide(true); if (Cat.steps && Cat.steps.length > 1) { Cat.i = 1; catStep(); } } }
  else if (a === 'leg-add') { S.strat.legs.push(leg('buy', 'call', 0, 30)); render(); }
  else if (a === 'leg-del') { S.strat.legs.splice(Number(t.getAttribute('data-i')), 1); render(); }
  else if (a === 'next-build') { const bad = validate(); if (bad) { e.preventDefault(); setMsg(bad); } }
  else if (a === 'next-data') { const bad = dataProblem(); if (bad) { e.preventDefault(); setMsg(bad); } }
  else if (a === 'pick-file') $('own-file').click();
  else if (a === 'run') run();
  else if (a === 'theme') setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
  else if (a === 'guide') startGuide(true);
  else if (a === 'cat') { if (!Cat.steps) { if (S.ai) openWizard(); else startGuide(true); } }
  else if (a === 'ai-save') aiSave();
  else if (a === 'ai-remove') { S.ai = null; S.aiProv = null; try { localStorage.removeItem('fye_ai'); } catch (err) { /* nothing stored */ } updateHat(); closeWizard(); render(); }
  else if (a === 'ai-open') openWizard();
  else if (a === 'wiz-close') closeWizard();
  else if (a.indexOf('wiz-') === 0) wizRun(a.slice(4));
  else if (a === 'guide-next') { if (Cat.i < Cat.steps.length - 1) { Cat.i++; catStep(); } else guideDone(false); }
  else if (a === 'guide-skip') guideDone(true);
  else if (a === 'reset') { try { ['fye_runs', 'fye_guide', 'fye_theme', 'fye_ai'].forEach(function (k) { localStorage.removeItem(k); }); } catch (err) { /* nothing stored */ } S.memRuns = 0; S.ai = null; updateHat(); $('reset-msg').textContent = 'Cleared.'; }
});
document.addEventListener('input', function (e) {
  const t = e.target;
  if (t.id === 'ex-q') return renderExplain();
  if (t.id === 'ai-key') { const want = /^xai-/.test(t.value.trim()) ? 'xai' : (/^sk-ant-/.test(t.value.trim()) ? 'anthropic' : ''); if (want && want !== curProv()) { const k = t.value; S.aiProv = want; render(); $('ai-key').value = k; $('ai-key').focus(); setMsg('That looks like a ' + PROVIDERS[want].name + ' key, so the provider was switched for you.'); } return; }
  if (t.hasAttribute('data-k')) { const k = t.getAttribute('data-k'); S.strat[k] = t.hasAttribute('data-num') ? Number(t.value) : t.value; }
  if (t.hasAttribute('data-leg')) { const f = t.getAttribute('data-f'), l = S.strat.legs[Number(t.getAttribute('data-leg'))]; l[f] = (f === 'action' || f === 'type') ? t.value : Number(t.value); }
  if (t.hasAttribute('data-k') || t.hasAttribute('data-leg')) { const w = $('words'); if (w) w.textContent = rulesWords(); const pc = $('payoff'); if (pc) pc.innerHTML = payoffSvg(); setMsg(''); }
  if (t.hasAttribute('data-c')) { const v = Number(t.value); if (isFinite(v) && v >= 0) S.costs[t.getAttribute('data-c')] = v; }
});
document.addEventListener('change', function (e) {
  const t = e.target;
  if (t.name === 'src') syncData();
  if (t.id === 'own-agree') { S.agreed = t.checked; setMsg(''); }
  if (t.id === 'syn-market') S.data.market = t.value;
  if (t.id === 'ai-prov') { const k = $('ai-key').value; S.aiProv = t.value; render(); $('ai-key').value = k; }
  if (t.id === 'ai-model') { if (S.ai && S.ai.provider === curProv()) { S.ai.model = t.value; S.ai.used = null; store.set('fye_ai', S.ai); setMsg(t.value === 'auto' ? 'The model is chosen automatically again.' : 'Model set to ' + t.value + '.'); } }
  if (t.id === 'own-file') readFile(t.files[0]);
  if (t.id === 'own-dow' && S.own) { S.own = null; $('own-msg').textContent = 'Expiry day changed. Choose the file again.'; }
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (!$('explain').hidden) closeExplain(); else if (!$('wizard').hidden) closeWizard(); else if (Cat.steps) guideDone(false); } });
document.addEventListener('dragover', function (e) { if (e.target.closest && e.target.closest('#drop')) e.preventDefault(); });
document.addEventListener('drop', function (e) { if (e.target.closest && e.target.closest('#drop')) { e.preventDefault(); if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); } });
window.addEventListener('hashchange', function () { S.openTerm = null; S.explainTab = 'screen'; render(); window.scrollTo(0, 0); startGuide(false); });
window.addEventListener('resize', catPosition);
window.addEventListener('scroll', function () { if (Cat.steps) catPosition(); }, { passive: true });
/* ---------- AI helper (the wizard cat) ---------- */
const AI_SYS = 'You are the guide cat of Test My Trade, an educational practice tool for Indian index options and futures. You teach concepts in plain, simple English for beginners. Hard rules: never recommend buying, selling or holding anything; never predict prices or profits; never name a stock or instrument as a pick; never say a strategy will make money. If asked for advice, tips or predictions, say you cannot give advice and explain the underlying concept instead. Simulations in this tool use synthetic or user-supplied prices and modelled option premiums, so results are not real-market performance. Answer in under 170 words of plain text. No markdown, no headings.';
const ADVICE = /\b(you should (definitely )?(buy|sell|short|go long)|i (would )?recommend (buying|selling|you)|guaranteed (profit|return)|sure[- ]shot|will definitely (make|rise|fall)|can't lose)\b/i;
const PROVIDERS = {
  anthropic: { name: 'Anthropic (Claude)', models: [['claude-sonnet-5-5', 'Claude Sonnet 5.5'], ['claude-haiku-5-5', 'Claude Haiku 5.5'], ['claude-opus-5-5', 'Claude Opus 5.5'], ['claude-fable-5-2', 'Claude Fable 5.2']] },
  xai: { name: 'xAI (Grok)', models: [['grok-4.7', 'Grok 4.7'], ['grok-4', 'Grok 4']] }
};
function curProv() { return S.aiProv || (S.ai ? S.ai.provider : 'anthropic'); }
function modelList() { const p = curProv(); return S.ai && S.ai.provider === p && S.ai.models && S.ai.models.length ? S.ai.models : PROVIDERS[p].models; }
const PREFER = { anthropic: [/sonnet/, /haiku/, /opus/, /claude/], xai: [/^grok-4\.7/, /^grok-4(?!\.)/, /^grok-4/, /^grok/] };
const NOT_CHAT = /image|vision|imagine|video|embed|tts|audio|speech|transcri/i;
/* Models to try, best first. 'auto' ranks what the account offers; a model picked by hand is tried alone. */
function candidates() {
  if (!S.ai) return [];
  if (S.ai.model && S.ai.model !== 'auto') return [S.ai.model];
  const pref = PREFER[S.ai.provider] || [], ids = modelList().map(function (m) { return m[0]; }).filter(function (id) { return !NOT_CHAT.test(id); });
  const rank = function (id) { for (let i = 0; i < pref.length; i++) if (pref[i].test(id)) return i; return pref.length; };
  const out = ids.map(function (id, i) { return [rank(id), i, id]; }).sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }).map(function (x) { return x[2]; });
  if (S.ai.used && out.indexOf(S.ai.used) > 0) { out.splice(out.indexOf(S.ai.used), 1); out.unshift(S.ai.used); }
  return out.length ? out : PROVIDERS[S.ai.provider].models.map(function (m) { return m[0]; });
}
function modelOptions(cur) {
  return '<option value="auto"' + (cur === 'auto' ? ' selected' : '') + '>Automatic (recommended)</option>' + modelList().filter(function (m) { return !NOT_CHAT.test(m[0]); }).map(function (m) { return '<option value="' + esc(m[0]) + '"' + (m[0] === cur ? ' selected' : '') + '>' + esc(m[1]) + (m[1] === m[0] ? '' : ' (' + esc(m[0]) + ')') + '</option>'; }).join('');
}
function modelLabel() { if (!S.ai) return ''; const c = candidates()[0] || ''; return S.ai.model === 'auto' ? 'Automatic (' + (S.ai.used || c) + ')' : S.ai.model; }
/* xAI: try the provider directly; if the browser is refused, use this site's own relay when it has one. */
async function xaiFetch(path, init) {
  try { return await fetch('https://api.x.ai/v1' + path, init); }
  catch (e) {
    if (!(e instanceof TypeError)) throw e;
    const r = await fetch('relay/xai' + path, init);
    if (r.status === 404 || r.status === 405) throw new TypeError('no relay on this site');
    S.aiRelay = true;
    return r;
  }
}
async function loadModels() {
  const x = S.ai.provider === 'xai';
  try {
    const res = x ? await xaiFetch('/models', { headers: { authorization: 'Bearer ' + S.ai.key } })
      : await fetch('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': S.ai.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } });
    if (res.status === 401 || (x && (res.status === 400 || res.status === 403))) return 'Saved, but ' + PROVIDERS[S.ai.provider].name + ' rejected this key. Check that you copied all of it and picked the right provider.';
    if (!res.ok) return 'Saved. The provider could not list your models (' + res.status + '), so the starter list is shown.';
    const j = await res.json(), list = (j.data || []).filter(function (m) { return m && typeof m.id === 'string'; }).map(function (m) { return [m.id, String(m.display_name || m.id)]; });
    if (!S.ai) return '';
    if (list.length) { S.ai.models = list; store.set('fye_ai', S.ai); }
    return 'The key works. ' + list.length + ' models found on your account.' + (S.aiRelay ? ' Requests go through this site\u2019s relay, because xAI refused a direct browser call.' : '');
  } catch (e) { return 'Saved, but this page could not reach ' + PROVIDERS[S.ai.provider].name + '. If you are inside the Claude preview, that is expected: open the site at localhost instead. Otherwise restart the local server and hard-refresh.'; }
}
function updateHat() { $('cat').classList.toggle('wiz', !!S.ai); }
function aiSave() {
  const key = $('ai-key').value.trim(), prov = $('ai-prov').value, sel = $('ai-model'), model = sel && S.ai && S.ai.provider === prov ? sel.value : 'auto';
  if (!key && (!S.ai || S.ai.provider !== prov)) return setMsg('Paste your ' + PROVIDERS[prov].name + ' key first.');
  if (key && (key.length < 20 || /\s/.test(key))) return setMsg('That does not look like an API key.');
  S.ai = { v: 2, provider: prov, key: key || S.ai.key, model: model, models: key ? null : S.ai.models, used: key ? null : S.ai.used };
  S.aiProv = prov;
  store.set('fye_ai', S.ai); updateHat(); render(); setMsg('Checking the key\u2026');
  loadModels().then(function (m) { if (current() === 'ai') { render(); setMsg(m); } });
}
async function askOnce(model, prompt, sys) {
  const x = S.ai.provider === 'xai';
  const res = x ? await xaiFetch('/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + S.ai.key }, body: JSON.stringify({ model: model, max_tokens: 2000, messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }] }) })
    : await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': S.ai.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: model, max_tokens: 800, system: sys, messages: [{ role: 'user', content: prompt }] }) });
  const j = await res.json().catch(function () { return null; });
  const em = j && j.error ? (typeof j.error === 'string' ? j.error : j.error.message) : '';
  if (!res.ok) {
    const e = new Error(res.status === 401 || /api key/i.test(em || '') ? 'Your AI provider rejected the key. Check it on the AI helper page.' : (em ? 'AI provider error: ' + em : 'The AI provider returned an error (' + res.status + ').'));
    e.model = res.status === 404 || (/model/i.test(em || '') && /not.?found|does not exist|invalid|not available|access|permission|unsupported/i.test(em || ''));
    throw e;
  }
  const out = x ? String((((j.choices || [])[0] || {}).message || {}).content || '') : (j.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
  if (!out.trim()) throw new Error('The AI returned an empty answer. Try again.');
  return out;
}
async function askAI(prompt, sys) {
  S.aiNote = '';
  try {
    const list = candidates().slice(0, 4);
    let last;
    for (let i = 0; i < list.length; i++) {
      try {
        const out = await askOnce(list[i], prompt, sys);
        if (S.ai && S.ai.used !== list[i]) { S.ai.used = list[i]; store.set('fye_ai', S.ai); const wm = $('wiz-model'); if (wm) wm.textContent = modelLabel(); }
        return out;
      } catch (e) { if (!e.model) throw e; last = e; }
    }
    throw new Error(S.ai.model === 'auto' ? 'None of the models tried are available on your account. Open Advanced on the AI helper page and pick one from the list.' : 'That model is not available on your account. Set the model back to Automatic on the AI helper page.' + (last ? ' (' + last.message + ')' : ''));
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    const sample = window.claude && window.claude.use ? await window.claude.use('sample') : null;
    if (!sample) throw new Error('Could not reach ' + PROVIDERS[S.ai.provider].name + ' from this page. Check your connection. If it keeps failing, this provider may be refusing requests sent straight from a browser.');
    let out;
    try { out = await sample(sys + '\n\n' + prompt, { cache: false }); }
    catch (err) { throw new Error(err && err.code === 'rate_limited' ? 'The preview AI is busy. Try again in a minute.' : 'The preview AI was not available for this page.'); }
    S.aiNote = 'Preview note: this preview page cannot reach outside services, so your key was not used. This answer came from the Claude built into the preview. On the live site your own key is used.';
    return out.text;
  }
}
function snapTime(t, def) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ''));
  if (!m) return def;
  const v = m[1].padStart(2, '0') + ':' + m[2];
  for (let i = 0; i < SYN_TIMES.length; i++) if (SYN_TIMES[i] >= v) return SYN_TIMES[i];
  return SYN_TIMES[SYN_TIMES.length - 1];
}
function applyAiStrategy(j) {
  const cl = function (x, lo, hi, def) { const n = Number(x); return isFinite(n) ? Math.min(Math.max(n, lo), hi) : def; }, s = S.strat;
  if (['legs', 'orb', 'ema', 'swing'].indexOf(j.kind) < 0) throw new Error('I could not turn that into a strategy this tool supports. Try describing the entry, the exit and the stop-loss.');
  s.kind = j.kind; s.name = String(j.name || 'My strategy').slice(0, 60);
  s.entry = snapTime(j.entry, '09:20'); s.exit = snapTime(j.exit, '15:15'); s.orbEnd = snapTime(j.orbEnd, '09:45');
  s.days = j.days === 'expiry' ? 'expiry' : 'all';
  s.lots = Math.round(cl(j.lots, 1, 50, 1)); s.sl = cl(j.sl, 0, 100, j.kind === 'swing' ? 3 : 30); s.target = cl(j.target, 0, 500, 0);
  s.fast = Math.round(cl(j.fast, 2, 100, 9)); s.slow = Math.round(cl(j.slow, 3, 300, 21)); s.lookN = Math.round(cl(j.lookN, 2, 200, 20)); s.exitM = Math.round(cl(j.exitM, 2, 200, 10));
  if (j.kind === 'legs') {
    const legs = (Array.isArray(j.legs) ? j.legs : []).filter(function (l) { return l && (l.action === 'buy' || l.action === 'sell') && (l.type === 'call' || l.type === 'put'); }).slice(0, 8).map(function (l) { return { action: l.action === 'buy' ? 'buy' : 'sell', type: l.type === 'put' ? 'put' : 'call', offset: Math.round(cl(l.offset, -10, 10, 0)), lots: Math.round(cl(l.lots, 1, 50, 1)), sl: cl(l.sl, 0, 500, 0), target: cl(l.target, 0, 500, 0) }; });
    if (!legs.length) throw new Error('The description did not include any option legs I could use.');
    s.legs = legs;
  }
  S.tpl = '';
  const bad = validate(); if (bad) throw new Error('I built it, but one setting needs fixing: ' + bad);
}
function openWizard() { if (!S.ai) { location.hash = 'ai'; return; } closeExplain(); $('wizard').hidden = false; $('wiz-model').textContent = modelLabel(); $('wiz-report').disabled = !S.result; $('wiz-close').focus(); }
function closeWizard() { $('wizard').hidden = true; }
async function wizRun(kind) {
  const out = $('wiz-out'), note = $('wiz-note'), s = S.strat;
  let prompt, sys = AI_SYS;
  track({ t: 'ai', a: kind, p: S.ai ? S.ai.provider : '' });
  if (kind === 'build') {
    const text = $('wiz-text').value.trim();
    if (!text) { out.textContent = 'Describe the strategy first, for example: sell a strangle at 9:30 with a 40% stop and exit at 3 pm.'; return; }
    sys = 'You convert a plain-English description of an intraday index options strategy, or a multi-day index futures swing strategy, into JSON for a practice simulator. Reply with one JSON object and nothing else. Do not judge or recommend the strategy.';
    prompt = 'Fields: kind ("legs" for fixed-time option legs, "orb" for opening range breakout buying an option, "ema" for moving-average crossover buying an option, "swing" for multi-day futures breakout); name (short); entry and exit as "HH:MM" 24-hour between 09:20 and 15:30; days ("all" or "expiry"); for kind legs: legs, an array of up to 8 objects {action:"buy"|"sell", type:"call"|"put", offset: whole strike steps from at-the-money between -10 and 10 (positive is a higher strike), lots: whole number, sl: stop-loss percent of premium or 0 for none, target: percent or 0}; for orb: orbEnd "HH:MM", sl, target, lots; for ema: fast, slow (bars), sl, target, lots; for swing: lookN (breakout lookback days), exitM (exit lookback days), sl (percent of price), lots. Use sensible defaults for anything not stated.\n\nDescription: ' + text;
  } else if (kind === 'explain') {
    prompt = 'Explain this practice strategy to a beginner: what it does, how it can gain, how it can lose, and which settings matter most. Lot size ' + s.lotSize + '. Rules: ' + rulesWords();
  } else if (kind === 'report') {
    if (!S.result) { out.textContent = 'Run a simulation first, then I can explain the report.'; return; }
    const r = S.result.res, c = S.result.checks;
    prompt = 'Explain to a beginner what these simulation results show and what they do not show. Data: ' + (S.result.kind === 'synthetic' ? 'synthetic practice prices, not real market data' : 'the user\u2019s own price file with modelled option premiums') + '. Rules: ' + S.result.words + ' Results in rupees: after costs ' + Math.round(r.net) + ', before costs ' + Math.round(r.gross) + ', total costs ' + Math.round(r.totalCost) + ', maximum drawdown ' + Math.round(r.maxDD) + ', trades ' + r.trades + ', winning trades ' + r.wins + ', trades stopped out ' + r.stopped + (r.trades ? '. With costs 50% higher the result would be ' + Math.round(c.cost150) + '. Small setting changes move the result between ' + Math.round(c.sensMin) + ' and ' + Math.round(c.sensMax) + '. The five best days made ' + Math.round(c.top5Share * 100) + '% of winning-day profit.' : '.');
  } else {
    const q = $('wiz-q').value.trim();
    if (!q) { out.textContent = 'Type a question first.'; return; }
    prompt = 'Question from a learner: ' + q + '\n\nFor context, their current practice strategy is: ' + rulesWords();
  }
  out.textContent = 'The cat is thinking\u2026'; note.textContent = '';
  document.querySelectorAll('#wizard button[data-act^="wiz-"]').forEach(function (b) { if (b.id !== 'wiz-close') b.disabled = true; });
  try {
    const text = await askAI(prompt, sys);
    if (kind === 'build') {
      const m = /\{[\s\S]*\}/.exec(text);
      if (!m) throw new Error('The AI did not return a strategy. Try describing it differently.');
      let j; try { j = JSON.parse(m[0]); } catch (e) { throw new Error('The AI returned something I could not read. Try again.'); }
      applyAiStrategy(j);
      out.textContent = 'Done. I filled in the builder for you. Check every setting before you run it:\n\n' + rulesWords();
      if (current() === 'build') render(); else location.hash = 'build';
    } else out.textContent = ADVICE.test(text) ? 'That answer looked like trading advice, so I have hidden it. Try asking how something works instead.' : text.trim();
    note.textContent = S.aiNote || '';
  } catch (e) { out.textContent = e && e.message ? e.message : 'Something went wrong. Try again.'; }
  document.querySelectorAll('#wizard button[data-act^="wiz-"]').forEach(function (b) { b.disabled = false; });
  $('wiz-report').disabled = !S.result;
}
S.ai = store.get('fye_ai'); if (!S.ai || !S.ai.key) S.ai = null; else { if (!PROVIDERS[S.ai.provider]) S.ai.provider = 'anthropic'; if (S.ai.v !== 2) { S.ai.v = 2; S.ai.model = 'auto'; S.ai.used = null; store.set('fye_ai', S.ai); } }
updateHat();
document.querySelectorAll('.site').forEach(function (n) { n.textContent = SITE; });
setTheme(store.get('fye_theme') === 'light' ? 'light' : 'dark');
render();
startGuide(false);
