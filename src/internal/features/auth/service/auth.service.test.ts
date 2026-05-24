import { beforeEach, describe, expect, it } from 'bun:test';
import { createLogger } from '../../../shared/telemetry/logger';
import type { SessionRepository, UserRepository } from '../domain/repository';
import type { Session, User } from '../domain/user';
import { AuthService } from './auth.service';

// In-memory mock repositories
class MockUserRepo implements UserRepository {
  private users: Map<string, User> = new Map();
  async findByID(id: string) {
    return this.users.get(id) ?? null;
  }
  async findByEmail(email: string) {
    for (const u of this.users.values()) {
      if (u.email === email) return u;
    }
    return null;
  }
  async findByUsername(uname: string) {
    for (const u of this.users.values()) {
      if (u.username === uname) return u;
    }
    return null;
  }
  async create(user: User) {
    this.users.set(user.id, user);
  }
  async update(user: User) {
    this.users.set(user.id, user);
  }
  async delete(id: string) {
    this.users.delete(id);
  }
}

class MockSessionRepo implements SessionRepository {
  private sessions: Map<string, Session> = new Map();
  async findByToken(token: string) {
    return this.sessions.get(token) ?? null;
  }
  async create(session: Session) {
    this.sessions.set(session.token, session);
  }
  async delete(token: string) {
    this.sessions.delete(token);
  }
  async deleteByUserID(userId: string) {
    for (const [k, s] of this.sessions) {
      if (s.userId === userId) this.sessions.delete(k);
    }
  }
}

describe('AuthService', () => {
  let svc: AuthService;
  let userRepo: MockUserRepo;

  beforeEach(() => {
    userRepo = new MockUserRepo();
    const sessionRepo = new MockSessionRepo();
    const logger = createLogger('error', 'json');
    svc = new AuthService(
      userRepo,
      sessionRepo,
      'test-access-secret-key-minimum-32-characters!!',
      900000, // 15min
      604800000, // 7d
      logger,
    );
  });

  it('registers a new user and returns tokens', async () => {
    const result = await svc.register({
      username: 'alice',
      email: 'alice@test.com',
      password: 'password123',
      displayName: 'Alice',
    });
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.username).toBe('alice');
  });

  it('login succeeds with correct credentials', async () => {
    await svc.register({
      username: 'bob',
      email: 'bob@test.com',
      password: 'password123',
      displayName: 'Bob',
    });
    const result = await svc.login({
      email: 'bob@test.com',
      password: 'password123',
    });
    expect(result.accessToken).toBeTruthy();
  });

  it('login fails with wrong password', async () => {
    await svc.register({
      username: 'carol',
      email: 'carol@test.com',
      password: 'password123',
      displayName: 'Carol',
    });
    await expect(
      svc.login({ email: 'carol@test.com', password: 'wrong' }),
    ).rejects.toThrow();
  });

  it('validates a valid token', async () => {
    const { accessToken } = await svc.register({
      username: 'dave',
      email: 'dave@test.com',
      password: 'password123',
      displayName: 'Dave',
    });
    const user = await svc.validateToken(accessToken);
    expect(user.username).toBe('dave');
  });

  it('rejects an invalid token', async () => {
    await expect(svc.validateToken('invalid.token.here')).rejects.toThrow();
  });

  it('refreshes tokens successfully', async () => {
    const { refreshToken } = await svc.register({
      username: 'eve',
      email: 'eve@test.com',
      password: 'password123',
      displayName: 'Eve',
    });
    const result = await svc.refreshToken(refreshToken);
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it('rejects duplicate registration', async () => {
    await svc.register({
      username: 'frank',
      email: 'frank@test.com',
      password: 'password123',
      displayName: 'Frank',
    });
    await expect(
      svc.register({
        username: 'frank2',
        email: 'frank@test.com',
        password: 'password123',
        displayName: 'Frank2',
      }),
    ).rejects.toThrow();
  });

  it('logout succeeds', async () => {
    const result = await svc.register({
      username: 'grace',
      email: 'grace@test.com',
      password: 'password123',
      displayName: 'Grace',
    });
    await svc.logout(result.user.id);
    // Should not throw
  });
});
