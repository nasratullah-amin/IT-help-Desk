import bcrypt from 'bcryptjs';
import {
  Attachment,
  Category,
  Comment,
  Ticket,
  TicketHistory,
  User,
} from './types.js';

export const users = new Map<number, User>();
export const categories = new Map<number, Category>();
export const tickets = new Map<number, Ticket>();
export const comments = new Map<number, Comment>();
export const attachments = new Map<number, Attachment>();
export const ticketHistories = new Map<number, TicketHistory>();

let nextUserId = 1;
let nextCategoryId = 1;
let nextTicketId = 1;
let nextCommentId = 1;
let nextAttachmentId = 1;
let nextHistoryId = 1;

export function allocateUserId(): number {
  return nextUserId++;
}

export function allocateCategoryId(): number {
  return nextCategoryId++;
}

export function allocateTicketId(): number {
  return nextTicketId++;
}

export function allocateCommentId(): number {
  return nextCommentId++;
}

export function allocateAttachmentId(): number {
  return nextAttachmentId++;
}

export function allocateHistoryId(): number {
  return nextHistoryId++;
}

export function findUserByEmail(email: string): User | undefined {
  const lower = email.trim().toLowerCase();
  for (const user of users.values()) {
    if (user.email.toLowerCase() === lower) {
      return user;
    }
  }
  return undefined;
}

export function findCategoryByName(name: string, ignoreId?: number): Category | undefined {
  const lower = name.trim().toLowerCase();
  for (const cat of categories.values()) {
    if (cat.id !== ignoreId && cat.name.toLowerCase() === lower) {
      return cat;
    }
  }
  return undefined;
}

export function seedInitialData(): void {
  if (users.size > 0) return;

  const now = new Date();

  const adminId = allocateUserId();
  users.set(adminId, {
    id: adminId,
    name: 'System Admin',
    email: 'admin@helpdesk.test',
    passwordHash: bcrypt.hashSync('Admin@12345', 10),
    role: 'admin',
    createdAt: now,
    updatedAt: now,
  });

  const techId = allocateUserId();
  users.set(techId, {
    id: techId,
    name: 'IT Technician',
    email: 'technician@helpdesk.test',
    passwordHash: bcrypt.hashSync('Tech@12345', 10),
    role: 'technician',
    createdAt: now,
    updatedAt: now,
  });

  const seededCategories: Array<{ name: string; description: string }> = [
    { name: 'Hardware', description: 'Computer, printer and device issues' },
    { name: 'Software', description: 'Operating system and application issues' },
    { name: 'Network', description: 'Internet, Wi-Fi and connectivity issues' },
    { name: 'Account Access', description: 'Login, password and account access issues' },
    { name: 'Security', description: 'Security incidents and access concerns' },
    { name: 'Other', description: 'Other technical support requests' },
  ];

  for (const item of seededCategories) {
    const id = allocateCategoryId();
    categories.set(id, {
      id,
      name: item.name,
      description: item.description,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }
}

seedInitialData();
