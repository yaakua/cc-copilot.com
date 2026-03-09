import { useMemo, useState } from "react";
import { Check, Globe, Key, Server, Sparkles, X } from "lucide-react";
import type { ProviderKind } from "../../../types/domain";
import { cn } from "../../../lib/utils";

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

  const providerLabel = provider === "codex" ? "Codex" : "Claude Code";
  const helper = useMemo(() => {
    if (provider === "codex") {
      return {
        system: "系统登录会直接复用本机 Codex CLI 的官方登录态，不需要填写 Base URL 或 API Key。",
        api: "第三方模式适合 OpenAI 兼容网关。填写 Base URL、API Key，模型默认建议 `gpt-5-codex`。",
        placeholder: "https://api.example.com/v1",
      };
    }
    return {
      system: "系统登录会直接复用本机 Claude Code 的官方登录态，不需要填写 Base URL 或 API Key。",
      api: "第三方模式适合 Anthropic 兼容网关或代理。一般需要 Base URL、API Key，模型字段可选。",
      placeholder: "https://anthropic-gateway.example.com",
    };
  }, [provider]);

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave({
        provider,
        label: label.trim() || `${providerLabel} Profile`,
        authKind,
        baseUrl: authKind === "apiKey" ? baseUrl.trim() : "",
        apiKey: authKind === "apiKey" ? apiKey.trim() : "",
        model: authKind === "apiKey" ? model.trim() || null : provider === "codex" ? "gpt-5-codex" : null,
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
        provider,
        label: label.trim() || null,
        authKind,
        baseUrl: authKind === "apiKey" ? baseUrl.trim() : "",
        apiKey: authKind === "apiKey" ? apiKey.trim() : "",
        model: authKind === "apiKey" ? model.trim() || null : provider === "codex" ? "gpt-5-codex" : null,
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
        className="w-full max-w-2xl rounded-[28px] border border-border bg-background p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              <Sparkles size={14} />
              新建 {providerLabel} Profile
            </div>
            <h3 className="text-xl font-semibold text-foreground">为当前 Provider 添加一个可切换账号</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              会根据当前会话的 Provider 预填推荐项。发出第一条消息前，你可以把它直接切到当前会话。
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

        <div className={cn("mt-6 grid gap-4", provider === "codex" ? "md:grid-cols-3" : "md:grid-cols-2")}>
          {provider === "codex" && (
            <button
              className={cn(
                "rounded-2xl border p-4 text-left transition-colors",
                authKind === "official" ? "border-sky-300 bg-sky-50" : "border-border hover:bg-muted/40",
              )}
              onClick={() => {
                setAuthKind("official");
                setFeedback(null);
              }}
              type="button"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Server size={16} />
                官方账号（独立）
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                为 Codex 创建独立 `CODEX_HOME`，可同时保存多个官方账号并切换。
              </p>
            </button>
          )}
          <button
            className={cn(
              "rounded-2xl border p-4 text-left transition-colors",
              authKind === "system" ? "border-sky-300 bg-sky-50" : "border-border hover:bg-muted/40",
            )}
            onClick={() => {
              setAuthKind("system");
              setFeedback(null);
            }}
            type="button"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Server size={16} />
              系统登录 / 官方账号
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{helper.system}</p>
          </button>

          <button
            className={cn(
              "rounded-2xl border p-4 text-left transition-colors",
              authKind === "apiKey" ? "border-sky-300 bg-sky-50" : "border-border hover:bg-muted/40",
            )}
            onClick={() => {
              setAuthKind("apiKey");
              setFeedback(null);
            }}
            type="button"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Globe size={16} />
              第三方 Provider
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{helper.api}</p>
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-muted-foreground">Profile 名称</span>
            <input
              className="rounded-xl border bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
              onChange={(event) => setLabel(event.currentTarget.value)}
              placeholder={`${providerLabel} Profile`}
              value={label}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-muted-foreground">模型</span>
            <input
              className="rounded-xl border bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={authKind !== "apiKey" && provider !== "codex"}
              onChange={(event) => setModel(event.currentTarget.value)}
              placeholder={provider === "codex" ? "gpt-5-codex" : "可留空"}
              value={model}
            />
          </label>

          <label className="md:col-span-2 flex flex-col gap-2 text-sm">
            <span className="font-medium text-muted-foreground">Base URL</span>
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={16} />
              <input
                className="w-full rounded-xl border bg-background py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={authKind !== "apiKey"}
                onChange={(event) => setBaseUrl(event.currentTarget.value)}
                placeholder={authKind === "apiKey" ? helper.placeholder : "官方账号不需要 Base URL"}
                value={baseUrl}
              />
            </div>
          </label>

          <label className="md:col-span-2 flex flex-col gap-2 text-sm">
            <span className="font-medium text-muted-foreground">API Key</span>
            <div className="relative">
              <Key className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={16} />
              <input
                className="w-full rounded-xl border bg-background py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={authKind !== "apiKey"}
                onChange={(event) => setApiKey(event.currentTarget.value)}
                placeholder={authKind === "apiKey" ? "sk-..." : "官方账号不需要 API Key"}
                type="password"
                value={apiKey}
              />
            </div>
          </label>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          {authKind === "apiKey"
            ? helper.api
            : authKind === "official" && provider === "codex"
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

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
            disabled={isTesting || isSaving}
            onClick={handleTest}
            type="button"
          >
            <Check size={16} />
            {isTesting ? "测试中..." : authKind === "apiKey" ? "先测试连接" : "验证当前登录"}
          </button>
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted"
              onClick={onClose}
              type="button"
            >
              取消
            </button>
            <button
              className="rounded-xl bg-foreground px-5 py-3 text-sm font-medium text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
              onClick={handleSave}
              type="button"
            >
              {isSaving ? "保存中..." : authKind === "official" && provider === "codex" ? "创建并登录" : "保存 Profile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
