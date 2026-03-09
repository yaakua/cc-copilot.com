import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { ProviderKind, ProviderProfile } from "../../../types/domain";
import { cn } from "../../../lib/utils";

interface SessionSetupBarProps {
  provider: ProviderKind;
  activeProfile: ProviderProfile | null;
  availableProfiles: ProviderProfile[];
  canSwitchProvider: boolean;
  onChangeProvider: (provider: ProviderKind) => void;
  onAssignProfile: (profileId: string) => void;
  onCreateProfile: () => void;
  stopPropagation?: boolean;
}

export function SessionSetupBar({
  provider,
  activeProfile,
  availableProfiles,
  canSwitchProvider,
  onChangeProvider,
  onAssignProfile,
  onCreateProfile,
  stopPropagation = false,
}: SessionSetupBarProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const groupedProfiles = {
    claude: availableProfiles.filter((profile) => profile.provider === "claude"),
    codex: availableProfiles.filter((profile) => profile.provider === "codex"),
  };
  const activeProfileLabel = activeProfile?.label ?? "未绑定账号";

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function stopEvent(event: { stopPropagation: () => void }) {
    if (stopPropagation) {
      event.stopPropagation();
    }
  }

  function handleSelect(targetProvider: ProviderKind, profileId: string | null) {
    if (!canSwitchProvider && provider !== targetProvider) {
      return;
    }
    if (canSwitchProvider && provider !== targetProvider) {
      onChangeProvider(targetProvider);
    }
    onAssignProfile(profileId ?? "");
    setOpen(false);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-200/80 bg-sky-50/60 px-3 py-2">
      <span className="min-w-0 text-[11px] font-semibold text-sky-900">
        {canSwitchProvider ? "首条消息前可切换 Provider / 账号" : "首条消息后仅可切换账号"}
      </span>
      <div className="relative max-w-full shrink-0" ref={menuRef}>
        <button
          className="flex h-8 min-w-[220px] max-w-[min(100%,360px)] items-center justify-between gap-2 rounded-lg border border-sky-200 bg-white px-3 text-left text-xs shadow-sm transition-colors hover:bg-sky-50"
          onMouseDown={stopEvent}
          onClick={(event) => {
            stopEvent(event);
            setOpen((current) => !current);
          }}
          type="button"
        >
          <span className="truncate font-medium text-sky-950">
            {provider === "codex" ? "Codex" : "Claude Code"}
            {" · "}
            {activeProfileLabel}
          </span>
          <ChevronDown className={cn("shrink-0 text-sky-700 transition-transform", open && "rotate-180")} size={16} />
        </button>

        {open && (
          <div
            className="absolute right-0 top-[calc(100%+8px)] z-20 w-[360px] max-w-[min(90vw,360px)] rounded-2xl border border-sky-200 bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
            onMouseDown={stopEvent}
            onClick={stopEvent}
          >
            {(["claude", "codex"] as const).map((sectionProvider, index) => (
              <div key={sectionProvider}>
                <div className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-sky-700/80">
                  {sectionProvider === "claude" ? "Claude Code" : "Codex"}
                </div>
                {groupedProfiles[sectionProvider].map((profile) => (
                  <button
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left",
                      !canSwitchProvider && provider !== sectionProvider
                        ? "cursor-not-allowed opacity-50"
                        : "hover:bg-sky-50",
                    )}
                    disabled={!canSwitchProvider && provider !== sectionProvider}
                    key={profile.id}
                    onClick={() => handleSelect(sectionProvider, profile.id)}
                    type="button"
                  >
                      <div>
                        <div className="text-sm font-semibold text-foreground">{profile.label}</div>
                        <div className="text-xs text-muted-foreground">
                        {profile.authKind === "apiKey"
                          ? "第三方 Provider"
                          : profile.authKind === "official"
                            ? "官方账号 Profile"
                            : "系统登录 Profile"}
                        {profile.model ? ` · ${profile.model}` : ""}
                      </div>
                    </div>
                    {provider === sectionProvider && activeProfile?.id === profile.id && (
                      <Check size={16} className="text-sky-700" />
                    )}
                  </button>
                ))}

                {groupedProfiles[sectionProvider].length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    暂无已保存账号，请先新建一个 profile。
                  </div>
                )}

                {!canSwitchProvider && provider !== sectionProvider && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    当前会话首条消息已发送，已固定为
                    {provider === "claude" ? " Claude Code" : " Codex"}，不能切到另一种 provider。
                  </div>
                )}

                {index === 0 && <div className="my-2 h-px bg-sky-100" />}
              </div>
            ))}

            <div className="my-2 h-px bg-sky-100" />
            <button
              className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-sky-900 hover:bg-sky-50"
              onClick={() => {
                onCreateProfile();
                setOpen(false);
              }}
              type="button"
            >
              新建 Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
