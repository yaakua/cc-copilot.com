import { useMemo } from "react";
import { Check, Globe, Key, Loader2, Server, Sparkles, Trash2 } from "lucide-react";
import type { ProviderKind, ProviderProfile } from "../../../types/domain";
import type { BackendProviderAccountStatus } from "../../../lib/backend";
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
  officialAccountStatus?: BackendProviderAccountStatus | null;
  officialAccountConfirmed?: boolean;
  onToggleOfficialAccountConfirmed?: (checked: boolean) => void;
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
  officialAccountStatus = null,
  officialAccountConfirmed = false,
  onToggleOfficialAccountConfirmed,
  onCancel,
  onDelete,
  onSave,
  onTest,
  onChange,
}: ProfileEditorFormProps) {
  const providerLabel = draft.provider === "codex" ? "Codex" : "Claude Code";
  const providerTone =
    draft.provider === "codex"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-teal-200 bg-teal-50 text-teal-700";
  const helper = useMemo(() => {
    if (draft.provider === "codex") {
      return {
        official:
          "为 Codex 创建独立 `CODEX_HOME`，可同时保存多个官方账号并切换，适合多账号管理。",
        api: "第三方模式适合 OpenAI 兼容网关。填写 Base URL、API Key，模型默认建议 `gpt-5-codex`。",
        placeholder: "https://api.example.com/v1",
      };
    }
    return {
      system: "系统登录会直接复用本机 Claude Code 的官方登录态，不需要填写 Base URL 或 API Key。",
      official: "",
      api: "第三方模式一般需要 Base URL、API Key，模型字段可选。",
      placeholder: "https://anthropic-gateway.example.com",
    };
  }, [draft.provider]);

  return (
    <div className="flex h-full flex-col">
      {(title || description || badge) && (
        <div className="space-y-1.5">
          {badge && (
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">
              <Sparkles size={14} />
              {badge}
            </div>
          )}
          {title && <h4 className="text-xl font-semibold text-foreground">{title}</h4>}
          {description && (
            <p className="text-[13px] leading-5 text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      <div className={cn("grid gap-2.5", title || description || badge ? "mt-4" : "")}>
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold", providerTone)}>
            {providerLabel}
          </span>
          <span className="text-[12px] text-muted-foreground">
            {mode === "create" ? "新建时已固定 Provider 类型" : "已有账号编辑时不能切换 Provider"}
          </span>
        </div>

        <div className="grid gap-2.5 md:grid-cols-2">
          {draft.provider === "codex" && (
            <button
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                draft.authKind === "official"
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
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                <Server size={14} />
                官方账号（独立）
              </div>
              <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{helper.official}</p>
            </button>
          )}

          {draft.provider === "claude" && (
            <button
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                draft.authKind === "system"
                  ? "border-sky-300 bg-sky-50"
                  : "border-border bg-card hover:bg-muted/40",
              )}
              onClick={() => onChange({ authKind: "system", baseUrl: "", apiKey: "" })}
              type="button"
            >
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                <Server size={14} />
                系统登录 / 官方账号
              </div>
              <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{helper.system}</p>
            </button>
          )}

          <button
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                draft.authKind === "apiKey"
                  ? "border-sky-300 bg-sky-50"
                  : "border-border bg-card hover:bg-muted/40",
              )}
            onClick={() => onChange({ authKind: "apiKey" })}
            type="button"
          >
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
              <Globe size={14} />
              第三方
            </div>
            <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{helper.api}</p>
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px]">
          <span className="font-medium text-muted-foreground">Profile 名称</span>
          <input
            className="rounded-lg border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-sky-300"
            onChange={(event) => onChange({ label: event.currentTarget.value })}
            placeholder={`${providerLabel} Profile`}
            value={draft.label}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-[13px]">
          <span className="font-medium text-muted-foreground">模型</span>
          <input
            className="rounded-lg border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={draft.authKind !== "apiKey" && draft.provider !== "codex"}
            onChange={(event) => onChange({ model: event.currentTarget.value })}
            placeholder={draft.provider === "codex" ? "gpt-5-codex" : "可留空"}
            value={draft.model ?? ""}
          />
        </label>

        <label className="md:col-span-2 flex flex-col gap-1.5 text-[13px]">
          <span className="font-medium text-muted-foreground">Base URL</span>
          <div className="relative">
            <Globe
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"
              size={14}
            />
            <input
              className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={draft.authKind !== "apiKey"}
              onChange={(event) => onChange({ baseUrl: event.currentTarget.value })}
              placeholder={
                draft.authKind === "apiKey" ? helper.placeholder : "当前模式不需要 Base URL"
              }
              value={draft.baseUrl}
            />
          </div>
        </label>

        <label className="md:col-span-2 flex flex-col gap-1.5 text-[13px]">
          <span className="font-medium text-muted-foreground">API Key</span>
          <div className="relative">
            <Key
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"
              size={14}
            />
            <input
              className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={draft.authKind !== "apiKey"}
              onChange={(event) => onChange({ apiKey: event.currentTarget.value })}
              placeholder={
                draft.authKind === "apiKey"
                  ? selectedProfile
                    ? "留空则保留当前 Key"
                    : "sk-..."
                  : "当前模式不需要 API Key"
              }
              type="password"
              value={draft.apiKey}
            />
          </div>
        </label>
      </div>

      {draft.authKind === "official" && draft.provider === "codex" && (
        <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] leading-5 text-sky-700">
          先点击“验证当前登录”。如果已检测到当前 Codex 登录账号并确认复用，保存时会直接写入该登录态；否则保存后会打开独立的 Codex 登录窗口。
        </div>
      )}

      {draft.authKind === "official" &&
        draft.provider === "codex" &&
        officialAccountStatus?.isLoggedIn && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-[12px] leading-5 text-emerald-800">
            <div className="font-semibold">已检测到当前 Codex 登录账号</div>
            <div className="mt-1">
              {officialAccountStatus.accountEmail ?? "未解析到邮箱"}
              {officialAccountStatus.accountPlan ? ` · ${officialAccountStatus.accountPlan}` : ""}
            </div>
            {officialAccountStatus.accountId && (
              <div className="mt-1 text-emerald-700/90">账号 ID: {officialAccountStatus.accountId}</div>
            )}
            <label className="mt-3 flex items-center gap-2 text-[12px] font-medium text-emerald-900">
              <input
                checked={officialAccountConfirmed}
                className="h-4 w-4 rounded border-emerald-300"
                onChange={(event) => onToggleOfficialAccountConfirmed?.(event.currentTarget.checked)}
                type="checkbox"
              />
              确认直接使用这个已登录账号保存，不再打开新的登录窗口
            </label>
          </div>
        )}

      {feedback && (
        <div
          className={cn(
            "mt-3 rounded-lg border px-3 py-2 text-[13px]",
            feedback.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700",
          )}
        >
          {feedback.message}
        </div>
      )}

      {isTesting && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          <Loader2 className="animate-spin" size={15} />
          <span>正在测试连接，请稍候…</span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[13px] font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isTesting || isSaving}
            onClick={onTest}
            type="button"
          >
            {isTesting ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
            {testLabel ??
              (isTesting
                ? "测试中..."
                : draft.authKind === "apiKey"
                  ? "先测试连接"
                  : "验证当前登录")}
          </button>

          {mode === "edit" && onDelete && selectedProfile && (
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2 text-[13px] font-medium text-destructive hover:bg-destructive/10"
              onClick={onDelete}
              type="button"
            >
              <Trash2 size={14} />
              删除
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              className="rounded-lg px-4 py-2 text-[13px] font-medium text-muted-foreground hover:bg-muted"
              onClick={onCancel}
              type="button"
            >
              取消
            </button>
          )}
          <button
            className="rounded-lg bg-foreground px-5 py-2 text-[13px] font-medium text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            onClick={onSave}
            type="button"
          >
            {saveLabel ??
              (isSaving
                ? "保存中..."
                : mode === "create" &&
                  draft.authKind === "official" &&
                  draft.provider === "codex"
                  ? "创建并登录"
                  : "保存 Profile")}
          </button>
        </div>
      </div>
    </div>
  );
}
