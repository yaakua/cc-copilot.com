import { useEffect, useMemo, useRef, useState, type FocusEvent, type MouseEvent } from "react";
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
}

export function ComposerBar({
  provider,
  value,
  onChange,
  onSend,
}: ComposerBarProps) {
  const shortcuts = useMemo(() => getProviderShortcutCatalog(provider), [provider]);
  const [showMore, setShowMore] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<BackendSkillSummary[]>([]);
  const [highlightedSkillIndex, setHighlightedSkillIndex] = useState(0);
  const [skillPickerDismissed, setSkillPickerDismissed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const skillItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

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
            "origin-bottom overflow-hidden rounded-[1.25rem] border border-border/60 bg-background/95 px-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition-all duration-200 ease-out",
            isComposerFocused
              ? "pointer-events-auto max-h-80 translate-y-0 py-3 opacity-100"
              : "pointer-events-none max-h-0 translate-y-3 py-0 opacity-0",
          )}
        >
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
              <Sparkles size={12} />
              $ Skill
            </span>
            {shortcuts.primarySkills.map((shortcut) => (
              <button
                className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-medium text-sky-900 transition-colors hover:bg-sky-50"
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
                    className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-medium text-sky-900 transition-colors hover:bg-sky-50"
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
      )}

      <div className="w-full relative flex items-end gap-2 p-1.5 bg-background shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all focus-within:shadow-[0_12px_40px_rgb(0,0,0,0.16)] focus-within:ring-2 focus-within:ring-primary/20 rounded-[1.5rem] border border-border/30">
        {showSkillPicker && (
          <div className="absolute bottom-[calc(100%+12px)] left-14 right-14 z-20 overflow-hidden rounded-[1.25rem] border border-border/70 bg-background/95 text-foreground shadow-[0_24px_48px_rgba(15,23,42,0.14)] backdrop-blur-xl">
            <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2 text-[11px] font-medium text-muted-foreground">
              <Boxes size={13} />
              输入 `$` 选择 Skill
            </div>
            <div className="max-h-80 overflow-y-auto py-2">
              {filteredSkills.map((skill, index) => (
                <button
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors",
                    index === highlightedSkillIndex ? "bg-sky-50" : "hover:bg-muted/70",
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
                        ? "border-sky-200 bg-white text-sky-700"
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

        {/* Attachment Button */}
        <button
          className="flex-shrink-0 p-3 h-12 w-12 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
          type="button"
          aria-label="Attach File"
          title="添加附件或上下文"
        >
          <Paperclip size={20} />
        </button>

        {/* Text Area */}
        <textarea
          className="flex-1 max-h-[40vh] min-h-[48px] p-3 py-3.5 bg-transparent border-none resize-none outline-none text-[15px] placeholder:text-muted-foreground/60 scrollbar-hide"
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

        {/* Send Action */}
        <button
          className={cn(
            "flex-shrink-0 p-3 h-12 w-12 flex items-center justify-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary/50",
            value.trim().length > 0
              ? "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              : "bg-transparent text-muted-foreground/30 cursor-not-allowed"
          )}
          disabled={value.trim().length === 0}
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
