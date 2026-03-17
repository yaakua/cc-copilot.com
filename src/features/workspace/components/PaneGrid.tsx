import { useState, useEffect, useMemo } from "react";
import { X, Folder, Moon, Sun, Plus } from "lucide-react";
import type { Pane, ProviderProfile, Project } from "../../../types/domain";
import { cn } from "../../../lib/utils";
import { ThreadTimeline } from "../../thread/components/ThreadTimeline";
import { ClaudeIcon } from "../../../components/icons/ClaudeIcon";
import { CodexIcon } from "../../../components/icons/CodexIcon";

interface PaneGridProps {
  panes: Pane[];
  paneProfiles: Record<string, ProviderProfile | null>;
  profiles: ProviderProfile[];
  activePaneId: string | null;
  canAddPane: boolean;
  canClosePane: boolean;
  onAddPane: () => void;
  onClosePane: (paneId: string) => void;
  onFocusPane: (paneId: string) => void;
  onTogglePaneSelection: (paneId: string) => void;
  selectedPaneIds: string[];
  onChangeProvider: (paneId: string, provider: "claude" | "codex") => void;
  onAssignProfile: (paneId: string, profileId: string) => void;
  onCreateProfile: (paneId: string) => void;
  onRetryLastMessage: (paneId: string) => void;
  currentProject: Project | null;
  darkMode: boolean;
  setDarkMode: (value: boolean | ((prev: boolean) => boolean)) => void;
}

export function PaneGrid({
  panes,
  paneProfiles,
  profiles,
  activePaneId,
  canAddPane,
  canClosePane,
  onAddPane,
  onClosePane,
  onFocusPane,
  onTogglePaneSelection,
  selectedPaneIds,
  onChangeProvider,
  onAssignProfile,
  onCreateProfile,
  onRetryLastMessage,
  currentProject,
  darkMode,
  setDarkMode,
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

  useEffect(() => {
    if (confirmCloseId && !panes.some((p) => p.id === confirmCloseId)) {
      setConfirmCloseId(null);
    }
  }, [panes, confirmCloseId]);

  // Close popover on outside click
  useEffect(() => {
    if (!confirmCloseId) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-close-popover]")) {
        setConfirmCloseId(null);
      }
    }
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [confirmCloseId]);

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

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const modKey = isMac ? "⌘" : "Ctrl+";

  const renderPane = (pane: Pane) => {
    const isActive = pane.id === activePaneId;
    const isSelected = selectedPaneIds.includes(pane.id);
    const meta = paneMeta[pane.id];
    const displayNum = meta ? meta.slot + 1 : 0;
    const paneProfile = paneProfiles[pane.id] ?? null;
    const availableProfiles = profiles;
    return (
      <div
        className={cn(
          "flex flex-col flex-1 min-h-0 min-w-0 bg-background text-left transition-all duration-200 overflow-hidden cursor-pointer",
          panes.length === 1
            ? "border border-border/40 shadow-sm"
            : "",
          // Active state: elevated with soft glow
          isActive && cn(
            "border border-sky-200/80",
            "shadow-[0_0_0_1px_rgba(56,189,248,0.1),0_8px_24px_-4px_rgba(56,189,248,0.15),0_4px_12px_-2px_rgba(0,0,0,0.05)]",
            "bg-gradient-to-br from-sky-50/30 via-background to-background",
            "relative z-10"
          ),
          // Selected state: distinct elevation with emerald accent
          !isActive && isSelected && cn(
            "border border-emerald-200/70",
            "shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_4px_16px_-2px_rgba(16,185,129,0.12),0_2px_8px_-1px_rgba(0,0,0,0.04)]",
            "bg-gradient-to-br from-emerald-50/20 via-background to-background",
            "relative z-[5]"
          ),
          // Inactive state: subtle depth
          !isActive && !isSelected && cn(
            "border border-border/30",
            "shadow-[0_1px_3px_0_rgba(0,0,0,0.05),0_1px_2px_0_rgba(0,0,0,0.03)]",
            "hover:border-border/50 hover:shadow-[0_2px_8px_-1px_rgba(0,0,0,0.08),0_1px_4px_0_rgba(0,0,0,0.04)]",
            "hover:bg-gradient-to-br hover:from-muted/10 hover:via-background hover:to-background",
            "relative z-0"
          )
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
        {/* Enhanced Pane Header with full info */}
        <div className="flex items-center justify-between px-3 py-2 border-b bg-background/95 backdrop-blur-sm shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Slot number */}
            {panes.length > 1 && (
              <div
                className="w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0"
                title={`${modKey}${displayNum}`}
              >
                {displayNum}
              </div>
            )}

            {/* Provider badge */}
            {paneProfile && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0",
                  pane.provider === "codex"
                    ? "border-sky-200 bg-sky-50 text-sky-700"
                    : "border-amber-200 bg-amber-50 text-amber-700",
                )}
              >
                {pane.provider === "codex" ? <CodexIcon size={10} className="opacity-70" /> : <ClaudeIcon size={10} className="opacity-70" />}
                <span className="truncate max-w-[80px]">{paneProfile.label}</span>
              </span>
            )}

            {/* Title */}
            <strong className="text-xs truncate flex-1 min-w-0">{pane.title}</strong>

            {/* Draft badge */}
            {pane.isDraft && (
              <span className="text-[9px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 uppercase tracking-wider shrink-0">
                草稿
              </span>
            )}

            {/* Selected badge */}
            {isSelected && !isActive && (
              <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 tracking-wider shrink-0">
                已选
              </span>
            )}

            {/* Project name */}
            {currentProject && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                <Folder size={9} />
                <span className="truncate max-w-[60px]">{currentProject.name}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Add pane button - show in every pane */}
            {canAddPane && (
              <button
                className="p-1 rounded bg-muted hover:bg-muted/80 transition-colors text-muted-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddPane();
                }}
                title="添加新窗格"
                type="button"
              >
                <Plus size={12} />
              </button>
            )}

            {/* Dark mode toggle - only show in last pane */}
            {pane.id === panes[panes.length - 1]?.id && (
              <button
                className="p-1 rounded hover:bg-muted/80 transition-colors text-muted-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setDarkMode((prev) => !prev);
                }}
                title={darkMode ? "切换到浅色模式" : "切换到深色模式"}
                type="button"
              >
                {darkMode ? <Sun size={12} /> : <Moon size={12} />}
              </button>
            )}

            {/* Close button */}
            {canClosePane && (
              <button
                className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  if (pane.messages.length > 0) {
                    setConfirmCloseId(pane.id);
                  } else {
                    onClosePane(pane.id);
                  }
                }}
                title="关闭窗格"
                type="button"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Thread Timeline */}
        <div className="flex-1 overflow-hidden">
          <ThreadTimeline
            activePane={pane}
            activeProfile={paneProfile}
            availableProfiles={availableProfiles}
            fullWidth
            onAssignProfile={(profileId) => onAssignProfile(pane.id, profileId)}
            onChangeProvider={(provider) => onChangeProvider(pane.id, provider)}
            onCreateProfile={() => onCreateProfile(pane.id)}
            onRetryLastMessage={() => onRetryLastMessage(pane.id)}
          />
        </div>

        {/* Close confirmation popover */}
        {confirmCloseId === pane.id && (
          <div
            className="absolute top-10 right-2 z-50 bg-popover border border-border shadow-lg rounded-xl p-4 min-w-[280px]"
            data-close-popover
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">确定要关闭此窗格吗？</p>
              <p className="text-xs text-muted-foreground">窗格中的消息将被保留。</p>
              <div className="flex justify-end gap-2">
                <button
                  className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
                  onClick={(event) => {
                    event.stopPropagation();
                    setConfirmCloseId(null);
                  }}
                  type="button"
                >
                  取消
                </button>
                <button
                  className="px-2.5 py-1 text-[11px] font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors rounded-md shadow-sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    onClosePane(pane.id);
                    setConfirmCloseId(null);
                  }}
                  type="button"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 min-h-0 w-full items-stretch">
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {leftCol.map((pane) => renderPane(pane))}
        </div>
        {rightCol.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {rightCol.map((pane) => renderPane(pane))}
          </div>
        )}
      </div>
    </section>
  );
}
