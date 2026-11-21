import path from 'node:path';
import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import {
  paginate,
  STATUS_TRANSITIONS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TicketPolicy,
} from '../helpers.js';
import {
  flashErrors,
  flashSuccess,
  render403,
  requireAuth,
  requireRole,
  verifyMultipartCsrf,
} from '../middleware.js';
import {
  allocateAttachmentId,
  allocateCommentId,
  allocateHistoryId,
  allocateTicketId,
  attachments,
  categories,
  comments,
  ticketHistories,
  tickets,
  users,
} from '../store.js';
import { Ticket, TicketPriority, TicketStatus, User } from '../types.js';

const router = Router();

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.txt',
  '.doc',
  '.docx',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error('The attachment must be a file of type: pdf, png, jpg, jpeg, txt, doc, docx.'));
      return;
    }
    cb(null, true);
  },
});

function handleUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single('attachment')(req, res, (err: unknown) => {
    if (err) {
      const msg =
        err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
          ? 'The attachment field must not be greater than 5120 kilobytes.'
          : err instanceof Error
            ? err.message
            : 'Invalid attachment file.';
      flashErrors(req, [msg], req.body as Record<string, unknown>);
      res.redirect(req.get('Referer') || '/tickets');
      return;
    }
    next();
  });
}

function recordHistory(
  ticket: Ticket,
  userId: number | null,
  action: string,
  fromValue: string | null,
  toValue: string | null,
  note: string | null
): void {
  const isStatusAction = ['status_changed', 'ticket_resolved', 'ticket_closed'].includes(action);
  const id = allocateHistoryId();
  ticketHistories.set(id, {
    id,
    ticketId: ticket.id,
    userId,
    action,
    fromValue,
    toValue,
    fromStatus: isStatusAction ? fromValue : null,
    toStatus: isStatusAction ? toValue : null,
    note,
    createdAt: new Date(),
  });
}

function storeAttachmentFile(req: Request, ticket: Ticket, userId: number): void {
  if (!req.file) return;
  const rawName = path.basename(req.file.originalname || 'attachment');
  const sanitized = rawName.replace(/[^\p{L}\p{N}._ -]/gu, '_') || 'attachment';
  const originalName = sanitized.slice(0, 180);
  const id = allocateAttachmentId();
  attachments.set(id, {
    id,
    ticketId: ticket.id,
    userId,
    originalName,
    mimeType: req.file.mimetype || 'application/octet-stream',
    fileSize: req.file.size,
    buffer: req.file.buffer,
    createdAt: new Date(),
  });
  recordHistory(ticket, userId, 'attachment_uploaded', null, null, 'Attachment uploaded');
}

function getActiveCategories() {
  return Array.from(categories.values())
    .filter((c) => c.isActive)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getTechnicians() {
  return Array.from(users.values())
    .filter((u) => u.role === 'technician')
    .sort((a, b) => a.name.localeCompare(b.name));
}

router.get('/tickets', requireAuth, (req, res) => {
  const user: User = res.locals.currentUser;
  if (!TicketPolicy.viewAny(user)) {
    render403(res);
    return;
  }

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const priority = typeof req.query.priority === 'string' ? req.query.priority : '';
  const categoryId = typeof req.query.category_id === 'string' ? req.query.category_id : '';
  const technicianId = typeof req.query.technician_id === 'string' ? req.query.technician_id : '';
  const from = typeof req.query.from === 'string' ? req.query.from : '';
  const to = typeof req.query.to === 'string' ? req.query.to : '';
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'newest';

  let list = Array.from(tickets.values()).filter((t) => {
    if (user.role === 'user' && t.userId !== user.id) return false;
    if (user.role === 'technician' && t.assignedTo !== user.id) return false;
    if (status && TICKET_STATUSES.includes(status as TicketStatus) && t.status !== status) {
      return false;
    }
    if (priority && TICKET_PRIORITIES.includes(priority as TicketPriority) && t.priority !== priority) {
      return false;
    }
    if (categoryId && Number(categoryId) !== t.categoryId) return false;
    if (technicianId && user.role === 'admin' && Number(technicianId) !== t.assignedTo) {
      return false;
    }
    if (from) {
      const fromDate = new Date(`${from}T00:00:00`);
      if (!Number.isNaN(fromDate.getTime()) && t.createdAt < fromDate) return false;
    }
    if (to) {
      const toDate = new Date(`${to}T23:59:59.999`);
      if (!Number.isNaN(toDate.getTime()) && t.createdAt > toDate) return false;
    }
    if (search) {
      const lower = search.toLowerCase();
      const numericId = /^\d+$/.test(search) ? Number(search) : 0;
      const matches =
        t.subject.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower) ||
        (numericId > 0 && t.id === numericId);
      if (!matches) return false;
    }
    return true;
  });

  const priorityRank: Record<TicketPriority, number> = {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4,
  };

  list = list.sort((a, b) => {
    if (sort === 'oldest') {
      return a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id;
    }
    if (sort === 'priority') {
      return priorityRank[a.priority] - priorityRank[b.priority] || b.id - a.id;
    }
    if (sort === 'updated') {
      return b.updatedAt.getTime() - a.updatedAt.getTime() || b.id - a.id;
    }
    return b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id;
  });

  const hydrated = list.map((t) => ({
    ...t,
    user: users.get(t.userId) ?? null,
    technician: t.assignedTo ? (users.get(t.assignedTo) ?? null) : null,
    category: categories.get(t.categoryId) ?? null,
  }));

  const pagination = paginate(hydrated, req.query.page, 12, '/tickets', req.query);

  res.render('tickets/index', {
    title: 'Tickets',
    tickets: pagination.items,
    pagination,
    categories: getActiveCategories(),
    technicians: user.role === 'admin' ? getTechnicians() : [],
  });
});

router.get('/tickets/create', requireAuth, (_req, res) => {
  const user: User = res.locals.currentUser;
  if (!TicketPolicy.create(user)) {
    render403(res);
    return;
  }
  res.render('tickets/create', {
    title: 'New ticket',
    categories: getActiveCategories(),
    ticket: null,
  });
});

router.post('/tickets', requireAuth, handleUpload, verifyMultipartCsrf, (req, res) => {
  const user: User = res.locals.currentUser;
  if (!TicketPolicy.create(user)) {
    render403(res);
    return;
  }

  const subject = typeof req.body.subject === 'string' ? req.body.subject.trim() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
  const categoryId = Number(req.body.category_id);
  const priority = typeof req.body.priority === 'string' ? req.body.priority : '';

  const errors: string[] = [];
  if (!subject) {
    errors.push('The subject field is required.');
  } else if (subject.length > 160) {
    errors.push('The subject field must not be greater than 160 characters.');
  }
  if (!description) {
    errors.push('The description field is required.');
  } else if (description.length < 10) {
    errors.push('The description field must be at least 10 characters.');
  } else if (description.length > 10000) {
    errors.push('The description field must not be greater than 10000 characters.');
  }

  const cat = categories.get(categoryId);
  if (!cat || !cat.isActive) {
    errors.push('The selected category is invalid.');
  }
  if (!TICKET_PRIORITIES.includes(priority as TicketPriority)) {
    errors.push('The selected priority is invalid.');
  }

  if (errors.length > 0) {
    flashErrors(req, errors, {
      subject,
      description,
      category_id: String(req.body.category_id || ''),
      priority,
    });
    res.redirect('/tickets/create');
    return;
  }

  const now = new Date();
  const id = allocateTicketId();
  const ticket: Ticket = {
    id,
    userId: user.id,
    assignedTo: null,
    categoryId,
    subject,
    description,
    priority: priority as TicketPriority,
    status: 'open',
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  tickets.set(id, ticket);
  recordHistory(ticket, user.id, 'created', null, 'open', 'Ticket created');
  if (req.file) {
    storeAttachmentFile(req, ticket, user.id);
  }

  flashSuccess(req, 'Ticket created successfully.');
  res.redirect(`/tickets/${ticket.id}`);
});

router.get('/tickets/:id', requireAuth, (req, res) => {
  const user: User = res.locals.currentUser;
  const ticket = tickets.get(Number(req.params.id));
  if (!ticket) {
    res.status(404).send('Ticket not found.');
    return;
  }
  if (!TicketPolicy.view(user, ticket)) {
    render403(res);
    return;
  }

  const ticketComments = Array.from(comments.values())
    .filter((c) => c.ticketId === ticket.id)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)
    .map((c) => ({ ...c, user: users.get(c.userId) ?? null }));

  const ticketAttachments = Array.from(attachments.values())
    .filter((a) => a.ticketId === ticket.id)
    .map((a) => ({ ...a, user: users.get(a.userId) ?? null }));

  const ticketHistory = Array.from(ticketHistories.values())
    .filter((h) => h.ticketId === ticket.id)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)
    .map((h) => ({ ...h, user: h.userId ? (users.get(h.userId) ?? null) : null }));

  res.render('tickets/show', {
    title: `Ticket #${ticket.id}`,
    ticket: {
      ...ticket,
      user: users.get(ticket.userId) ?? null,
      technician: ticket.assignedTo ? (users.get(ticket.assignedTo) ?? null) : null,
      category: categories.get(ticket.categoryId) ?? null,
      comments: ticketComments,
      attachments: ticketAttachments,
      histories: ticketHistory,
    },
    technicians: user.role === 'admin' ? getTechnicians() : [],
    statusOptions: STATUS_TRANSITIONS[ticket.status] ?? [],
  });
});

router.get('/tickets/:id/edit', requireAuth, (req, res) => {
  const user: User = res.locals.currentUser;
  const ticket = tickets.get(Number(req.params.id));
  if (!ticket) {
    res.status(404).send('Ticket not found.');
    return;
  }
  if (!TicketPolicy.update(user, ticket)) {
    render403(res);
    return;
  }
  res.render('tickets/edit', {
    title: 'Edit ticket',
    ticket,
    categories: getActiveCategories(),
  });
});

router.put('/tickets/:id', requireAuth, (req, res) => {
  const user: User = res.locals.currentUser;
  const ticket = tickets.get(Number(req.params.id));
  if (!ticket) {
    res.status(404).send('Ticket not found.');
    return;
  }
  if (!TicketPolicy.update(user, ticket)) {
    render403(res);
    return;
  }

  const subject = typeof req.body.subject === 'string' ? req.body.subject.trim() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
  const categoryId = Number(req.body.category_id);
  const priority = typeof req.body.priority === 'string' ? req.body.priority : '';

  const errors: string[] = [];
  if (!subject) {
    errors.push('The subject field is required.');
  } else if (subject.length > 160) {
    errors.push('The subject field must not be greater than 160 characters.');
  }
  if (!description) {
    errors.push('The description field is required.');
  } else if (description.length < 10) {
    errors.push('The description field must be at least 10 characters.');
  } else if (description.length > 10000) {
    errors.push('The description field must not be greater than 10000 characters.');
  }

  const cat = categories.get(categoryId);
  if (!cat || !cat.isActive) {
    errors.push('The selected category is invalid.');
  }
  if (!TICKET_PRIORITIES.includes(priority as TicketPriority)) {
    errors.push('The selected priority is invalid.');
  }

  if (errors.length > 0) {
    flashErrors(req, errors, {
      subject,
      description,
      category_id: String(req.body.category_id || ''),
      priority,
    });
    res.redirect(`/tickets/${ticket.id}/edit`);
    return;
  }

  if (ticket.priority !== priority) {
    recordHistory(ticket, user.id, 'priority_changed', ticket.priority, priority, 'Priority changed');
  }
  if (ticket.categoryId !== categoryId) {
    recordHistory(
      ticket,
      user.id,
      'category_id_changed',
      String(ticket.categoryId),
      String(categoryId),
      'Category id changed'
    );
  }

  ticket.subject = subject;
  ticket.description = description;
  ticket.categoryId = categoryId;
  ticket.priority = priority as TicketPriority;
  ticket.updatedAt = new Date();
  recordHistory(ticket, user.id, 'details_updated', null, null, 'Ticket details updated');

  flashSuccess(req, 'Ticket updated.');
  res.redirect(`/tickets/${ticket.id}`);
});

router.delete('/tickets/:id', requireAuth, (req, res) => {
  const user: User = res.locals.currentUser;
  const ticket = tickets.get(Number(req.params.id));
  if (!ticket) {
    res.status(404).send('Ticket not found.');
    return;
  }
  if (!TicketPolicy.delete(user, ticket)) {
    render403(res);
    return;
  }

  for (const [attId, att] of attachments.entries()) {
    if (att.ticketId === ticket.id) attachments.delete(attId);
  }
  for (const [cId, c] of comments.entries()) {
    if (c.ticketId === ticket.id) comments.delete(cId);
  }
  for (const [hId, h] of ticketHistories.entries()) {
    if (h.ticketId === ticket.id) ticketHistories.delete(hId);
  }
  tickets.delete(ticket.id);

  flashSuccess(req, 'Ticket deleted.');
  res.redirect('/tickets');
});

router.post('/tickets/:id/comments', requireAuth, (req, res) => {
  const user: User = res.locals.currentUser;
  const ticket = tickets.get(Number(req.params.id));
  if (!ticket) {
    res.status(404).send('Ticket not found.');
    return;
  }
  if (!TicketPolicy.comment(user, ticket)) {
    render403(res);
    return;
  }

  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  const errors: string[] = [];
  if (!body) {
    errors.push('The comment body field is required.');
  } else if (body.length < 2) {
    errors.push('The comment body must be at least 2 characters.');
  } else if (body.length > 3000) {
    errors.push('The comment body must not be greater than 3000 characters.');
  }

  if (errors.length > 0) {
    flashErrors(req, errors);
    res.redirect(`/tickets/${ticket.id}`);
    return;
  }

  const now = new Date();
  const id = allocateCommentId();
  comments.set(id, {
    id,
    ticketId: ticket.id,
    userId: user.id,
    body,
    createdAt: now,
    updatedAt: now,
  });
  ticket.updatedAt = now;
  recordHistory(ticket, user.id, 'comment_added', null, null, 'Comment added');

  flashSuccess(req, 'Comment added.');
  res.redirect(`/tickets/${ticket.id}`);
});

router.post(
  '/tickets/:id/attachments',
  requireAuth,
  handleUpload,
  verifyMultipartCsrf,
  (req, res) => {
    const user: User = res.locals.currentUser;
    const ticket = tickets.get(Number(req.params.id));
    if (!ticket) {
      res.status(404).send('Ticket not found.');
      return;
    }
    if (!TicketPolicy.attach(user, ticket)) {
      render403(res);
      return;
    }
    if (!req.file) {
      flashErrors(req, ['The attachment field is required.']);
      res.redirect(`/tickets/${ticket.id}`);
      return;
    }

    storeAttachmentFile(req, ticket, user.id);
    ticket.updatedAt = new Date();
    flashSuccess(req, 'Attachment uploaded.');
    res.redirect(`/tickets/${ticket.id}`);
  }
);

router.get('/attachments/:id/download', requireAuth, (req, res) => {
  const user: User = res.locals.currentUser;
  const attachment = attachments.get(Number(req.params.id));
  if (!attachment) {
    res.status(404).send('Attachment not found.');
    return;
  }
  const ticket = tickets.get(attachment.ticketId);
  if (!ticket) {
    res.status(404).send('Ticket not found.');
    return;
  }
  if (!TicketPolicy.view(user, ticket)) {
    render403(res);
    return;
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${attachment.originalName.replace(/"/g, '')}"`
  );
  res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
  res.send(attachment.buffer);
});

router.patch('/tickets/:id/status', requireAuth, (req, res) => {
  const user: User = res.locals.currentUser;
  const ticket = tickets.get(Number(req.params.id));
  if (!ticket) {
    res.status(404).send('Ticket not found.');
    return;
  }
  if (!TicketPolicy.manage(user, ticket)) {
    render403(res);
    return;
  }

  const nextStatus = typeof req.body.status === 'string' ? req.body.status : '';
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';

  if (!TICKET_STATUSES.includes(nextStatus as TicketStatus)) {
    flashErrors(req, ['The selected status is invalid.']);
    res.redirect(`/tickets/${ticket.id}`);
    return;
  }
  if (note.length > 500) {
    flashErrors(req, ['The note field must not be greater than 500 characters.']);
    res.redirect(`/tickets/${ticket.id}`);
    return;
  }

  const oldStatus = ticket.status;
  const allowed = STATUS_TRANSITIONS[oldStatus] ?? [];
  if (!allowed.includes(nextStatus as TicketStatus)) {
    res.status(422).send('This status transition is not allowed.');
    return;
  }

  ticket.status = nextStatus as TicketStatus;
  ticket.resolvedAt = ['resolved', 'closed'].includes(nextStatus) ? new Date() : null;
  ticket.updatedAt = new Date();

  const action =
    nextStatus === 'resolved'
      ? 'ticket_resolved'
      : nextStatus === 'closed'
        ? 'ticket_closed'
        : 'status_changed';

  recordHistory(ticket, user.id, action, oldStatus, nextStatus, note || 'Status updated');
  flashSuccess(req, 'Ticket status updated.');
  res.redirect(`/tickets/${ticket.id}`);
});

router.patch('/tickets/:id/assign', requireAuth, requireRole('admin'), (req, res) => {
  const user: User = res.locals.currentUser;
  const ticket = tickets.get(Number(req.params.id));
  if (!ticket) {
    res.status(404).send('Ticket not found.');
    return;
  }
  if (!TicketPolicy.assign(user)) {
    render403(res);
    return;
  }

  const rawAssigned = typeof req.body.assigned_to === 'string' ? req.body.assigned_to.trim() : '';
  let newId: number | null = null;
  if (rawAssigned !== '') {
    const parsed = Number(rawAssigned);
    const tech = users.get(parsed);
    if (!tech || tech.role !== 'technician') {
      flashErrors(req, ['The selected technician is invalid.']);
      res.redirect(`/tickets/${ticket.id}`);
      return;
    }
    newId = tech.id;
  }

  const oldId = ticket.assignedTo;
  const oldStatus = ticket.status;

  ticket.assignedTo = newId;
  if (newId && ticket.status === 'open') {
    ticket.status = 'assigned';
  } else if (!newId && ticket.status === 'assigned') {
    ticket.status = 'open';
  }
  ticket.updatedAt = new Date();

  if (oldId !== newId) {
    const oldName = oldId ? (users.get(oldId)?.name ?? 'Unassigned') : 'Unassigned';
    const newName = newId ? (users.get(newId)?.name ?? 'Unassigned') : 'Unassigned';
    recordHistory(
      ticket,
      user.id,
      'technician_assigned',
      oldName,
      newName,
      'Technician assignment changed'
    );
  }
  if (ticket.status !== oldStatus) {
    recordHistory(
      ticket,
      user.id,
      'status_changed',
      oldStatus,
      ticket.status,
      'Status updated by assignment'
    );
  }

  flashSuccess(req, 'Technician assignment updated.');
  res.redirect(`/tickets/${ticket.id}`);
});

export default router;
