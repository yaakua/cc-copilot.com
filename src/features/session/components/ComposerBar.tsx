import { useEffect, useMemo, useRef, useState, type FocusEvent, type MouseEvent, type RefObject } from "react";
import { Paperclip, ArrowUp, Command, Sparkles, Clock3, Boxes } from "lucide-react";
import type { ComposerTargetMode, ProviderKind } from "../../../types/domain";
import { getAvailableSkills, type BackendSkillSummary } from "../../../lib/backend";
import { getProviderShortcutCatalog, type ProviderShortcutItem } from "../../../lib/providerShortcuts";
import { cn } from "../../../lib/utils";

interface ComposerBarProps {
  provider: ProviderKind | null;
  value: string;
  onChange: (value: string) => void;
  onSend: (mode: ComposerTargetMode) => void;
  // H5: Multi-pane target indicator props
  paneCount?: number;
  selectedPaneIds?: string[];
  activePaneId?: string | null;
  onSelectAllPanes?: () => void;
  // H6: External ref for focus shortcut
  composerRef?: RefObject<HTMLTextAreaElement | null>;
}

export function ComposerBar({
  provider,
  value,
  onChange,
  onSend,
  paneCount = 1,
  selectedPaneIds = [],
  activePaneId,
  onSelectAllPanes,
  composerRef,
}: ComposerBarProps) {
  const shortcuts = useMemo(() => getProviderShortcutCatalog(provider), [provider]);
  const [showMore, setShowMore] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<BackendSkillSummary[]>([]);
  const [highlightedSkillIndex, setHighlightedSkillIndex] = useState(0);
  const [skillPickerDismissed, setSkillPickerDismissed] = useState(false);
  const internalRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = composerRef ?? internalRef;
  const skillItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const autoHideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    void getAvailableSkills()
      .then((skills) => {
        if (mounted) {
          setAvailableSkills(skills);
        }
      })
      .catch(() => {
        if (mounted) {
          setAvailableSkills([]);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Auto-hide skill picker after 3 seconds
  useEffect(() => {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? value.length;
    const trigger = matchSkillTrigger(value, cursor);
    const shouldShowSkillPicker = isComposerFocused && !skillPickerDismissed && trigger !== null;

    // Clear any existing timer
    if (autoHideTimerRef.current !== null) {
      window.clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }

    // Start auto-hide timer when picker becomes visible
    if (shouldShowSkillPicker) {
      autoHideTimerRef.current = window.setTimeout(() => {
        setSkillPickerDismissed(true);
        autoHideTimerRef.current = null;
      }, 3000);
    }

    return () => {
      if (autoHideTimerRef.current !== null) {
        window.clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
    };
  }, [isComposerFocused, skillPickerDismissed, value, textareaRef]);

  function insertShortcut(shortcut: ProviderShortcutItem) {
    const snippet = shortcut.value;
    const nextValue = value.trim().length === 0 ? snippet : `${value}\n${snippet}`;
    onChange(nextValue);
    setRecentIds((current) => [shortcut.id, ...current.filter((id) => id !== shortcut.id)].slice(0, 6));
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  function handleShortcutMouseDown(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsComposerFocused(true);
  }

  function replaceSkillToken(skillName: string) {
    const textarea = textareaRef.current;
    const selectionStart = textarea?.selectionStart ?? value.length;
    const selectionEnd = textarea?.selectionEnd ?? value.length;
    const match = matchSkillTrigger(value, selectionStart);
    if (!match) {
      const nextValue = value.trim().length === 0 ? `$${skillName} ` : `${value}$${skillName} `;
      onChange(nextValue);
      window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
      return;
    }

    const nextValue = `${value.slice(0, match.start)}$${skillName} ${value.slice(selectionEnd)}`;
    onChange(nextValue);
    window.requestAnimationFrame(() => {
      const nextCursor = match.start + skillName.length + 2;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function handleFocusCapture() {
    setIsComposerFocused(true);
  }

  function handleBlurCapture(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setIsComposerFocused(false);
    setShowMore(false);
    setSkillPickerDismissed(false);
  }

  const recentShortcuts = useMemo(() => {
    if (!shortcuts || recentIds.length === 0) {
      return [];
    }
    const all = [
      ...shortcuts.primaryCommands,
      ...shortcuts.moreCommands,
      ...shortcuts.primarySkills,
      ...shortcuts.moreSkills,
    ];
    return recentIds
      .map((id) => all.find((item) => item.id === id))
      .filter((item): item is ProviderShortcutItem => Boolean(item));
  }, [recentIds, shortcuts]);

  const skillTrigger = useMemo(
    () => matchSkillTrigger(value, textareaRef.current?.selectionStart ?? value.length),
    [value],
  );
  const filteredSkills = useMemo(() => {
    if (!skillTrigger) {
      return [];
    }
    const query = skillTrigger.query.toLowerCase();
    const list = availableSkills.filter((skill) =>
      query.length === 0
        ? true
        : skill.name.toLowerCase().includes(query) || skill.description.toLowerCase().includes(query),
    );
    return list.slice(0, 10);
  }, [availableSkills, skillTrigger]);
  const showSkillPicker =
    isComposerFocused && Boolean(skillTrigger) && filteredSkills.length > 0 && !skillPickerDismissed;

  useEffect(() => {
    setHighlightedSkillIndex(0);
    setSkillPickerDismissed(false);
  }, [skillTrigger?.query]);

  useEffect(() => {
    if (!showSkillPicker) {
      return;
    }
    const target = skillItemRefs.current[highlightedSkillIndex];
    target?.scrollIntoView({ block: "nearest" });
  }, [highlightedSkillIndex, showSkillPicker]);

  // H5: Multi-pane target count
  const targetPaneCount = selectedPaneIds.length > 0 ? selectedPaneIds.length : 1;
  const showMultiPaneIndicator = paneCount > 1;

  const canSend = value.trim().length > 0;

  return (
    <div
      className="w-full space-y-3"
      onBlurCapture={handleBlurCapture}
      onFocusCapture={handleFocusCapture}
    >
      {provider && shortcuts && (
        <div
          aria-hidden={!isComposerFocused}
          className={cn(
            "origin-bottom overflow-hidden rounded-xl border border-border/60 bg-background/95 px-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition-all duration-200 ease-out",
            isComposerFocused
              ? "pointer-events-auto translate-y-0 py-3 opacity-100"
              : "pointer-events-none translate-y-3 py-0 opacity-0",
            /* L7: Use grid-rows for smoother animation */
            isComposerFocused ? "grid grid-rows-[1fr]" : "grid grid-rows-[0fr]",
          )}
          style={{
            display: isComposerFocused ? undefined : "none",
          }}
        >
          <div className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                <Command size={12} />
                {provider === "codex" ? "Codex 快捷命令" : "Claude Code 快捷命令"}
              </span>
              {shortcuts.primaryCommands.map((shortcut) => (
                <button
                  className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  key={shortcut.label}
                  onMouseDown={handleShortcutMouseDown}
                  onClick={() => insertShortcut(shortcut)}
                  type="button"
                  title={shortcut.description}
                >
                  {shortcut.label}
                </button>
              ))}
              <button
                className="rounded-full border border-dashed border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                onMouseDown={handleShortcutMouseDown}
                onClick={() => setShowMore((current) => !current)}
                type="button"
              >
                {showMore ? "收起" : "更多"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                <Sparkles size={12} />
                $ Skill
              </span>
              {shortcuts.primarySkills.map((shortcut) => (
                <button
                  className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-900 transition-colors hover:bg-violet-50"
                  key={shortcut.label}
                  onMouseDown={handleShortcutMouseDown}
                  onClick={() => insertShortcut(shortcut)}
                  type="button"
                  title={shortcut.description}
                >
                  {shortcut.label}
                </button>
              ))}
            </div>
            {recentShortcuts.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                  <Clock3 size={12} />
                  最近使用
                </span>
                {recentShortcuts.map((shortcut) => (
                  <button
                    className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-50"
                    key={`recent-${shortcut.id}`}
                    onMouseDown={handleShortcutMouseDown}
                    onClick={() => insertShortcut(shortcut)}
                    type="button"
                    title={shortcut.description}
                  >
                    {shortcut.label}
                  </button>
                ))}
              </div>
            )}
            {showMore && (
              <div className="mt-3 space-y-2 rounded-2xl border border-border/60 bg-slate-50/70 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {shortcuts.moreCommands.map((shortcut) => (
                    <button
                      className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                      key={`more-command-${shortcut.id}`}
                      onMouseDown={handleShortcutMouseDown}
                      onClick={() => insertShortcut(shortcut)}
                      type="button"
                      title={shortcut.description}
                    >
                      {shortcut.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {shortcuts.moreSkills.map((shortcut) => (
                    <button
                      className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-900 transition-colors hover:bg-violet-50"
                      key={`more-skill-${shortcut.id}`}
                      onMouseDown={handleShortcutMouseDown}
                      onClick={() => insertShortcut(shortcut)}
                      type="button"
                      title={shortcut.description}
                    >
                      {shortcut.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="w-full relative flex items-end gap-2 p-1.5 bg-background shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.16)] focus-within:ring-2 focus-within:ring-primary/20 rounded-2xl border border-border/30">
        {showSkillPicker && (
          <div className="absolute bottom-[calc(100%+12px)] left-14 right-14 z-20 overflow-hidden rounded-xl border border-border/70 bg-background/95 text-foreground shadow-[0_24px_48px_rgba(15,23,42,0.14)] backdrop-blur-xl">
            <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2 text-[11px] font-medium text-muted-foreground">
              <Boxes size={13} />
              输入 `$` 选择 Skill
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-none py-2">
              {filteredSkills.map((skill, index) => (
                <button
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors",
                    index === highlightedSkillIndex ? "bg-violet-50" : "hover:bg-muted/70",
                  )}
                  key={skill.id}
                  onMouseDown={handleShortcutMouseDown}
                  onMouseEnter={() => setHighlightedSkillIndex(index)}
                  onClick={() => replaceSkillToken(skill.name)}
                  ref={(node) => {
                    skillItemRefs.current[index] = node;
                  }}
                  type="button"
                >
                  <span
                    className={cn(
                      "mt-0.5 rounded-md border p-1",
                      index === highlightedSkillIndex
                        ? "border-violet-200 bg-white text-violet-700"
                        : "border-border/70 bg-background text-muted-foreground",
                    )}
                  >
                    <Boxes size={12} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">${skill.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{skill.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* L6: Attachment Button - disabled with tooltip */}
        <button
          className="flex-shrink-0 p-3 h-12 w-12 flex items-center justify-center rounded-full text-muted-foreground/40 cursor-not-allowed transition-colors focus:outline-none"
          type="button"
          aria-label="Attach File"
          title="即将推出"
          disabled
        >
          <Paperclip size={20} />
        </button>

        {/* Text Area */}
        <textarea
          className="flex-1 max-h-[40vh] min-h-[48px] p-3 py-3.5 bg-transparent border-none resize-none outline-none text-sm placeholder:text-muted-foreground/60 scrollbar-none"
          ref={textareaRef}
          onChange={(event) => onChange(event.currentTarget.value)}
          onClick={() => {
            setHighlightedSkillIndex(0);
            setSkillPickerDismissed(false);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) {
              return;
            }
            if (showSkillPicker && filteredSkills.length > 0) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setHighlightedSkillIndex((current) => (current + 1) % filteredSkills.length);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlightedSkillIndex((current) => (current - 1 + filteredSkills.length) % filteredSkills.length);
                return;
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                const highlighted = filteredSkills[highlightedSkillIndex] ?? filteredSkills[0];
                if (highlighted) {
                  replaceSkillToken(highlighted.name);
                }
                return;
              }
              if (event.key === "Tab") {
                event.preventDefault();
                const highlighted = filteredSkills[highlightedSkillIndex] ?? filteredSkills[0];
                if (highlighted) {
                  replaceSkillToken(highlighted.name);
                }
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setHighlightedSkillIndex(0);
                setSkillPickerDismissed(true);
                return;
              }
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (value.trim().length > 0) {
                onSend("selected");
              }
            }
          }}
          onSelect={() => {
            setHighlightedSkillIndex(0);
          }}
          placeholder="给 Agent 发送指令 (Enter 发送，Shift+Enter 换行)"
          rows={Math.min(5, Math.max(1, value.split("\n").length))}
          value={value}
        />

        {/* H5: Multi-pane target indicator - moved to right side */}
        {showMultiPaneIndicator && (
          <div className="flex-shrink-0 flex flex-col items-center justify-center gap-1.5 px-2 border-l border-border/30">
            <div className="flex items-center gap-1">
              {selectedPaneIds.length > 0 ? (
                selectedPaneIds.map((id) => (
                  <span
                    key={id}
                    className={cn(
                      "w-2 h-2 rounded-full",
                      id === activePaneId ? "bg-sky-500" : "bg-emerald-500",
                    )}
                  />
                ))
              ) : (
                <span className="w-2 h-2 rounded-full bg-sky-500" />
              )}
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {targetPaneCount}个窗格
            </span>
            {paneCount > 1 && onSelectAllPanes && (
              <button
                className="px-1.5 py-0.5 text-[10px] rounded border border-border hover:bg-muted transition-colors whitespace-nowrap"
                onClick={onSelectAllPanes}
                type="button"
                title={selectedPaneIds.length === paneCount ? "取消全选" : "选择所有窗格"}
              >
                {selectedPaneIds.length === paneCount ? "取消" : "全选"}
              </button>
            )}
          </div>
        )}

        {/* H5: Send Action — enhanced visual */}
        <button
          className={cn(
            "flex-shrink-0 p-3 h-12 w-12 flex items-center justify-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary/50",
            canSend
              ? "bg-primary text-primary-foreground hover:shadow-md active:scale-95"
              : "bg-transparent text-muted-foreground/30 cursor-not-allowed"
          )}
          disabled={!canSend}
          onClick={() => {
            onSend("selected");
          }}
          type="button"
          title="发送指令"
        >
          <ArrowUp strokeWidth={2.5} size={20} />
        </button>
      </div>
    </div>
  );
}

function matchSkillTrigger(value: string, cursor: number) {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|\s)\$([a-zA-Z0-9-]*)$/);
  if (!match || match.index === undefined) {
    return null;
  }

  const fullMatch = match[0];
  const start = beforeCursor.length - fullMatch.length + fullMatch.lastIndexOf("$");
  return {
    start,
    query: match[1] ?? "",
  };
}
