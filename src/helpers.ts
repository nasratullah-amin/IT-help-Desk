import { Ticket, TicketPriority, TicketStatus, User } from './types.js';

export const TICKET_STATUSES: TicketStatus[] = [
  'open',
  'assigned',
  'in_progress',
  'resolved',
  'closed',
];

export const TICKET_PRIORITIES: TicketPriority[] = [
  'low',
  'medium',
  'high',
  'critical',
];

export const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ['assigned'],
  assigned: ['in_progress', 'open'],
  in_progress: ['resolved', 'assigned'],
  resolved: ['closed', 'in_progress'],
  closed: [],
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatDateTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(date)}, ${hours}:${mins}`;
}

export function ucfirst(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatLabel(str: string): string {
  return ucfirst(str).replace(/_/g, ' ');
}

export const TicketPolicy = {
  viewAny(user: User): boolean {
    return ['user', 'technician', 'admin'].includes(user.role);
  },
  view(user: User, ticket: Ticket): boolean {
    return (
      user.role === 'admin' ||
      (user.role === 'user' && ticket.userId === user.id) ||
      (user.role === 'technician' && ticket.assignedTo === user.id)
    );
  },
  create(user: User): boolean {
    return ['user', 'admin'].includes(user.role);
  },
  update(user: User, ticket: Ticket): boolean {
    return (
      user.role === 'admin' ||
      (user.role === 'user' && ticket.userId === user.id && ticket.status === 'open')
    );
  },
  delete(user: User, ticket: Ticket): boolean {
    return (
      user.role === 'admin' ||
      (user.role === 'user' && ticket.userId === user.id && ticket.status === 'open')
    );
  },
  manage(user: User, ticket: Ticket): boolean {
    return (
      user.role === 'admin' ||
      (user.role === 'technician' && ticket.assignedTo === user.id)
    );
  },
  assign(user: User): boolean {
    return user.role === 'admin';
  },
  comment(user: User, ticket: Ticket): boolean {
    return TicketPolicy.view(user, ticket);
  },
  attach(user: User, ticket: Ticket): boolean {
    return TicketPolicy.view(user, ticket);
  },
};

export interface PaginationResult<T> {
  items: T[];
  currentPage: number;
  lastPage: number;
  total: number;
  perPage: number;
  buildPageUrl: (page: number) => string;
}

export function paginate<T>(
  allItems: T[],
  pageParam: unknown,
  perPage: number,
  basePath: string,
  queryObj: Record<string, unknown>
): PaginationResult<T> {
  const total = allItems.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const rawPage = Number(pageParam);
  const currentPage = Number.isInteger(rawPage) && rawPage >= 1
    ? Math.min(rawPage, lastPage)
    : 1;
  const start = (currentPage - 1) * perPage;
  const items = allItems.slice(start, start + perPage);

  const buildPageUrl = (page: number): string => {
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(queryObj)) {
      if (key === 'page') continue;
      if (typeof val === 'string' && val.length > 0) {
        params.set(key, val);
      }
    }
    params.set('page', String(page));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return { items, currentPage, lastPage, total, perPage, buildPageUrl };
}
