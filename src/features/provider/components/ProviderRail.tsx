import type { ProviderState } from "../../../types/domain";

interface ProviderRailProps {
  providers: ProviderState[];
}

export function ProviderRail({ providers }: ProviderRailProps) {
  return (
    <div className="detail-card">
      <div className="detail-card-header">
        <div className="detail-card-title">
          <span>运行环境</span>
          <strong>Provider runtime</strong>
        </div>
      </div>
      <div className="detail-chip-list">
        {providers.map((provider) => (
          <div className="detail-row" key={provider.id}>
            <div className="detail-card-title">
              <strong>{provider.label}</strong>
              <span>{provider.description}</span>
            </div>
            <span className={`detail-badge detail-badge-${provider.availability}`}>
              {provider.availability}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
