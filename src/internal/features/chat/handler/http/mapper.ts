import type { Message } from '../../domain/message';
import type { Room, RoomMember } from '../../domain/room';
import type {
  GetMessagesResponse,
  ListRoomsResponse,
  MessageResponse,
  RoomMemberResponse,
  RoomResponse,
} from '../../dto/dto';

export function toRoomResponse(room: Room): RoomResponse {
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    type: room.type,
    owner_id: room.ownerId,
    member_count: room.memberCount,
    created_at: room.createdAt.toISOString(),
  };
}

export function toRoomListResponse(
  rooms: Room[],
  total: number,
): ListRoomsResponse {
  return {
    rooms: rooms.map(toRoomResponse),
    total,
  };
}

export function toMessageResponse(msg: Message): MessageResponse {
  const response: MessageResponse = {
    id: msg.id,
    room_id: msg.roomId,
    sender_id: msg.senderId,
    sender_username: msg.senderUsername,
    content: msg.content,
    message_type: msg.messageType,
    created_at: msg.createdAt.toISOString(),
  };
  if (msg.replyTo) {
    response.reply_to = msg.replyTo;
  }
  return response;
}

export function toMessageListResponse(
  messages: Message[],
  hasMore: boolean,
): GetMessagesResponse {
  return {
    messages: messages.map(toMessageResponse),
    has_more: hasMore,
  };
}

export function toMemberResponse(member: RoomMember): RoomMemberResponse {
  return {
    room_id: member.roomId,
    user_id: member.userId,
    username: member.username,
    display_name: member.displayName,
    avatar_url: member.avatarUrl,
    role: member.role,
    joined_at: member.joinedAt.toISOString(),
  };
}
