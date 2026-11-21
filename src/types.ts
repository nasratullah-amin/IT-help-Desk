export type UserRole = 'user' | 'technician' | 'admin';

export type TicketStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface User {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Ticket {
  id: number;
  userId: number;
  assignedTo: number | null;
  categoryId: number;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: number;
  ticketId: number;
  userId: number;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Attachment {
  id: number;
  ticketId: number;
  userId: number;
  originalName: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
  createdAt: Date;
}

export interface TicketHistory {
  id: number;
  ticketId: number;
  userId: number | null;
  action: string;
  fromValue: string | null;
  toValue: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: Date;
}
