/* configuration.js — Threshold & peak limit configuration; uses common.js helpers */

let peakLimits = [...DEFAULT_LIMITS];

function loadConfig() {
    try {
        const t = loadStoredThresholds();
        document.getElementById('p1Min').value = t.p1Min;
        document.getElementById('p1Max').value = t.p1Max;
        document.getElementById('p2Min').value = t.p2Min;
        document.getElementById('p2Max').value = t.p2Max;
        document.getElementById('p3Min').value = t.p3Min;

        peakLimits = loadStoredLimits();
        updateUI();
    } catch (e) {
        console.error('Error loading config:', e);
    }
}

function updateUI() {
    updateRanges();
    displayPeakLimits();
    displayCurrentConfig();
}

function updateRanges() {
    document.getElementById('p1Range').textContent = `${document.getElementById('p1Min').value}g - ${document.getElementById('p1Max').value}g`;
    document.getElementById('p2Range').textContent = `${document.getElementById('p2Min').value}g - ${document.getElementById('p2Max').value}g`;
    document.getElementById('p3Range').textContent = `${document.getElementById('p3Min').value}g +`;
}

function displayPeakLimits() {
    document.getElementById('limitsContainer').innerHTML = peakLimits.map(limit => `
        <div class="limit-tag">
            <span>${limit}g</span>
            <button onclick="removePeakLimit(${limit})" title="Remove limit">&times;</button>
        </div>
    `).join('');
}

function displayCurrentConfig() {
    document.getElementById('configBadges').innerHTML = `
        <div class="config-badge-item">P1: ${document.getElementById('p1Min').value}g - ${document.getElementById('p1Max').value}g</div>
        <div class="config-badge-item">P2: ${document.getElementById('p2Min').value}g - ${document.getElementById('p2Max').value}g</div>
        <div class="config-badge-item">P3: &gt; ${document.getElementById('p3Min').value}g</div>
        <div class="config-badge-item">Peak Limits: ${peakLimits.slice(0, 3).join(', ')}...${peakLimits.slice(-2).join(', ')}g</div>
    `;
}

function addPeakLimit() {
    const input = document.getElementById('newLimit');
    const newLimit = parseFloat(input.value);

    if (isNaN(newLimit) || newLimit <= 0)   { showError('Please enter a valid peak limit'); return; }
    if (peakLimits.includes(newLimit))       { showError('This peak limit already exists'); return; }

    peakLimits.push(newLimit);
    peakLimits.sort((a, b) => a - b);
    displayPeakLimits();
    displayCurrentConfig();
    input.value = '';
    hideError();
}

function removePeakLimit(limit) {
    if (peakLimits.length <= 1) { showError('You must have at least one peak limit'); return; }
    peakLimits = peakLimits.filter(l => l !== limit);
    displayPeakLimits();
    displayCurrentConfig();
    hideError();
}

function validateThresholds() {
    const p1Min = parseFloat(document.getElementById('p1Min').value);
    const p1Max = parseFloat(document.getElementById('p1Max').value);
    const p2Min = parseFloat(document.getElementById('p2Min').value);
    const p2Max = parseFloat(document.getElementById('p2Max').value);
    const p3Min = parseFloat(document.getElementById('p3Min').value);

    if (p1Min >= p1Max)  { showError('P1 minimum must be less than maximum'); return false; }
    if (p2Min >= p2Max)  { showError('P2 minimum must be less than maximum'); return false; }
    if (p2Min <= p1Max)  { showError('P2 minimum must be greater than P1 maximum (no overlap)'); return false; }
    if (p3Min <= p2Max)  { showError('P3 minimum must be greater than P2 maximum (no overlap)'); return false; }
    return true;
}

function saveAllConfig() {
    if (!validateThresholds()) return;

    const thresholds = {
        p1Min: parseFloat(document.getElementById('p1Min').value),
        p1Max: parseFloat(document.getElementById('p1Max').value),
        p2Min: parseFloat(document.getElementById('p2Min').value),
        p2Max: parseFloat(document.getElementById('p2Max').value),
        p3Min: parseFloat(document.getElementById('p3Min').value)
    };

    saveThresholds(thresholds);
    saveLimits(peakLimits);
    updateUI();

    const msg = document.getElementById('successMessage');
    msg.style.display = 'flex';
    setTimeout(() => { msg.style.display = 'none'; }, 4000);
    hideError();
}

function resetToDefault() {
    document.getElementById('p1Min').value = DEFAULT_THRESHOLDS.p1Min;
    document.getElementById('p1Max').value = DEFAULT_THRESHOLDS.p1Max;
    document.getElementById('p2Min').value = DEFAULT_THRESHOLDS.p2Min;
    document.getElementById('p2Max').value = DEFAULT_THRESHOLDS.p2Max;
    document.getElementById('p3Min').value = DEFAULT_THRESHOLDS.p3Min;
    peakLimits = [...DEFAULT_LIMITS];
    updateUI();
    hideError();
}

function showError(message) {
    const error = document.getElementById('validationError');
    error.querySelector('span').textContent = message;
    error.style.display = 'block';
}

function hideError() {
    document.getElementById('validationError').style.display = 'none';
}

// Live range preview on input
['p1Min', 'p1Max', 'p2Min', 'p2Max', 'p3Min'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateRanges);
});

loadConfig();

window.addPeakLimit   = addPeakLimit;
window.removePeakLimit = removePeakLimit;
window.saveAllConfig  = saveAllConfig;
window.resetToDefault = resetToDefault;
