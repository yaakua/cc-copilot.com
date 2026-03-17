export function CodexIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/app-icon.png"
      alt="Copilot"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "cover", borderRadius: Math.max(3, Math.round(size * 0.2)) }}
    />
  );
}
