import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ParentBasedSampler, TraceIdRatioBasedSampler } from "@opentelemetry/sdk-trace-base";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import type { Config } from "../../config/config";

export const TracerKey = Symbol("Tracer");

export interface TracerHandle {
  shutdown(): Promise<void>;
}

function normalizeEndpoint(raw: string): string {
  if (raw.endsWith("/v1/traces")) {
    return raw;
  }
  return `${raw.replace(/\/+$/, "")}/v1/traces`;
}

export function startTracer(cfg: Config): Promise<TracerHandle | null> {
  if (cfg.otel.exporter === "none") {
    return Promise.resolve(null);
  }

  const exporter = new OTLPTraceExporter({ url: normalizeEndpoint(cfg.otel.endpoint) });
  const resource = resourceFromAttributes({ [SEMRESATTRS_SERVICE_NAME]: cfg.otel.service_name });

  const sdk = new NodeSDK({
    traceExporter: exporter,
    resource,
    sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(cfg.otel.sampling) }),
  });

  sdk.start();
  return Promise.resolve({ shutdown: () => sdk.shutdown() });
}
