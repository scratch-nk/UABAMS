/* acceleration-km.js — KM-wise sections with checkbox-driven tab toggle */

let activeSections = { blocks: true, peakDist: false, worstPeaks: false };

// Load thresholds (used for future dynamic rendering)
let thresholds = { ...DEFAULT_THRESHOLDS };

function loadThresholds() {
    thresholds = loadStoredThresholds();
}

function toggleSection(section) {
    const checkboxes = {
        blocks:     document.getElementById('blocksCheck'),
        peakDist:   document.getElementById('peakDistCheck'),
        worstPeaks: document.getElementById('worstPeaksCheck')
    };
    const tabs = {
        blocks:     document.getElementById('blocksTab'),
        peakDist:   document.getElementById('peakDistTab'),
        worstPeaks: document.getElementById('worstPeaksTab')
    };
    const sections = {
        blocks:     document.getElementById('blocksSection'),
        peakDist:   document.getElementById('peakDistSection'),
        worstPeaks: document.getElementById('worstPeaksSection')
    };

    checkboxes[section].checked = !checkboxes[section].checked;
    activeSections[section] = checkboxes[section].checked;

    tabs[section].classList.toggle('active', activeSections[section]);

    for (const key in sections) {
        sections[key].style.display = activeSections[key] ? 'block' : 'none';
    }
}

window.onload = function () {
    loadThresholds();

    document.getElementById('blocksCheck').checked    = true;
    document.getElementById('peakDistCheck').checked  = false;
    document.getElementById('worstPeaksCheck').checked = false;

    document.getElementById('blocksSection').style.display    = 'block';
    document.getElementById('peakDistSection').style.display  = 'none';
    document.getElementById('worstPeaksSection').style.display = 'none';

    document.getElementById('blocksTab').classList.add('active');
    document.getElementById('peakDistTab').classList.remove('active');
    document.getElementById('worstPeaksTab').classList.remove('active');
};

window.toggleSection = toggleSection;
