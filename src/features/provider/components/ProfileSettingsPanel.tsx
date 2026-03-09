import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type {
  ProfileEditorIntent,
  ProviderKind,
  ProviderProfile,
  ProviderState,
} from "../../../types/domain";
import { nextProfileDefaults, providerAccent } from "../useProviderProfiles";
import { cn } from "../../../lib/utils";
import { ProfileEditorForm } from "./ProfileEditorForm";

interface ProfileSettingsPanelProps {
  profiles: ProviderProfile[];
  providers: ProviderState[];
  onSaveProfile: (profile: {
    id?: string | null;
    provider: ProviderKind;
    label: string;
    authKind: "apiKey" | "official" | "system";
    baseUrl: string;
    apiKey: string;
    model?: string | null;
  }) => void;
  onTestProfile: (profile: {
    id?: string | null;
    provider: ProviderKind;
    label?: string | null;
    authKind: "apiKey" | "official" | "system";
    baseUrl: string;
    apiKey: string;
    model?: string | null;
  }) => Promise<{
    ok: boolean;
    latencyMs: number;
    message: string;
  }>;
  editorIntent?: ProfileEditorIntent | null;
  onConsumeEditorIntent?: () => void;
  onDeleteProfile: (profileId: string) => void;
}

export function ProfileSettingsPanel({
  profiles,
  providers,
  onSaveProfile,
  onTestProfile,
  editorIntent,
  onConsumeEditorIntent,
  onDeleteProfile,
}: ProfileSettingsPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    profiles[0]?.id ?? null,
  );
  const [draft, setDraft] = useState({
    ...nextProfileDefaults("claude"),
    apiKey: "",
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  const groupedProfiles = useMemo(
    () => ({
      claude: profiles.filter((profile) => profile.provider === "claude"),
      codex: profiles.filter((profile) => profile.provider === "codex"),
    }),
    [profiles],
  );

  useEffect(() => {
    if (isCreating) {
      return;
    }
    if (selectedProfileId && profiles.some((profile) => profile.id === selectedProfileId)) {
      return;
    }
    setSelectedProfileId(profiles[0]?.id ?? null);
  }, [isCreating, profiles, selectedProfileId]);

  useEffect(() => {
    setTestFeedback(null);
  }, [isCreating, selectedProfileId]);

  useEffect(() => {
    if (isCreating) {
      return;
    }

    if (selectedProfile) {
      setDraft({
        provider: selectedProfile.provider,
        label: selectedProfile.label,
        authKind: selectedProfile.authKind,
        baseUrl: selectedProfile.baseUrl,
        model: selectedProfile.model,
        apiKey: "",
      });
      return;
    }

    setDraft({
      ...nextProfileDefaults(providers[0]?.id ?? "claude"),
      apiKey: "",
    });
  }, [isCreating, providers, selectedProfile]);

  useEffect(() => {
    if (!editorIntent) {
      return;
    }

    setIsCreating(true);
    setSelectedProfileId(null);
    setTestFeedback(null);
    setDraft({
      ...nextProfileDefaults(editorIntent.provider),
      authKind: editorIntent.authKind,
      apiKey: "",
    });
    onConsumeEditorIntent?.();
  }, [editorIntent, onConsumeEditorIntent]);

  function startCreate(provider?: ProviderKind) {
    const nextProvider = provider ?? draft.provider ?? providers[0]?.id ?? "claude";
    setIsCreating(true);
    setSelectedProfileId(null);
    setDraft({
      ...nextProfileDefaults(nextProvider),
      apiKey: "",
    });
    setTestFeedback(null);
  }

  function selectProfile(profileId: string) {
    setIsCreating(false);
    setSelectedProfileId(profileId);
  }

  async function handleTest() {
    setIsTesting(true);
    try {
      const result = await onTestProfile({
        id: isCreating ? null : selectedProfile?.id ?? null,
        provider: draft.provider,
        label: draft.label.trim() || null,
        authKind: draft.authKind,
        baseUrl: draft.baseUrl.trim(),
        apiKey: draft.apiKey.trim(),
        model: draft.model?.trim() ? draft.model.trim() : null,
      });
      setTestFeedback({ ok: result.ok, message: result.message });
    } catch (error) {
      setTestFeedback({
        ok: false,
        message: error instanceof Error ? error.message : "连接测试失败。",
      });
    } finally {
      setIsTesting(false);
    }
  }

  function handleSave() {
    onSaveProfile({
      id: isCreating ? null : selectedProfile?.id ?? null,
      provider: draft.provider,
      label:
        draft.label.trim() || (draft.provider === "claude" ? "Claude Profile" : "Codex Profile"),
      authKind: draft.authKind,
      baseUrl: draft.baseUrl.trim(),
      apiKey: draft.apiKey.trim(),
      model: draft.model?.trim() ? draft.model.trim() : null,
    });
  }

  const title = isCreating ? "新建账号" : selectedProfile ? `编辑 ${selectedProfile.label}` : "账号详情";
  const description = isCreating
    ? "新建账号会复用统一的 profile 表单。保存后即可在会话和草稿窗口中切换使用。"
    : selectedProfile
      ? "选中左侧账号后，可在这里修改认证方式、模型和连接信息。"
      : "先从左侧选择一个账号，或新建一个账号。";

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] h-full">
      <aside className="rounded-2xl border border-border bg-background/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">账号列表</div>
            <div className="text-xs text-muted-foreground">按下拉菜单同样的分组方式展示默认账号和用户创建的 profiles</div>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            onClick={() => startCreate()}
            type="button"
          >
            <Plus size={16} />
            新建
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {(["claude", "codex"] as const).map((provider) => (
            <div className="space-y-2" key={provider}>
              <div className="flex items-center justify-between px-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-700/80">
                  {provider === "claude" ? "Claude Code" : "Codex"}
                </div>
              </div>

              <div className="space-y-2">
                <button
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors",
                    !isCreating && selectedProfileId === null && draft.provider === provider
                      ? "bg-sky-50"
                      : "hover:bg-sky-50",
                  )}
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedProfileId(null);
                    setDraft({
                      ...nextProfileDefaults(provider),
                      apiKey: "",
                    });
                    setTestFeedback(null);
                  }}
                  type="button"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-foreground">
                        {provider === "claude" ? "系统登录 / 官方账号" : "默认官方账号"}
                      </div>
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">
                        默认
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {provider === "claude"
                        ? "复用当前机器上的 Claude CLI 登录态"
                        : "复用当前机器上的 Codex 官方账号"}
                    </div>
                  </div>
                </button>

                {groupedProfiles[provider].map((profile) => {
                  const isActive = !isCreating && profile.id === selectedProfileId;
                  return (
                    <button
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors",
                        isActive ? "bg-sky-50" : "hover:bg-sky-50",
                      )}
                      key={profile.id}
                      onClick={() => selectProfile(profile.id)}
                      type="button"
                    >
                      <div>
                        <div className="flex items-center gap-3">
                          <span
                            className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: providerAccent(profile) }}
                          />
                          <div>
                            <div className="text-sm font-semibold text-foreground">{profile.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {profile.authKind === "apiKey" ? "第三方 Provider" : "官方账号 Profile"}
                              {profile.model ? ` · ${profile.model}` : ""}
                            </div>
                          </div>
                        </div>
                      </div>
                      {isActive && <span className="text-sky-700">✓</span>}
                    </button>
                  );
                })}

                {/* Buttons replaced by the top-level '新建' button */}

                {groupedProfiles[provider].length === 0 && (
                  <div className="px-3 py-1 text-xs text-muted-foreground">
                    暂无用户创建的 profile
                  </div>
                )}

                {provider === "claude" && <div className="my-2 h-px bg-sky-100" />}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div className="rounded-2xl border border-border bg-background p-4 flex flex-col">
        {selectedProfile || isCreating ? (
          <ProfileEditorForm
            description={description}
            draft={draft}
            feedback={testFeedback}
            isTesting={isTesting}
            mode={isCreating ? "create" : "edit"}
            onChange={(next) => {
              setDraft((current) => ({ ...current, ...next }));
              setTestFeedback(null);
            }}
            onDelete={
              isCreating || !selectedProfile ? undefined : () => onDeleteProfile(selectedProfile.id)
            }
            onSave={handleSave}
            onTest={handleTest}
            saveLabel={
              isCreating && draft.authKind === "official" && draft.provider === "codex"
                ? "创建并登录"
                : "保存配置"
            }
            selectedProfile={selectedProfile}
            testLabel={
              isTesting ? "测试中..." : draft.authKind === "apiKey" ? "测试连接" : "验证当前登录"
            }
            title={title}
          />
        ) : (
          <div className="flex h-full min-h-[460px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-8 text-center">
            <div className="text-lg font-semibold text-foreground">选择一个账号开始编辑</div>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              左侧使用和切换下拉一致的排列方式展示默认账号与用户创建的 profiles。点击任意项后，右侧即可编辑或创建。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
