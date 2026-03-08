import type { RemoteState } from "../../../types/domain";

interface RemotePanelProps {
  remote: RemoteState;
  onToggle: (enabled: boolean) => void;
}

export function RemotePanel({ remote, onToggle }: RemotePanelProps) {
  const enabled = remote.status === "connecting" || remote.status === "online";
  const statusLabel =
    remote.status === "online"
      ? "Online"
      : remote.status === "connecting"
        ? "Connecting"
        : "Offline";
  const heartbeatLabel = remote.lastHeartbeatAt
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(remote.lastHeartbeatAt))
    : "No heartbeat";
  const summary =
    remote.endpoint ?? "Tunnel is offline. Start remote access to expose the active workspace.";
  const actionLabel = enabled ? "Stop tunnel" : "Start tunnel";

  return (
    <div className="detail-card detail-card-remote">
      <div className="detail-card-header">
        <div className="detail-card-title">
          <span>Remote access</span>
          <strong>{statusLabel}</strong>
        </div>
        <button
          className={enabled ? "toolbar-button" : "toolbar-button toolbar-button-primary"}
          onClick={() => onToggle(!enabled)}
          type="button"
        >
          {actionLabel}
        </button>
      </div>
      <div className="remote-status-grid">
        <div className="remote-status-hero">
          <span className={`detail-badge detail-badge-remote-${remote.status}`}>{statusLabel}</span>
          <strong>FRP tunnel status</strong>
          <p>{summary}</p>
        </div>
        <div className="remote-status-meta">
          <div className="remote-status-metric">
            <span>认证</span>
            <strong>{remote.authMode}</strong>
          </div>
          <div className="remote-status-metric">
            <span>Heartbeat</span>
            <strong>{heartbeatLabel}</strong>
          </div>
          <div className="remote-status-metric">
            <span>凭据</span>
            <strong>{remote.passwordHint}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
