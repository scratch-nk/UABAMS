/**
 * sampling-frequency.js
 * Requires: accel-config.js (must be loaded first)
 */

const samplingRates = [
    { value: 50,  label: '50 Hz' },
    { value: 100, label: '100 Hz' },
    { value: 200, label: '200 Hz' },
];

// ── Accelerometer ODR card ────────────────────────────────────────────────────
class Accelerometer {
    constructor(id, color) {
        this.id    = id;
        this.color = color;
        this.enabled     = AccelConfig.isEnabled(id);
        this.currentRate = AccelConfig.getOdr(id);

        this.switchEl   = document.getElementById(`switch${id}`);
        this.statusEl   = document.getElementById(`status${id}`);
        this.freqEl     = document.getElementById(`freq${id}`);
        this.triggerEl  = document.getElementById(`trigger${id}`);
        this.dropdownEl = document.getElementById(`dropdown${id}`);
        this.selectedEl = document.getElementById(`selected${id}`);

        this._init();
    }

    _init() {
        this._populateDropdown();
        this._renderStatus();

        this.switchEl.addEventListener('click', () => this._toggleEnabled());

        this.triggerEl.addEventListener('click', (e) => {
            if (!this.enabled) return;
            e.stopPropagation();
            this._toggleDropdown();
        });

        document.addEventListener('click', (e) => {
            if (!this.dropdownEl.contains(e.target) && !this.triggerEl.contains(e.target)) {
                this._closeDropdown();
            }
        });
    }

    _populateDropdown() {
        samplingRates.forEach(rate => {
            const opt = document.createElement('div');
            opt.className = `select-option ${this.color}`;
            if (rate.value === this.currentRate) opt.classList.add('selected');
            opt.innerHTML = `<div class="option-text">${rate.label}</div>`;
            opt.addEventListener('click', () => this._selectRate(rate));
            this.dropdownEl.appendChild(opt);
        });
    }

    _renderStatus() {
        const rate   = samplingRates.find(r => r.value === this.currentRate) || samplingRates[1];
        const factor = Math.round(200 / rate.value);
        this.selectedEl.textContent = rate.label;
        this.freqEl.textContent     = rate.label;

        if (this.enabled) {
            this.switchEl.classList.add('active');
            this.statusEl.classList.remove('disabled');
            this.statusEl.classList.add('enabled', this.color);
            this.triggerEl.classList.remove('disabled');
        } else {
            this.switchEl.classList.remove('active');
            this.statusEl.classList.add('disabled');
            this.statusEl.classList.remove('enabled', this.color);
            this.triggerEl.classList.add('disabled');
        }
    }

    _toggleEnabled() {
        this.enabled = !this.enabled;
        AccelConfig.setEnabled(this.id, this.enabled);
        this._renderStatus();
        if (!this.enabled) this._closeDropdown();
    }

    _toggleDropdown() {
        this.dropdownEl.classList.toggle('open');
        this.triggerEl.classList.toggle('open');
    }

    _closeDropdown() {
        this.dropdownEl.classList.remove('open');
        this.triggerEl.classList.remove('open');
    }

    _selectRate(rate) {
        this.currentRate = rate.value;
        AccelConfig.setOdr(this.id, rate.value);
        this._renderStatus();
        this.dropdownEl.querySelectorAll('.select-option').forEach((el, i) => {
            el.classList.toggle('selected', samplingRates[i].value === rate.value);
        });
        this._closeDropdown();
    }

    getConfig() {
        return { enabled: this.enabled, odrHz: this.currentRate };
    }
}

// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${target}`)?.classList.add('active');
    });
});

// ── Bandpass SF live display ──────────────────────────────────────────────────
function syncSF(inputId, displayId) {
    const input   = document.getElementById(inputId);
    const display = document.getElementById(displayId);
    if (!input || !display) return;
    display.textContent = input.value;
    input.addEventListener('input', () => { display.textContent = input.value || '–'; });
}
syncSF('a1-sf', 'a1-sf-display');
syncSF('a2-sf', 'a2-sf-display');

// ── Helpers ───────────────────────────────────────────────────────────────────
// Returns a numeric value for a field, or null if the field is blank/empty
function numOrNull(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const v = el.value.trim();
    return v === '' ? null : Number(v);
}

// ── Collect config ────────────────────────────────────────────────────────────
function collectConfig() {
    return {
        accel1: accel1.getConfig(),
        accel2: accel2.getConfig(),
        bandpass: {
            accel1: { low: document.getElementById('a1-low').value,  high: document.getElementById('a1-high').value,  sf: document.getElementById('a1-sf').value },
            accel2: { low: document.getElementById('a2-low').value,  high: document.getElementById('a2-high').value,  sf: document.getElementById('a2-sf').value },
        },
        uml: {
            accel1: {
                vert: { low: numOrNull('uml-a1-vert-low'),  high: numOrNull('uml-a1-vert-high') },
                lat:  { low: numOrNull('uml-a1-lat-low'),   high: numOrNull('uml-a1-lat-high')  }
            },
            accel2: {
                vert: { low: numOrNull('uml-a2-vert-low'),  high: numOrNull('uml-a2-vert-high') },
                lat:  { low: numOrNull('uml-a2-lat-low'),   high: numOrNull('uml-a2-lat-high')  }
            }
        },
        limitClass: {
            accel1: {
                lat: {
                    ri:  { p1: numOrNull('lc-a1-lat-ri-p1'),   p2: numOrNull('lc-a1-lat-ri-p2'),   p3: numOrNull('lc-a1-lat-ri-p3')   },
                    rms: { p1: numOrNull('lc-a1-lat-rms-p1'),  p2: numOrNull('lc-a1-lat-rms-p2'),  p3: numOrNull('lc-a1-lat-rms-p3')  },
                    peak:{ p1: numOrNull('lc-a1-lat-peak-p1'), p2: numOrNull('lc-a1-lat-peak-p2'), p3: numOrNull('lc-a1-lat-peak-p3') }
                },
                vert: {
                    ri:  { p1: numOrNull('lc-a1-vert-ri-p1'),   p2: numOrNull('lc-a1-vert-ri-p2'),   p3: numOrNull('lc-a1-vert-ri-p3')   },
                    rms: { p1: numOrNull('lc-a1-vert-rms-p1'),  p2: numOrNull('lc-a1-vert-rms-p2'),  p3: numOrNull('lc-a1-vert-rms-p3')  },
                    peak:{ p1: numOrNull('lc-a1-vert-peak-p1'), p2: numOrNull('lc-a1-vert-peak-p2'), p3: numOrNull('lc-a1-vert-peak-p3') }
                }
            },
            accel2: {
                lat: {
                    ri:  { p1: numOrNull('lc-a2-lat-ri-p1'),   p2: numOrNull('lc-a2-lat-ri-p2'),   p3: numOrNull('lc-a2-lat-ri-p3')   },
                    rms: { p1: numOrNull('lc-a2-lat-rms-p1'),  p2: numOrNull('lc-a2-lat-rms-p2'),  p3: numOrNull('lc-a2-lat-rms-p3')  },
                    peak:{ p1: numOrNull('lc-a2-lat-peak-p1'), p2: numOrNull('lc-a2-lat-peak-p2'), p3: numOrNull('lc-a2-lat-peak-p3') }
                },
                vert: {
                    ri:  { p1: numOrNull('lc-a2-vert-ri-p1'),   p2: numOrNull('lc-a2-vert-ri-p2'),   p3: numOrNull('lc-a2-vert-ri-p3')   },
                    rms: { p1: numOrNull('lc-a2-vert-rms-p1'),  p2: numOrNull('lc-a2-vert-rms-p2'),  p3: numOrNull('lc-a2-vert-rms-p3')  },
                    peak:{ p1: numOrNull('lc-a2-vert-peak-p1'), p2: numOrNull('lc-a2-vert-peak-p2'), p3: numOrNull('lc-a2-vert-peak-p3') }
                }
            }
        }
    };
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent      = msg;
    t.style.background = type === 'error' ? '#c0392b' : '#2e7d52';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Footer buttons ────────────────────────────────────────────────────────────
const API = window.location.origin;

document.getElementById('btn-save').addEventListener('click', async () => {
    const cfg = collectConfig();
    console.log('Saving config:', JSON.stringify(cfg, null, 2));
    try {
        // Save ODR to server
        const odrRes  = await fetch(`${API}/api/odr-config`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ accel1: cfg.accel1.odrHz, accel2: cfg.accel2.odrHz }),
        });
        const odrData = await odrRes.json();
        if (!odrData.success) { showToast('Save failed: ' + (odrData.error || 'Unknown error'), 'error'); return; }

        // Save UML + Limit Class to dedicated endpoint
        const limRes  = await fetch(`${API}/api/limits-config`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ uml: cfg.uml, limitClass: cfg.limitClass }),
        });
        const limData = await limRes.json();
        if (!limData.success) { showToast('Limits save failed: ' + (limData.error || 'Unknown error'), 'error'); return; }

        showToast('Configuration saved — ODR & limits applied to all pages.');
    } catch (e) {
        showToast('Save failed: ' + e.message, 'error');
    }
});

document.getElementById('btn-import').addEventListener('click', () => {
    showToast('Import: select a configuration file to load.');
});

document.getElementById('btn-report').addEventListener('click', () => {
    console.log('Report config:', collectConfig());
    showToast('Report generated — check console for details.');
});

document.getElementById('btn-cancel').addEventListener('click', () => {
    showToast('Cancelled.');
});

document.getElementById('btn-reset-default')?.addEventListener('click', async () => {
    if (!confirm('Reset all settings to factory defaults?\n\nThis will set both accelerometers to 100 Hz ODR and restore bandpass filters.')) return;

    // Reset ODR on server first so all pages take effect immediately
    try {
        await fetch(`${API}/api/odr-config`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ accel1: 100, accel2: 100 }),
        });
    } catch (e) {
        showToast('Reset failed: ' + e.message, 'error');
        return;
    }

    // Reset shared config
    AccelConfig.setOdr(1, 100);
    AccelConfig.setOdr(2, 100);
    AccelConfig.setEnabled(1, true);
    AccelConfig.setEnabled(2, true);

    // Re-render ODR cards
    accel1.currentRate = 100;
    accel2.currentRate = 100;
    accel1._renderStatus();
    accel2._renderStatus();
    accel1.dropdownEl.querySelectorAll('.select-option').forEach((el, i) => {
        el.classList.toggle('selected', samplingRates[i].value === 100);
    });
    accel2.dropdownEl.querySelectorAll('.select-option').forEach((el, i) => {
        el.classList.toggle('selected', samplingRates[i].value === 100);
    });

    // Reset bandpass inputs
    const bpDefaults = { 'a1-low': 0.3, 'a1-high': 10, 'a1-sf': 200, 'a2-low': 0.3, 'a2-high': 50, 'a2-sf': 200 };
    Object.entries(bpDefaults).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    });
    syncSF('a1-sf', 'a1-sf-display');
    syncSF('a2-sf', 'a2-sf-display');

    showToast('Reset to factory defaults.');

    // Switch back to Configuration tab so user can see the changes
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.tab[data-tab="configuration"]').classList.add('active');
    document.getElementById('tab-configuration').classList.add('active');

    // Clear UML + LC on server and blank the inputs
    await fetch(`${API}/api/limits-config`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uml: null, limitClass: null }),
    });
    ['uml-a1-vert-low','uml-a1-vert-high','uml-a1-lat-low','uml-a1-lat-high',
     'uml-a2-vert-low','uml-a2-vert-high','uml-a2-lat-low','uml-a2-lat-high'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });


});

// ── Init ──────────────────────────────────────────────────────────────────────
const accel1 = new Accelerometer(1, 'blue');
const accel2 = new Accelerometer(2, 'purple');

// Shared helper — populates a field only if the server returned a non-null value
function restoreField(id, v) {
    const el = document.getElementById(id);
    if (el && v != null) el.value = v;
}

// Sync ODR cards to server state
fetch(`${API}/api/odr-config`)
    .then(r => r.json())
    .then(cfg => {
        [{ inst: accel1, id: 1, key: 'accel1' }, { inst: accel2, id: 2, key: 'accel2' }].forEach(({ inst, id, key }) => {
            const hz = cfg[key];
            if (!hz) return;
            AccelConfig.setOdr(id, hz);
            inst.currentRate = hz;
            inst._renderStatus();
            inst.dropdownEl.querySelectorAll('.select-option').forEach((el, i) => {
                el.classList.toggle('selected', samplingRates[i].value === hz);
            });
        });
    })
    .catch(() => {});


// ── Inline ghost suggestions (VS Code / Smart Compose style) ─────────────────
// Uses the native placeholder as the ghost — works perfectly on number inputs.
// Tab  → accept the suggestion (writes value, moves to next field)
// Any keystroke / Escape / blur → dismiss, type freely

(function initGhostSuggestions() {

    // ── Suggestion logic ─────────────────────────────────────────────────────
    function suggestFor(input) {
        const id = input.id;

        // LC: lc-{ax}-{dir}-{metric}-{p}
        const lcMatch = id.match(/^lc-(a[12])-(lat|vert)-(ri|rms|peak)-(p[123])$/);
        if (lcMatch) {
            const [, , , metric, p] = lcMatch;
            const donors = [
                `lc-a1-lat-${metric}-${p}`,
                `lc-a1-vert-${metric}-${p}`,
                `lc-a2-lat-${metric}-${p}`,
                `lc-a2-vert-${metric}-${p}`,
            ].filter(d => d !== id);
            for (const did of donors) {
                const el = document.getElementById(did);
                if (el && el.value.trim() !== '') return el.value.trim();
            }
        }

        // UML: uml-{ax}-{dir}-{low|high}
        const umlMatch = id.match(/^uml-(a[12])-(vert|lat)-(low|high)$/);
        if (umlMatch) {
            const [, , , bound] = umlMatch;
            const donors = [
                `uml-a1-vert-${bound}`,
                `uml-a1-lat-${bound}`,
                `uml-a2-vert-${bound}`,
                `uml-a2-lat-${bound}`,
            ].filter(d => d !== id);
            for (const did of donors) {
                const el = document.getElementById(did);
                if (el && el.value.trim() !== '') return el.value.trim();
            }
        }

        return null;
    }

    // ── Wire up all LC + UML inputs ──────────────────────────────────────────
    function wireInputs() {
        document.querySelectorAll('[id^="lc-"], [id^="uml-"]').forEach(input => {
            if (input.dataset.ghostWired) return;
            input.dataset.ghostWired = '1';

            let ghostActive = false;
            let ghostVal    = null;

            input.addEventListener('focus', () => {
                if (input.value.trim() !== '') return;
                const suggestion = suggestFor(input);
                if (suggestion == null) return;
                ghostVal    = suggestion;
                ghostActive = true;
                input.placeholder = suggestion;
                input.classList.add('ghost-active');
            });

            input.addEventListener('keydown', e => {
                if (!ghostActive) return;
                if (e.key === 'Tab') {
                    e.preventDefault();
                    input.value = ghostVal;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    clearGhost();
                    // advance focus to next wireable input
                    const all  = [...document.querySelectorAll('[id^="lc-"], [id^="uml-"]')];
                    const next = all[all.indexOf(input) + 1];
                    if (next) next.focus();
                } else {
                    clearGhost();
                }
            });

            input.addEventListener('input', clearGhost);
            input.addEventListener('blur',  clearGhost);

            function clearGhost() {
                if (!ghostActive) return;
                ghostActive       = false;
                ghostVal          = null;
                input.placeholder = '';
                input.classList.remove('ghost-active');
            }
        });
    }

    wireInputs();
    new MutationObserver(wireInputs).observe(document.body, { childList: true, subtree: true });

})();

// Restore UML + Limit Class from server
fetch(`${API}/api/limits-config`)
    .then(r => r.json())
    .then(cfg => {
        const uml = cfg.uml;
        if (uml) {
            restoreField('uml-a1-vert-low',  uml.accel1?.vert?.low);
            restoreField('uml-a1-vert-high', uml.accel1?.vert?.high);
            restoreField('uml-a1-lat-low',   uml.accel1?.lat?.low);
            restoreField('uml-a1-lat-high',  uml.accel1?.lat?.high);
            restoreField('uml-a2-vert-low',  uml.accel2?.vert?.low);
            restoreField('uml-a2-vert-high', uml.accel2?.vert?.high);
            restoreField('uml-a2-lat-low',   uml.accel2?.lat?.low);
            restoreField('uml-a2-lat-high',  uml.accel2?.lat?.high);
        }
        const lc = cfg.limitClass;
        if (lc) {
            ['a1', 'a2'].forEach(ax => {
                ['lat', 'vert'].forEach(dir => {
                    ['ri', 'rms', 'peak'].forEach(m => {
                        ['p1', 'p2', 'p3'].forEach(p => {
                            restoreField(`lc-${ax}-${dir}-${m}-${p}`,
                                lc[ax === 'a1' ? 'accel1' : 'accel2']?.[dir]?.[m]?.[p]);
                        });
                    });
                });
            });
        }
    })
    .catch(() => {});