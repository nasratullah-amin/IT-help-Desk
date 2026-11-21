import { Router } from 'express';
import { paginate, parsePositiveInt } from '../helpers.js';
import { flashSuccess, render403, render404, requireAuth } from '../middleware.js';
import { notifications, tickets } from '../store.js';
import { User } from '../types.js';

const router = Router();

router.get('/notifications', requireAuth, (req, res) => {
  const user: User = res.locals.currentUser;
  const filter = typeof req.query.filter === 'string' ? req.query.filter : 'all';

  const list = Array.from(notifications.values())
    .filter((n) => {
      if (n.userId !== user.id) return false;
      if (filter === 'unread' && n.isRead) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id);

  const pagination = paginate(list, req.query.page, 15, '/notifications', req.query);
  res.render('notifications/index', {
    title: 'Notifications',
    breadcrumbs: [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Notifications' }],
    notifications: pagination.items,
    pagination,
    filter,
  });
});

router.patch('/notifications/:id/read', requireAuth, (req, res) => {
  const user: User = res.locals.currentUser;
  const id = parsePositiveInt(req.params.id);
  const notification = id ? notifications.get(id) : undefined;
  if (!notification) {
    render404(res, 'Notification not found.');
    return;
  }
  if (notification.userId !== user.id) {
    render403(res);
    return;
  }

  notification.isRead = true;
  flashSuccess(req, 'Notification marked as read.');
  res.redirect('/notifications');
});

router.get('/notifications/:id/open', requireAuth, (req, res) => {
  const user: User = res.locals.currentUser;
  const id = parsePositiveInt(req.params.id);
  const notification = id ? notifications.get(id) : undefined;
  if (!notification) {
    render404(res, 'Notification not found.');
    return;
  }
  if (notification.userId !== user.id) {
    render403(res);
    return;
  }

  notification.isRead = true;
  if (notification.ticketId && tickets.has(notification.ticketId)) {
    res.redirect(`/tickets/${notification.ticketId}`);
    return;
  }
  res.redirect('/notifications');
});

router.post('/notifications/mark-all-read', requireAuth, (req, res) => {
  const user: User = res.locals.currentUser;
  let count = 0;
  for (const n of notifications.values()) {
    if (n.userId === user.id && !n.isRead) {
      n.isRead = true;
      count++;
    }
  }
  flashSuccess(
    req,
    count > 0 ? `Marked ${count} notification${count === 1 ? '' : 's'} as read.` : 'All notifications are already read.'
  );
  res.redirect('/notifications');
});

export default router;
