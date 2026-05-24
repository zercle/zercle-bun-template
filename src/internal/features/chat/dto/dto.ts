export interface CreateRoomRequest {
  name: string;
  description?: string;
  type: string;
  member_ids?: string[];
}

export interface UpdateRoomRequest {
  name?: string;
  description?: string;
}

export interface RoomResponse {
  id: string;
  name: string;
  description: string;
  type: string;
  owner_id: string;
  member_count: number;
  created_at: string;
}

export interface ListRoomsResponse {
  rooms: RoomResponse[];
  total: number;
}

export interface SendMessageRequest {
  content: string;
  message_type?: string;
  reply_to?: string;
}

export interface MessageResponse {
  id: string;
  room_id: string;
  sender_id: string;
  sender_username: string;
  content: string;
  message_type: string;
  reply_to?: string;
  created_at: string;
}

export interface GetMessagesResponse {
  messages: MessageResponse[];
  has_more: boolean;
}

export interface RoomMemberResponse {
  room_id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  role: string;
  joined_at: string;
}
