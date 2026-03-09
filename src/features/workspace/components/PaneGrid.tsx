import { useState, useEffect, useMemo } from "react";
import { X, Maximize2 } from "lucide-react";
import type { Pane, ProviderProfile } from "../../../types/domain";
import { cn } from "../../../lib/utils";
import { SessionSetupBar } from "../../session/components/SessionSetupBar";

interface PaneGridProps {
  panes: Pane[];
  paneProfiles: Record<string, ProviderProfile | null>;
  profiles: ProviderProfile[];
  activePaneId: string | null;
  canAddPane: boolean;
  canClosePane: boolean;
  onAddPane: () => void;
  onCancelRun: (paneId: string) => void;
  onClosePane: (paneId: string) => void;
  onFocusPane: (paneId: string) => void;
  onTogglePaneSelection: (paneId: string) => void;
  selectedPaneIds: string[];
  onChangeProvider: (paneId: string, provider: "claude" | "codex") => void;
  onAssignProfile: (paneId: string, profileId: string) => void;
  onCreateProfile: (paneId: string) => void;
}

export function PaneGrid({
  panes,
  paneProfiles,
  profiles,
  activePaneId,
  canClosePane,
  onCancelRun,
  onClosePane,
  onFocusPane,
  onTogglePaneSelection,
  selectedPaneIds,
  onChangeProvider,
  onAssignProfile,
  onCreateProfile,
}: PaneGridProps) {
  const [paneMeta, setPaneMeta] = useState<Record<string, { slot: number }>>({});
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null);

  useEffect(() => {
    setPaneMeta((prev) => {
      let changed = false;
      const nextMeta = { ...prev };

      // Remove obsolete panes
      Object.keys(nextMeta).forEach((id) => {
        if (!panes.find((p) => p.id === id)) {
          delete nextMeta[id];
          changed = true;
        }
      });

      // Add new panes
      panes.forEach((pane) => {
        if (!nextMeta[pane.id]) {
          const usedSlots = new Set(Object.values(nextMeta).map((m) => m.slot));
          let freeSlot = 0;
          while (usedSlots.has(freeSlot)) freeSlot++;

          nextMeta[pane.id] = { slot: freeSlot };
          changed = true;
        }
      });

      return changed ? nextMeta : prev;
    });
  }, [panes]);

  const isMetaReady = panes.every((p) => paneMeta[p.id]);

  const { leftCol, rightCol } = useMemo(() => {
    if (!isMetaReady) return { leftCol: [], rightCol: [] };
    const left: Pane[] = [];
    const right: Pane[] = [];
    panes.forEach((pane) => {
      const meta = paneMeta[pane.id];
      if (!meta) return;
      if (meta.slot === 0 || meta.slot === 2) {
        left.push(pane);
      } else {
        right.push(pane);
      }
    });

    left.sort((a, b) => paneMeta[a.id].slot - paneMeta[b.id].slot);
    right.sort((a, b) => paneMeta[a.id].slot - paneMeta[b.id].slot);
    return { leftCol: left, rightCol: right };
  }, [panes, paneMeta, isMetaReady]);

  if (!isMetaReady) return null;

  const renderPane = (pane: Pane, isLeftCol: boolean, isLastInCol: boolean) => {
    const isActive = pane.id === activePaneId;
    const isSelected = selectedPaneIds.includes(pane.id);
    const meta = paneMeta[pane.id];
    const previewMessages = pane.messages.slice(-3);
    const hasUserMessages = pane.messages.some((message) => message.role === "user");
    const displayNum = meta ? meta.slot + 1 : 0;
    const hasRightCol = rightCol.length > 0;
    const paneProfile = paneProfiles[pane.id] ?? null;
    const availableProfiles = profiles;
    return (
      <div
        className={cn(
          "flex flex-col flex-1 min-h-0 min-w-0 bg-background text-left transition-all overflow-hidden cursor-pointer border-2 rounded-2xl",
          panes.length === 1
            ? "border-border/70"
            : cn(
              !isLastInCol && "mb-3",
              isLeftCol && hasRightCol && "mr-3"
            ),
          isActive && "border-sky-400 shadow-[0_10px_30px_rgba(56,189,248,0.12)] relative z-10",
          !isActive && isSelected && "border-border bg-sky-50/40 shadow-[0_0_0_1px_rgba(148,163,184,0.18)] z-0",
          !isActive && !isSelected && "border-border/70 hover:border-border hover:bg-muted/20 z-0"
        )}
        key={pane.id}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey) {
            onTogglePaneSelection(pane.id);
          } else {
            onFocusPane(pane.id);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onFocusPane(pane.id);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center justify-between p-2 pb-1 bg-background shrink-0">
          <div className="flex items-center gap-2 overflow-hidden px-1">
            {panes.length > 1 && (
              <div className="w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground flex-shrink-0">
                {displayNum}
              </div>
            )}
            <strong className="text-xs truncate">{pane.title}</strong>
            {pane.isDraft && (
              <span className="text-[9px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 uppercase tracking-wider">
                草稿
              </span>
            )}
            <span className="text-[9px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border uppercase tracking-wider">
              {pane.provider === "claude" ? "Claude" : "Codex"}
            </span>
            {isSelected && !isActive && (
              <span className="text-[9px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 tracking-wider">
                已选
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {confirmCloseId === pane.id ? (
              <div className="flex items-center gap-1 animate-in fade-in duration-200">
                <button
                  className="px-2 py-0.5 text-[10px] font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors rounded shadow-sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    onClosePane(pane.id);
                    setConfirmCloseId(null);
                  }}
                  type="button"
                >
                  确定关闭
                </button>
                <button
                  className="px-2 py-0.5 text-[10px] bg-muted hover:bg-muted/80 text-muted-foreground transition-colors rounded"
                  onClick={(event) => {
                    event.stopPropagation();
                    setConfirmCloseId(null);
                  }}
                  type="button"
                >
                  取消
                </button>
              </div>
            ) : (
              <>
                {pane.status === "running" && (
                  <button
                    className="px-2 py-0.5 text-[10px] border border-border/50 hover:bg-muted text-muted-foreground transition-colors rounded"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCancelRun(pane.id);
                    }}
                    type="button"
                  >
                    取消
                  </button>
                )}

                <button
                  className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                  disabled={!canClosePane}
                  onClick={(event) => {
                    event.stopPropagation();
                    setConfirmCloseId(pane.id);
                  }}
                  type="button"
                  title="关闭窗格"
                >
                  <X size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 p-3 pt-0 bg-background flex flex-col gap-2 overflow-y-auto">
          {!hasUserMessages && (
            <SessionSetupBar
              activeProfile={paneProfile}
              availableProfiles={availableProfiles}
              canSwitchProvider={Boolean(pane.isDraft)}
              onAssignProfile={(profileId) => onAssignProfile(pane.id, profileId)}
              onChangeProvider={(provider) => onChangeProvider(pane.id, provider)}
              onCreateProfile={() => onCreateProfile(pane.id)}
              provider={pane.provider}
              stopPropagation
            />
          )}

          {previewMessages.map((message) => (
            <div
              className={cn(
                "p-3 rounded-xl text-xs border shadow-[0_1px_2px_rgba(0,0,0,0.02)] bg-background transition-shadow",
                message.role === "assistant"
                  ? "border-l-[3px] border-l-slate-400"
                  : message.role === "system"
                    ? "border-l-[3px] border-l-orange-500"
                    : "border-l-[3px] border-l-primary/60"
              )}
              key={message.id}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  {message.role}
                </span>
              </div>
              <p className="line-clamp-2 text-foreground leading-relaxed">{message.body}</p>
            </div>
          ))}

          {previewMessages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/50 gap-2">
              <Maximize2 size={24} />
              <span className="text-xs font-medium">
                {pane.isDraft ? "空白会话，发送后再创建" : "无消息记录"}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 min-h-0 w-full items-stretch">
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {leftCol.map((pane, index) => renderPane(pane, true, index === leftCol.length - 1))}
        </div>
        {rightCol.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {rightCol.map((pane, index) => renderPane(pane, false, index === rightCol.length - 1))}
          </div>
        )}
      </div>
    </section>
  );
}
