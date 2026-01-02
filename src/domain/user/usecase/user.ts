import type { CreateUser, UpdateUser } from '../entity/user.js';
import { User } from '../entity/user.js';
import type { IUserRepository } from '../repository/user.js';
import type { RegisterUser, LoginUser } from '../request/user.js';
import type { UserResponse, LoginResponse, ListUsersResponse } from '../response/user.js';
import type { JWTConfig } from '../../../infrastructure/config/config.js';
import type { Passworder } from '../../../infrastructure/password/passworder.js';
import type { Logger } from '../../../infrastructure/logger/logger.js';
import { generateToken } from '../../../infrastructure/middleware/auth.js';

export class ErrUserNotFound extends Error {
  constructor() {
    super('User not found');
    this.name = 'ErrUserNotFound';
  }
}

export class ErrUserAlreadyExists extends Error {
  constructor() {
    super('User already exists');
    this.name = 'ErrUserAlreadyExists';
  }
}

export class ErrInvalidCredentials extends Error {
  constructor() {
    super('Invalid credentials');
    this.name = 'ErrInvalidCredentials';
  }
}

export interface IUserService {
  register(user: RegisterUser): Promise<LoginResponse>;
  login(user: LoginUser): Promise<LoginResponse>;
  getProfile(id: string): Promise<UserResponse>;
  updateProfile(id: string, user: UpdateUser): Promise<UserResponse>;
  deleteAccount(id: string): Promise<void>;
  listUsers(limit: number, offset: number): Promise<ListUsersResponse>;
}

export class UserUseCase implements IUserService {
  constructor(
    private repo: IUserRepository,
    private jwtConfig: JWTConfig,
    private passworder: Passworder,
    private logger: Logger,
  ) {}

  async register(user: RegisterUser): Promise<LoginResponse> {
    // Check if user already exists
    const existing = await this.repo.getByEmail(user.email);
    if (existing) {
      throw new ErrUserAlreadyExists();
    }

    // Hash password
    const hashedPassword = await this.passworder.hashPassword(user.password);

    // Create user
    const newUser: CreateUser = {
      email: user.email,
      password: hashedPassword,
      fullName: user.fullName,
      phone: user.phone,
    };

    const created = await this.repo.create(newUser);

    // Generate token
    const token = generateToken(created.id, created.email, this.jwtConfig);

    return {
      token,
      user: {
        id: created.id,
        email: created.email,
        fullName: created.fullName,
        phone: created.phone,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
    };
  }

  async login(user: LoginUser): Promise<LoginResponse> {
    // Get user by email
    const existing = await this.repo.getByEmail(user.email);
    if (!existing) {
      throw new ErrInvalidCredentials();
    }

    // Verify password
    const isValid = await this.passworder.verifyPassword(user.password, existing.password);
    if (!isValid) {
      throw new ErrInvalidCredentials();
    }

    // Generate token
    const token = generateToken(existing.id, existing.email, this.jwtConfig);

    return {
      token,
      user: {
        id: existing.id,
        email: existing.email,
        fullName: existing.fullName,
        phone: existing.phone,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      },
    };
  }

  async getProfile(id: string): Promise<UserResponse> {
    const user = await this.repo.getByID(id);
    if (!user) {
      throw new ErrUserNotFound();
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateProfile(id: string, user: UpdateUser): Promise<UserResponse> {
    // Validate full name length if provided
    if (user.fullName && user.fullName.length < 2) {
      throw new Error('Full name must be at least 2 characters');
    }

    const updated = await this.repo.update(id, user);
    if (!updated) {
      throw new ErrUserNotFound();
    }

    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      phone: updated.phone,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteAccount(id: string): Promise<void> {
    const user = await this.repo.getByID(id);
    if (!user) {
      throw new ErrUserNotFound();
    }

    await this.repo.delete(id);
  }

  async listUsers(limit: number, offset: number): Promise<ListUsersResponse> {
    const { users, total } = await this.repo.list(limit, offset);

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        phone: u.phone,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      total,
    };
  }
}
