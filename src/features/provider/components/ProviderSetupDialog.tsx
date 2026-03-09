import type {
  ProviderKind,
  ProviderProfile,
  ProviderSetupPrompt,
  ProviderState,
} from "../../../types/domain";

interface ProviderSetupDialogProps {
  prompt: ProviderSetupPrompt;
  providerState: ProviderState | null;
  existingProfiles: ProviderProfile[];
  onClose: () => void;
  onRetry: () => void;
  onLaunchOfficialLogin: (provider: ProviderKind) => void;
  onUseProfile: (profileId: string) => void;
  onConfigureThirdParty: () => void;
}

export function ProviderSetupDialog({
  prompt,
  providerState,
  existingProfiles,
  onClose,
  onRetry,
  onLaunchOfficialLogin,
  onUseProfile,
  onConfigureThirdParty,
}: ProviderSetupDialogProps) {
  const providerLabel = prompt.provider === "claude" ? "Claude Code" : "Codex";
  const cliMissing = providerState?.availability === "missing";

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/30 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-border bg-background p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{providerLabel} 还没有可用登录</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            你可以先完成官方登录再重试当前消息，或者改用第三方 provider 新建一个会话继续。
          </p>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {prompt.failureMessage}
          </p>
          {cliMissing && (
            <p className="text-sm text-muted-foreground">
              当前机器上还没有检测到 {providerLabel} CLI，官方登录入口可能不可用。
            </p>
          )}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-4">
            <h4 className="text-sm font-semibold text-foreground">官方登录</h4>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              打开 CLI 登录流程，完成后回到这里重试当前消息。
            </p>
            <div className="mt-4 flex gap-2">
              <button
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={cliMissing}
                onClick={() => onLaunchOfficialLogin(prompt.provider)}
                type="button"
              >
                官方登录
              </button>
              <button
                className="rounded-lg border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                onClick={onRetry}
                type="button"
              >
                已登录，重试当前消息
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h4 className="text-sm font-semibold text-foreground">第三方 Provider</h4>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              使用 OpenAI 兼容网关、代理地址或团队共享账号，通过 Base URL 和 API Key 直接创建会话。
            </p>
            <div className="mt-4 flex gap-2">
              <button
                className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
                onClick={onConfigureThirdParty}
                type="button"
              >
                配置第三方 Provider
              </button>
            </div>
          </section>
        </div>

        {existingProfiles.length > 0 && (
          <section className="mt-6 rounded-2xl border border-border bg-card p-4">
            <h4 className="text-sm font-semibold text-foreground">已有第三方配置</h4>
            <div className="mt-3 grid gap-2">
              {existingProfiles.map((profile) => (
                <button
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-3 text-left hover:bg-muted/50"
                  key={profile.id}
                  onClick={() => onUseProfile(profile.id)}
                  type="button"
                >
                    <div>
                      <div className="text-sm font-medium text-foreground">{profile.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {profile.baseUrl || "已保存 API Key"}{profile.model ? ` · ${profile.model}` : ""}
                      </div>
                    </div>
                  <span className="text-xs font-medium text-primary">新建会话使用</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="mt-6 flex justify-end">
          <button
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
            onClick={onClose}
            type="button"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
