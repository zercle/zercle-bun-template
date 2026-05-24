import type { Session, User } from './user';

export interface UserReader {
  findByID(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
}

export interface UserWriter {
  create(user: User): Promise<void>;
  update(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface UserRepository extends UserReader, UserWriter {}

export interface SessionReader {
  findByToken(token: string): Promise<Session | null>;
}

export interface SessionWriter {
  create(session: Session): Promise<void>;
  delete(token: string): Promise<void>;
  deleteByUserID(userId: string): Promise<void>;
}

export interface SessionRepository extends SessionReader, SessionWriter {}
