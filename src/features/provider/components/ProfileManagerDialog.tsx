import { X } from "lucide-react";
import type { ProfileEditorIntent, ProviderProfile, ProviderState } from "../../../types/domain";
import { ProfileSettingsPanel } from "./ProfileSettingsPanel";

interface ProfileManagerDialogProps {
  profiles: ProviderProfile[];
  providers: ProviderState[];
  editorIntent?: ProfileEditorIntent | null;
  onClose: () => void;
  onSaveProfile: (profile: {
    id?: string | null;
    provider: "claude" | "codex";
    label: string;
    authKind: "apiKey" | "official" | "system";
    baseUrl: string;
    apiKey: string;
    model?: string | null;
  }) => Promise<unknown> | void;
  onTestProfile: (profile: {
    id?: string | null;
    provider: "claude" | "codex";
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
  onConsumeEditorIntent?: () => void;
  onDeleteProfile: (profileId: string) => void;
}

export function ProfileManagerDialog({
  profiles,
  providers,
  editorIntent,
  onClose,
  onSaveProfile,
  onTestProfile,
  onConsumeEditorIntent,
  onDeleteProfile,
}: ProfileManagerDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/30 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-[28px] border border-border bg-background p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-foreground">全局 Profile 设置</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              统一维护 Codex 和 Claude Code 的账号配置。这里新增或编辑后，可以在新会话或草稿窗口里直接切换使用。
            </p>
          </div>
          <button
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <ProfileSettingsPanel
          editorIntent={editorIntent}
          onConsumeEditorIntent={onConsumeEditorIntent}
          onDeleteProfile={onDeleteProfile}
          onSaveProfile={onSaveProfile}
          onTestProfile={onTestProfile}
          profiles={profiles}
          providers={providers}
        />
      </div>
    </div>
  );
}
