/* management-dashboard.js — Executive Management Dashboard */

// Clock — uses startClock from common.js
startClock('currentTime', 'currentDate', 'long');

// ── Sensor Performance Chart ──────────────────────────────────────────────
const sensorCtx = document.getElementById('sensorChart').getContext('2d');
new Chart(sensorCtx, {
    type: 'line',
    data: {
        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        datasets: [{
            label: 'Sensor Value',
            data: Array.from({ length: 24 }, () => Math.random() * 4 + 1),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#ffffff',
                titleColor: '#0f172a',
                bodyColor: '#0f172a',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 12,
                displayColors: false,
                callbacks: {
                    label: ctx => 'Value: ' + ctx.parsed.y.toFixed(2)
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: '#e2e8f0', drawBorder: false },
                ticks: { color: '#64748b', font: { size: 12 } }
            },
            x: {
                grid: { color: '#e2e8f0', drawBorder: false },
                ticks: { color: '#64748b', font: { size: 12 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }
            }
        }
    }
});

// ── System Health Doughnut ────────────────────────────────────────────────
const healthCtx = document.getElementById('healthChart').getContext('2d');
new Chart(healthCtx, {
    type: 'doughnut',
    data: {
        labels: ['Operational', 'Warning', 'Critical'],
        datasets: [{
            data: [142, 12, 2],
            backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
            borderWidth: 0,
            spacing: 2
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#ffffff',
                titleColor: '#0f172a',
                bodyColor: '#0f172a',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 12
            }
        },
        cutout: '60%'
    }
});

// ── KPI entrance animation ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.kpi-value').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => {
            el.style.transition = 'all 0.5s ease';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, 100);
    });
});
