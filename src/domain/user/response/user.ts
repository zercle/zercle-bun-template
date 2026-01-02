export interface UserResponse {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginResponse {
  token: string;
  user: UserResponse;
}

export interface ListUsersResponse {
  users: UserResponse[];
  total: number;
}
