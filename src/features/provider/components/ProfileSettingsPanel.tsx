import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Layers3, Plus, ShieldCheck } from "lucide-react";
import type { BackendProviderAccountStatus } from "../../../lib/backend";
import type {
  ProfileEditorIntent,
  ProviderKind,
  ProviderProfile,
  ProviderState,
} from "../../../types/domain";
import { nextProfileDefaults, providerAccent } from "../useProviderProfiles";
import { cn } from "../../../lib/utils";
import { ProviderProfileEditor } from "./ProviderProfileEditor";

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
    reuseCurrentLogin?: boolean | null;
    confirmedAccountEmail?: string | null;
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
  onInspectProviderAccount: (profile: {
    provider: ProviderKind;
    profileId?: string | null;
  }) => Promise<BackendProviderAccountStatus>;
  editorIntent?: ProfileEditorIntent | null;
  onConsumeEditorIntent?: () => void;
  onDeleteProfile: (profileId: string) => void;
}

export function ProfileSettingsPanel({
  profiles,
  providers,
  onSaveProfile,
  onTestProfile,
  onInspectProviderAccount,
  editorIntent,
  onConsumeEditorIntent,
  onDeleteProfile,
}: ProfileSettingsPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    ...nextProfileDefaults("claude"),
    apiKey: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<ProviderProfile | null>(null);

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
    setSelectedProfileId(null);
  }, [isCreating, profiles, selectedProfileId]);

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
  }

  function selectProfile(profileId: string) {
    setIsCreating(false);
    setSelectedProfileId(profileId);
  }

  function requestDelete(profile: ProviderProfile) {
    setDeleteTarget(profile);
  }

  async function handleSaveProfile(profile: Parameters<typeof onSaveProfile>[0]) {
    await Promise.resolve(onSaveProfile(profile));
    setIsCreating(false);
    setSelectedProfileId(null);
    setDraft({
      ...nextProfileDefaults(profile.provider),
      apiKey: "",
    });
  }

  function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    onDeleteProfile(deleteTarget.id);
    setDeleteTarget(null);
  }

  const title = isCreating ? "新建账号" : selectedProfile ? `编辑 ${selectedProfile.label}` : "账号详情";
  const description = isCreating
    ? "先在左侧选择要新建的 Provider，草稿账号会先出现在列表里，再在这里完成配置。"
    : selectedProfile
      ? "选中左侧账号后，可在这里修改认证方式、模型和连接信息；Provider 类型不可修改。"
      : "先从左侧选择一个账号，或新建一个账号。";

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] h-full">
      <aside className="rounded-2xl border border-border bg-background/70 p-4">
        <div className="text-sm font-semibold text-foreground">账号列表</div>

        <div className="mt-4 space-y-4">
          {(["claude", "codex"] as const).map((provider) => (
            <div className="space-y-2" key={provider}>
              <div className="flex items-center justify-between px-1 pt-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-700/80">
                  {provider === "claude" ? "Claude Code" : "Codex"}
                </div>
                <button
                  className="inline-flex items-center gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted"
                  onClick={() => startCreate(provider)}
                  type="button"
                >
                  <Plus size={13} />
                  新建
                </button>
              </div>

              <div className="space-y-2">
                {isCreating && draft.provider === provider && (
                  <div
                    className="rounded-2xl border border-dashed border-sky-300 bg-sky-50/60 px-3 py-3 text-left shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          {draft.label.trim() || `New ${provider === "claude" ? "Claude" : "Codex"} Profile`}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          草稿账号 · 尚未保存
                          {draft.authKind === "apiKey"
                            ? " · 第三方 Provider"
                            : draft.authKind === "official"
                              ? " · 官方账号 Profile"
                              : " · 系统登录 Profile"}
                        </div>
                      </div>
                      <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-sky-700">
                        新建中
                      </span>
                    </div>
                  </div>
                )}

                {groupedProfiles[provider].map((profile) => {
                  const isActive = !isCreating && profile.id === selectedProfileId;
                  return (
                    <button
                      className={cn(
                        "flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left shadow-sm transition-all",
                        isActive
                          ? "border-sky-300 bg-sky-50 shadow-sky-100"
                          : "border-border/70 bg-background/95 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white hover:shadow-md",
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
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {profile.authKind === "apiKey"
                                ? "第三方 Provider"
                                : profile.authKind === "official"
                                  ? "官方账号 Profile"
                                  : "系统登录 Profile"}
                              {profile.model ? ` · ${profile.model}` : ""}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-1 text-[10px] font-semibold",
                            profile.authKind === "apiKey"
                              ? "bg-amber-50 text-amber-700"
                              : profile.authKind === "official"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-700",
                          )}
                        >
                          {profile.authKind === "apiKey"
                            ? "第三方"
                            : profile.authKind === "official"
                              ? "官方"
                              : "系统"}
                        </span>
                        {isActive && <span className="text-sky-700">✓</span>}
                      </div>
                    </button>
                  );
                })}

                {groupedProfiles[provider].length === 0 && !(isCreating && draft.provider === provider) && (
                  <div className="rounded-2xl border border-dashed border-border/80 bg-muted/30 px-4 py-5 text-center text-xs leading-5 text-muted-foreground">
                    暂无已保存账号，点击右侧“新建”先创建一个该 Provider 的草稿账号
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div className="rounded-2xl border border-border bg-background p-4 flex flex-col">
        {selectedProfile || isCreating ? (
          <ProviderProfileEditor
            badge={isCreating ? "新建账号" : undefined}
            description={description}
            draft={draft}
            mode={isCreating ? "create" : "edit"}
            onChangeDraft={(next) => setDraft({ ...next, model: next.model ?? null })}
            onDelete={
              isCreating || !selectedProfile ? undefined : () => requestDelete(selectedProfile)
            }
            onInspectProviderAccount={onInspectProviderAccount}
            onSaveProfile={handleSaveProfile}
            onTestProfile={onTestProfile}
            resetKey={`${isCreating ? "create" : "edit"}-${selectedProfile?.id ?? draft.provider}`}
            selectedProfile={selectedProfile}
            title={title}
          />
        ) : (
          <div className="flex h-full min-h-[460px] flex-col justify-center rounded-2xl border border-dashed border-border bg-card/40 px-8 py-10">
            <div className="mx-auto w-full max-w-2xl text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 shadow-sm">
                <Layers3 size={26} />
              </div>
              <div className="mt-5 text-xl font-semibold text-foreground">账号设置说明</div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                这里用于统一维护 Claude Code 与 Codex 的账号配置。右侧在未新建或未编辑时默认展示说明页，避免保留草稿态；保存完成后也会回到这个状态。
              </p>
            </div>

            <div className="mx-auto mt-8 grid w-full max-w-3xl gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background px-4 py-4 text-left shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Plus className="text-sky-700" size={16} />
                  新建与编辑
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  左侧点击“新建”开始配置；点击已保存账号可进入编辑。Provider 类型创建后固定，避免混淆不同运行方式。
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background px-4 py-4 text-left shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="text-emerald-700" size={16} />
                  使用约定
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  第三方模式填写 Base URL、API Key 和可选模型；官方或系统模式则复用本机登录态，不需要再填密钥。
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background px-4 py-4 text-left shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CheckCircle2 className="text-amber-600" size={16} />
                  保存后行为
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  保存成功后会退出编辑态并回到说明页。需要继续修改时，可从左侧重新选择目标账号进入编辑。
                </p>
              </div>
            </div>

            <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border bg-background px-3 py-1.5">支持多第三方并行保存</span>
              <span className="rounded-full border border-border bg-background px-3 py-1.5">不同会话可绑定不同 Profile</span>
              <span className="rounded-full border border-border bg-background px-3 py-1.5">可随时查看日志排查连接问题</span>
            </div>
          </div>
        )}
      </div>
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/35 px-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-2">
              <h4 className="text-lg font-semibold text-foreground">确认删除账号？</h4>
              <p className="text-sm leading-6 text-muted-foreground">
                将删除“{deleteTarget.label}”。已绑定到会话或 pane 的账号会被解绑，但不会删除会话内容。
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                onClick={() => setDeleteTarget(null)}
                type="button"
              >
                取消
              </button>
              <button
                className="rounded-xl bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90"
                onClick={confirmDelete}
                type="button"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
