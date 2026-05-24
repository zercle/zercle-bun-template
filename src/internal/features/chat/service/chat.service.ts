import {
  ErrAlreadyJoined,
  ErrNotMember,
  ErrRoomNotFound,
} from '../../../shared/errors/app-error';
import type { Logger } from '../../../shared/telemetry/logger';
import type { Message } from '../domain/message';
import { newMessage, validateMessage } from '../domain/message';
import type { MessageRepository, RoomRepository } from '../domain/repository';
import type { Room, RoomMember } from '../domain/room';
import { newRoom, validateRoom } from '../domain/room';
import type { ChatServiceInterface } from './interface';

interface PubSubService {
  publishMessage(channel: string, event: MessageEvent): Promise<void>;
}

interface MessageEvent {
  type: string;
  roomId: string;
  messageId: string;
  senderId: string;
  content: string;
  timestamp: number;
}

export interface CreateRoomInput {
  name: string;
  description: string;
  type: string;
  ownerId: string;
  memberIds: string[];
}

export interface SendMessageInput {
  roomId: string;
  senderId: string;
  content: string;
  messageType: string;
  replyTo?: string | null;
}

const DefaultRoomPageSize = 20;
const MaxRoomPageSize = 100;
const DefaultMessagePageSize = 50;
const MaxMessagePageSize = 100;

export class ChatService implements ChatServiceInterface {
  constructor(
    private readonly roomRepo: RoomRepository,
    private readonly messageRepo: MessageRepository,
    private readonly pubsub: PubSubService | null,
    private readonly logger: Logger,
  ) {}

  async createRoom(input: CreateRoomInput): Promise<Room> {
    const room = newRoom(
      input.name,
      input.description,
      input.type,
      input.ownerId,
    );
    validateRoom(room);

    await this.roomRepo.create(room);
    await this.roomRepo.addMember(room.id, input.ownerId, 'owner');

    for (const memberId of input.memberIds) {
      if (memberId !== input.ownerId) {
        await this.roomRepo.addMember(room.id, memberId, 'member');
      }
    }

    this.logger.info('room created', { roomId: room.id, type: room.type });
    return room;
  }

  async getRoom(roomId: string): Promise<Room> {
    const room = await this.roomRepo.findByID(roomId);
    if (!room) throw ErrRoomNotFound;
    return room;
  }

  async listRooms(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ rooms: Room[]; total: number }> {
    const l =
      limit > 0 && limit <= MaxRoomPageSize ? limit : DefaultRoomPageSize;
    return this.roomRepo.findByUserID(userId, l, offset);
  }

  async updateRoom(
    roomId: string,
    name: string,
    description: string,
  ): Promise<Room> {
    const room = await this.roomRepo.findByID(roomId);
    if (!room) throw ErrRoomNotFound;

    room.name = name;
    room.description = description;

    await this.roomRepo.update(room);
    return room;
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.roomRepo.delete(roomId);
    this.logger.info('room deleted', { roomId });
  }

  async joinRoom(roomId: string, userId: string): Promise<void> {
    const isMember = await this.roomRepo.isMember(roomId, userId);
    if (isMember) throw ErrAlreadyJoined;

    await this.roomRepo.addMember(roomId, userId, 'member');
    this.logger.info('user joined room', { roomId, userId });
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const isMember = await this.roomRepo.isMember(roomId, userId);
    if (!isMember) throw ErrNotMember;

    await this.roomRepo.removeMember(roomId, userId);
    this.logger.info('user left room', { roomId, userId });
  }

  async getRoomMembers(roomId: string): Promise<RoomMember[]> {
    return this.roomRepo.getMembers(roomId);
  }

  async sendMessage(input: SendMessageInput): Promise<Message> {
    const isMember = await this.roomRepo.isMember(input.roomId, input.senderId);
    if (!isMember) throw ErrNotMember;

    const msgType = input.messageType || 'text';
    const message = newMessage(
      input.roomId,
      input.senderId,
      input.content,
      msgType,
    );
    message.replyTo = input.replyTo ?? null;

    validateMessage(message);

    await this.messageRepo.create(message);

    if (this.pubsub) {
      try {
        const event: MessageEvent = {
          type: 'message',
          roomId: message.roomId,
          messageId: message.id,
          senderId: message.senderId,
          content: message.content,
          timestamp: message.createdAt.getTime(),
        };
        await this.pubsub.publishMessage(message.roomId, event);
      } catch (err) {
        this.logger.error('failed to publish message event', {
          roomId: message.roomId,
          error: String(err),
        });
      }
    }

    return message;
  }

  async getMessageHistory(
    roomId: string,
    limit: number,
    offset: number,
    before?: string | null,
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    const l =
      limit > 0 && limit <= MaxMessagePageSize ? limit : DefaultMessagePageSize;
    return this.messageRepo.findByRoomID(roomId, l, offset, before);
  }
}
