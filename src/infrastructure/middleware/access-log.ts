import type { Logger } from "pino";
import { getRequestState } from "./context.ts";
import { type MapResponseContext, responseStatus } from "./response-status.ts";

/**
 * Log one line per request with its method, path, status, and latency.
 *
 * `onAfterHandle` runs for every response the framework produces — handler
 * results and error envelopes alike — so the logged status is the one the
 * client actually receives.
 */
export function accessLog(logger: Logger): (context: MapResponseContext) => void {
  return (context) => {
    const state = getRequestState();
    logger.info(
      {
        request_id: state?.requestId ?? "",
        method: context.request.method,
        path: context.path,
        status: responseStatus(context),
        latency_ms: state ? Math.round(performance.now() - state.startedAt) : 0,
      },
      "http request",
    );
  };
}
