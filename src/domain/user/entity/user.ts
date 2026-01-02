export interface User {
  id: string;
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUser {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface UpdateUser {
  fullName?: string;
  phone?: string;
}
