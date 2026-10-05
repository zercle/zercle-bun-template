/**
 * Domain sentinel errors for the reporting feature. They are mapped to HTTP
 * responses by the infrastructure error mapper, so their identity is part of the
 * feature's public surface.
 */
export const ErrInvalidTopMachines = new Error("top machines limit is invalid");
