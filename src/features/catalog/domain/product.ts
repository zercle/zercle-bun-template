/**
 * Product is a sellable item held in the global catalog pool. Prices are
 * integer cents so the coin arithmetic on the payment path is exact; `stock`
 * is the number of units still available across every machine.
 */
export interface Product {
  id: string;
  name: string;
  priceCents: number;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}
