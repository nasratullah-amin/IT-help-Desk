import { Router } from 'express';
import { paginate } from '../helpers.js';
import { flashErrors, flashSuccess, requireAuth, requireRole } from '../middleware.js';
import { categories, ticketHistories, tickets, users } from '../store.js';
import { User, UserRole } from '../types.js';

const router = Router();

router.get('/dashboard', requireAuth, (_req, res) => {
  const user: User = res.locals.currentUser;

  const allTickets = Array.from(tickets.values()).filter((t) => {
    if (user.role === 'user') return t.userId === user.id;
    if (user.role === 'technician') return t.assignedTo === user.id;
    return true;
  });

  const sortedTickets = [...allTickets].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id
  );

  const recentTickets = sortedTickets.slice(0, 8).map((t) => ({
    ...t,
    user: users.get(t.userId) ?? null,
    technician: t.assignedTo ? (users.get(t.assignedTo) ?? null) : null,
    category: categories.get(t.categoryId) ?? null,
  }));

  const stats = {
    total: allTickets.length,
    open: allTickets.filter((t) => t.status === 'open').length,
    assigned: allTickets.filter((t) => t.status === 'assigned').length,
    progress: allTickets.filter((t) => t.status === 'in_progress').length,
    resolved: allTickets.filter((t) => t.status === 'resolved').length,
    closed: allTickets.filter((t) => t.status === 'closed').length,
    critical: allTickets.filter((t) => t.priority === 'critical').length,
    high: allTickets.filter((t) => t.priority === 'high').length,
  };

  const allUsers = Array.from(users.values());
  const adminStats =
    user.role === 'admin'
      ? {
          users: allUsers.filter((u) => u.role === 'user').length,
          technicians: allUsers.filter((u) => u.role === 'technician').length,
          categories: categories.size,
        }
      : null;

  const visibleTicketIds = new Set(allTickets.map((t) => t.id));
  const recentActivity = Array.from(ticketHistories.values())
    .filter((h) => visibleTicketIds.has(h.ticketId))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)
    .slice(0, 8)
    .map((h) => ({
      ...h,
      ticket: tickets.get(h.ticketId) ?? null,
      user: h.userId ? (users.get(h.userId) ?? null) : null,
    }));

  res.render('dashboard', {
    title: 'Dashboard',
    tickets: recentTickets,
    stats,
    adminStats,
    recentActivity,
  });
});

router.get('/users', requireAuth, requireRole('admin'), (req, res) => {
  const allUsers = Array.from(users.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id
  );
  const pagination = paginate(allUsers, req.query.page, 15, '/users', req.query);
  res.render('users/index', {
    title: 'Users',
    users: pagination.items,
    pagination,
  });
});

router.patch('/users/:id/role', requireAuth, requireRole('admin'), (req, res) => {
  const targetId = Number(req.params.id);
  const targetUser = users.get(targetId);
  if (!targetUser) {
    res.status(404).send('User not found.');
    return;
  }

  const currentUser: User = res.locals.currentUser;
  if (currentUser.id === targetUser.id) {
    res.status(422).send('You cannot change your own role.');
    return;
  }

  const role = typeof req.body.role === 'string' ? req.body.role : '';
  if (!['user', 'technician', 'admin'].includes(role)) {
    flashErrors(req, ['The selected role is invalid.']);
    res.redirect('/users');
    return;
  }

  targetUser.role = role as UserRole;
  targetUser.updatedAt = new Date();
  flashSuccess(req, 'User role updated.');
  res.redirect(req.get('Referer') || '/users');
});

export default router;
