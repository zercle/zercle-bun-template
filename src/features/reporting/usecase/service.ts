/**
 * Inbound (driving) service of the reporting feature.
 *
 * Handlers under `handler` consume this interface; the use-case
 * implementation lives in `usecase.ts`. Methods speak the wire contract, so
 * handlers never touch the domain directly.
 */
import type { SummaryRequest, SummaryResponse } from "../contract/summary.ts";

export interface ReportingService {
  summary(req: SummaryRequest): Promise<SummaryResponse>;
}
