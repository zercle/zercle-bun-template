/**
 * Inbound (driving) port of the sales feature.
 *
 * Driving adapters under `adapter/in` consume this interface; the use-case
 * implementation lives in `usecase.ts`. Methods speak the wire contract, so
 * adapters never touch the domain directly.
 */
import type { PurchaseRequest, PurchaseResponse } from "../contract/purchase.ts";

export interface SalesService {
  purchase(req: PurchaseRequest): Promise<PurchaseResponse>;
}
