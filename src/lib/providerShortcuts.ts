import type { ProviderKind } from "../types/domain";

export interface ProviderShortcutItem {
  id: string;
  label: string;
  value: string;
  description: string;
}

export interface ProviderShortcutCatalog {
  primaryCommands: ProviderShortcutItem[];
  moreCommands: ProviderShortcutItem[];
  primarySkills: ProviderShortcutItem[];
  moreSkills: ProviderShortcutItem[];
}

const CODEX_SHORTCUTS: ProviderShortcutCatalog = {
  primaryCommands: [
    { id: "status", label: "/status", value: "/status", description: "查看当前 Codex 会话状态" },
    { id: "review", label: "/review", value: "/review", description: "让 Codex 做代码审查" },
    { id: "plan", label: "/plan", value: "/plan", description: "先输出实施计划" },
  ],
  moreCommands: [
    { id: "tests", label: "测试", value: "Run the relevant tests for the current changes.", description: "执行相关测试" },
    { id: "explain", label: "解释实现", value: "Explain the current implementation and relevant files.", description: "解释当前实现" },
    { id: "summarize", label: "总结改动", value: "Summarize the current changes and remaining risks.", description: "总结当前改动" },
    { id: "next", label: "下一步", value: "What are the next best implementation steps from here?", description: "给出后续建议" },
  ],
  primarySkills: [
    { id: "next", label: "$next-best-practices", value: "$next-best-practices ", description: "Next.js 最佳实践" },
    { id: "playwriter", label: "$playwriter", value: "$playwriter ", description: "浏览器自动化与调试" },
    { id: "agent-browser", label: "$agent-browser", value: "$agent-browser ", description: "浏览器操作" },
  ],
  moreSkills: [
    { id: "vercel-react", label: "$vercel-react-best-practices", value: "$vercel-react-best-practices ", description: "React / Next 性能优化" },
    { id: "uiux", label: "$ui-ux-pro-max", value: "$ui-ux-pro-max ", description: "UI/UX 设计辅助" },
    { id: "reasoning", label: "$reasoning-personas", value: "$reasoning-personas ", description: "高阶推理模式" },
  ],
};

const CLAUDE_SHORTCUTS: ProviderShortcutCatalog = {
  primaryCommands: [
    { id: "init", label: "/init", value: "/init", description: "初始化当前项目上下文" },
    { id: "review", label: "/review", value: "/review", description: "对当前改动做代码审查" },
    { id: "context", label: "/context", value: "/context", description: "查看当前上下文摘要" },
  ],
  moreCommands: [
    { id: "cost", label: "/cost", value: "/cost", description: "查看当前会话成本" },
    { id: "compact", label: "/compact", value: "/compact", description: "压缩当前上下文" },
    { id: "insights", label: "/insights", value: "/insights", description: "查看当前会话洞察" },
    { id: "security", label: "/security-review", value: "/security-review", description: "执行安全审查" },
    { id: "release", label: "/release-notes", value: "/release-notes", description: "生成 release notes" },
  ],
  primarySkills: [
    { id: "next", label: "$next-best-practices", value: "$next-best-practices ", description: "Next.js 最佳实践" },
    { id: "playwriter", label: "$playwriter", value: "$playwriter ", description: "浏览器自动化与调试" },
    { id: "agent-browser", label: "$agent-browser", value: "$agent-browser ", description: "浏览器操作" },
  ],
  moreSkills: [
    { id: "uiux", label: "$ui-ux-pro-max", value: "$ui-ux-pro-max ", description: "UI/UX 设计辅助" },
    { id: "vercel-react", label: "$vercel-react-best-practices", value: "$vercel-react-best-practices ", description: "React / Next 性能优化" },
    { id: "writing", label: "$writing-skills", value: "$writing-skills ", description: "写作与技能编排" },
  ],
};

export function getProviderShortcutCatalog(provider: ProviderKind | null): ProviderShortcutCatalog | null {
  if (provider === "claude") {
    return CLAUDE_SHORTCUTS;
  }
  if (provider === "codex") {
    return CODEX_SHORTCUTS;
  }
  return null;
}
