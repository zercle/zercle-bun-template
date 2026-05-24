import { newUUID } from '../../../../pkg/uuidgen/uuid';
import { ErrMessageContentRequired } from '../../../shared/errors/app-error';

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderUsername: string;
  content: string;
  messageType: string;
  replyTo?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export function newMessage(
  roomId: string,
  senderId: string,
  content: string,
  messageType: string,
): Message {
  const now = new Date();
  return {
    id: newUUID(),
    roomId,
    senderId,
    senderUsername: '',
    content,
    messageType: messageType || 'text',
    replyTo: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function validateMessage(m: Message): void {
  if (!m.content) throw ErrMessageContentRequired;
}
