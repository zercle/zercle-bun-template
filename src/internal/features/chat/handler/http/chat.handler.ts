import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Logger } from '../../../../shared/telemetry/logger';
import type { ChatServiceInterface } from '../../service/interface';
import {
  toMemberResponse,
  toMessageListResponse,
  toMessageResponse,
  toRoomListResponse,
  toRoomResponse,
} from './mapper';

const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional().default(''),
  type: z.enum(['public', 'private', 'direct']),
  member_ids: z.array(z.string().uuid()).optional().default([]),
});

const updateRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  message_type: z.string().max(20).optional().default('text'),
  reply_to: z.string().uuid().optional(),
});

const paginationQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

const messageQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  before: z.string().uuid().optional(),
});

export class ChatHandler {
  constructor(
    private readonly chatService: ChatServiceInterface,
    private readonly logger: Logger,
  ) {}

  registerRoutes(app: Hono): void {
    const chat = new Hono();

    // POST /chat/rooms
    chat.post('/rooms', zValidator('json', createRoomSchema), async (c) => {
      const body = c.req.valid('json');
      const userId = c.get('userId');

      const room = await this.chatService.createRoom({
        name: body.name,
        description: body.description,
        type: body.type,
        ownerId: userId,
        memberIds: body.member_ids,
      });

      return c.json(toRoomResponse(room), 201);
    });

    // GET /chat/rooms
    chat.get('/rooms', zValidator('query', paginationQuery), async (c) => {
      const userId = c.get('userId');
      const { limit, offset } = c.req.valid('query');

      const { rooms, total } = await this.chatService.listRooms(
        userId,
        limit,
        offset,
      );
      return c.json(toRoomListResponse(rooms, total));
    });

    // GET /chat/rooms/:id
    chat.get('/rooms/:id', async (c) => {
      const { id } = c.req.param();

      const room = await this.chatService.getRoom(id);
      return c.json(toRoomResponse(room));
    });

    // PUT /chat/rooms/:id
    chat.put('/rooms/:id', zValidator('json', updateRoomSchema), async (c) => {
      const { id } = c.req.param();
      const body = c.req.valid('json');

      const room = await this.chatService.updateRoom(
        id,
        body.name ?? '',
        body.description ?? '',
      );
      return c.json(toRoomResponse(room));
    });

    // DELETE /chat/rooms/:id
    chat.delete('/rooms/:id', async (c) => {
      const { id } = c.req.param();

      await this.chatService.deleteRoom(id);
      return c.body(null, 204);
    });

    // POST /chat/rooms/:id/join
    chat.post('/rooms/:id/join', async (c) => {
      const { id } = c.req.param();
      const userId = c.get('userId');

      await this.chatService.joinRoom(id, userId);
      return c.json({ message: 'joined room' });
    });

    // POST /chat/rooms/:id/leave
    chat.post('/rooms/:id/leave', async (c) => {
      const { id } = c.req.param();
      const userId = c.get('userId');

      await this.chatService.leaveRoom(id, userId);
      return c.json({ message: 'left room' });
    });

    // GET /chat/rooms/:id/members
    chat.get('/rooms/:id/members', async (c) => {
      const { id } = c.req.param();

      const members = await this.chatService.getRoomMembers(id);
      return c.json(members.map(toMemberResponse));
    });

    // POST /chat/rooms/:id/messages
    chat.post(
      '/rooms/:id/messages',
      zValidator('json', sendMessageSchema),
      async (c) => {
        const { id } = c.req.param();
        const body = c.req.valid('json');
        const userId = c.get('userId');

        const message = await this.chatService.sendMessage({
          roomId: id,
          senderId: userId,
          content: body.content,
          messageType: body.message_type,
          replyTo: body.reply_to ?? null,
        });

        this.logger.info('message sent', {
          messageId: message.id,
          roomId: id,
        });
        return c.json(toMessageResponse(message), 201);
      },
    );

    // GET /chat/rooms/:id/messages
    chat.get(
      '/rooms/:id/messages',
      zValidator('query', messageQuery),
      async (c) => {
        const { id } = c.req.param();
        const { limit, offset, before } = c.req.valid('query');

        const { messages, hasMore } = await this.chatService.getMessageHistory(
          id,
          limit,
          offset,
          before,
        );
        return c.json(toMessageListResponse(messages, hasMore));
      },
    );

    // Mount under /chat
    app.route('/chat', chat);
  }
}
