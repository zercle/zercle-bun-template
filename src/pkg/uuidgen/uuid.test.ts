import { describe, expect, it } from 'bun:test';
import { newUUID, newUUIDString } from './uuid';

describe('uuidgen', () => {
  it('generates a valid UUID', () => {
    const id = newUUID();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('newUUIDString returns a string', () => {
    const id = newUUIDString();
    expect(typeof id).toBe('string');
    expect(id.length).toBe(36);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newUUID()));
    expect(ids.size).toBe(100);
  });
});
