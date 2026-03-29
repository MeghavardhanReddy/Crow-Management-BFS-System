import { useEffect, useRef, useState, useCallback } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

const CameraFeed = ({ backendUrl }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    const [cameras, setCameras] = useState([]);
    const [activeCamera, setActiveCamera] = useState('');
    const [activeZone, setActiveZone] = useState('1');
    const [crowdCount, setCrowdCount] = useState(0);
    const [aiStatus, setAiStatus] = useState('Initializing');
    const [isLoading, setIsLoading] = useState(true);
    const [model, setModel] = useState(null);

    const lastPostTimeRef = useRef(0);

    // Load Model
    useEffect(() => {
        const loadAiModel = async () => {
            try {
                const loadedModel = await cocoSsd.load();
                setModel(loadedModel);
                setAiStatus('Active (Person Tracking)');
                setIsLoading(false);
            } catch (err) {
                console.error("Failed to load COCO-SSD", err);
                setAiStatus('Model Error');
            }
        };
        loadAiModel();
    }, []);

    // Enumerate cameras
    useEffect(() => {
        const getCameras = async () => {
            try {
                // Request permission first to get device labels
                await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoInputDevices = devices.filter(device => device.kind === 'videoinput');
                setCameras(videoInputDevices);
                if (videoInputDevices.length > 0) {
                    setActiveCamera(videoInputDevices[0].deviceId);
                }
            } catch (err) {
                console.error('Error enumerating or accessing devices', err);
                setAiStatus('Camera Error');
            }
        };
        getCameras();
    }, []);

    // Setup Camera Stream
    useEffect(() => {
        if (!activeCamera) return;

        const setupStream = async () => {
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: { exact: activeCamera }, width: 640, height: 480 }
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                setAiStatus('Camera Error');
                console.error("Camera access error", err);
            }
        };

        setupStream();
    }, [activeCamera]);

    // Detection Loop
    const detectFrame = useCallback(async () => {
        if (!model || !videoRef.current || videoRef.current.readyState < 2) {
            return requestAnimationFrame(detectFrame);
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const predictions = await model.detect(video);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let persons = 0;

        predictions.forEach(prediction => {
            if (prediction.class === 'person') {
                persons++;
                const [x, y, width, height] = prediction.bbox;

                ctx.shadowColor = 'rgba(14, 165, 233, 0.8)';
                ctx.shadowBlur = 10;
                ctx.strokeStyle = '#0ea5e9';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, width, height);
                ctx.shadowBlur = 0;

                ctx.fillStyle = 'rgba(14, 165, 233, 0.15)';
                ctx.fillRect(x, y, width, height);

                ctx.fillStyle = '#f1f5f9';
                ctx.font = 'bold 16px Inter';
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 4;
                ctx.fillText(`${Math.round(prediction.score * 100)}%`, x + 5, y + 20);
                ctx.shadowBlur = 0;
            }
        });

        setCrowdCount(persons);

        // Sync to backend throttled
        const now = Date.now();
        if (now - lastPostTimeRef.current > 2000) {
            lastPostTimeRef.current = now;
            fetch(`${backendUrl}/api/crowd`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ zoneId: parseInt(activeZone), crowd: persons })
            }).catch(() => { });
        }

        requestAnimationFrame(detectFrame);
    }, [model, backendUrl, activeZone]);

    useEffect(() => {
        let animationId;
        if (model) {
            animationId = requestAnimationFrame(detectFrame);
        }
        return () => cancelAnimationFrame(animationId);
    }, [model, detectFrame]);

    // Styling helpers
    const getCrowdColorClasses = () => {
        if (crowdCount > 50) return { color: 'var(--critical-color)', shadow: '0 0 20px var(--critical-glow)' };
        if (crowdCount > 40) return { color: 'var(--warning-color)', shadow: '0 0 20px var(--warning-glow)' };
        return { color: 'var(--accent-blue)', shadow: '0 0 20px var(--accent-blue-glow)' };
    };

    const crowdStyle = getCrowdColorClasses();

    return (
        <section className="panel glass-panel camera-panel">
            <div className="panel-header">
                <h2>Live Camera Feed</h2>
                <div className="controls-row">
                    <select
                        className="premium-select"
                        value={activeCamera}
                        onChange={(e) => setActiveCamera(e.target.value)}
                    >
                        {cameras.length === 0 ? <option value="">Loading cameras...</option> : null}
                        {cameras.map((cam, idx) => (
                            <option key={cam.deviceId} value={cam.deviceId}>
                                {cam.label || `Camera ${idx + 1}`}
                            </option>
                        ))}
                    </select>
                    <select
                        className="premium-select"
                        value={activeZone}
                        onChange={(e) => setActiveZone(e.target.value)}
                    >
                        {[1, 2, 3, 4, 5, 6].map(z => (
                            <option key={z} value={z}>Zone {z}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="video-container">
                <video ref={videoRef} autoPlay playsInline muted width="640" height="480"></video>
                <canvas ref={canvasRef} width="640" height="480" id="overlay"></canvas>
                {isLoading && (
                    <div className="loading-overlay" style={{ opacity: 1 }}>
                        <div className="spinner"></div>
                        <p>Loading AI Model (COCO-SSD)...</p>
                    </div>
                )}
            </div>

            <div className="stats-grid">
                <div className="stat-box">
                    <span className="label">Detected Crowd</span>
                    <span className="value highlight" style={{ color: crowdStyle.color, textShadow: crowdStyle.shadow }}>
                        {crowdCount}
                    </span>
                </div>
                <div className="stat-box">
                    <span className="label">AI Status</span>
                    <span className="value status-text" style={{ color: aiStatus.includes('Error') ? 'var(--critical-color)' : 'var(--safe-color)' }}>
                        {aiStatus}
                    </span>
                </div>
            </div>
        </section>
    );
};

export default CameraFeed;
