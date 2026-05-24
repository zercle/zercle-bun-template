import type { Message } from '../domain/message';
import type { Room, RoomMember } from '../domain/room';
import type { CreateRoomInput, SendMessageInput } from './chat.service';

export interface ChatServiceInterface {
  createRoom(input: CreateRoomInput): Promise<Room>;
  getRoom(roomId: string): Promise<Room>;
  listRooms(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ rooms: Room[]; total: number }>;
  updateRoom(roomId: string, name: string, description: string): Promise<Room>;
  deleteRoom(roomId: string): Promise<void>;
  joinRoom(roomId: string, userId: string): Promise<void>;
  leaveRoom(roomId: string, userId: string): Promise<void>;
  getRoomMembers(roomId: string): Promise<RoomMember[]>;
  sendMessage(input: SendMessageInput): Promise<Message>;
  getMessageHistory(
    roomId: string,
    limit: number,
    offset: number,
    before?: string | null,
  ): Promise<{ messages: Message[]; hasMore: boolean }>;
}
