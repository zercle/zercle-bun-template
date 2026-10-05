/**
 * Inbound (driving) port of the reporting feature.
 *
 * Driving adapters under `adapter/in` consume this interface; the use-case
 * implementation lives in `usecase.ts`. Methods speak the wire contract, so
 * adapters never touch the domain directly.
 */
import type { SummaryRequest, SummaryResponse } from "../contract/summary.ts";

export interface ReportingService {
  summary(req: SummaryRequest): Promise<SummaryResponse>;
}
