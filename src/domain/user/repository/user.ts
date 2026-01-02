import type { User, CreateUser, UpdateUser } from "../entity/user.js";
import type { DrizzleDatabase } from "../../../infrastructure/db/drizzle.js";
import { users } from "../../../infrastructure/db/drizzle.js";
import { eq, desc } from "drizzle-orm";
import type { Logger } from "../../../infrastructure/logger/logger.js";

export interface IUserRepository {
  create(user: CreateUser): Promise<User>;
  getByID(id: string): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;
  update(id: string, user: UpdateUser): Promise<User | null>;
  delete(id: string): Promise<void>;
  list(
    limit: number,
    offset: number,
  ): Promise<{ users: User[]; total: number }>;
}

export class UserRepository implements IUserRepository {
  constructor(
    private db: DrizzleDatabase,
    private logger: Logger,
  ) {}

  async create(user: CreateUser): Promise<User> {
    try {
      const [newUser] = await this.db.db
        .insert(users)
        .values({
          email: user.email,
          password: user.password,
          full_name: user.fullName,
          phone: user.phone ?? null,
          is_active: true,
        })
        .returning();

      return {
        id: newUser.id,
        email: newUser.email,
        password: newUser.password,
        fullName: newUser.full_name,
        phone: newUser.phone ?? undefined,
        isActive: newUser.is_active,
        createdAt: newUser.created_at,
        updatedAt: newUser.updated_at,
      };
    } catch (error) {
      this.logger.error("Failed to create user", { error });
      throw error;
    }
  }

  async getByID(id: string): Promise<User | null> {
    try {
      const user = await this.db.db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (user.length === 0) {
        return null;
      }

      const u = user[0];
      return {
        id: u.id,
        email: u.email,
        password: u.password,
        fullName: u.full_name,
        phone: u.phone ?? undefined,
        isActive: u.is_active,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      };
    } catch (error) {
      this.logger.error("Failed to get user by ID", { error, id });
      throw error;
    }
  }

  async getByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.db.db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (user.length === 0) {
        return null;
      }

      const u = user[0];
      return {
        id: u.id,
        email: u.email,
        password: u.password,
        fullName: u.full_name,
        phone: u.phone ?? undefined,
        isActive: u.is_active,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      };
    } catch (error) {
      this.logger.error("Failed to get user by email", { error, email });
      throw error;
    }
  }

  async update(id: string, user: UpdateUser): Promise<User | null> {
    try {
      const [updatedUser] = await this.db.db
        .update(users)
        .set({
          full_name: user.fullName,
          phone: user.phone ?? null,
          updated_at: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      if (!updatedUser) {
        return null;
      }

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        password: updatedUser.password,
        fullName: updatedUser.full_name,
        phone: updatedUser.phone ?? undefined,
        isActive: updatedUser.is_active,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at,
      };
    } catch (error) {
      this.logger.error("Failed to update user", { error, id });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.db.delete(users).where(eq(users.id, id));
    } catch (error) {
      this.logger.error("Failed to delete user", { error, id });
      throw error;
    }
  }

  async list(
    limit: number,
    offset: number,
  ): Promise<{ users: User[]; total: number }> {
    try {
      const userList = await this.db.db
        .select()
        .from(users)
        .orderBy(desc(users.created_at))
        .limit(limit)
        .offset(offset);

      const totalResult = await this.db.db
        .select({ count: users.id })
        .from(users);
      const total = totalResult.length;

      const usersList: User[] = userList.map((u) => ({
        id: u.id,
        email: u.email,
        password: u.password,
        fullName: u.full_name,
        phone: u.phone ?? undefined,
        isActive: u.is_active,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      }));

      return { users: usersList, total };
    } catch (error) {
      this.logger.error("Failed to list users", { error });
      throw error;
    }
  }
}
