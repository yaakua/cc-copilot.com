import type { ProviderKind, ProviderProfile } from "../../types/domain";

export function maskApiKeyState(profile: ProviderProfile | null) {
  if (!profile) {
    return "未设置";
  }
  if (profile.authKind === "system") {
    return "使用系统登录";
  }
  return profile.apiKeyPresent ? "已保存到系统钥匙串" : "未设置";
}

export function nextProfileDefaults(
  provider: ProviderKind,
): Pick<ProviderProfile, "provider" | "authKind" | "label" | "baseUrl" | "model"> {
  return {
    provider,
    authKind: "system",
    label: provider === "claude" ? "New Claude Profile" : "New Codex Profile",
    baseUrl: "",
    model: provider === "codex" ? "gpt-5-codex" : null,
  };
}

export function providerAccent(profile: ProviderProfile | null) {
  if (!profile) {
    return "#9ca3af";
  }
  return profile.provider === "claude" ? "#0f766e" : "#2563eb";
}
