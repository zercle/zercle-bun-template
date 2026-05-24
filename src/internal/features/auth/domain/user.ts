import { newUUID } from '../../../../pkg/uuidgen/uuid';
import {
  ErrEmailRequired,
  ErrPasswordTooShort,
  ErrUsernameRequired,
} from '../../../shared/errors/app-error';

export type UserStatus = 'online' | 'away' | 'offline';

export interface User {
  readonly id: string;
  username: string;
  email: string;
  password: string;
  displayName: string;
  avatarUrl: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export function newUser(
  username: string,
  email: string,
  password: string,
  displayName: string,
): User {
  const now = new Date();
  return {
    id: newUUID(),
    username,
    email,
    password,
    displayName: displayName || username,
    avatarUrl: '',
    status: 'offline' as UserStatus,
    createdAt: now,
    updatedAt: now,
  };
}

export function validateUser(u: User): void {
  if (!u.username) throw ErrUsernameRequired;
  if (!u.email) throw ErrEmailRequired;
  if (u.password && u.password.length < 8) throw ErrPasswordTooShort;
}

export interface Session {
  userId: string;
  token: string;
  expiresAt: Date;
}
