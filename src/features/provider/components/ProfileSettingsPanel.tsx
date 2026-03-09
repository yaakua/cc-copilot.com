import { useEffect, useMemo, useState } from "react";
import { Settings2, Key, Globe, Trash2, Plus, Play, Check } from "lucide-react";
import type {
  ProfileEditorIntent,
  ProviderKind,
  ProviderProfile,
  ProviderState,
} from "../../../types/domain";
import { maskApiKeyState, nextProfileDefaults, providerAccent } from "../useProviderProfiles";
import { cn } from "../../../lib/utils";

interface ProfileSettingsPanelProps {
  profiles: ProviderProfile[];
  providers: ProviderState[];
  activePaneId: string | null;
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
  onLaunchProviderLogin: (provider: ProviderKind) => void;
  onDeleteProfile: (profileId: string) => void;
}

export function ProfileSettingsPanel({
  profiles,
  providers,
  activePaneId,
  onSaveProfile,
  onTestProfile,
  editorIntent,
  onConsumeEditorIntent,
  onLaunchProviderLogin,
  onDeleteProfile,
}: ProfileSettingsPanelProps) {
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

  useEffect(() => {
    if (selectedProfileId && profiles.some((profile) => profile.id === selectedProfileId)) {
      return;
    }
    setSelectedProfileId(profiles[0]?.id ?? null);
  }, [profiles, selectedProfileId]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  useEffect(() => {
    setTestFeedback(null);
  }, [selectedProfileId]);

  useEffect(() => {
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
  }, [providers, selectedProfile]);

  useEffect(() => {
    if (!editorIntent) {
      return;
    }

    setSelectedProfileId(null);
    setTestFeedback(null);
    setDraft({
      ...nextProfileDefaults(editorIntent.provider),
      authKind: editorIntent.authKind,
      apiKey: "",
    });
    onConsumeEditorIntent?.();
  }, [editorIntent, onConsumeEditorIntent]);

  return (
    <section className="p-5 rounded-2xl border bg-card text-card-foreground shadow-sm flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 size={18} className="text-muted-foreground" />
            <h3 className="font-semibold leading-none tracking-tight">账号配置</h3>
          </div>
          <span className={cn(
            "px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full",
            activePaneId ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
          )}>
            {activePaneId ? "已启用" : "待绑定"}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button
            className="flex-1 py-1.5 px-3 rounded text-sm font-medium border bg-background hover:bg-muted transition-colors focus:ring-2 focus:ring-ring"
            onClick={() => onLaunchProviderLogin("claude")}
            type="button"
          >
            Connect Claude
          </button>
          <button
            className="flex-1 py-1.5 px-3 rounded text-sm font-medium border bg-background hover:bg-muted transition-colors focus:ring-2 focus:ring-ring"
            onClick={() => onLaunchProviderLogin("codex")}
            type="button"
          >
            Connect Codex
          </button>
        </div>
      </div>

      {/* Profiles List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
        {profiles.map((profile) => (
          <button
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border text-left transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
              profile.id === selectedProfileId
                ? "border-primary bg-primary/5 shadow-sm"
                : "bg-background hover:bg-muted/50"
            )}
            key={profile.id}
            onClick={() => setSelectedProfileId(profile.id)}
            type="button"
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: providerAccent(profile) }}
            />
            <div className="flex flex-col truncate">
              <strong className="text-sm font-medium truncate">{profile.label}</strong>
              <span className="text-[11px] text-muted-foreground truncate">
                {profile.provider} · {maskApiKeyState(profile)}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="h-px bg-border" />

      {/* Profile Editor */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted-foreground">Provider</span>
            <select
              className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  provider: event.currentTarget.value as ProviderKind,
                }))
              }
              value={draft.provider}
            >
              <option value="claude">Claude</option>
              <option value="codex">Codex</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted-foreground">Label</span>
            <input
              className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              onChange={(event) =>
                setDraft((current) => ({ ...current, label: event.currentTarget.value }))
              }
              placeholder="Workspace label"
              value={draft.label}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted-foreground">Auth</span>
            <select
              className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  authKind: event.currentTarget.value as "apiKey" | "official" | "system",
                  baseUrl:
                    event.currentTarget.value === "apiKey" ? current.baseUrl : "",
                  apiKey: event.currentTarget.value === "apiKey" ? current.apiKey : "",
                }))
              }
              value={draft.authKind}
            >
              <option value="official">官方账号</option>
              <option value="system">系统登录</option>
              <option value="apiKey">API Key</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted-foreground">Model</span>
            <input
              className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              onChange={(event) =>
                setDraft((current) => ({ ...current, model: event.currentTarget.value }))
              }
              placeholder={draft.provider === "codex" ? "gpt-5-codex" : "可留空"}
              value={draft.model ?? ""}
            />
          </label>

          <label className="col-span-2 flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted-foreground">Base URL</span>
            <div className="relative flex items-center">
              <Globe className="absolute left-3 text-muted-foreground/50" size={16} />
              <input
                className="pl-9 pr-3 py-2 w-full rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={draft.authKind !== "apiKey"}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, baseUrl: event.currentTarget.value }))
                }
                placeholder={
                  draft.authKind !== "apiKey"
                    ? "官方/系统登录不需要 Base URL"
                    : draft.provider === "claude"
                      ? "留空直连官方 Claude，填写则按 gateway/foundry 方式启动"
                      : "https://api.example.com/v1"
                }
                value={draft.baseUrl}
              />
            </div>
          </label>

          <label className="col-span-2 flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted-foreground">API Key</span>
            <div className="relative flex items-center">
              <Key className="absolute left-3 text-muted-foreground/50" size={16} />
              <input
                className="pl-9 pr-3 py-2 w-full rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={draft.authKind !== "apiKey"}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, apiKey: event.currentTarget.value }))
                }
                placeholder={
                  draft.authKind !== "apiKey"
                    ? "官方/系统登录不需要 API Key"
                    : selectedProfile
                      ? "留空则保留当前 Key"
                      : "sk-..."
                }
                type="password"
                value={draft.apiKey}
              />
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 mt-2">
          <button
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 border rounded-md text-sm font-medium bg-background hover:bg-muted transition-colors focus:ring-2"
            onClick={() => {
              setSelectedProfileId(null);
              setDraft({
                ...nextProfileDefaults(draft.provider),
                apiKey: "",
              });
              setTestFeedback(null);
            }}
            type="button"
          >
            <Plus size={16} /> 新建
          </button>

          {selectedProfile && (
            <button
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-destructive/20 text-destructive rounded-md text-sm font-medium bg-destructive/5 hover:bg-destructive/10 transition-colors focus:ring-2"
              onClick={() => onDeleteProfile(selectedProfile.id)}
              type="button"
            >
              <Trash2 size={16} /> 删除
            </button>
          )}

          <button
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 border rounded-md text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors focus:ring-2"
            disabled={isTesting}
            onClick={async () => {
              setIsTesting(true);
              try {
                const result = await onTestProfile({
                  id: selectedProfile?.id ?? null,
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
            }}
            type="button"
          >
            <Play size={16} /> {isTesting ? "测试中..." : "测试连接"}
          </button>

          <button
            className="flex items-center justify-center gap-1.5 px-4 py-1.5 border border-primary rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm focus:ring-2"
            onClick={() =>
              onSaveProfile({
                id: selectedProfile?.id ?? null,
                provider: draft.provider,
                label:
                  draft.label.trim() ||
                  (draft.provider === "claude" ? "Claude Profile" : "Codex Profile"),
                authKind: draft.authKind,
                baseUrl: draft.baseUrl.trim(),
                apiKey: draft.apiKey.trim(),
                model: draft.model?.trim() ? draft.model.trim() : null,
              })
            }
            type="button"
          >
            <Check size={16} /> 保存配置
          </button>
        </div>

        {/* Feedback Message */}
        {testFeedback && (
          <div className={cn(
            "mt-2 p-3 text-sm rounded-lg border",
            testFeedback.ok ? "bg-green-50 text-green-700 border-green-200" : "bg-destructive/10 text-destructive border-destructive/20"
          )}>
            {testFeedback.message}
          </div>
        )}
      </div>
    </section>
  );
}
