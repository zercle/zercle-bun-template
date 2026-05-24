export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  display_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface UserDTO {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar_url: string;
  status: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: UserDTO;
  expires_at: number;
}
