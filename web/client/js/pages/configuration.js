/* configuration.js
 * No hardcoded defaults. Inputs are blank until the user saves.
 * All threshold values come from and go to /api/thresholds on the server.
 * Peak limits use common.js localStorage helpers (unchanged).
 */

let peakLimits = [];

function safeLoadLimits()      { try { return (typeof loadStoredLimits === 'function') ? loadStoredLimits() : []; } catch(e) { return []; } }
function safeSaveLimits(l)     { try { if (typeof saveLimits === 'function') saveLimits(l); } catch(e) {} }
function safeDefaultLimits()   { try { return (typeof DEFAULT_LIMITS !== 'undefined') ? [...DEFAULT_LIMITS] : []; } catch(e) { return []; } }

// ── Boot: fetch thresholds from server, populate inputs ───────────────────
async function loadConfig() {
    let t = { p1Min: null, p1Max: null, p2Min: null, p2Max: null, p3Min: null };

    try {
        const res = await fetch('/api/thresholds');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        t = await res.json();
        console.log('[config] Loaded from server:', t);
    } catch (e) {
        console.warn('[config] Could not reach /api/thresholds:', e.message);
        showError('Could not load thresholds from server. Is the server running?');
    }

    // Set inputs — empty string if null (shows placeholder, not 0)
    document.getElementById('p1Min').value = t.p1Min ?? '';
    document.getElementById('p1Max').value = t.p1Max ?? '';
    document.getElementById('p2Min').value = t.p2Min ?? '';
    document.getElementById('p2Max').value = t.p2Max ?? '';
    document.getElementById('p3Min').value = t.p3Min ?? '';

    peakLimits = safeLoadLimits();
    if (!peakLimits.length) peakLimits = safeDefaultLimits();

    updateUI(t);
}

// ── UI helpers ────────────────────────────────────────────────────────────
function updateUI(t) {
    // t is optional — read from DOM if not provided
    if (!t) t = readInputs();
    updateRanges(t);
    displayPeakLimits();
    displayCurrentConfig(t);
}

function readInputs() {
    return {
        p1Min: parseFloat(document.getElementById('p1Min').value) || null,
        p1Max: parseFloat(document.getElementById('p1Max').value) || null,
        p2Min: parseFloat(document.getElementById('p2Min').value) || null,
        p2Max: parseFloat(document.getElementById('p2Max').value) || null,
        p3Min: parseFloat(document.getElementById('p3Min').value) || null,
    };
}

function fmt(min, max) {
    if (min === null && max === null) return '—';
    if (max === null) return `${min}g +`;
    return `${min}g – ${max}g`;
}

function updateRanges(t) {
    if (!t) t = readInputs();
    const r1 = document.getElementById('p1Range');
    const r2 = document.getElementById('p2Range');
    const r3 = document.getElementById('p3Range');
    if (r1) r1.textContent = fmt(t.p1Min, t.p1Max);
    if (r2) r2.textContent = fmt(t.p2Min, t.p2Max);
    if (r3) r3.textContent = t.p3Min !== null ? `${t.p3Min}g +` : '—';
}

function displayCurrentConfig(t) {
    const badges = document.getElementById('configBadges');
    if (!badges) return;
    if (!t) t = readInputs();
    const configured = t.p1Min !== null;
    badges.innerHTML = configured ? `
        <div class="config-badge-item">P1: ${fmt(t.p1Min, t.p1Max)}</div>
        <div class="config-badge-item">P2: ${fmt(t.p2Min, t.p2Max)}</div>
        <div class="config-badge-item">P3: &gt; ${t.p3Min}g</div>
    ` : `<div class="config-badge-item" style="color:#94a3b8;">No thresholds configured yet — enter values and save.</div>`;
}

function displayPeakLimits() {
    const c = document.getElementById('limitsContainer');
    if (!c) return;
    c.innerHTML = peakLimits.map(l => `
        <div class="limit-tag">
            <span>${l}g</span>
            <button onclick="removePeakLimit(${l})" title="Remove">&times;</button>
        </div>`).join('');
}

// ── Input live preview ────────────────────────────────────────────────────
['p1Min','p1Max','p2Min','p2Max','p3Min'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => updateRanges());
});

// ── Peak limit management ─────────────────────────────────────────────────
function addPeakLimit() {
    const input = document.getElementById('newLimit');
    const v     = parseFloat(input.value);
    if (isNaN(v) || v <= 0)         { showError('Enter a valid peak limit'); return; }
    if (peakLimits.includes(v))     { showError('This limit already exists'); return; }
    peakLimits.push(v);
    peakLimits.sort((a,b) => a-b);
    displayPeakLimits();
    input.value = '';
    hideError();
}

function removePeakLimit(limit) {
    if (peakLimits.length <= 1) { showError('Must have at least one peak limit'); return; }
    peakLimits = peakLimits.filter(l => l !== limit);
    displayPeakLimits();
    hideError();
}

// ── Validation ────────────────────────────────────────────────────────────
function validateThresholds() {
    const t = readInputs();
    if (Object.values(t).some(v => v === null || isNaN(v)))
        { showError('All threshold values are required'); return null; }
    if (t.p1Min >= t.p1Max)  { showError('P1 min must be less than P1 max'); return null; }
    if (t.p2Min >= t.p2Max)  { showError('P2 min must be less than P2 max'); return null; }
    // Cross-range: only require mins are ordered (P1 min < P2 min < P3 min)
    if (t.p2Min <= t.p1Min) { showError('P2 min must be greater than P1 min'); return null; }
    if (t.p3Min <= t.p2Min) { showError('P3 min must be greater than P2 min'); return null; }
    return t;
}

// ── Save ──────────────────────────────────────────────────────────────────
async function saveAllConfig() {
    const t = validateThresholds();
    if (!t) return;

    try {
        const res = await fetch('/api/thresholds', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(t)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        console.log('[config] Saved:', data.thresholds);
        updateUI(data.thresholds);
    } catch (e) {
        showError(`Save failed: ${e.message}`);
        return;
    }

    safeSaveLimits(peakLimits);
    hideError();
    const msg = document.getElementById('successMessage');
    if (msg) { msg.style.display = 'flex'; setTimeout(() => msg.style.display = 'none', 4000); }
}

// ── Clear ─────────────────────────────────────────────────────────────────
async function resetToDefault() {
    try {
        const res  = await fetch('/api/thresholds', { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        // Clear all inputs
        ['p1Min','p1Max','p2Min','p2Max','p3Min'].forEach(id => {
            document.getElementById(id).value = '';
        });
        peakLimits = safeDefaultLimits();
        updateUI(data.thresholds);
        hideError();
    } catch (e) {
        showError(`Clear failed: ${e.message}`);
    }
}

// ── Error/success display ─────────────────────────────────────────────────
function showError(msg) {
    const el = document.getElementById('validationError');
    if (!el) return;
    el.querySelector('span').textContent = msg;
    el.style.display = 'block';
}
function hideError() {
    const el = document.getElementById('validationError');
    if (el) el.style.display = 'none';
}

// ── Expose to HTML onclick handlers ──────────────────────────────────────
window.addPeakLimit    = addPeakLimit;
window.removePeakLimit = removePeakLimit;
window.saveAllConfig   = saveAllConfig;
window.resetToDefault  = resetToDefault;

// ── Start ─────────────────────────────────────────────────────────────────
loadConfig();