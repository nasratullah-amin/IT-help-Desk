import bcrypt from 'bcryptjs';
import {
  Attachment,
  Category,
  Comment,
  Notification,
  NotificationType,
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
export const notifications = new Map<number, Notification>();

let nextUserId = 1;
let nextCategoryId = 1;
let nextTicketId = 1;
let nextCommentId = 1;
let nextAttachmentId = 1;
let nextHistoryId = 1;
let nextNotificationId = 1;

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

export function allocateNotificationId(): number {
  return nextNotificationId++;
}

export function findUserByEmail(email: string, ignoreId?: number): User | undefined {
  const lower = email.trim().toLowerCase();
  for (const user of users.values()) {
    if (user.id !== ignoreId && user.email.toLowerCase() === lower) {
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

export function createNotification(params: {
  userId: number;
  ticketId: number | null;
  type: NotificationType;
  title: string;
  message: string;
}): Notification {
  const id = allocateNotificationId();
  const notification: Notification = {
    id,
    userId: params.userId,
    ticketId: params.ticketId,
    type: params.type,
    title: params.title,
    message: params.message,
    isRead: false,
    createdAt: new Date(),
  };
  notifications.set(id, notification);
  return notification;
}

export function resetStore(): void {
  users.clear();
  categories.clear();
  tickets.clear();
  comments.clear();
  attachments.clear();
  ticketHistories.clear();
  notifications.clear();
  nextUserId = 1;
  nextCategoryId = 1;
  nextTicketId = 1;
  nextCommentId = 1;
  nextAttachmentId = 1;
  nextHistoryId = 1;
  nextNotificationId = 1;
  seedInitialData();
}

export function seedInitialData(): void {
  if (users.size > 0) return;

  const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

  const adminId = allocateUserId();
  users.set(adminId, {
    id: adminId,
    name: 'System Admin',
    email: 'admin@helpdesk.test',
    passwordHash: bcrypt.hashSync('Admin@12345', 10),
    role: 'admin',
    isActive: true,
    createdAt: hoursAgo(240),
    updatedAt: hoursAgo(240),
  });

  const tech1Id = allocateUserId();
  users.set(tech1Id, {
    id: tech1Id,
    name: 'IT Technician',
    email: 'technician@helpdesk.test',
    passwordHash: bcrypt.hashSync('Tech@12345', 10),
    role: 'technician',
    isActive: true,
    createdAt: hoursAgo(220),
    updatedAt: hoursAgo(220),
  });

  const tech2Id = allocateUserId();
  users.set(tech2Id, {
    id: tech2Id,
    name: 'Sara Mahmood',
    email: 'sara.tech@helpdesk.test',
    passwordHash: bcrypt.hashSync('Tech@12345', 10),
    role: 'technician',
    isActive: true,
    createdAt: hoursAgo(200),
    updatedAt: hoursAgo(200),
  });

  const user1Id = allocateUserId();
  users.set(user1Id, {
    id: user1Id,
    name: 'Ahmad Karim',
    email: 'user@helpdesk.test',
    passwordHash: bcrypt.hashSync('User@12345', 10),
    role: 'user',
    isActive: true,
    createdAt: hoursAgo(180),
    updatedAt: hoursAgo(180),
  });

  const user2Id = allocateUserId();
  users.set(user2Id, {
    id: user2Id,
    name: 'Layla Hassan',
    email: 'layla@helpdesk.test',
    passwordHash: bcrypt.hashSync('User@12345', 10),
    role: 'user',
    isActive: true,
    createdAt: hoursAgo(160),
    updatedAt: hoursAgo(160),
  });

  const seededCategories: Array<{ name: string; description: string }> = [
    { name: 'Hardware', description: 'Computer, printer and device issues' },
    { name: 'Software', description: 'Operating system and application issues' },
    { name: 'Network', description: 'Internet, Wi-Fi and connectivity issues' },
    { name: 'Account Access', description: 'Login, password and account access issues' },
    { name: 'Security', description: 'Security incidents and access concerns' },
    { name: 'Other', description: 'Other technical support requests' },
  ];

  const categoryIds: number[] = [];
  for (const item of seededCategories) {
    const id = allocateCategoryId();
    categoryIds.push(id);
    categories.set(id, {
      id,
      name: item.name,
      description: item.description,
      isActive: true,
      createdAt: hoursAgo(240),
      updatedAt: hoursAgo(240),
    });
  }

  // Seed realistic sample tickets for immediate academic evaluation
  const t1 = allocateTicketId();
  tickets.set(t1, {
    id: t1,
    userId: user1Id,
    assignedTo: tech1Id,
    categoryId: categoryIds[2], // Network
    subject: 'Campus Wi-Fi disconnects repeatedly in Engineering Lab B',
    description:
      'Every 10 to 15 minutes my laptop loses connection to the campus eduroam wireless network in Lab B. Other students at nearby desks are experiencing the same issue.',
    priority: 'high',
    status: 'in_progress',
    resolvedAt: null,
    createdAt: hoursAgo(48),
    updatedAt: hoursAgo(4),
  });

  const t2 = allocateTicketId();
  tickets.set(t2, {
    id: t2,
    userId: user2Id,
    assignedTo: null,
    categoryId: categoryIds[3], // Account Access
    subject: 'Unable to access student portal after password reset',
    description:
      'I reset my university portal password this morning and received the confirmation message, but logging in still returns an invalid credentials notice.',
    priority: 'critical',
    status: 'open',
    resolvedAt: null,
    createdAt: hoursAgo(12),
    updatedAt: hoursAgo(12),
  });

  const t3 = allocateTicketId();
  tickets.set(t3, {
    id: t3,
    userId: user1Id,
    assignedTo: tech1Id,
    categoryId: categoryIds[0], // Hardware
    subject: 'Projector HDMI port not detected in Lecture Hall 204',
    description:
      'The podium HDMI cable in Lecture Hall 204 shows No Signal when connected to both Windows and macOS laptops.',
    priority: 'medium',
    status: 'assigned',
    resolvedAt: null,
    createdAt: hoursAgo(26),
    updatedAt: hoursAgo(18),
  });

  const t4 = allocateTicketId();
  tickets.set(t4, {
    id: t4,
    userId: user1Id,
    assignedTo: tech2Id,
    categoryId: categoryIds[1], // Software
    subject: 'MATLAB license activation error on workstation PC-14',
    description:
      'Opening MATLAB on workstation PC-14 prompts for a network license server address and fails with License Manager Error -96.',
    priority: 'low',
    status: 'resolved',
    resolvedAt: hoursAgo(6),
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(6),
  });

  const t5 = allocateTicketId();
  tickets.set(t5, {
    id: t5,
    userId: user2Id,
    assignedTo: tech1Id,
    categoryId: categoryIds[4], // Security
    subject: 'Suspicious phishing email targeting CS department accounts',
    description:
      'Several students received an email claiming our university email quota is full with a link to an external login page.',
    priority: 'critical',
    status: 'closed',
    resolvedAt: hoursAgo(30),
    createdAt: hoursAgo(96),
    updatedAt: hoursAgo(24),
  });

  // Seed history entries for the sample tickets
  const addHist = (
    ticketId: number,
    userId: number,
    action: string,
    fromValue: string | null,
    toValue: string | null,
    note: string,
    createdAt: Date
  ) => {
    const id = allocateHistoryId();
    const isStatus = ['status_changed', 'ticket_resolved', 'ticket_closed'].includes(action);
    ticketHistories.set(id, {
      id,
      ticketId,
      userId,
      action,
      fromValue,
      toValue,
      fromStatus: isStatus ? fromValue : null,
      toStatus: isStatus ? toValue : null,
      note,
      createdAt,
    });
  };

  addHist(t1, user1Id, 'created', null, 'open', 'Ticket created', hoursAgo(48));
  addHist(t1, adminId, 'technician_assigned', 'Unassigned', 'IT Technician', 'Assigned to network support', hoursAgo(40));
  addHist(t1, tech1Id, 'status_changed', 'assigned', 'in_progress', 'Inspecting access point logs in Lab B', hoursAgo(4));

  addHist(t2, user2Id, 'created', null, 'open', 'Ticket created', hoursAgo(12));

  addHist(t3, user1Id, 'created', null, 'open', 'Ticket created', hoursAgo(26));
  addHist(t3, adminId, 'technician_assigned', 'Unassigned', 'IT Technician', 'Technician assignment changed', hoursAgo(18));

  addHist(t4, user1Id, 'created', null, 'open', 'Ticket created', hoursAgo(72));
  addHist(t4, adminId, 'technician_assigned', 'Unassigned', 'Sara Mahmood', 'Assigned to software team', hoursAgo(60));
  addHist(t4, tech2Id, 'ticket_resolved', 'in_progress', 'resolved', 'Updated license server hostname on PC-14', hoursAgo(6));

  addHist(t5, user2Id, 'created', null, 'open', 'Ticket created', hoursAgo(96));
  addHist(t5, tech1Id, 'ticket_resolved', 'in_progress', 'resolved', 'Blocked sender domain and purged phishing emails', hoursAgo(30));
  addHist(t5, adminId, 'ticket_closed', 'resolved', 'closed', 'Confirmed resolved with security team', hoursAgo(24));

  // Seed comments
  const c1 = allocateCommentId();
  comments.set(c1, {
    id: c1,
    ticketId: t1,
    userId: tech1Id,
    body: 'I am checking the Lab B access point lease logs this afternoon. Could you share whether this happens on both 2.4 GHz and 5 GHz?',
    createdAt: hoursAgo(4),
    updatedAt: hoursAgo(4),
  });

  const c2 = allocateCommentId();
  comments.set(c2, {
    id: c2,
    ticketId: t4,
    userId: tech2Id,
    body: 'Reconfigured the FlexNet license path to license.university.local:27000 and verified MATLAB launches normally.',
    createdAt: hoursAgo(6),
    updatedAt: hoursAgo(6),
  });

  // Seed notifications
  const n1 = allocateNotificationId();
  notifications.set(n1, {
    id: n1,
    userId: adminId,
    ticketId: t2,
    type: 'ticket_created',
    title: 'New critical ticket submitted',
    message: `Ticket #${t2}: Unable to access student portal after password reset`,
    isRead: false,
    createdAt: hoursAgo(12),
  });

  const n2 = allocateNotificationId();
  notifications.set(n2, {
    id: n2,
    userId: tech1Id,
    ticketId: t3,
    type: 'ticket_assigned',
    title: 'Ticket assigned to you',
    message: `You have been assigned Ticket #${t3}: Projector HDMI port not detected in Lecture Hall 204`,
    isRead: false,
    createdAt: hoursAgo(18),
  });

  const n3 = allocateNotificationId();
  notifications.set(n3, {
    id: n3,
    userId: user1Id,
    ticketId: t1,
    type: 'comment_added',
    title: 'New comment on your ticket',
    message: `IT Technician commented on Ticket #${t1}`,
    isRead: false,
    createdAt: hoursAgo(4),
  });

  const n4 = allocateNotificationId();
  notifications.set(n4, {
    id: n4,
    userId: user1Id,
    ticketId: t4,
    type: 'ticket_resolved',
    title: 'Ticket resolved',
    message: `Ticket #${t4} has been marked as resolved by Sara Mahmood`,
    isRead: false,
    createdAt: hoursAgo(6),
  });
}

seedInitialData();
