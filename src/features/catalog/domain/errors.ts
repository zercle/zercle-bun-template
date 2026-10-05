/**
 * Domain sentinel errors for the catalog feature. They are mapped to HTTP
 * responses by the infrastructure error mapper, so their identity is part of
 * the feature's public surface.
 */
export const ErrProductNotFound = new Error("product not found");
export const ErrInvalidID = new Error("product id is invalid");
export const ErrInvalidProductName = new Error("product name is invalid");
export const ErrInvalidPrice = new Error("product price is invalid");
