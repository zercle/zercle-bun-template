/**
 * Domain sentinel errors for the machines feature. They are mapped to HTTP
 * responses by the infrastructure error mapper, so their identity is part of
 * the feature's public surface.
 */
export const ErrMachineNotFound = new Error("machine not found");
export const ErrInvalidID = new Error("machine id is invalid");
export const ErrInvalidMachineLabel = new Error("machine label is invalid");
export const ErrUnsupportedCoin = new Error("unsupported coin");
