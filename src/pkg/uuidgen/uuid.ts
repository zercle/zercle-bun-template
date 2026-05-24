import { randomUUID } from 'node:crypto';

export function newUUID(): string {
  return randomUUID();
}

export function newUUIDString(): string {
  return randomUUID();
}
