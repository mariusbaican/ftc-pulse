#!/usr/bin/env node

/**
 * Automated Network Deserialization & Contract Verification Script
 * Validates all 7 Flask REST endpoints against TypeScript contracts in src/types/api.ts.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_PORT = 5050;
const BASE_URL = (process.env.API_URL || `http://127.0.0.1:${DEFAULT_PORT}`).replace(/\/+$/, '');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

let serverProcess = null;
let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition, message) {
  totalAssertions++;
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  passedAssertions++;
}

async function isServerRunning() {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServerRunning() {
  const running = await isServerRunning();
  if (running) {
    console.log(`${colors.cyan}ℹ Connected to running server at ${BASE_URL}${colors.reset}\n`);
    return;
  }

  console.log(`${colors.yellow}⚡ Server not running at ${BASE_URL}. Auto-starting local Flask server...${colors.reset}`);

  // Resolve Python binary and server entrypoint
  const rootDir = resolve(__dirname, '../..');
  const venvPython = resolve(rootDir, 'server/.venv/bin/python');
  const serverScript = resolve(rootDir, 'server/app.py');

  const pythonBin = existsSync(venvPython) ? venvPython : 'python3';

  serverProcess = spawn(pythonBin, [serverScript], {
    cwd: resolve(rootDir, 'server'),
    env: { ...process.env, FTC_USE_CACHED_SNAPSHOT: '1' },
    stdio: 'ignore',
  });

  serverProcess.on('error', (err) => {
    console.error(`${colors.red}Failed to spawn server process: ${err.message}${colors.reset}`);
  });

  // Poll until ready or timeout after 10 seconds
  const startTime = Date.now();
  while (Date.now() - startTime < 10000) {
    await new Promise((r) => setTimeout(r, 300));
    if (await isServerRunning()) {
      console.log(`${colors.green}✔ Flask server spawned and listening on ${BASE_URL}${colors.reset}\n`);
      return;
    }
  }

  throw new Error(`Flask server failed to start within 10s at ${BASE_URL}. Run 'python server/app.py' manually.`);
}

function cleanup() {
  if (serverProcess && !serverProcess.killed) {
    console.log(`\n${colors.dim}Shutting down auto-started Flask server...${colors.reset}`);
    serverProcess.kill('SIGTERM');
  }
}

process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(143);
});

// ============================================================================
// Endpoint Contract Test Suites
// ============================================================================

async function test1_Health() {
  console.log(`${colors.bold}1. Testing GET /api/health${colors.reset}`);
  const res = await fetch(`${BASE_URL}/api/health`);
  assert(res.status === 200, `HTTP status 200 (received ${res.status})`);

  const data = await res.json();
  assert(data.status === 'ok', `status === 'ok' (received ${data.status})`);
  assert(data.season === 2025, `season === 2025 (received ${data.season})`);
  assert(data.targetTeam === 15996, `targetTeam === 15996 (received ${data.targetTeam})`);
  assert(typeof data.dataSource === 'string', `typeof dataSource is string (${data.dataSource})`);
  assert(typeof data.fetchedAt === 'string', `typeof fetchedAt is string (${data.fetchedAt})`);
  assert(typeof data.eventsCount === 'number' && data.eventsCount >= 14, `eventsCount >= 14 (${data.eventsCount})`);

  console.log(`   ${colors.green}✔ GET /api/health matches HealthResponse contract.${colors.reset}\n`);
}

async function test2_TeamSearchMatches() {
  console.log(`${colors.bold}2. Testing GET /api/teams?query=15996${colors.reset}`);
  const res = await fetch(`${BASE_URL}/api/teams?query=15996`);
  assert(res.status === 200, `HTTP status 200 (received ${res.status})`);

  const data = await res.json();
  assert(data.query === '15996', `query === '15996'`);
  assert(data.count === 1, `count === 1 (received ${data.count})`);
  assert(Array.isArray(data.teams), `teams is Array`);
  assert(data.teams.length === 1, `teams.length === 1`);
  assert(data.pocNotice === null, `pocNotice === null`);

  const team = data.teams[0];
  assert(team.teamNumber === 15996, `teamNumber === 15996`);
  assert(team.nameShort === 'BrickBot', `nameShort === 'BrickBot' (received ${team.nameShort})`);
  assert(typeof team.rookieYear === 'number', `typeof rookieYear is number (${team.rookieYear})`);
  assert(typeof team.city === 'string', `typeof city is string`);
  assert(typeof team.country === 'string', `typeof country is string`);

  console.log(`   ${colors.green}✔ GET /api/teams?query=15996 matches TeamSearchResponse contract.${colors.reset}\n`);
}

async function test3_TeamSearchNonMatching() {
  console.log(`${colors.bold}3. Testing GET /api/teams?query=99999${colors.reset}`);
  const res = await fetch(`${BASE_URL}/api/teams?query=99999`);
  assert(res.status === 200, `HTTP status 200 (received ${res.status})`);

  const data = await res.json();
  assert(data.count === 0, `count === 0 (received ${data.count})`);
  assert(Array.isArray(data.teams) && data.teams.length === 0, `teams is empty array`);
  assert(typeof data.pocNotice === 'string', `typeof pocNotice === 'string'`);
  assert(data.pocNotice.includes('proof of concept'), `pocNotice mentions proof of concept`);

  console.log(`   ${colors.green}✔ GET /api/teams?query=99999 matches PoC empty response contract.${colors.reset}\n`);
}

async function test4_SeasonSummary() {
  console.log(`${colors.bold}4. Testing GET /api/teams/15996/season-summary${colors.reset}`);
  const res = await fetch(`${BASE_URL}/api/teams/15996/season-summary`);
  assert(res.status === 200, `HTTP status 200 (received ${res.status})`);

  const data = await res.json();
  assert(data.teamNumber === 15996, `teamNumber === 15996`);
  assert(data.season === 2026 || data.season === 2025, `season === 2026 or 2025 (received ${data.season})`);

  // Record contract
  const rec = data.record;
  assert(typeof rec === 'object' && rec !== null, `record object present`);
  assert(typeof rec.wins === 'number', `record.wins is number`);
  assert(typeof rec.losses === 'number', `record.losses is number`);
  assert(typeof rec.ties === 'number', `record.ties is number`);
  assert(typeof rec.winRate === 'number', `record.winRate is number`);
  assert(typeof rec.matchesPlayed === 'number', `record.matchesPlayed is number`);
  assert(rec.wins + rec.losses + rec.ties === rec.matchesPlayed, `W + L + T === matchesPlayed (${rec.matchesPlayed})`);

  // Global OPR contract
  const opr = data.globalOpr;
  assert(typeof opr === 'object' && opr !== null, `globalOpr object present`);
  assert(typeof opr.totalOpr === 'number', `globalOpr.totalOpr is number (${opr.totalOpr})`);
  assert(typeof opr.autoOpr === 'number', `globalOpr.autoOpr is number (${opr.autoOpr})`);
  assert(typeof opr.teleopOpr === 'number', `globalOpr.teleopOpr is number (${opr.teleopOpr})`);
  assert(typeof opr.endgameOpr === 'number', `globalOpr.endgameOpr is number (${opr.endgameOpr})`);

  // Period Averages contract
  const avg = data.periodAverages;
  assert(typeof avg === 'object' && avg !== null, `periodAverages object present`);
  assert(typeof avg.autoAvg === 'number', `periodAverages.autoAvg is number`);
  assert(typeof avg.teleopAvg === 'number', `periodAverages.teleopAvg is number`);
  assert(typeof avg.endgameAvg === 'number', `periodAverages.endgameAvg is number`);
  assert(typeof avg.totalAvg === 'number', `periodAverages.totalAvg is number`);

  // Best Match contract
  assert(typeof data.bestMatch === 'object' && data.bestMatch !== null, `bestMatch object present`);
  assert(typeof data.bestMatch.score === 'number', `bestMatch.score is number (${data.bestMatch.score})`);
  assert(typeof data.bestMatch.eventName === 'string', `bestMatch.eventName is string`);

  // Events Array contract
  assert(Array.isArray(data.events) && data.events.length > 0, `events is non-empty array`);
  assert(
    data.events[0].eventCode === '2025_mock_championship',
    `First event in list is '2025_mock_championship' (received ${data.events[0].eventCode})`
  );
  assert(typeof data.events[0].totalOpr === 'number', `events[0].totalOpr is number`);
  assert(typeof data.events[0].record === 'string', `events[0].record is string`);

  console.log(`   ${colors.green}✔ GET /api/teams/15996/season-summary matches SeasonSummaryResponse contract.${colors.reset}\n`);
}

async function test5_EventDetailsRoelt() {
  console.log(`${colors.bold}5. Testing GET /api/events/ROELT/details${colors.reset}`);
  const res = await fetch(`${BASE_URL}/api/events/ROELT/details`);
  assert(res.status === 200, `HTTP status 200 (received ${res.status})`);

  const data = await res.json();

  // Event metadata
  assert(typeof data.event === 'object' && data.event !== null, `event metadata present`);
  assert(data.event.code === 'ROELT', `event.code === 'ROELT'`);
  assert(typeof data.event.name === 'string', `event.name is string`);
  assert(data.event.status === 'COMPLETED', `event.status === 'COMPLETED'`);

  // Event stats
  assert(typeof data.stats === 'object' && data.stats !== null, `stats object present`);
  assert(data.stats.teamNumber === 15996, `stats.teamNumber === 15996`);
  assert(typeof data.stats.opr === 'object' && data.stats.opr !== null, `stats.opr present`);
  assert(typeof data.stats.opr.totalOpr === 'number', `stats.opr.totalOpr is number`);
  assert(typeof data.stats.averages === 'object' && data.stats.averages !== null, `stats.averages present`);
  assert(typeof data.stats.averages.totalAvg === 'number', `stats.averages.totalAvg is number`);

  // Matches schedule
  assert(Array.isArray(data.matches) && data.matches.length > 0, `matches is non-empty array`);
  const m = data.matches[0];
  assert(typeof m.matchId === 'string', `matchId is string`);
  assert(typeof m.description === 'string', `description is string`);
  assert(Array.isArray(m.redAlliance), `redAlliance is array`);
  assert(Array.isArray(m.blueAlliance), `blueAlliance is array`);

  console.log(`   ${colors.green}✔ GET /api/events/ROELT/details matches EventDetailsResponse contract.${colors.reset}\n`);
}

async function test6_EventDetailsMockChampionship() {
  console.log(`${colors.bold}6. Testing GET /api/events/2025_mock_championship/details${colors.reset}`);
  const res = await fetch(`${BASE_URL}/api/events/2025_mock_championship/details`);
  assert(res.status === 200, `HTTP status 200 (received ${res.status})`);

  const data = await res.json();
  assert(data.event.code === '2025_mock_championship', `event.code === '2025_mock_championship'`);
  assert(data.event.status === 'IN_PROGRESS', `event.status === 'IN_PROGRESS'`);

  // Check activeAlert field presence
  assert('activeAlert' in data, `activeAlert field exists in event payload`);

  // Check matches contain COMPLETED, QUEUED, and UPCOMING statuses
  assert(Array.isArray(data.matches) && data.matches.length > 0, `matches list non-empty`);
  const statuses = new Set(data.matches.map((match) => match.status));
  assert(statuses.has('COMPLETED'), `matches contain 'COMPLETED' status`);
  assert(statuses.has('QUEUED'), `matches contain 'QUEUED' status`);
  assert(statuses.has('UPCOMING'), `matches contain 'UPCOMING' status`);

  console.log(`   ${colors.green}✔ GET /api/events/2025_mock_championship/details matches in-progress contract with all match statuses.${colors.reset}\n`);
}

async function test7_AlertLifecycle() {
  console.log(`${colors.bold}7. Testing Alert Lifecycle (POST trigger -> GET current -> POST clear)${colors.reset}`);

  // 1. Clear any prior alert
  const clearPre = await fetch(`${BASE_URL}/api/mock/clear-alert`, { method: 'POST' });
  assert(clearPre.status === 200, `POST /api/mock/clear-alert status 200`);

  // 2. Trigger new queue alert
  const triggerBody = {
    matchNumber: 'QM-24',
    field: 'Field Alpha',
    alliance: 'Red',
    estimatedTime: '14:30',
  };
  const triggerRes = await fetch(`${BASE_URL}/api/mock/trigger-queue-alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(triggerBody),
  });
  assert(triggerRes.status === 201, `POST /api/mock/trigger-queue-alert status 201`);

  const triggerData = await triggerRes.json();
  assert(triggerData.active === true, `active === true after trigger`);
  assert(typeof triggerData.alert === 'object' && triggerData.alert !== null, `alert object present`);
  assert(triggerData.alert.teamNumber === 15996, `alert.teamNumber === 15996`);
  assert(triggerData.alert.matchNumber === 'QM-24', `alert.matchNumber === 'QM-24'`);
  assert(triggerData.alert.field === 'Field Alpha', `alert.field === 'Field Alpha'`);
  assert(triggerData.alert.alliance === 'Red', `alert.alliance === 'Red'`);
  assert(typeof triggerData.alert.alertId === 'number', `alert.alertId is number`);
  const alertId = triggerData.alert.alertId;

  // 3. Poll current alert
  const currRes = await fetch(`${BASE_URL}/api/mock/current-alert`);
  assert(currRes.status === 200, `GET /api/mock/current-alert status 200`);
  const currData = await currRes.json();
  assert(currData.active === true, `current alert active === true`);
  assert(currData.alert.alertId === alertId, `current alert matches triggered alertId (${alertId})`);
  assert(currData.alert.matchNumber === 'QM-24', `current alert matchNumber === 'QM-24'`);

  // 4. Clear alert
  const clearRes = await fetch(`${BASE_URL}/api/mock/clear-alert`, { method: 'POST' });
  assert(clearRes.status === 200, `POST /api/mock/clear-alert status 200`);
  const clearData = await clearRes.json();
  assert(clearData.active === false, `clear alert active === false`);
  assert(clearData.alert === null, `clear alert payload is null`);

  // 5. Verify current alert is now inactive
  const currAfter = await fetch(`${BASE_URL}/api/mock/current-alert`);
  assert(currAfter.status === 200, `GET /api/mock/current-alert status 200`);
  const currAfterData = await currAfter.json();
  assert(currAfterData.active === false, `alert is inactive after clearing`);
  assert(currAfterData.alert === null, `alert payload is null after clearing`);

  console.log(`   ${colors.green}✔ Alert lifecycle (trigger -> current -> clear) fully verified.${colors.reset}\n`);
}

// ============================================================================
// Main Execution
// ============================================================================

async function run() {
  console.log(`\n${colors.bold}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  FTC Pulse: Mobile API Client Contract Verification${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}\n`);

  try {
    await ensureServerRunning();

    await test1_Health();
    await test2_TeamSearchMatches();
    await test3_TeamSearchNonMatching();
    await test4_SeasonSummary();
    await test5_EventDetailsRoelt();
    await test6_EventDetailsMockChampionship();
    await test7_AlertLifecycle();

    console.log(`${colors.bold}${colors.green}====================================================${colors.reset}`);
    console.log(
      `${colors.bold}${colors.green}✔ ALL 7 API CONTRACT TEST SUITES PASSED! (${passedAssertions}/${totalAssertions} assertions verified)${colors.reset}`
    );
    console.log(`${colors.bold}${colors.green}====================================================${colors.reset}\n`);
    process.exit(0);
  } catch (err) {
    console.error(`\n${colors.bold}${colors.red}✖ VERIFICATION FAILED:${colors.reset} ${err.message}\n`);
    process.exit(1);
  }
}

run();
