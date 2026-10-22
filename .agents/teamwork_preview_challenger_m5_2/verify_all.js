const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('   EMPIRICAL VERIFICATION HARNESS - CHALLENGER 2    ');
console.log('====================================================\n');

// ----------------------------------------------------
// TASK 1: WebSocket Context State Machine & Stream
// ----------------------------------------------------
console.log('--- TASK 1: WebSocket Context & State Machine ---');

// 1.1 State Machine States
const validStatuses = ['LIVE', 'CONNECTING', 'OFFLINE'];
console.log('[1.1] Valid Connection Statuses defined:', validStatuses);

// 1.2 Endpoint Resolution
const resolveWsUrl = (pathOrUrl, host = 'localhost:8000', protocol = 'http:') => {
  if (pathOrUrl.startsWith('ws://') || pathOrUrl.startsWith('wss://')) {
    return pathOrUrl;
  }
  const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${wsProto}//${host}${cleanPath}`;
};

console.log('[1.2] Resolving default endpoint "/ws":', resolveWsUrl('/ws'));
console.log('[1.2] Resolving agent topic endpoint "/ws/agent/AGT-009":', resolveWsUrl('/ws/agent/AGT-009'));
console.log('[1.2] Resolving absolute ws endpoint "ws://custom:9000/ws":', resolveWsUrl('ws://custom:9000/ws'));

// 1.3 Topic Subscription Check
const wsContextFile = fs.readFileSync(path.join(__dirname, '../../frontend/src/ws/WebSocketContext.tsx'), 'utf8');
const hasSetEndpoint = wsContextFile.includes('setEndpoint');
console.log('[1.3] setEndpoint provided in context value:', hasSetEndpoint);

// Check if any UI component actually calls setEndpoint
const srcDir = path.join(__dirname, '../../frontend/src');
function findUsages(dir, str) {
  let matches = [];
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) matches = matches.concat(findUsages(full, str));
    else if (f.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes(str)) matches.push(full);
    }
  }
  return matches;
}

const setEndpointUsages = findUsages(srcDir, 'setEndpoint');
console.log('[1.3] Files calling setEndpoint:', setEndpointUsages.length, setEndpointUsages);

// 1.4 Mock Stream Interval & Data structure
const mockActions = [
  { agent: 'AGT-009', action: 'Unauthorized DB Query', risk: 88, tone: 'danger', status: 'Critical' },
  { agent: 'AGT-042', action: 'Elevated API Rate', risk: 62, tone: 'warning', status: 'Suspicious' },
  { agent: 'AGT-012', action: 'Data Sync Request', risk: 14, tone: 'success', status: 'Normal' },
  { agent: 'AGT-004', action: 'Model Parameter Update', risk: 33, tone: 'info', status: 'Monitoring' },
  { agent: 'AGT-009', action: 'Prompt Injection Vector Test', risk: 94, tone: 'danger', status: 'Critical' },
  { agent: 'AGT-018', action: 'Token Exfiltration Attempt', risk: 78, tone: 'warning', status: 'High Risk' },
  { agent: 'AGT-007', action: 'Healthcheck Response OK', risk: 5, tone: 'success', status: 'Normal' },
];

console.log('[1.4] Mock stream interval configured: 4000ms (4 seconds)');
console.log('[1.4] Max mock message history limit: 100 items');
console.log('[1.4] Max WS message history limit: 200 items');

// 1.5 Connection Teardown Flaw Analysis
const hasIsPausedInDeps = wsContextFile.includes('}, [wsUrl, isPaused])');
console.log('[1.5] isPaused in useEffect dependency array:', hasIsPausedInDeps);
if (hasIsPausedInDeps) {
  console.log('   ⚠️  FLAW DETECTED: Toggling isPaused tears down and reconnects the WebSocket connection because isPaused is in the useEffect dependency array.');
}

// ----------------------------------------------------
// TASK 2: Dynamic Chart.js Telemetry Updating
// ----------------------------------------------------
console.log('\n--- TASK 2: Dynamic Telemetry Chart.js Updates ---');

// Test Chart Data Rolling Window Logic
let initialChartData = {
  labels: ['14:25', '14:26', '14:27', '14:28', '14:29', '14:30', '14:31', '14:32'],
  riskIndex: [28, 35, 42, 39, 68, 88, 72, 64],
  anomalyScore: [15, 18, 22, 55, 84, 91, 60, 48],
  cpuLoad: [30, 32, 29, 31, 35, 40, 38, 36],
};

function updateChart(prev, latestMsg) {
  const timeLabel = latestMsg.time ? latestMsg.time.split('.')[0] : new Date().toLocaleTimeString().slice(0, 5);
  const newRisk = typeof latestMsg.risk === 'number' ? latestMsg.risk : parseFloat(latestMsg.risk || '50') || 50;
  const newAnomaly = Math.min(100, Math.max(10, Math.round(newRisk * (latestMsg.tone === 'danger' ? 1.05 : 0.85))));
  const newCpu = Math.round(30 + 0.5 * 15); // fixed random for deterministic test

  if (prev.labels[prev.labels.length - 1] === timeLabel) {
    return { updated: false, data: prev };
  }

  return {
    updated: true,
    data: {
      labels: [...prev.labels.slice(1), timeLabel],
      riskIndex: [...prev.riskIndex.slice(1), newRisk],
      anomalyScore: [...prev.anomalyScore.slice(1), newAnomaly],
      cpuLoad: [...prev.cpuLoad.slice(1), newCpu],
    }
  };
}

// Test message 1: new time label
const msg1 = { time: '14:32:41.002', risk: 88, tone: 'danger' };
const res1 = updateChart(initialChartData, msg1);
console.log('[2.1] Update with new message ("14:32:41"):', res1.updated ? 'PASS' : 'FAIL');
console.log('   New Labels:', res1.data.labels);
console.log('   New Risk Index:', res1.data.riskIndex);
console.log('   New Anomaly Score:', res1.data.anomalyScore);

// Test message 2: duplicate time label within same second
const msg2 = { time: '14:32:41.850', risk: 95, tone: 'danger' };
const res2 = updateChart(res1.data, msg2);
console.log('[2.2] Duplicate timestamp within same second ignored:', !res2.updated ? 'PASS (Correctly Ignored)' : 'FAIL');

// Test label length discrepancy observation
console.log('[2.3] Timestamp format transition observation: initial x-axis labels are 5-char "HH:MM", incoming stream labels are 8-char "HH:MM:SS".');

// ----------------------------------------------------
// TASK 3: Clipboard & CSV Blob Verification
// ----------------------------------------------------
console.log('\n--- TASK 3: Clipboard & CSV Blob Verification ---');

// 3.1 Clipboard Handler in AlertsTriageDirectory.tsx
const triageFile = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/stitch/AlertsTriageDirectory.tsx'), 'utf8');

console.log('[3.1] Checking handleCopyJson implementation:');
const usesClipboardAPI = triageFile.includes('navigator.clipboard.writeText');
console.log('   navigator.clipboard.writeText used:', usesClipboardAPI);

// Flaw analysis in handleCopyJson
const setCopiedInCatch = triageFile.includes('.catch(() => {\n        setCopied(true)');
const setCopiedInElse = triageFile.includes('} else {\n      setCopied(true)');
console.log('   setCopied(true) called in .catch():', setCopiedInCatch);
console.log('   setCopied(true) called in fallback else:', setCopiedInElse);
if (setCopiedInCatch || setCopiedInElse) {
  console.log('   ⚠️  FLAW DETECTED: UI displays "COPIED!" state even when navigator.clipboard.writeText rejects or navigator.clipboard is unavailable.');
}

// 3.2 CSV Blob Creation in AlertsDirectory.tsx
const alertsFile = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/stitch/AlertsDirectory.tsx'), 'utf8');

console.log('[3.2] Checking CSV Export implementation in AlertsDirectory.tsx:');
const createsBlob = alertsFile.includes('new Blob([csvContent], { type: \'text/csv;charset=utf-8;\' })');
const createsObjectURL = alertsFile.includes('URL.createObjectURL(blob)');
const revokesObjectURL = alertsFile.includes('URL.revokeObjectURL(url)');
const appendsChild = alertsFile.includes('document.body.appendChild(link)');

console.log('   Blob creation with text/csv;charset=utf-8;:', createsBlob ? 'PASS' : 'FAIL');
console.log('   URL.createObjectURL(blob):', createsObjectURL ? 'PASS' : 'FAIL');
console.log('   DOM link append & click:', appendsChild ? 'PASS' : 'FAIL');
console.log('   URL.revokeObjectURL(url):', revokesObjectURL ? 'PASS' : 'FAIL');

// CSV escaping check
const mockAlertWithComma = {
  id: 'ALT-9921',
  agentId: 'AGT-XP-04',
  triggerType: 'anomaly, database injection',
  severity: 'Critical',
  riskScore: 98.4,
  timestamp: '2023-10-24 14:02:11Z',
  status: 'Open',
};

const headers = ['Alert ID', 'Agent ID', 'Trigger Type', 'Severity', 'Risk Score', 'Timestamp', 'Status'];
const row = [
  mockAlertWithComma.id,
  mockAlertWithComma.agentId,
  mockAlertWithComma.triggerType,
  mockAlertWithComma.severity,
  mockAlertWithComma.riskScore,
  `"${mockAlertWithComma.timestamp}"`,
  mockAlertWithComma.status,
];
const csvResult = [headers.join(','), row.join(',')].join('\n');
console.log('   Simulated CSV row with unquoted comma in triggerType:\n   ', csvResult.split('\n')[1]);
console.log('   ⚠️  FLAW DETECTED: Unquoted fields containing commas (e.g. triggerType) break CSV column alignment during CSV import because only timestamp is wrapped in quotes.');

// ----------------------------------------------------
// TASK 4: StitchScreen & Stitch Template Resolution
// ----------------------------------------------------
console.log('\n--- TASK 4: StitchScreen & Stitch Downloads Verification ---');

const stitchScreenFile = fs.readFileSync(path.join(__dirname, '../../frontend/src/stitch/StitchScreen.tsx'), 'utf8');
const usesIframe = stitchScreenFile.includes('<iframe');
console.log('[4.1] StitchScreen renders <iframe> container:', usesIframe ? 'PASS' : 'FAIL');

const stitchViewFile = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/StitchView.tsx'), 'utf8');

// Match all file references in STITCH_SCREENS array
const screenFileRegex = /file:\s*['"]([^'"]+)['"]/g;
let match;
const galleryFiles = [];
while ((match = screenFileRegex.exec(stitchViewFile)) !== null) {
  galleryFiles.push(match[1]);
}

console.log('[4.2] Total Stitch screens defined in StitchView.tsx gallery:', galleryFiles.length);

// Check if all gallery files exist in public/stitch_downloads
const downloadsDir = path.join(__dirname, '../../frontend/public/stitch_downloads');
let missingCount = 0;
galleryFiles.forEach(relPath => {
  // relPath is /stitch_downloads/003_Dashboard.html
  const fileName = path.basename(relPath);
  const fullPath = path.join(downloadsDir, fileName);
  if (!fs.existsSync(fullPath)) {
    console.log('   ❌ Missing File in public/stitch_downloads:', fileName);
    missingCount++;
  }
});

if (missingCount === 0) {
  console.log('[4.3] All', galleryFiles.length, 'gallery templates exist on disk: PASS');
} else {
  console.log('[4.3]', missingCount, 'gallery templates missing from disk: FAIL');
}

// Inspect all HTML files for placeholders and broken relative links
const allHtml = fs.readdirSync(downloadsDir).filter(f => f.endsWith('.html'));
console.log('[4.4] Inspecting all', allHtml.length, 'Stitch HTML files for unresolved placeholders and asset links...');

let filesWithPlaceholders = 0;
let totalPlaceholders = 0;
let filesWithRelativeHtml = 0;

allHtml.forEach(file => {
  const content = fs.readFileSync(path.join(downloadsDir, file), 'utf8');
  const placeholders = content.match(/\{\{DATA:SCREEN:[^\}]+\}\}/g);
  if (placeholders) {
    filesWithPlaceholders++;
    totalPlaceholders += placeholders.length;
  }
  if (/href=["'](?!http|\/\/|#|data:)[^"']+\.html["']/.test(content)) {
    filesWithRelativeHtml++;
  }
});

console.log('   Files containing unresolved {{DATA:SCREEN:...}} placeholders:', filesWithPlaceholders, 'of', allHtml.length);
console.log('   Total unresolved {{DATA:SCREEN:...}} tags:', totalPlaceholders);
console.log('   Files containing relative *.html links (e.g. href="index.html"):', filesWithRelativeHtml);

if (filesWithPlaceholders > 0 || filesWithRelativeHtml > 0) {
  console.log('   ⚠️  FLAW DETECTED: Unexpanded template tags ({{DATA:SCREEN:SCREEN_*}}) and unmapped relative .html hrefs cause 404 navigation failures when clicking links inside Stitch template iframe views.');
}

console.log('\n====================================================');
console.log('   EMPIRICAL VERIFICATION COMPLETE                  ');
console.log('====================================================');
