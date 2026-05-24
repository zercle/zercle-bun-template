import * as argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import { newUUIDString } from '../../../../pkg/uuidgen/uuid';
import {
  AppError,
  ErrAlreadyExists,
  ErrInvalidCredentials,
  ErrTokenExpired,
  ErrTokenInvalid,
  ErrUserNotFound,
} from '../../../shared/errors/app-error';
import type { Logger } from '../../../shared/telemetry/logger';
import type { SessionRepository, UserRepository } from '../domain/repository';
import type { Session, User } from '../domain/user';
import { newUser, validateUser } from '../domain/user';
import type { AuthServiceInterface } from './interface';

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: User;
  expiresAt: number;
}

export class AuthService implements AuthServiceInterface {
  private accessSecret: Uint8Array;

  constructor(
    private readonly userRepo: UserRepository,
    private readonly sessionRepo: SessionRepository,
    accessSecret: string,
    private readonly accessTokenTtl: number,
    private readonly refreshTokenTtl: number,
    private readonly logger: Logger,
  ) {
    this.accessSecret = new TextEncoder().encode(accessSecret);
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) throw ErrAlreadyExists;

    const hashed = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const user = newUser(
      input.username,
      input.email,
      hashed,
      input.displayName,
    );
    validateUser(user);

    await this.userRepo.create(user);

    this.logger.info('user registered', { userId: user.id, email: user.email });
    return this.generateAuthResult(user);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(input.email);
    if (!user) throw ErrInvalidCredentials;

    const valid = await argon2.verify(user.password, input.password);
    if (!valid) throw ErrInvalidCredentials;

    this.logger.info('user logged in', { userId: user.id });
    return this.generateAuthResult(user);
  }

  async validateToken(token: string): Promise<User> {
    try {
      const { payload } = await jwtVerify(token, this.accessSecret);
      const userId = payload.sub;
      if (!userId) throw ErrTokenInvalid;

      const user = await this.userRepo.findByID(userId);
      if (!user) throw ErrUserNotFound;

      return user;
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (err instanceof Error && err.name === 'JWTExpired')
        throw ErrTokenExpired;
      throw ErrTokenInvalid;
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResult> {
    const session = await this.sessionRepo.findByToken(refreshToken);
    if (!session) throw ErrTokenInvalid;

    if (session.expiresAt < new Date()) throw ErrTokenExpired;

    const user = await this.userRepo.findByID(session.userId);
    if (!user) throw ErrUserNotFound;

    await this.sessionRepo.delete(refreshToken);

    return this.generateAuthResult(user);
  }

  async logout(userId: string): Promise<void> {
    await this.sessionRepo.deleteByUserID(userId);
    this.logger.info('user logged out', { userId });
  }

  private async generateAuthResult(user: User): Promise<AuthResult> {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + Math.floor(this.accessTokenTtl / 1000);

    const accessToken = await new SignJWT({ sub: user.id, name: user.username })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(this.accessSecret);

    const refreshToken = newUUIDString();
    const refreshExpires = new Date(Date.now() + this.refreshTokenTtl);

    const session: Session = {
      userId: user.id,
      token: refreshToken,
      expiresAt: refreshExpires,
    };

    await this.sessionRepo.create(session);

    return {
      accessToken,
      refreshToken,
      user,
      expiresAt: expiresAt,
    };
  }
}
