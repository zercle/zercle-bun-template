import promClient from "prom-client";

export const MeterKey = Symbol("Meter");

export function createMeterRegistry(): promClient.Registry {
  return promClient.register;
}

/**
 * Serve the Prometheus scrape endpoint.
 *
 * Elysia handlers may return a plain `Response`, so the scrape is rendered
 * here rather than in the framework.
 */
export function metricsHandler(): () => Promise<Response> {
  return async (): Promise<Response> => {
    const body = await promClient.register.metrics();
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": promClient.register.contentType },
    });
  };
}
