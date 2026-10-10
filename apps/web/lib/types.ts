export type ApiErrorBody = { error: { code: string; message: string; request_id: string } };

export type HealthResponse = {
  status: "ok" | "degraded";
  environment: string;
  dependencies: { database: string; anthropic: { mode: "mock" | "live"; model: string } };
  demo_mode: boolean;
  pricing_catalog_version: string;
};

export type DataOrigin = "real" | "synthetic" | "forecast";
