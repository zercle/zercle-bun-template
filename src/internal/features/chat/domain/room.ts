import { newUUID } from '../../../../pkg/uuidgen/uuid';
import {
  ErrInvalidRoomType,
  ErrRoomNameRequired,
} from '../../../shared/errors/app-error';

export const RoomTypePublic = 'public';
export const RoomTypePrivate = 'private';
export const RoomTypeDirect = 'direct';

export interface Room {
  id: string;
  name: string;
  description: string;
  type: string;
  ownerId: string;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export function newRoom(
  name: string,
  description: string,
  roomType: string,
  ownerId: string,
): Room {
  const now = new Date();
  return {
    id: newUUID(),
    name,
    description,
    type: roomType,
    ownerId,
    memberCount: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function validateRoom(r: Room): void {
  if (!r.name) throw ErrRoomNameRequired;
  if (
    r.type !== RoomTypePublic &&
    r.type !== RoomTypePrivate &&
    r.type !== RoomTypeDirect
  ) {
    throw ErrInvalidRoomType;
  }
}

export interface RoomMember {
  roomId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: string;
  joinedAt: Date;
}

export const ErrRoomNameRequiredLocal = ErrRoomNameRequired;
export const ErrInvalidRoomTypeLocal = ErrInvalidRoomType;
