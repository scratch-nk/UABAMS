/* mqtt_status.js — polls /api/realtime/status and fires onChange when status changes
 *
 * Usage:
 *   startMqttStatus({ interval: 2000, onChange({ online, connected, receiving_data, time_since_last }) });
 *
 * online = true  → MQTT connected AND data received in last 10 s
 * online = false → MQTT disconnected, no recent data, or server unreachable
 */

// Returns { pause(), resume() } so callers can halt polling (e.g. historical mode)
function startMqttStatus({ interval = 2000, onChange } = {}) {
    const API = window.location.origin;
    let lastOnline = null;
    let paused     = false;

    async function poll() {
        if (paused) return;
        try {
            const data   = await fetch(`${API}/api/realtime/status`).then(r => r.json());
            const online = !!(data.connected && data.receiving_data);
            if (online !== lastOnline) {
                lastOnline = online;
                onChange({ online, ...data });
            }
        } catch (_) {
            if (lastOnline !== false) {
                lastOnline = false;
                onChange({ online: false, connected: false, receiving_data: false,
                           last_data_received: null, time_since_last: null });
            }
        }
    }

    poll();
    setInterval(poll, interval);

    return {
        pause()  { paused = true; },
        resume() { paused = false; lastOnline = null; poll(); }
    };
}
