"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";
import type { HealthResponse } from "@/lib/types";

type State = { kind: "loading" } | { kind: "ok"; health: HealthResponse } | { kind: "down" };

export function ApiStatus() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    getHealth()
      .then((health) => setState({ kind: "ok", health }))
      .catch(() => setState({ kind: "down" }));
  }, []);

  if (state.kind === "loading") return <p className="text-xs text-muted">Checking API…</p>;
  if (state.kind === "down") return <p className="text-xs text-danger">API unreachable</p>;
  const { health } = state;
  return (
    <div className="space-y-0.5 text-xs text-muted" data-testid="api-status">
      <p>
        API: <span className={health.status === "ok" ? "text-success" : "text-warning"}>{health.status}</span>
        {" · "}
        {health.environment}
      </p>
      <p>Anthropic: {health.dependencies.anthropic.mode === "mock" ? "mock mode" : "live"}</p>
    </div>
  );
}
