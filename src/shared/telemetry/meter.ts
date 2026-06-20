import type { Context } from "hono";
import promClient from "prom-client";

export const MeterKey = Symbol("Meter");

export function createMeterRegistry(): promClient.Registry {
  return promClient.register;
}

export function metricsHandler(): (c: Context) => Promise<Response> {
  return async (c: Context): Promise<Response> => {
    const body = await promClient.register.metrics();
    return c.body(body, 200, { "Content-Type": promClient.register.contentType });
  };
}
