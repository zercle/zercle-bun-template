import type { Message } from './message';
import type { Room, RoomMember } from './room';

export interface RoomReader {
  findByID(id: string): Promise<Room | null>;
  findByUserID(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ rooms: Room[]; total: number }>;
  getMembers(roomId: string): Promise<RoomMember[]>;
  isMember(roomId: string, userId: string): Promise<boolean>;
}

export interface RoomWriter {
  create(room: Room): Promise<void>;
  update(room: Room): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface RoomMembershipManager {
  addMember(roomId: string, userId: string, role: string): Promise<void>;
  removeMember(roomId: string, userId: string): Promise<void>;
}

export interface RoomRepository
  extends RoomReader,
    RoomWriter,
    RoomMembershipManager {}

export interface MessageReader {
  findByID(id: string): Promise<Message | null>;
  findByRoomID(
    roomId: string,
    limit: number,
    offset: number,
    before?: string | null,
  ): Promise<{ messages: Message[]; hasMore: boolean }>;
}

export interface MessageWriter {
  create(message: Message): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface MessageRepository extends MessageReader, MessageWriter {}
