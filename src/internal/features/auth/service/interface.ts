import type { User } from '../domain/user';
import type { AuthResult, LoginInput, RegisterInput } from './auth.service';

export interface AuthServiceInterface {
  register(input: RegisterInput): Promise<AuthResult>;
  login(input: LoginInput): Promise<AuthResult>;
  validateToken(token: string): Promise<User>;
  refreshToken(refreshToken: string): Promise<AuthResult>;
  logout(userId: string): Promise<void>;
}
