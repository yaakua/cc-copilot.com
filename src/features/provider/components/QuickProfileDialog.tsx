import { useState } from "react";
import { X } from "lucide-react";
import type { ProviderKind } from "../../../types/domain";
import { ProfileEditorForm } from "./ProfileEditorForm";

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
}

export function QuickProfileDialog({
  provider,
  onClose,
  onSave,
  onTest,
}: QuickProfileDialogProps) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderKind>(provider);
  const [authKind, setAuthKind] = useState<"apiKey" | "official" | "system">(
    provider === "codex" ? "official" : "system",
  );
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(provider === "codex" ? "gpt-5-codex" : "");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave({
        provider: selectedProvider,
        label: label.trim() || `${selectedProvider === "codex" ? "Codex" : "Claude Code"} Profile`,
        authKind,
        baseUrl: authKind === "apiKey" ? baseUrl.trim() : "",
        apiKey: authKind === "apiKey" ? apiKey.trim() : "",
        model:
          authKind === "apiKey"
            ? model.trim() || null
            : selectedProvider === "codex"
              ? "gpt-5-codex"
              : null,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest() {
    setIsTesting(true);
    try {
      const result = await onTest({
        provider: selectedProvider,
        label: label.trim() || null,
        authKind,
        baseUrl: authKind === "apiKey" ? baseUrl.trim() : "",
        apiKey: authKind === "apiKey" ? apiKey.trim() : "",
        model:
          authKind === "apiKey"
            ? model.trim() || null
            : selectedProvider === "codex"
              ? "gpt-5-codex"
              : null,
      });
      setFeedback({ ok: result.ok, message: result.message });
    } catch (error) {
      setFeedback({
        ok: false,
        message: error instanceof Error ? error.message : "连接测试失败。",
      });
    } finally {
      setIsTesting(false);
    }
  }

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

        <ProfileEditorForm
          badge="新建可切换账号"
          description="会根据当前会话的 Provider 预填推荐项。你也可以在这里直接切换到另一种 Provider 后再创建。"
          draft={{
            provider: selectedProvider,
            label,
            authKind,
            baseUrl,
            apiKey,
            model,
          }}
          feedback={feedback}
          isSaving={isSaving}
          isTesting={isTesting}
          mode="create"
          onCancel={onClose}
          onChange={(next) => {
            if (next.provider !== undefined) setSelectedProvider(next.provider);
            if (next.label !== undefined) setLabel(next.label);
            if (next.authKind !== undefined) setAuthKind(next.authKind);
            if (next.baseUrl !== undefined) setBaseUrl(next.baseUrl);
            if (next.apiKey !== undefined) setApiKey(next.apiKey);
            if (next.model !== undefined) setModel(next.model ?? "");
            setFeedback(null);
          }}
          onSave={handleSave}
          onTest={handleTest}
          saveLabel={
            isSaving
              ? "保存中..."
              : authKind === "official" && selectedProvider === "codex"
                ? "创建并登录"
                : "保存 Profile"
          }
          testLabel={
            isTesting ? "测试中..." : authKind === "apiKey" ? "先测试连接" : "验证当前登录"
          }
          title="新建一个可切换账号"
        />
      </div>
    </div>
  );
}
