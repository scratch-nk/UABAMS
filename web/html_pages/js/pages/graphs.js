/* graphs.js — Real-time acceleration graphs + RCI */

// Timestamp display
function updateTimestamp() {
    const now = new Date();
    document.getElementById('currentTimestamp').textContent =
        now.toLocaleTimeString() + ' ' + now.toLocaleDateString();
}
setInterval(updateTimestamp, 1000);
updateTimestamp();

// ── Chart 1: Acceleration vs Distance ──────────────────────────────────────
const distanceCtx = document.getElementById('distanceChart').getContext('2d');
const distancePoints = 100;
const startDistance = 1390;

const distanceChart = new Chart(distanceCtx, {
    type: 'line',
    data: {
        labels: Array(distancePoints).fill(0).map((_, i) => (startDistance + i * 0.1).toFixed(1) + ' km'),
        datasets: [
            { label: 'AB-L-VERT', data: [], borderColor: '#22c55e', backgroundColor: 'transparent', borderWidth: 2, tension: 0.4, pointRadius: 0 },
            { label: 'AB-L-LAT',  data: [], borderColor: '#eab308', backgroundColor: 'transparent', borderWidth: 2, tension: 0.4, pointRadius: 0 },
            { label: 'AB-R-VERT', data: [], borderColor: '#ef4444', backgroundColor: 'transparent', borderWidth: 2, tension: 0.4, pointRadius: 0 },
            { label: 'AB-R-LAT',  data: [], borderColor: '#8b5cf6', backgroundColor: 'transparent', borderWidth: 2, tension: 0.4, pointRadius: 0 }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { beginAtZero: true, title: { display: true, text: 'Acceleration (m/s²)' }, grid: { color: '#f1f5f9' } },
            x: { title: { display: true, text: 'Distance (km)' }, ticks: { maxRotation: 45, maxTicksLimit: 10 } }
        }
    }
});

// ── Charts 2a/2b: Raw X,Y,Z ──────────────────────────────────────────────
function makeRawChart(canvasId) {
    return new Chart(document.getElementById(canvasId).getContext('2d'), {
        type: 'line',
        data: {
            labels: Array(50).fill(0).map((_, i) => i),
            datasets: [
                { label: 'X-Axis', data: [], borderColor: '#ef4444', borderWidth: 2, tension: 0.4, pointRadius: 0 },
                { label: 'Y-Axis', data: [], borderColor: '#22c55e', borderWidth: 2, tension: 0.4, pointRadius: 0 },
                { label: 'Z-Axis', data: [], borderColor: '#3b82f6', borderWidth: 2, tension: 0.4, pointRadius: 0 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: false }, x: { display: false } }
        }
    });
}

const rawChart1 = makeRawChart('rawChart1');
const rawChart2 = makeRawChart('rawChart2');

// ── Chart 3: Ride Comfort Index ───────────────────────────────────────────
const rciCtx = document.getElementById('rciChart').getContext('2d');
const rciPoints = 50;

const rciChart = new Chart(rciCtx, {
    type: 'line',
    data: {
        labels: Array(rciPoints).fill(0).map((_, i) => {
            const d = new Date();
            d.setMinutes(d.getMinutes() - (rciPoints - i) * 30);
            return d.getHours() + ':' + d.getMinutes().toString().padStart(2, '0');
        }),
        datasets: [{
            label: 'Ride Comfort Index',
            data: [],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 2
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { min: 0, max: 100, title: { display: true, text: 'RCI Score' }, grid: { color: '#f1f5f9' } },
            x: { ticks: { maxRotation: 45, maxTicksLimit: 8 } }
        }
    }
});

// ── Data generators ───────────────────────────────────────────────────────
function generateDistanceData() {
    return [
        Array(distancePoints).fill(0).map(() => 2.2 + Math.random() * 1.5),
        Array(distancePoints).fill(0).map(() => 0.5 + Math.random() * 0.8),
        Array(distancePoints).fill(0).map(() => 0.3 + Math.random() * 0.5),
        Array(distancePoints).fill(0).map(() => 0.1 + Math.random() * 0.2)
    ];
}

function generateRawData() {
    return {
        accel1: {
            x: Array(50).fill(0).map(() =>  0.10 + Math.random() * 0.20),
            y: Array(50).fill(0).map(() => -0.10 + Math.random() * 0.20),
            z: Array(50).fill(0).map(() =>  9.80 + Math.random() * 0.10)
        },
        accel2: {
            x: Array(50).fill(0).map(() =>  0.08 + Math.random() * 0.15),
            y: Array(50).fill(0).map(() => -0.08 + Math.random() * 0.15),
            z: Array(50).fill(0).map(() =>  9.78 + Math.random() * 0.10)
        }
    };
}

function generateRCIData() {
    const data = [];
    let val = 70;
    for (let i = 0; i < rciPoints; i++) {
        val += (Math.random() - 0.5) * 8;
        val = Math.max(30, Math.min(95, val));
        data.push(val);
    }
    return data;
}

// ── Initialize ────────────────────────────────────────────────────────────
let distData = generateDistanceData();
let rawData  = generateRawData();
let rciData  = generateRCIData();

distanceChart.data.datasets.forEach((ds, i) => ds.data = distData[i]);
rawChart1.data.datasets[0].data = rawData.accel1.x;
rawChart1.data.datasets[1].data = rawData.accel1.y;
rawChart1.data.datasets[2].data = rawData.accel1.z;
rawChart2.data.datasets[0].data = rawData.accel2.x;
rawChart2.data.datasets[1].data = rawData.accel2.y;
rawChart2.data.datasets[2].data = rawData.accel2.z;
rciChart.data.datasets[0].data  = rciData;

distanceChart.update(); rawChart1.update(); rawChart2.update(); rciChart.update();

// Initial legend values
document.getElementById('distVal1').textContent = distData[0][distData[0].length-1].toFixed(2) + ' m/s²';
document.getElementById('distVal2').textContent = distData[1][distData[1].length-1].toFixed(2) + ' m/s²';
document.getElementById('distVal3').textContent = distData[2][distData[2].length-1].toFixed(2) + ' m/s²';
document.getElementById('distVal4').textContent = distData[3][distData[3].length-1].toFixed(2) + ' m/s²';
document.getElementById('raw1X').textContent = rawData.accel1.x[rawData.accel1.x.length-1].toFixed(3);
document.getElementById('raw1Y').textContent = rawData.accel1.y[rawData.accel1.y.length-1].toFixed(3);
document.getElementById('raw1Z').textContent = rawData.accel1.z[rawData.accel1.z.length-1].toFixed(2);
document.getElementById('raw2X').textContent = rawData.accel2.x[rawData.accel2.x.length-1].toFixed(3);
document.getElementById('raw2Y').textContent = rawData.accel2.y[rawData.accel2.y.length-1].toFixed(3);
document.getElementById('raw2Z').textContent = rawData.accel2.z[rawData.accel2.z.length-1].toFixed(2);

function setRCIStatus(val) {
    const el = document.getElementById('rciStatus');
    if (val >= 80)      { el.textContent = 'Excellent'; el.className = 'rci-status status-excellent'; }
    else if (val >= 60) { el.textContent = 'Good';      el.className = 'rci-status status-good'; }
    else if (val >= 40) { el.textContent = 'Fair';      el.className = 'rci-status status-fair'; }
    else                { el.textContent = 'Poor';      el.className = 'rci-status status-poor'; }
}

const currentRCI = rciData[rciData.length-1];
document.getElementById('rciCurrent').textContent = Math.round(currentRCI);
setRCIStatus(currentRCI);
document.getElementById('rciAvg').textContent   = Math.round(rciData.reduce((a,b) => a+b, 0) / rciData.length);
document.getElementById('rciBest').textContent  = Math.round(Math.max(...rciData));
document.getElementById('rciWorst').textContent = Math.round(Math.min(...rciData));

// ── Real-time updates (every 2 s) ─────────────────────────────────────────
setInterval(() => {
    distanceChart.data.datasets.forEach((ds, i) => {
        ds.data.shift();
        ds.data.push([2.2, 0.5, 0.3, 0.1][i] + Math.random() * [1.5, 0.8, 0.5, 0.2][i]);
    });
    document.getElementById('distVal1').textContent = distanceChart.data.datasets[0].data[distancePoints-1].toFixed(2) + ' m/s²';
    document.getElementById('distVal2').textContent = distanceChart.data.datasets[1].data[distancePoints-1].toFixed(2) + ' m/s²';
    document.getElementById('distVal3').textContent = distanceChart.data.datasets[2].data[distancePoints-1].toFixed(2) + ' m/s²';
    document.getElementById('distVal4').textContent = distanceChart.data.datasets[3].data[distancePoints-1].toFixed(2) + ' m/s²';

    ['accel1', 'accel2'].forEach((accel, idx) => {
        const chart = idx === 0 ? rawChart1 : rawChart2;
        ['x', 'y', 'z'].forEach((axis, axisIdx) => {
            chart.data.datasets[axisIdx].data.shift();
            const base = axis === 'x' ? (idx === 0 ? 0.15 : 0.12)
                       : axis === 'y' ? (idx === 0 ? -0.05 : -0.04)
                       :                (idx === 0 ? 9.82  : 9.80);
            chart.data.datasets[axisIdx].data.push(base + (Math.random() - 0.5) * 0.1);
        });
    });

    const l1 = rawChart1.data.datasets;
    document.getElementById('raw1X').textContent = l1[0].data[l1[0].data.length-1].toFixed(3);
    document.getElementById('raw1Y').textContent = l1[1].data[l1[1].data.length-1].toFixed(3);
    document.getElementById('raw1Z').textContent = l1[2].data[l1[2].data.length-1].toFixed(2);

    const l2 = rawChart2.data.datasets;
    document.getElementById('raw2X').textContent = l2[0].data[l2[0].data.length-1].toFixed(3);
    document.getElementById('raw2Y').textContent = l2[1].data[l2[1].data.length-1].toFixed(3);
    document.getElementById('raw2Z').textContent = l2[2].data[l2[2].data.length-1].toFixed(2);

    rciChart.data.datasets[0].data.shift();
    let newRCI = rciChart.data.datasets[0].data[rciChart.data.datasets[0].data.length-1] + (Math.random() - 0.5) * 6;
    newRCI = Math.max(30, Math.min(95, newRCI));
    rciChart.data.datasets[0].data.push(newRCI);

    document.getElementById('rciCurrent').textContent = Math.round(newRCI);
    setRCIStatus(newRCI);

    const allRCI = rciChart.data.datasets[0].data;
    document.getElementById('rciAvg').textContent   = Math.round(allRCI.reduce((a,b) => a+b, 0) / allRCI.length);
    document.getElementById('rciBest').textContent  = Math.round(Math.max(...allRCI));
    document.getElementById('rciWorst').textContent = Math.round(Math.min(...allRCI));

    distanceChart.update(); rawChart1.update(); rawChart2.update(); rciChart.update();
}, 2000);

// ── Control functions ─────────────────────────────────────────────────────
function setDistanceRange(range) {
    document.querySelectorAll('.graph-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function setRCIRange(range) {
    document.querySelectorAll('.graph-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

window.setDistanceRange = setDistanceRange;
window.setRCIRange = setRCIRange;
