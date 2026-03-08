import { useEffect, useMemo, useState } from "react";
import type { ProviderKind, ProviderProfile, ProviderState } from "../../../types/domain";
import { maskApiKeyState, nextProfileDefaults, providerAccent } from "../useProviderProfiles";

interface ProfileSettingsPanelProps {
  profiles: ProviderProfile[];
  providers: ProviderState[];
  activePaneId: string | null;
  onSaveProfile: (profile: {
    id?: string | null;
    provider: ProviderKind;
    label: string;
    authKind: "apiKey" | "system";
    baseUrl: string;
    apiKey: string;
    model?: string | null;
  }) => void;
  onTestProfile: (profile: {
    id?: string | null;
    provider: ProviderKind;
    label?: string | null;
    authKind: "apiKey" | "system";
    baseUrl: string;
    apiKey: string;
    model?: string | null;
  }) => Promise<{
    ok: boolean;
    latencyMs: number;
    message: string;
  }>;
  onLaunchProviderLogin: (provider: ProviderKind) => void;
  onDeleteProfile: (profileId: string) => void;
}

export function ProfileSettingsPanel({
  profiles,
  providers,
  activePaneId,
  onSaveProfile,
  onTestProfile,
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

  return (
    <section className="detail-card profile-settings-card">
      <div className="detail-card-header">
        <div className="detail-card-title">
          <span>账号配置</span>
          <strong>Pane profiles</strong>
        </div>
        <div className="profile-header-actions">
          <button
            className="toolbar-button"
            onClick={() => onLaunchProviderLogin("claude")}
            type="button"
          >
            Connect Claude
          </button>
          <button
            className="toolbar-button"
            onClick={() => onLaunchProviderLogin("codex")}
            type="button"
          >
            Connect Codex
          </button>
          <span className="detail-badge detail-badge-ready">
            {activePaneId ? "已启用" : "待绑定"}
          </span>
        </div>
      </div>

      <div className="profile-list">
        {profiles.map((profile) => (
          <button
            className={
              profile.id === selectedProfileId
                ? "profile-pill profile-pill-active"
                : "profile-pill"
            }
            key={profile.id}
            onClick={() => setSelectedProfileId(profile.id)}
            type="button"
          >
            <span
              className="profile-pill-dot"
              style={{ backgroundColor: providerAccent(profile) }}
            />
            <div className="profile-pill-copy">
              <strong>{profile.label}</strong>
              <span>
                {profile.provider} · {maskApiKeyState(profile)}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="profile-editor">
        <div className="profile-editor-grid">
          <label className="profile-field">
            <span>Provider</span>
            <select
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

          <label className="profile-field">
            <span>Label</span>
            <input
              onChange={(event) =>
                setDraft((current) => ({ ...current, label: event.currentTarget.value }))
              }
              placeholder="Workspace label"
              value={draft.label}
            />
          </label>

          <label className="profile-field">
            <span>Auth</span>
            <select
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  authKind: event.currentTarget.value as "apiKey" | "system",
                  baseUrl:
                    event.currentTarget.value === "system" ? "" : current.baseUrl,
                  apiKey: event.currentTarget.value === "system" ? "" : current.apiKey,
                }))
              }
              value={draft.authKind}
            >
              <option value="system">系统登录</option>
              <option value="apiKey">API Key</option>
            </select>
          </label>

          <label className="profile-field">
            <span>Model</span>
            <input
              onChange={(event) =>
                setDraft((current) => ({ ...current, model: event.currentTarget.value }))
              }
              placeholder={draft.provider === "codex" ? "gpt-5-codex" : "可留空"}
              value={draft.model ?? ""}
            />
          </label>

          <label className="profile-field profile-field-wide">
            <span>Base URL</span>
            <input
              disabled={draft.authKind === "system"}
              onChange={(event) =>
                setDraft((current) => ({ ...current, baseUrl: event.currentTarget.value }))
              }
              placeholder={
                draft.authKind === "system"
                  ? "系统登录模式下不需要 Base URL"
                  : draft.provider === "claude"
                  ? "留空直连官方 Claude，填写则按 gateway/foundry 方式启动"
                  : "https://api.example.com/v1"
              }
              value={draft.baseUrl}
            />
          </label>

          <label className="profile-field profile-field-wide">
            <span>API Key</span>
            <input
              disabled={draft.authKind === "system"}
              onChange={(event) =>
                setDraft((current) => ({ ...current, apiKey: event.currentTarget.value }))
              }
              placeholder={
                draft.authKind === "system"
                  ? "系统登录模式下不需要 API Key"
                  : selectedProfile
                    ? "留空则保留当前 Key"
                    : "sk-..."
              }
              type="password"
              value={draft.apiKey}
            />
          </label>
        </div>

        <div className="profile-editor-actions">
          <button
            className="toolbar-button"
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
            新建
          </button>
          {selectedProfile ? (
            <button
              className="toolbar-button"
              onClick={() => onDeleteProfile(selectedProfile.id)}
              type="button"
            >
              删除
            </button>
          ) : null}
          <button
            className="toolbar-button"
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
            {isTesting ? "测试中..." : "测试连接"}
          </button>
          <button
            className="toolbar-button toolbar-button-primary"
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
            保存配置
          </button>
        </div>
        {testFeedback ? (
          <p
            className={
              testFeedback.ok
                ? "profile-test-feedback profile-test-feedback-ok"
                : "profile-test-feedback"
            }
          >
            {testFeedback.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
