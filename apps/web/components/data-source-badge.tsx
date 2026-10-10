import { clsx } from "clsx";
import type { DataOrigin } from "@/lib/types";

const STYLES: Record<DataOrigin, string> = {
  real: "border-success/30 bg-success/10 text-success",
  synthetic: "border-warning/30 bg-warning/10 text-warning",
  forecast: "border-accent/30 bg-accent-tint text-accent",
};

const LABELS: Record<DataOrigin, string> = {
  real: "Live traffic",
  synthetic: "Synthetic demo data",
  forecast: "Forecast",
};

export function DataSourceBadge({ origin }: { origin: DataOrigin }) {
  return (
    <span className={clsx("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", STYLES[origin])}>
      {LABELS[origin]}
    </span>
  );
}
