import { useState } from "react";
import { X } from "lucide-react";
import type { BackendProviderAccountStatus } from "../../../lib/backend";
import type { ProviderKind } from "../../../types/domain";
import { ProviderProfileEditor } from "./ProviderProfileEditor";

interface QuickProfileDialogProps {
  provider: ProviderKind;
  onClose: () => void;
  onSave: (profile: {
    provider: ProviderKind;
    label: string;
    authKind: "apiKey" | "official" | "system";
    baseUrl: string;
    apiKey: string;
    model?: string | null;
    reuseCurrentLogin?: boolean | null;
    confirmedAccountEmail?: string | null;
  }) => Promise<unknown>;
  onTest: (profile: {
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
}

export function QuickProfileDialog({
  provider,
  onClose,
  onSave,
  onTest,
  onInspectProviderAccount,
}: QuickProfileDialogProps) {
  const [draft, setDraft] = useState({
    provider,
    label: "",
    authKind: provider === "codex" ? "official" : "system" as "apiKey" | "official" | "system",
    baseUrl: "",
    apiKey: "",
    model: provider === "codex" ? "gpt-5-codex" : "",
  });

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-[28px] border border-border bg-background p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div />
          <button
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <ProviderProfileEditor
          badge="新建可切换账号"
          description="会根据当前会话的 Provider 预填推荐项。当前弹窗内的 Provider 类型已固定。"
          draft={draft}
          mode="create"
          onCancel={onClose}
          onChangeDraft={(next) => setDraft({ ...next, model: next.model ?? "" })}
          onInspectProviderAccount={onInspectProviderAccount}
          onSaveProfile={async (profile) => {
            await onSave(profile);
            onClose();
          }}
          onTestProfile={onTest}
          resetKey={`quick-${provider}`}
          saveLabel="保存 Profile"
          title="新建一个可切换账号"
        />
      </div>
    </div>
  );
}
