/**
 * Inbound (driving) service of the sales feature.
 *
 * Handlers under `handler` consume this interface; the use-case
 * implementation lives in `usecase.ts`. Methods speak the wire contract, so
 * handlers never touch the domain directly.
 */
import type { PurchaseRequest, PurchaseResponse } from "../contract/purchase.ts";

export interface SalesService {
  purchase(req: PurchaseRequest): Promise<PurchaseResponse>;
}
