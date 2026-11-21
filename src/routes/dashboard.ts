import { Router } from 'express';
import { requireAuth } from '../middleware.js';
import { categories, notifications, ticketHistories, tickets, users } from '../store.js';
import { User } from '../types.js';

const router = Router();

router.get('/dashboard', requireAuth, (_req, res) => {
  const user: User = res.locals.currentUser;

  const allTickets = Array.from(tickets.values()).filter((t) => {
    if (user.role === 'user') return t.userId === user.id;
    if (user.role === 'technician') return t.assignedTo === user.id;
    return true;
  });

  const sortedTickets = [...allTickets].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id - a.id
  );

  const recentTickets = sortedTickets.slice(0, 6).map((t) => ({
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
    low: allTickets.filter((t) => t.priority === 'low').length,
    medium: allTickets.filter((t) => t.priority === 'medium').length,
    high: allTickets.filter((t) => t.priority === 'high').length,
    critical: allTickets.filter((t) => t.priority === 'critical').length,
  };

  const allUsers = Array.from(users.values());
  const adminStats =
    user.role === 'admin'
      ? {
          totalUsers: allUsers.length,
          users: allUsers.filter((u) => u.role === 'user').length,
          technicians: allUsers.filter((u) => u.role === 'technician').length,
          admins: allUsers.filter((u) => u.role === 'admin').length,
          categories: categories.size,
          activeCategories: Array.from(categories.values()).filter((c) => c.isActive).length,
        }
      : null;

  const visibleTicketIds = new Set(allTickets.map((t) => t.id));
  const recentActivity = Array.from(ticketHistories.values())
    .filter((h) => visibleTicketIds.has(h.ticketId))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)
    .slice(0, 6)
    .map((h) => ({
      ...h,
      ticket: tickets.get(h.ticketId) ?? null,
      user: h.userId ? (users.get(h.userId) ?? null) : null,
    }));

  const recentNotifications = Array.from(notifications.values())
    .filter((n) => n.userId === user.id)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)
    .slice(0, 5);

  res.render('dashboard', {
    title: 'Dashboard',
    breadcrumbs: [{ label: 'Dashboard' }],
    tickets: recentTickets,
    stats,
    adminStats,
    recentActivity,
    recentNotifications,
  });
});

export default router;
