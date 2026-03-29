import { useEffect, useState } from 'react';
import { Camera, Activity } from 'lucide-react';
import CameraFeed from './components/CameraFeed';
import NetworkGraph from './components/NetworkGraph';
import AlertsPanel from './components/AlertsPanel';
import './index.css';

const BACKEND_URL = 'http://localhost:8080';

function App() {
  const [apiStatus, setApiStatus] = useState('Connecting...');
  const [networkState, setNetworkState] = useState(null);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/state`);
        if (!response.ok) throw new Error("Network response not ok");
        const data = await response.json();
        setNetworkState(data);
        setApiStatus('Connected');
      } catch (err) {
        setApiStatus('Disconnected');
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard">
      <header className="glass-panel">
        <div className="header-content">
          <div className="title-container">
            <div className="pulse-icon"></div>
            <h1>Real-Time Crowd Management <span className="badge">LIVE</span></h1>
          </div>
          <p>Powered by Edge AI & Network Analytics</p>
        </div>
        <div className="system-status">
          <span className="status-label">Backend API:</span>
          <span className={`status-indicator ${apiStatus === 'Connected' ? 'online' : 'offline'}`}>
            {apiStatus}
          </span>
        </div>
      </header>

      <main className="grid-container">
        <CameraFeed backendUrl={BACKEND_URL} />
        <NetworkGraph networkState={networkState} />
      </main>

      <AlertsPanel alerts={networkState?.alerts || []} />
    </div>
  );
}

export default App;
