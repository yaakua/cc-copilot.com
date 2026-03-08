import type { ComposerTargetMode, Pane } from "../../../types/domain";

interface ComposerBarProps {
  value: string;
  paneCount: number;
  selectedPaneCount: number;
  activePane: Pane | null;
  onChange: (value: string) => void;
  onSend: (mode: ComposerTargetMode) => void;
}

const targetModes: Array<{ id: ComposerTargetMode; label: string }> = [
  { id: "active", label: "当前窗口" },
  { id: "selected", label: "选中窗口" },
  { id: "all", label: "全部窗口" },
];

export function ComposerBar({
  value,
  paneCount,
  selectedPaneCount,
  activePane,
  onChange,
  onSend,
}: ComposerBarProps) {
  return (
    <section className="composer-shell">
      <div className="composer-toolbar">
        <button className="composer-icon-button" type="button" aria-label="Attach">
          +
        </button>
        <div className="composer-targets">
          {targetModes.map((target) => (
            <button
              className="composer-target-chip"
              key={target.id}
              onClick={() => onSend(target.id)}
              type="button"
            >
              {target.label}
            </button>
          ))}
        </div>
        <div className="composer-status">
          <span>{paneCount} 个窗口</span>
          <span>{selectedPaneCount} 个已选</span>
          <span>{activePane ? activePane.title : "未激活"}</span>
        </div>
      </div>

      <div className="composer-input-shell">
        <textarea
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder="要求后续变更"
          rows={5}
          value={value}
        />
        <button className="composer-send-button" onClick={() => onSend("active")} type="button">
          ↑
        </button>
      </div>
    </section>
  );
}
