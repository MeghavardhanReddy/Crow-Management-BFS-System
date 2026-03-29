import { useEffect, useRef } from 'react';

const NetworkGraph = ({ networkState }) => {
    const canvasRef = useRef(null);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !networkState || !networkState.zones) return;

        const ctx = canvas.getContext('2d');

        const handleResize = () => {
            if (!wrapperRef.current) return;
            const rect = wrapperRef.current.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = 400;
            drawGraph();
        };

        const drawGraph = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const scaleX = (x) => (x / 1000) * canvas.width;
            const scaleY = (y) => (y / 600) * canvas.height;

            const nodes = {};
            networkState.zones.forEach(z => {
                nodes[z.id] = { ...z, sx: scaleX(z.x), sy: scaleY(z.y) };
            });

            const safeEdges = new Set();
            if (networkState.paths && networkState.paths.length > 0) {
                const primaryPath = networkState.paths[0];
                for (let i = 0; i < primaryPath.length - 1; i++) {
                    safeEdges.add(`${Math.min(primaryPath[i], primaryPath[i + 1])}-${Math.max(primaryPath[i], primaryPath[i + 1])}`);
                }
            }

            // Draw Edges
            if (networkState.edges) {
                networkState.edges.forEach(edge => {
                    const u = nodes[edge.source];
                    const v = nodes[edge.target];
                    if (!u || !v) return;

                    const edgeKey = `${Math.min(edge.source, edge.target)}-${Math.max(edge.source, edge.target)}`;
                    const isSafePath = safeEdges.has(edgeKey);

                    ctx.beginPath();
                    ctx.moveTo(u.sx, u.sy);
                    ctx.lineTo(v.sx, v.sy);

                    if (isSafePath) {
                        ctx.strokeStyle = '#0ea5e9';
                        ctx.lineWidth = 5;
                        ctx.shadowBlur = 15;
                        ctx.shadowColor = 'rgba(14, 165, 233, 0.6)';
                    } else {
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                        ctx.lineWidth = 2;
                        ctx.shadowBlur = 0;
                    }
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                });
            }

            // Draw Nodes
            Object.values(nodes).forEach(node => {
                ctx.beginPath();
                ctx.arc(node.sx, node.sy, 16, 0, 2 * Math.PI);

                if (node.crowd > 50) {
                    ctx.fillStyle = '#ef4444';
                    ctx.shadowColor = 'rgba(239, 68, 68, 0.6)';
                } else if (node.crowd > 40) {
                    ctx.fillStyle = '#f59e0b';
                    ctx.shadowColor = 'rgba(245, 158, 11, 0.6)';
                } else {
                    ctx.fillStyle = '#10b981';
                    ctx.shadowColor = 'rgba(16, 185, 129, 0.6)';
                }

                ctx.shadowBlur = 15;
                ctx.fill();

                ctx.lineWidth = 3;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.stroke();
                ctx.shadowBlur = 0;

                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.font = '12px Inter';
                ctx.textAlign = 'center';
                ctx.fillText(node.name, node.sx, node.sy - 25);

                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 12px Inter';
                ctx.fillText(node.crowd.toString(), node.sx, node.sy + 4);
            });
        };

        handleResize(); // Initial draw
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [networkState]);

    return (
        <section className="panel glass-panel graph-panel">
            <div className="panel-header">
                <h2>Facility Network Overview</h2>
                <span className="subtitle">Routing & Density Tracking</span>
            </div>

            <div className="canvas-wrapper" ref={wrapperRef}>
                <canvas ref={canvasRef} width="800" height="400" id="network-canvas"></canvas>
            </div>

            <div className="legend">
                <div className="legend-item"><span className="dot safe"></span> Safe (0-40)</div>
                <div className="legend-item"><span className="dot warning"></span> Warning (41-50)</div>
                <div className="legend-item"><span className="dot critical"></span> Critical (&gt;50)</div>
                <div className="legend-item"><span className="line path"></span> Active Safe Path</div>
            </div>
        </section>
    );
};

export default NetworkGraph;
