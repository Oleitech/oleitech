// Guards the coupling the README warns about: the runner must fetch stats for
// every fixture the worker's quick filter will ask about. When it does not, the
// worker falls back to a direct API call from the Cloudflare IP, that call is
// refused, and the strategy evaluates with stats=null — a silent no-alert.
//
// Run: node relay/filter-parity.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// Pull isInteresting straight out of the runner so this tests the real code.
function extract(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${name} not found`);
  let depth = 0, i = source.indexOf('{', start);
  const open = i;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) break;
  }
  return new Function(`return function ${name}${source.slice(source.indexOf('(', start), open)}${source.slice(open, i + 1)}`)();
}

const relaySrc = readFileSync(join(root, 'relay/relay.mjs'), 'utf8');
const relayIsInteresting = extract(relaySrc, 'isInteresting');

// worker/index.js:1810-1814. Inline in a loop, so it is transcribed here and the
// transcription is fingerprinted below — if the worker filter changes, this test
// fails loudly instead of drifting silently.
const WORKER_FILTER_LINES = [
  'let interesting = false;',
  "if (hg === 0 && ag === 0 && (status === 'HT' || status === '2H')) interesting = true;",
  "if (hg === 1 && ag === 1 && (status === 'HT' || (status === '2H' && elapsed <= 55))) interesting = true;",
  'if ((hg > 0) !== (ag > 0) && elapsed >= 50 && elapsed <= 75) interesting = true;',
  "if (status === '2H' && elapsed >= 70) interesting = true;",
];
function workerInteresting(hg, ag, status, elapsed) {
  let interesting = false;
  if (hg === 0 && ag === 0 && (status === 'HT' || status === '2H')) interesting = true;
  if (hg === 1 && ag === 1 && (status === 'HT' || (status === '2H' && elapsed <= 55))) interesting = true;
  if ((hg > 0) !== (ag > 0) && elapsed >= 50 && elapsed <= 75) interesting = true;
  if (status === '2H' && elapsed >= 70) interesting = true;
  return interesting;
}

const failures = [];

// 1. The transcription above must still match the deployed worker.
const workerSrc = readFileSync(join(root, 'worker/index.js'), 'utf8');
const normalized = workerSrc.replace(/\s+/g, ' ');
for (const line of WORKER_FILTER_LINES) {
  if (!normalized.includes(line.replace(/\s+/g, ' '))) {
    failures.push(`worker quick filter changed — this line is no longer in worker/index.js:\n    ${line}`);
  }
}

// 2. Coverage: worker wants it => runner must have fetched it.
const gaps = [];
for (const status of ['1H', 'HT', '2H']) {
  for (let elapsed = 1; elapsed <= 95; elapsed++) {
    if (status === '1H' && elapsed > 45) continue;
    if (status === 'HT' && elapsed !== 45) continue;
    if (status === '2H' && elapsed < 46) continue;
    for (let hg = 0; hg <= 4; hg++) {
      for (let ag = 0; ag <= 4; ag++) {
        const f = { fixture: { status: { short: status, elapsed } }, goals: { home: hg, away: ag } };
        if (workerInteresting(hg, ag, status, elapsed) && !relayIsInteresting(f)) {
          gaps.push(`${hg}-${ag} ${status} ${elapsed}'`);
        }
      }
    }
  }
}
if (gaps.length) {
  failures.push(`runner skips ${gaps.length} states the worker asks about; each one is a [RELAY-MISS].\n    first 10: ${gaps.slice(0, 10).join(' | ')}`);
}

// 3. The states each strategy can actually fire in must all be covered.
const strategies = {
  'OVER 1.5 HT': (hg, ag, st, el) => hg === 0 && ag === 0 && (st === 'HT' || (st === '2H' && el <= 50)),
  'BTTS LIVE': (hg, ag, st, el) => ((hg > 0) !== (ag > 0)) && Math.abs(hg - ag) <= 2 && st === '2H' && el >= 50 && el <= 70,
  // worker/index.js:1150 — favourite losing by exactly one, 30'-78'. Note it does
  // NOT require that only one team has scored: 1-2 and 2-1 qualify.
  'FAVORITO A PERDER': (hg, ag, st, el) => el >= 30 && el <= 78 && Math.abs(hg - ag) === 1,
};
for (const [name, fires] of Object.entries(strategies)) {
  const dead = [];
  for (const status of ['1H', 'HT', '2H']) {
    for (let elapsed = 1; elapsed <= 95; elapsed++) {
      if (status === '1H' && elapsed > 45) continue;
      if (status === 'HT' && elapsed !== 45) continue;
      if (status === '2H' && elapsed < 46) continue;
      for (let hg = 0; hg <= 4; hg++) {
        for (let ag = 0; ag <= 4; ag++) {
          if (!fires(hg, ag, status, elapsed)) continue;
          if (!workerInteresting(hg, ag, status, elapsed)) continue; // worker-side gap, tracked separately
          const f = { fixture: { status: { short: status, elapsed } }, goals: { home: hg, away: ag } };
          if (!relayIsInteresting(f)) dead.push(`${hg}-${ag} ${status} ${elapsed}'`);
        }
      }
    }
  }
  if (dead.length) {
    failures.push(`${name}: ${dead.length} firing states get no stats from the runner.\n    first 10: ${dead.slice(0, 10).join(' | ')}`);
  }
}

if (failures.length) {
  console.error(`FAIL — ${failures.length} problem(s)\n`);
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}\n`));
  process.exit(1);
}
console.log('PASS — runner covers every state the worker quick filter asks about.');
