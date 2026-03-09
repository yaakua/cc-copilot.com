import { useEffect, useState } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import type { BackendProviderAccountStatus } from "../../../lib/backend";
import { getLogFilePath } from "../../../lib/backend";
import type { ProviderKind, ProviderProfile } from "../../../types/domain";
import { ProfileEditorForm, type ProfileEditorDraft } from "./ProfileEditorForm";

interface ProviderProfileEditorProps {
  mode: "create" | "edit";
  draft: ProfileEditorDraft;
  selectedProfile?: ProviderProfile | null;
  title: string;
  description: string;
  badge?: string;
  saveLabel?: string;
  testLabel?: string;
  resetKey: string;
  onChangeDraft: (next: ProfileEditorDraft) => void;
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
  }) => Promise<unknown> | void;
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
  onCancel?: () => void;
  onDelete?: () => void;
}

export function ProviderProfileEditor({
  mode,
  draft,
  selectedProfile = null,
  title,
  description,
  badge,
  saveLabel,
  testLabel,
  resetKey,
  onChangeDraft,
  onSaveProfile,
  onTestProfile,
  onInspectProviderAccount,
  onCancel,
  onDelete,
}: ProviderProfileEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isOpeningLog, setIsOpeningLog] = useState(false);
  const [officialAccountStatus, setOfficialAccountStatus] =
    useState<BackendProviderAccountStatus | null>(null);
  const [officialAccountConfirmed, setOfficialAccountConfirmed] = useState(false);

  useEffect(() => {
    setFeedback(null);
    setOfficialAccountStatus(null);
    setOfficialAccountConfirmed(false);
  }, [resetKey]);

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSaveProfile({
        id: mode === "create" ? null : selectedProfile?.id ?? null,
        provider: draft.provider,
        label: draft.label.trim() || (draft.provider === "claude" ? "Claude Profile" : "Codex Profile"),
        authKind: draft.authKind,
        baseUrl: draft.baseUrl.trim(),
        apiKey: draft.apiKey.trim(),
        model: draft.model?.trim() ? draft.model.trim() : null,
        reuseCurrentLogin:
          draft.provider === "codex" &&
          draft.authKind === "official" &&
          officialAccountStatus?.isLoggedIn === true &&
          officialAccountConfirmed,
        confirmedAccountEmail: officialAccountConfirmed ? officialAccountStatus?.accountEmail ?? null : null,
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest() {
    setIsTesting(true);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    try {
      const result = await onTestProfile({
        id: mode === "create" ? null : selectedProfile?.id ?? null,
        provider: draft.provider,
        label: draft.label.trim() || null,
        authKind: draft.authKind,
        baseUrl: draft.baseUrl.trim(),
        apiKey: draft.apiKey.trim(),
        model: draft.model?.trim() ? draft.model.trim() : null,
      });
      setFeedback({ ok: result.ok, message: result.message });
      if (draft.provider === "codex" && draft.authKind === "official" && result.ok) {
        const accountStatus = await onInspectProviderAccount({
          provider: draft.provider,
          profileId: mode === "create" ? null : selectedProfile?.id ?? null,
        });
        setOfficialAccountStatus(accountStatus.isLoggedIn ? accountStatus : null);
        setOfficialAccountConfirmed(false);
      } else {
        setOfficialAccountStatus(null);
        setOfficialAccountConfirmed(false);
      }
    } catch (error) {
      setFeedback({
        ok: false,
        message: error instanceof Error ? error.message : "连接测试失败。",
      });
      setOfficialAccountStatus(null);
      setOfficialAccountConfirmed(false);
    } finally {
      setIsTesting(false);
    }
  }

  async function handleOpenLog() {
    setIsOpeningLog(true);
    try {
      const logPath = await getLogFilePath();
      await openPath(logPath);
    } catch (error) {
      setFeedback({
        ok: false,
        message: error instanceof Error ? error.message : "打开日志文件失败。",
      });
    } finally {
      setIsOpeningLog(false);
    }
  }

  return (
    <ProfileEditorForm
      badge={badge}
      description={description}
      draft={draft}
      feedback={feedback}
      isSaving={isSaving}
      isTesting={isTesting}
      mode={mode}
      officialAccountConfirmed={officialAccountConfirmed}
      officialAccountStatus={officialAccountStatus}
      isOpeningLog={isOpeningLog}
      onCancel={onCancel}
      onChange={(next) => {
        onChangeDraft({ ...draft, ...next });
        setFeedback(null);
        setOfficialAccountStatus(null);
        setOfficialAccountConfirmed(false);
      }}
      onDelete={onDelete}
      onOpenLog={handleOpenLog}
      onSave={handleSave}
      onTest={handleTest}
      onToggleOfficialAccountConfirmed={setOfficialAccountConfirmed}
      saveLabel={
        saveLabel ??
        (isSaving
          ? "保存中..."
          : mode === "create" && draft.authKind === "official" && draft.provider === "codex"
            ? officialAccountConfirmed
              ? "保存并复用当前登录"
              : "创建并登录"
            : "保存配置")
      }
      selectedProfile={selectedProfile}
      testLabel={
        testLabel ?? (isTesting ? "测试中..." : draft.authKind === "apiKey" ? "测试连接" : "验证当前登录")
      }
      title={title}
    />
  );
}
