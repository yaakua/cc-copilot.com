import { Globe, Radio } from "lucide-react";
import type { RemoteState } from "../../../types/domain";
import { cn } from "../../../lib/utils";

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
    : "无数据";
  const summary =
    remote.endpoint ?? "远程穿透服务尚未连接。开启远程穿透可从外部访问应用。";
  const actionLabel = enabled ? "停止服务" : "启动穿透";

  return (
    <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-sm relative overflow-hidden flex flex-col gap-4">
      {/* Background Decorator */}
      <Globe className="absolute -right-8 -bottom-8 w-32 h-32 text-muted-foreground/5 opacity-20 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Radio size={16} className={cn(remote.status === "online" ? "text-green-500 animate-pulse" : "text-muted-foreground")} />
            <h3 className="font-semibold leading-none tracking-tight">远程访问</h3>
          </div>
          <p className="text-sm text-muted-foreground">通过 FRP 建立安全连接</p>
        </div>
        <button
          className={cn(
            "px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            enabled
              ? "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20"
              : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          )}
          onClick={() => onToggle(!enabled)}
          type="button"
        >
          {actionLabel}
        </button>
      </div>

      {/* Status Hero */}
      <div className="bg-muted/50 p-4 rounded-xl border border-border/50 space-y-2 z-10">
        <div className="flex items-center gap-2">
          <span className={cn(
            "inline-block px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider",
            remote.status === "online" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
              remote.status === "connecting" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
          )}>{statusLabel}</span>
          <strong className="text-sm">FRP Tunnel Status</strong>
        </div>
        <p className="text-sm text-muted-foreground break-all">{summary}</p>
      </div>

      {/* Meta Grid */}
      <div className="grid grid-cols-3 gap-2 z-10">
        <div className="flex flex-col bg-background border rounded-lg p-2.5">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold mb-1">认证方式</span>
          <strong className="text-sm">{remote.authMode}</strong>
        </div>
        <div className="flex flex-col bg-background border rounded-lg p-2.5">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold mb-1">心跳时间</span>
          <strong className="text-sm">{heartbeatLabel}</strong>
        </div>
        <div className="flex flex-col bg-background border rounded-lg p-2.5">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold mb-1">凭据提示</span>
          <strong className="text-sm truncate" title={remote.passwordHint}>{remote.passwordHint}</strong>
        </div>
      </div>
    </div>
  );
}
