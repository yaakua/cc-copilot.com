import { useMemo } from "react";
import { Check, Globe, Key, Server, Sparkles, Trash2 } from "lucide-react";
import type { ProviderKind, ProviderProfile } from "../../../types/domain";
import { cn } from "../../../lib/utils";

export interface ProfileEditorDraft {
  provider: ProviderKind;
  label: string;
  authKind: "apiKey" | "official" | "system";
  baseUrl: string;
  apiKey: string;
  model?: string | null;
}

interface ProfileEditorFormProps {
  mode: "create" | "edit";
  draft: ProfileEditorDraft;
  selectedProfile?: ProviderProfile | null;
  isSaving?: boolean;
  isTesting?: boolean;
  feedback?: { ok: boolean; message: string } | null;
  saveLabel?: string;
  testLabel?: string;
  title?: string;
  description?: string;
  badge?: string;
  lockProvider?: boolean;
  onCancel?: () => void;
  onDelete?: () => void;
  onSave: () => void;
  onTest: () => void;
  onChange: (next: Partial<ProfileEditorDraft>) => void;
}

export function ProfileEditorForm({
  mode,
  draft,
  selectedProfile,
  isSaving = false,
  isTesting = false,
  feedback = null,
  saveLabel,
  testLabel,
  title,
  description,
  badge,
  lockProvider = false,
  onCancel,
  onDelete,
  onSave,
  onTest,
  onChange,
}: ProfileEditorFormProps) {
  const normalizedAuthKind =
    draft.provider === "codex" && draft.authKind === "system" ? "official" : draft.authKind;
  const providerLabel = draft.provider === "codex" ? "Codex" : "Claude Code";
  const helper = useMemo(() => {
    if (draft.provider === "codex") {
      return {
        system: "系统登录会直接复用本机 Codex CLI 的官方登录态，不需要填写 Base URL 或 API Key。",
        official:
          "为 Codex 创建独立 `CODEX_HOME`，可同时保存多个官方账号并切换，适合多账号管理。",
        api: "第三方模式适合 OpenAI 兼容网关。填写 Base URL、API Key，模型默认建议 `gpt-5-codex`。",
        placeholder: "https://api.example.com/v1",
      };
    }
    return {
      system: "系统登录会直接复用本机 Claude Code 的官方登录态，不需要填写 Base URL 或 API Key。",
      official: "",
      api: "第三方模式适合 Anthropic 兼容网关或代理。一般需要 Base URL、API Key，模型字段可选。",
      placeholder: "https://anthropic-gateway.example.com",
    };
  }, [draft.provider]);

  return (
    <div className="flex h-full flex-col">
      {(title || description || badge) && (
        <div className="space-y-2">
          {badge && (
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              <Sparkles size={14} />
              {badge}
            </div>
          )}
          {title && <h4 className="text-2xl font-semibold text-foreground">{title}</h4>}
          {description && (
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      <div className={cn("grid gap-3", title || description || badge ? "mt-6" : "")}>
        <div className="grid gap-3 md:grid-cols-2">
          <button
            className={cn(
              "rounded-2xl border p-4 text-left transition-colors",
              draft.provider === "claude"
                ? "border-sky-300 bg-sky-50"
                : "border-border bg-card hover:bg-muted/40",
              lockProvider && draft.provider !== "claude" ? "opacity-60" : "",
            )}
            disabled={lockProvider}
            onClick={() => onChange({ provider: "claude", authKind: "system", baseUrl: "", apiKey: "", model: null })}
            type="button"
          >
            <div className="text-sm font-semibold text-foreground">Claude Code</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              适合系统登录或 Anthropic 兼容网关。
            </p>
          </button>
          <button
            className={cn(
              "rounded-2xl border p-4 text-left transition-colors",
              draft.provider === "codex"
                ? "border-sky-300 bg-sky-50"
                : "border-border bg-card hover:bg-muted/40",
              lockProvider && draft.provider !== "codex" ? "opacity-60" : "",
            )}
            disabled={lockProvider}
            onClick={() =>
              onChange({
                provider: "codex",
                authKind: "official",
                model: draft.model?.trim() ? draft.model : "gpt-5-codex",
                baseUrl: normalizedAuthKind === "apiKey" ? draft.baseUrl : "",
                apiKey: normalizedAuthKind === "apiKey" ? draft.apiKey : "",
              })
            }
            type="button"
          >
            <div className="text-sm font-semibold text-foreground">Codex</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              支持系统登录、独立官方账号和 OpenAI 兼容网关。
            </p>
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {draft.provider === "codex" && (
            <button
              className={cn(
                "rounded-2xl border p-4 text-left transition-colors",
                normalizedAuthKind === "official"
                  ? "border-sky-300 bg-sky-50"
                  : "border-border bg-card hover:bg-muted/40",
              )}
              onClick={() =>
                onChange({
                  authKind: "official",
                  baseUrl: "",
                  apiKey: "",
                  model: draft.model?.trim() ? draft.model : "gpt-5-codex",
                })
              }
              type="button"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Server size={16} />
                官方账号（独立）
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{helper.official}</p>
            </button>
          )}

          {draft.provider === "claude" && (
            <button
              className={cn(
                "rounded-2xl border p-4 text-left transition-colors",
                normalizedAuthKind === "system"
                  ? "border-sky-300 bg-sky-50"
                  : "border-border bg-card hover:bg-muted/40",
              )}
              onClick={() => onChange({ authKind: "system", baseUrl: "", apiKey: "" })}
              type="button"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Server size={16} />
                系统登录 / 官方账号
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{helper.system}</p>
            </button>
          )}

          <button
            className={cn(
              "rounded-2xl border p-4 text-left transition-colors",
              normalizedAuthKind === "apiKey"
                ? "border-sky-300 bg-sky-50"
                : "border-border bg-card hover:bg-muted/40",
            )}
            onClick={() => onChange({ authKind: "apiKey" })}
            type="button"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Globe size={16} />
              第三方 Provider
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{helper.api}</p>
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-muted-foreground">Profile 名称</span>
          <input
            className="rounded-xl border bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            onChange={(event) => onChange({ label: event.currentTarget.value })}
            placeholder={`${providerLabel} Profile`}
            value={draft.label}
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-muted-foreground">模型</span>
          <input
            className="rounded-xl border bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={normalizedAuthKind !== "apiKey" && draft.provider !== "codex"}
            onChange={(event) => onChange({ model: event.currentTarget.value })}
            placeholder={draft.provider === "codex" ? "gpt-5-codex" : "可留空"}
            value={draft.model ?? ""}
          />
        </label>

        <label className="md:col-span-2 flex flex-col gap-2 text-sm">
          <span className="font-medium text-muted-foreground">Base URL</span>
          <div className="relative">
            <Globe
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"
              size={16}
            />
            <input
              className="w-full rounded-xl border bg-background py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={normalizedAuthKind !== "apiKey"}
              onChange={(event) => onChange({ baseUrl: event.currentTarget.value })}
              placeholder={
                normalizedAuthKind === "apiKey" ? helper.placeholder : "官方账号不需要 Base URL"
              }
              value={draft.baseUrl}
            />
          </div>
        </label>

        <label className="md:col-span-2 flex flex-col gap-2 text-sm">
          <span className="font-medium text-muted-foreground">API Key</span>
          <div className="relative">
            <Key
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"
              size={16}
            />
            <input
              className="w-full rounded-xl border bg-background py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={normalizedAuthKind !== "apiKey"}
              onChange={(event) => onChange({ apiKey: event.currentTarget.value })}
              placeholder={
                normalizedAuthKind === "apiKey"
                  ? selectedProfile
                    ? "留空则保留当前 Key"
                    : "sk-..."
                  : "官方账号不需要 API Key"
              }
              type="password"
              value={draft.apiKey}
            />
          </div>
        </label>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
        {normalizedAuthKind === "apiKey"
          ? helper.api
          : normalizedAuthKind === "official" && draft.provider === "codex"
            ? "保存后会立即打开独立的 Codex 登录窗口。登录完成后，这个官方账号会作为单独 profile 出现在切换菜单中。"
            : helper.system}
      </div>

      {feedback && (
        <div
          className={cn(
            "mt-4 rounded-2xl border px-4 py-3 text-sm",
            feedback.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700",
          )}
        >
          {feedback.message}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isTesting || isSaving}
            onClick={onTest}
            type="button"
          >
            <Check size={16} />
            {testLabel ??
              (isTesting
                ? "测试中..."
                : normalizedAuthKind === "apiKey"
                  ? "先测试连接"
                  : "验证当前登录")}
          </button>

          {mode === "edit" && onDelete && selectedProfile && (
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10"
              onClick={onDelete}
              type="button"
            >
              <Trash2 size={16} />
              删除
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              className="rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted"
              onClick={onCancel}
              type="button"
            >
              取消
            </button>
          )}
          <button
            className="rounded-xl bg-foreground px-5 py-3 text-sm font-medium text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            onClick={onSave}
            type="button"
          >
            {saveLabel ??
              (isSaving
                ? "保存中..."
                : mode === "create" &&
                    normalizedAuthKind === "official" &&
                    draft.provider === "codex"
                  ? "创建并登录"
                  : "保存 Profile")}
          </button>
        </div>
      </div>
    </div>
  );
}
