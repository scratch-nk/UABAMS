/* events.js — Impact Events list with severity filter */

const events = [
    { time: '2024-03-12 14:32:18', location: 'KM 1392+450', peak: 16.8, severity: 'high'   },
    { time: '2024-03-12 14:30:15', location: 'KM 1395+120', peak: 15.2, severity: 'high'   },
    { time: '2024-03-12 14:25:42', location: 'KM 1401+780', peak: 7.3,  severity: 'medium' },
    { time: '2024-03-12 14:20:33', location: 'KM 1405+230', peak: 6.9,  severity: 'medium' },
    { time: '2024-03-12 14:15:21', location: 'KM 1412+560', peak: 2.8,  severity: 'low'    }
];

function displayEvents() {
    const filter   = document.getElementById('severityFilter').value;
    const filtered = filter === 'all' ? events : events.filter(e => e.severity === filter);

    document.getElementById('totalEvents').textContent  = filtered.length;
    document.getElementById('highEvents').textContent   = filtered.filter(e => e.severity === 'high').length;
    document.getElementById('mediumEvents').textContent = filtered.filter(e => e.severity === 'medium').length;
    document.getElementById('lowEvents').textContent    = filtered.filter(e => e.severity === 'low').length;

    document.getElementById('eventsList').innerHTML = filtered.map(event => `
        <div class="event-card event-${event.severity}">
            <div class="event-info">
                <span class="event-time">${event.time}</span>
                <span class="event-location">${event.location}</span>
            </div>
            <span class="event-peak peak-${event.severity}">${event.peak.toFixed(1)} g</span>
        </div>
    `).join('');
}

function exportEvents() {
    alert('Events exported successfully!');
}

document.getElementById('severityFilter').addEventListener('change', displayEvents);
displayEvents();

window.exportEvents = exportEvents;
