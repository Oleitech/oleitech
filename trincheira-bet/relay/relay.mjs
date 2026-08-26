#!/usr/bin/env node
// Trincheira Bet — live scan relay runner.
//
// API-Sports applies IP-level protections and Cloudflare Workers egress from
// shared IPs, so only about one scheduled tick in five was getting through —
// useless for live alerts whose windows last minutes. Support confirmed the
// protection cannot be lifted and recommended a stable outbound IP. This runner
// does the API fetching from this machine's home IP (verified working: 298/300
// per-minute allowance, full rate-limit headers) and hands the payloads to the
// worker, which still owns every strategy.
//
// Required env: API_KEY, WORKER_URL, ADMIN_TOKEN

const API_HOST = 'v3.football.api-sports.io';
const API_KEY = process.env.API_KEY;
const WORKER_URL = (process.env.WORKER_URL || '').replace(/\/$/, '');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

for (const [name, value] of Object.entries({ API_KEY, WORKER_URL, ADMIN_TOKEN })) {
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
}

// Mirrors cachedFetch/fetchAPI's key format in worker/index.js. Both sides must
// agree exactly or every lookup turns into a RELAY-MISS.
function relayKey(endpoint, params) {
  const parts = Object.keys(params).sort().map(k => `${k}=${params[k]}`);
  return parts.length ? `${endpoint}?${parts.join('&')}` : endpoint;
}

const bundle = {};
let apiCalls = 0;
// Read from x-ratelimit-requests-remaining. Running the daily budget dry would
// recreate the exact blackout this relay exists to fix, so spend degrades in
// stages rather than stopping dead: predictions go first, then the per-fixture
// stats, and the live poll plus pending resolution are kept to the very end.
let dailyRemaining = null;

// Predictions are the wrong thing to sacrifice: all three live strategies require
// them, they are cached 3h server-side, and they are a handful of calls per run.
// The real cost is stats+events, at two calls per interesting fixture per run.
// So a tight budget shrinks how many fixtures we watch, and never the predictions
// — degrading coverage rather than silently disabling every strategy at once.
// Budget pacing.
//
// Two lessons paid for in lost nights. First (2026-08-18): an uncapped scan
// spends 140 calls per run in European prime time and drains 7500 before
// midnight. Second (2026-08-19): live football runs somewhere at every hour, so
// an unpaced daytime scan of Asian fixtures burned 7029 of 7500 by 18:00 and
// left nothing for the matches that matter.
//
// A fixed "reserve the evening" rule fixes neither, because the valuable window
// is not a constant: a Wednesday concentrates on 18h-24h, a Saturday runs from
// 12h30 to 23h and would need 8250 calls at full cap. So instead of hardcoding
// hours, spend is paced against how much of the active window is left — which
// self-adjusts to weekends, midweek European nights and quiet Mondays alike.
const WINDOW_START_HOUR = 11;   // Lisbon; before this, Betclic-relevant football is rare
const WINDOW_END_HOUR = 1;      // next day, covers late South American kickoffs
// Medidos por regressao sobre 1376 scans reais (21/08/2026): o custo observado e
// 2,7 fixas + 2,56 por fixture, nao 3 + 2. O CALLS_PER_FIXTURE ignorava as
// predictions e o RUN_OVERHEAD ainda nao contava o odds/live. Subestimar o custo
// faz o interestingBudget prometer mais do que o orcamento aguenta, que foi como
// a 19/08 o cap chegou a 0 a meio da noite.
const CALLS_PER_FIXTURE = 3;    // statistics + events + predictions amortizadas
const RUN_OVERHEAD = 4;         // live poll + manifest + odds/live + folga

function lisbonParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Lisbon',
  }).formatToParts(d);
  const get = t => parseInt(f.find(p => p.type === t).value, 10);
  return { hour: get('hour'), minute: get('minute') };
}

function inActiveWindow({ hour }) {
  return hour >= WINDOW_START_HOUR || hour < WINDOW_END_HOUR;
}

// Runs left before the window closes, at one run every two minutes.
function runsLeftInWindow({ hour, minute }) {
  const nowMin = hour * 60 + minute;
  const endMin = WINDOW_END_HOUR * 60;
  const minutesLeft = hour < WINDOW_END_HOUR
    ? endMin - nowMin                 // already past midnight
    : (24 * 60 - nowMin) + endMin;    // wrap through midnight
  return Math.max(1, Math.floor(minutesLeft / 2));
}

function interestingBudget(remaining, parts) {
  if (remaining === null) return MAX_INTERESTING_PER_RUN;
  const perRun = remaining / runsLeftInWindow(parts);
  const affordable = Math.floor((perRun - RUN_OVERHEAD) / CALLS_PER_FIXTURE);
  return Math.max(0, Math.min(MAX_INTERESTING_PER_RUN, affordable));
}

// Emergency lever: ration a nearly-empty budget onto specific fixtures instead of
// spreading it across the whole world. Format is `YYYY-MM-DD:id,id,id` and it is
// ignored once that date passes — a forgotten focus set on 2026-08-18 left the
// scanner filtering for three finished matches for two days, watching nothing
// while reporting itself healthy. An emergency lever that cannot expire is a
// silent kill switch.
function parseFocus(raw, todayISO) {
  if (!raw) return [];
  const [datePart, idsPart] = raw.includes(':') ? raw.split(':') : [null, raw];
  if (!datePart) {
    console.error('[warn] FOCUS_FIXTURES sem data (formato YYYY-MM-DD:ids) — ignorado');
    return [];
  }
  if (datePart.trim() !== todayISO) {
    console.error(`[warn] FOCUS_FIXTURES expirado (${datePart.trim()} != ${todayISO}) — ignorado`);
    return [];
  }
  return (idsPart || '').split(',').map(x => x.trim()).filter(Boolean).map(Number);
}

const TODAY_LISBON = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const FOCUS = parseFocus(process.env.FOCUS_FIXTURES, TODAY_LISBON);
if (FOCUS.length) console.error(`[warn] FOCUS ACTIVO: ${FOCUS.length} jogos — o scanner ignora todos os outros`);

async function apiFetch(endpoint, params) {
  const url = new URL(`https://${API_HOST}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  // A 429 here is real quota, not the IP throttling we are working around, so a
  // short backoff is enough.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'x-apisports-key': API_KEY } });
    const json = await res.json();
    apiCalls++;
    const rem = res.headers.get('x-ratelimit-requests-remaining');
    if (rem !== null) dailyRemaining = parseInt(rem, 10);
    const errs = json?.errors;
    const hasError = errs && (Array.isArray(errs) ? errs.length > 0 : Object.keys(errs).length > 0);
    if (!hasError || attempt >= 2) {
      if (hasError) console.error(`[api-error] ${endpoint} ${JSON.stringify(errs)}`);
      bundle[relayKey(endpoint, params)] = json;
      return json;
    }
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
}

async function worker(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method,
    headers: {
      'X-Admin-Token': ADMIN_TOKEN,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// Kept in sync with the "Quick filter" block in handleScheduled. If the runner
// prefetches less than the worker asks for, the worker falls back to its own
// (throttled) fetch and we are back where we started.
// Narrowed to the states the three surviving strategies can actually fire from.
// The worker's own gate is wider because it still carries branches written for
// Cartao Vermelho, Favorito 2H and Cantos Tardios — all removed. Fetching for a
// 1-1 scoreline, or for every match simply because it passed the 70th minute,
// buys data no strategy reads: at 72 fixtures live that was 45 "interesting"
// matches and 140 calls, for nothing. A few small buffers absorb the two-minute
// polling gap so a window is not missed by a minute.
// Mirrors the worker's quick filter (worker/index.js:1810-1814) rule for rule.
// It must stay a superset of it: any fixture the worker calls interesting but the
// runner did not fetch becomes a [RELAY-MISS], and the worker then retries from the
// Cloudflare IP — which API-Sports refuses — so the strategy evaluates with
// stats=null and can never fire. That is how FAVORITO A PERDER went quiet for every
// both-teams-scored scoreline. relay/filter-parity.test.mjs enforces the parity.
function isInteresting(f) {
  const status = f.fixture.status.short;
  const elapsed = f.fixture.status.elapsed || 0;
  const hg = f.goals.home ?? 0;
  const ag = f.goals.away ?? 0;

  // OVER xG 0-0 — goalless at the break or anywhere in the second half
  if (hg === 0 && ag === 0 && (status === 'HT' || status === '2H')) return true;
  // 1-1 at the break or early in the second half
  if (hg === 1 && ag === 1 && (status === 'HT' || (status === '2H' && elapsed <= 55))) return true;
  // BTTS LIVE — one side scored, second half 50-75'
  if ((hg > 0) !== (ag > 0) && elapsed >= 50 && elapsed <= 75) return true;
  // FAVORITO A PERDER late window — any scoreline from 70', both-scored included
  if (status === '2H' && elapsed >= 70) return true;
  return false;
}

// Union of the worker's pre-warm and BTTS-eligible conditions: both end up
// calling getMatchPredictions, which falls through to fetchAPI on a cache miss.
function needsPredictions(f) {
  const status = f.fixture.status.short;
  const elapsed = f.fixture.status.elapsed || 0;
  const hg = f.goals.home ?? 0;
  const ag = f.goals.away ?? 0;
  const asymmetric = (hg > 0) !== (ag > 0) && Math.abs(hg - ag) < 3;
  if (!asymmetric) return false;
  if (status === 'HT') return true;
  if (status === '2H' && elapsed >= 45 && elapsed <= 75) return true;
  return false;
}

// A European evening puts 70+ fixtures in play and the worker's gate calls 45 of
// them "interesting" — 140 API calls in a single run, which drained a 7500/day
// budget before midnight on 2026-08-18 and silently disabled the strategies.
// The windows that can actually fire are narrow, so rank by proximity to one and
// keep only the top slice: spending the budget on the fixtures that can produce
// an alert beats spreading it thin over every match in progress.
// Subido de 10 para 60 a 21/08/2026, com a passagem ao plano Ultra (75.000/dia).
//
// O tecto nao e o orcamento: o interestingBudget ja divide o restante pelos scans
// que faltam, por isso trava-se sozinho. Isto e so o limite superior de quando ha
// folga. Contas para o pico de sabado (~393 jogos simultaneos apos country gate,
// dos quais 30-40% em janela de disparo = 118-157):
//   cap 60 -> 4 + 60*3 = 184 chamadas/scan
//   pico 6h a 2 min = 180 scans -> 33.120, mais ~7.200 fora de pico = ~40.000
//   ou seja ~54% das 75.000, com margem para o odds/live que ainda nao tem
//   historico e para um sabado de volume inedito.
//
// Cobre 60 dos 118-157 em janela, mas o triggerPriority ordena primeiro os que
// podem mesmo disparar, por isso o que cai fora e a cauda, nao o topo. Subir isto
// so com dados de consumo real de um sabado — prefiro sobrar orcamento a repetir
// o apagao das 21h de 19/08.
const MAX_INTERESTING_PER_RUN = 60;

function triggerPriority(f) {
  const status = f.fixture.status.short;
  const elapsed = f.fixture.status.elapsed || 0;
  const hg = f.goals.home ?? 0;
  const ag = f.goals.away ?? 0;
  const asymmetric = (hg > 0) !== (ag > 0);

  // BTTS LIVE — one side scored, 2H 50-70'
  if (asymmetric && status === '2H' && elapsed >= 50 && elapsed <= 70) return 0;
  // OVER xG 0-0 — goalless at the break or early in the second half. A janela
  // subiu de 50 para 55 a 26/08/2026 para acompanhar o worker; sem isto os
  // jogos aos 51-55' caiam para o fundo da fila e o cap de 60 podia corta-los.
  if (hg === 0 && ag === 0 && (status === 'HT' || (status === '2H' && elapsed <= 55))) return 1;
  // FAVORITO A PERDER — a one-goal deficit inside the comeback window. The worker
  // only requires the gap to be one goal, so 1-2 and 2-1 rank here too; gating this
  // on `asymmetric` used to push them to the bottom and drop them under the cap.
  if (Math.abs(hg - ag) === 1 && elapsed >= 30 && elapsed <= 78) return 2;
  return 3;
}

async function mapLimit(items, limit, fn) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      try { await fn(item); } catch (e) { console.error(`[warn] ${e.message}`); }
    }
  });
  await Promise.all(workers);
}

async function main() {
  const parts = lisbonParts();
  if (!inActiveWindow(parts)) {
    // Tell the worker we are alive but idle, so it does not mistake a planned
    // quiet period for the API being down and page the user every morning.
    await worker('/relay-heartbeat', { method: 'POST', body: {} }).catch(e =>
      console.error(`[warn] heartbeat failed: ${e.message}`));
    console.log(JSON.stringify({ skipped: 'outside active window', hour: parts.hour }));
    return;
  }

  const manifest = await worker('/relay-manifest');
  const allowedCountries = new Set(manifest.allowedCountries || []);
  const pendingIds = manifest.pendingFixtureIds || [];

  const live = await apiFetch('fixtures', { live: 'all' });
  const fixtures = live?.response || [];

  const candidates = fixtures.filter(f =>
    (allowedCountries.size === 0 || allowedCountries.has(f.league?.country)));

  const cap = interestingBudget(dailyRemaining, parts);
  const focused = FOCUS.length ? candidates.filter(f => FOCUS.includes(f.fixture.id)) : candidates;
  const allInteresting = focused.filter(isInteresting);
  const interesting = [...allInteresting]
    .sort((a, b) => triggerPriority(a) - triggerPriority(b))
    .slice(0, cap);
  const dropped = allInteresting.length - interesting.length;
  const predictionTargets = focused.filter(needsPredictions);

  // O worker chama odds/live ao disparar um alerta, para gravar o preco tomavel
  // no arquivo (sem ele so se consegue taxa de acerto, nunca ROI). Se este payload
  // faltar no bundle o worker cai no IP do Cloudflare, que a API-Sports recusa, e
  // as odds ficam sempre a null. E UMA chamada que cobre todos os jogos em play,
  // por isso so se omite quando nao ha candidatos nenhuns a avaliar.
  if (interesting.length) await apiFetch('odds/live', {});

  await mapLimit(interesting, 5, async (f) => {
    await apiFetch('fixtures/statistics', { fixture: f.fixture.id });
    await apiFetch('fixtures/events', { fixture: f.fixture.id });
  });

  await mapLimit(predictionTargets, 5, async (f) => {
    await apiFetch('predictions', { fixture: f.fixture.id });
  });

  // Pending alerts need their final result once the match drops out of the feed.
  const liveIds = new Set(fixtures.map(f => f.fixture.id));
  const toResolve = pendingIds.filter(id => !liveIds.has(id));
  await mapLimit(toResolve, 5, async (id) => {
    await apiFetch('fixtures', { id });
    await apiFetch('fixtures/statistics', { fixture: id });
    await apiFetch('fixtures/events', { fixture: id });
  });

  const result = await worker('/relay-run', { method: 'POST', body: { bundle } });

  console.log(JSON.stringify({
    live: fixtures.length,
    afterCountryGate: candidates.length,
    interesting: interesting.length,
    dropped,
    predictions: predictionTargets.length,
    resolving: toResolve.length,
    apiCalls,
    dailyRemaining,
    cap,
    runsLeft: runsLeftInWindow(parts),
    focus: FOCUS.length || null,
    bundleKeys: result?.keys,
  }));
}

main().catch(err => {
  console.error(err.stack || String(err));
  process.exit(1);
});
