const BACKEND_URL = 'http://localhost:8080';

// DOM Elements
const video = document.getElementById('webcam');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const crowdCountEl = document.getElementById('crowd-count');
const loadingEl = document.getElementById('loading');
const aiStatusEl = document.getElementById('ai-status');
const apiStatusEl = document.getElementById('api-status');
const alertsList = document.getElementById('alerts-list');
const cameraSelect = document.getElementById('camera-select');
const zoneSelect = document.getElementById('zone-select');

// Network Canvas
const netCanvas = document.getElementById('network-canvas');
const netCtx = netCanvas.getContext('2d');

let model = null;
let currentZoneState = null;

// --- 1. AI & Camera Pipeline ---
async function enumerateCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputDevices = devices.filter(device => device.kind === 'videoinput');

        cameraSelect.innerHTML = '';
        if (videoInputDevices.length === 0) {
            cameraSelect.innerHTML = '<option value="">No cameras found</option>';
            return;
        }

        videoInputDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Camera ${index + 1}`;
            cameraSelect.appendChild(option);
        });

        // Add listener to switch camera when select changes
        cameraSelect.addEventListener('change', () => {
            setupCamera(cameraSelect.value);
        });

    } catch (err) {
        console.error("Error enumerating devices", err);
    }
}

async function setupCamera(deviceId = null) {
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }

    const constraints = {
        audio: false,
        video: deviceId ? { deviceId: { exact: deviceId }, width: 640, height: 480 } : { width: 640, height: 480 }
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve(video);
            };
        });
    } catch (err) {
        console.error("Camera access denied or unavailable", err);
        aiStatusEl.innerText = "Camera Error";
        aiStatusEl.style.color = "var(--critical-color)";
        loadingEl.innerHTML = "<p>Camera access denied. Please allow camera and reload.</p>";
    }
}

async function loadModel() {
    try {
        model = await cocoSsd.load();
        loadingEl.style.opacity = '0';
        setTimeout(() => loadingEl.style.display = 'none', 500);
        aiStatusEl.innerText = "Active (Person Tracking)";
        aiStatusEl.style.color = "var(--safe-color)";
        detectFrame();
    } catch (err) {
        console.error("Failed to load COCO-SSD model", err);
        aiStatusEl.innerText = "Model Error";
        aiStatusEl.style.color = "var(--critical-color)";
        loadingEl.innerHTML = "<p>Failed to load AI model. Check console.</p>";
    }
}

async function detectFrame() {
    if (!model || video.readyState < 2) {
        requestAnimationFrame(detectFrame);
        return;
    }

    const predictions = await model.detect(video);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let persons = 0;

    predictions.forEach(prediction => {
        if (prediction.class === 'person') {
            persons++;
            const [x, y, width, height] = prediction.bbox;

            // Vibrant neon box
            ctx.shadowColor = 'rgba(14, 165, 233, 0.8)';
            ctx.shadowBlur = 10;
            ctx.strokeStyle = '#0ea5e9';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, width, height);
            ctx.shadowBlur = 0; // reset

            ctx.fillStyle = 'rgba(14, 165, 233, 0.15)';
            ctx.fillRect(x, y, width, height);

            ctx.fillStyle = '#f1f5f9';
            ctx.font = 'bold 16px Inter';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            ctx.fillText(`${Math.round(prediction.score * 100)}%`, x + 5, y + 20);
            ctx.shadowBlur = 0; // reset
        }
    });

    crowdCountEl.innerText = persons;

    // Smooth transition for crowd stat color based on threshold (Threshold=50)
    if (persons > 50) {
        crowdCountEl.style.color = "var(--critical-color)";
        crowdCountEl.style.textShadow = "0 0 20px var(--critical-glow)";
    } else if (persons > 40) {
        crowdCountEl.style.color = "var(--warning-color)";
        crowdCountEl.style.textShadow = "0 0 20px var(--warning-glow)";
    } else {
        crowdCountEl.style.color = "var(--accent-blue)";
        crowdCountEl.style.textShadow = "0 0 20px var(--accent-blue-glow)";
    }

    sendCrowdData(persons);

    requestAnimationFrame(detectFrame);
}

// Throttled POST to avoid flooding backend
let lastPostTime = 0;
async function sendCrowdData(count) {
    const now = Date.now();
    if (now - lastPostTime < 2000) return; // Send every 2 seconds max
    lastPostTime = now;

    // Get assigned zone from dropdown
    const targetZoneId = parseInt(zoneSelect.value);

    try {
        await fetch(`${BACKEND_URL}/api/crowd`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zoneId: targetZoneId, crowd: count })
        });
    } catch (err) {
        // Soft fail if server isn't up
    }
}

// --- 2. Network Sync Pipeline ---
async function fetchState() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/state`);
        if (!response.ok) throw new Error("Network response not ok");

        currentZoneState = await response.json();

        // Update API Status
        apiStatusEl.innerText = "Connected & Syncing";
        apiStatusEl.className = "status-indicator online";

        updateAlerts(currentZoneState.alerts);
        drawNetwork(currentZoneState);

    } catch (err) {
        apiStatusEl.innerText = "Disconnected";
        apiStatusEl.className = "status-indicator offline";
        console.warn("Backend not running or unreachable", err);
    }
}

function updateAlerts(alerts) {
    alertsList.innerHTML = '';
    if (!alerts || alerts.length === 0) {
        const li = document.createElement('li');
        li.className = 'no-alerts';
        li.innerText = 'System operating nominally. No alerts at this time.';
        alertsList.appendChild(li);
        return;
    }

    alerts.forEach(alert => {
        const li = document.createElement('li');
        li.innerText = alert;
        if (alert.toLowerCase().includes('critical')) {
            li.classList.add('critical-alert');
        }
        alertsList.appendChild(li);
    });
}

function drawNetwork(state) {
    // Dynamic resize logic based on container
    const rect = netCanvas.parentElement.getBoundingClientRect();
    netCanvas.width = rect.width;
    netCanvas.height = 400; // Fixed relative height visualizer

    netCtx.clearRect(0, 0, netCanvas.width, netCanvas.height);

    if (!state || !state.zones) return;

    // Scale coordinates to fit canvas (Domain loosely 0-1000 -> 0-Width)
    const scaleX = (x) => (x / 1000) * netCanvas.width;
    const scaleY = (y) => (y / 600) * netCanvas.height;

    // Build mapped nodes for lookup
    const nodes = {};
    state.zones.forEach(z => {
        nodes[z.id] = { ...z, sx: scaleX(z.x), sy: scaleY(z.y) };
    });

    // Extract path edges for highlighting
    const safeEdges = new Set();
    if (state.paths && state.paths.length > 0) {
        // Highlight first safe path (primary route)
        const primaryPath = state.paths[0];
        for (let i = 0; i < primaryPath.length - 1; i++) {
            let u = primaryPath[i];
            let v = primaryPath[i + 1];
            safeEdges.add(`${Math.min(u, v)}-${Math.max(u, v)}`);
        }
    }

    // Draw Edges
    if (state.edges) {
        state.edges.forEach(edge => {
            const u = nodes[edge.source];
            const v = nodes[edge.target];
            if (!u || !v) return;

            const edgeKey = `${Math.min(edge.source, edge.target)}-${Math.max(edge.source, edge.target)}`;
            const isSafePath = safeEdges.has(edgeKey);

            netCtx.beginPath();
            netCtx.moveTo(u.sx, u.sy);
            netCtx.lineTo(v.sx, v.sy);

            if (isSafePath) {
                netCtx.strokeStyle = '#0ea5e9'; // vibrant neon blue
                netCtx.lineWidth = 5;
                netCtx.shadowBlur = 15;
                netCtx.shadowColor = 'rgba(14, 165, 233, 0.6)';
            } else {
                netCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                netCtx.lineWidth = 2;
                netCtx.shadowBlur = 0;
            }
            netCtx.stroke();
            netCtx.shadowBlur = 0; // reset
        });
    }

    // Draw Nodes
    Object.values(nodes).forEach(node => {
        netCtx.beginPath();
        netCtx.arc(node.sx, node.sy, 16, 0, 2 * Math.PI);

        // Node color based on crowd
        if (node.crowd > 50) {
            netCtx.fillStyle = '#ef4444'; // critical
            netCtx.shadowColor = 'rgba(239, 68, 68, 0.6)';
        } else if (node.crowd > 40) {
            netCtx.fillStyle = '#f59e0b'; // warning
            netCtx.shadowColor = 'rgba(245, 158, 11, 0.6)';
        } else {
            netCtx.fillStyle = '#10b981'; // safe
            netCtx.shadowColor = 'rgba(16, 185, 129, 0.6)';
        }

        netCtx.shadowBlur = 15;
        netCtx.fill();

        // Node outline
        netCtx.lineWidth = 3;
        netCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        netCtx.stroke();
        netCtx.shadowBlur = 0; // reset

        // Draw Label
        netCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        netCtx.font = '12px Inter';
        netCtx.textAlign = 'center';
        netCtx.fillText(node.name, node.sx, node.sy - 25);

        // Draw Crowd Count
        netCtx.fillStyle = '#0f172a';
        netCtx.font = 'bold 12px Inter';
        netCtx.fillText(node.crowd.toString(), node.sx, node.sy + 4);
    });
}

// Boot sequence
async function init() {
    // Request permission once before enumerating to get device labels
    await setupCamera();
    await enumerateCameras();
    await loadModel();

    // Initial fetch
    fetchState();
    // Poll backend every 2s
    setInterval(fetchState, 2000);

    // Resize handler for canvas
    window.addEventListener('resize', () => {
        if (currentZoneState) drawNetwork(currentZoneState);
    });
}

init();
