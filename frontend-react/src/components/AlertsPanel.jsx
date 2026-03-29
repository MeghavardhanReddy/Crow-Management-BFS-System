const AlertsPanel = ({ alerts }) => {
    return (
        <footer className="glass-panel alerts-panel">
            <div className="panel-header">
                <h3>System Alerts</h3>
            </div>
            <ul id="alerts-list">
                {!alerts || alerts.length === 0 ? (
                    <li className="no-alerts">System operating nominally. No alerts at this time.</li>
                ) : (
                    alerts.map((alert, idx) => (
                        <li
                            key={idx}
                            className={alert.toLowerCase().includes('critical') ? 'critical-alert' : ''}
                        >
                            {alert}
                        </li>
                    ))
                )}
            </ul>
        </footer>
    );
};

export default AlertsPanel;
