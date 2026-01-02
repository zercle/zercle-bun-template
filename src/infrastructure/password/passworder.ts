import * as argon2 from "argon2";

export interface Argon2idConfig {
  memory: number;
  iterations: number;
  parallelism: number;
  salt_length: number;
  key_length: number;
}

export class Passworder {
  private config: Argon2idConfig;

  constructor(config: Argon2idConfig) {
    this.config = config;
  }

  async hashPassword(password: string): Promise<string> {
    try {
      return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: this.config.memory,
        timeCost: this.config.iterations,
        parallelism: this.config.parallelism,
        hashLength: this.config.key_length,
        saltLength: this.config.salt_length,
      });
    } catch (error) {
      throw new Error(
        `Failed to hash password: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      throw new Error(
        `Failed to verify password: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
