/**
 * Domain sentinel errors for the sales feature. They are mapped to HTTP
 * responses by the infrastructure error mapper, so their identity is part of the
 * feature's public surface.
 */
export const ErrProductNotFound = new Error("product not found");
export const ErrMachineNotFound = new Error("machine not found");
export const ErrInvalidID = new Error("sale id is invalid");
export const ErrUnsupportedCoin = new Error("unsupported coin");
export const ErrInsufficientPayment = new Error("insufficient payment");
export const ErrOutOfStock = new Error("product out of stock");
export const ErrExactChangeRequired = new Error("exact change required");
