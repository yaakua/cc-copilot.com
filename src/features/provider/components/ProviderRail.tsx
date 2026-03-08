import { Cpu } from "lucide-react";
import type { ProviderState } from "../../../types/domain";
import { cn } from "../../../lib/utils";

interface ProviderRailProps {
  providers: ProviderState[];
}

export function ProviderRail({ providers }: ProviderRailProps) {
  return (
    <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Cpu size={18} className="text-muted-foreground" />
        <h3 className="font-semibold leading-none tracking-tight">Provider Runtime</h3>
      </div>

      <div className="grid gap-3">
        {providers.map((provider) => (
          <div className="flex items-center justify-between p-3 rounded-xl border bg-background/50 transition-colors hover:bg-muted/50" key={provider.id}>
            <div className="flex flex-col gap-1">
              <strong className="text-sm font-medium">{provider.label}</strong>
              <span className="text-xs text-muted-foreground">{provider.description}</span>
            </div>
            <span className={cn(
              "px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full",
              provider.availability === "ready" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                provider.availability === "missing" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            )}>
              {provider.availability}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
