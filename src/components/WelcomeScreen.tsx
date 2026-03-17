import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { scanCliConfigs, autoImportCliProfiles, type DetectedCliConfig } from "../lib/backend";
import { ClaudeIcon } from "./icons/ClaudeIcon";
import { CodexIcon } from "./icons/CodexIcon";

interface WelcomeScreenProps {
  onStartSetup: () => void;
  onQuickStart: () => void;
}

export function WelcomeScreen({ onStartSetup, onQuickStart }: WelcomeScreenProps) {
  const [scanning, setScanning] = useState(true);
  const [importing, setImporting] = useState(false);
  const [configs, setConfigs] = useState<DetectedCliConfig[]>([]);
  const [profilesImported, setProfilesImported] = useState(false);

  useEffect(() => {
    async function scan() {
      try {
        const detected = await scanCliConfigs();
        setConfigs(detected);

        // Auto-import profiles if configs are detected
        if (detected.length > 0 && detected.some(c => c.has_auth)) {
          setImporting(true);
          try {
            await autoImportCliProfiles();
            setProfilesImported(true);
          } catch (error) {
            console.error("Failed to auto-import profiles:", error);
          } finally {
            setImporting(false);
          }
        }
      } catch (error) {
        console.error("Failed to scan CLI configs:", error);
      } finally {
        setScanning(false);
      }
    }
    void scan();
  }, []);

  const hasCodex = configs.some((c) => c.provider === "codex");
  const hasClaude = configs.some((c) => c.provider === "claude");

  return (
    <div className="flex h-full items-center justify-center bg-zinc-950 p-8">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-semibold text-zinc-100">
            欢迎使用 CC Copilot
          </h1>
          <p className="text-lg text-zinc-400">
            让我们开始设置，使用 AI 辅助编程
          </p>
        </div>

        {/* Scanning Status */}
        {scanning || importing ? (
          <div className="flex items-center justify-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-8">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            <span className="text-zinc-300">
              {scanning ? "正在扫描已安装的 CLI 工具..." : "正在导入配置..."}
            </span>
          </div>
        ) : (
          <>
            {/* Detection Results */}
            <div className="space-y-4">
              <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
                检测到的 CLI 工具
              </h2>

              {configs.length === 0 ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                      <p className="text-zinc-300 font-medium">
                        未检测到 CLI 工具
                      </p>
                      <p className="text-sm text-zinc-400">
                        我们在您的系统上找不到 codex 或 claude CLI 配置。
                        您需要手动配置 profile 才能开始使用。
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {hasCodex && (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                        <CodexIcon size={20} className="flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-zinc-100 font-medium">Codex CLI</p>
                          <p className="text-sm text-zinc-400 truncate">
                            找到配置：{configs.find((c) => c.provider === "codex")?.config_path}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {hasClaude && (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                        <ClaudeIcon size={20} className="flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-zinc-100 font-medium">Claude Code CLI</p>
                          <p className="text-sm text-zinc-400 truncate">
                            找到配置：{configs.find((c) => c.provider === "claude")?.config_path}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Next Steps */}
            <div className="space-y-4">
              <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
                下一步
              </h2>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
                {configs.length > 0 ? (
                  <>
                    <p className="text-zinc-300">
                      太好了！我们已经为您自动导入了检测到的 CLI 配置。
                    </p>
                    <p className="text-sm text-zinc-400">
                      点击下面的按钮开始使用。
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-zinc-300 font-medium">
                      安装 CLI 工具以获得最佳体验
                    </p>
                    <ul className="space-y-2 text-sm text-zinc-400">
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-600">•</span>
                        <span>
                          <strong className="text-zinc-300">Codex CLI</strong> - 从{" "}
                          <a
                            href="https://codex.dev"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline"
                          >
                            codex.dev
                          </a>{" "}
                          下载
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-600">•</span>
                        <span>
                          <strong className="text-zinc-300">Claude Code CLI</strong> - 从{" "}
                          <a
                            href="https://claude.ai/download"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline"
                          >
                            claude.ai/download
                          </a>{" "}
                          下载
                        </span>
                      </li>
                    </ul>
                    <p className="text-sm text-zinc-400">
                      安装后，您可以手动创建 profile 或使用自己的 API 密钥。
                    </p>
                  </>
                )}

                <button
                  onClick={configs.length > 0 && profilesImported ? onQuickStart : onStartSetup}
                  className="w-full rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition-colors"
                >
                  {configs.length > 0 && profilesImported ? "开始使用" : "手动设置"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
