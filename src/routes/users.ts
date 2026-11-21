import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { paginate, parsePositiveInt } from '../helpers.js';
import { flashErrors, flashSuccess, render404, requireAuth, requireRole } from '../middleware.js';
import { allocateUserId, comments, findUserByEmail, tickets, users } from '../store.js';
import { User, UserRole } from '../types.js';

const router = Router();
const VALID_ROLES: UserRole[] = ['user', 'technician', 'admin'];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.get('/users', requireAuth, requireRole('admin'), (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  const roleFilter = typeof req.query.role === 'string' ? req.query.role : '';
  const statusFilter = typeof req.query.status === 'string' ? req.query.status : '';

  const filtered = Array.from(users.values())
    .filter((u) => {
      if (roleFilter && VALID_ROLES.includes(roleFilter as UserRole) && u.role !== roleFilter) {
        return false;
      }
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'inactive' && u.isActive) return false;
      if (search) {
        const matches =
          u.name.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search) ||
          String(u.id) === search;
        if (!matches) return false;
      }
      return true;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id);

  const ticketList = Array.from(tickets.values());
  const hydrated = filtered.map((u) => ({
    ...u,
    createdTicketsCount: ticketList.filter((t) => t.userId === u.id).length,
    assignedTicketsCount: ticketList.filter((t) => t.assignedTo === u.id).length,
  }));

  const pagination = paginate(hydrated, req.query.page, 12, '/users', req.query);
  res.render('users/index', {
    title: 'User management',
    breadcrumbs: [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Users' }],
    users: pagination.items,
    pagination,
  });
});

router.get('/users/create', requireAuth, requireRole('admin'), (_req, res) => {
  res.render('users/form', {
    title: 'Create user',
    breadcrumbs: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Users', href: '/users' },
      { label: 'Create user' },
    ],
    targetUser: null,
  });
});

router.post('/users', requireAuth, requireRole('admin'), (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const role = typeof req.body.role === 'string' ? req.body.role : 'user';
  const rawActive = req.body.is_active;
  const isActive = Array.isArray(rawActive)
    ? rawActive.includes('1') || rawActive.includes('true')
    : rawActive === '1' || rawActive === 'true' || rawActive === true;

  const errors: string[] = [];
  if (!name) {
    errors.push('The name field is required.');
  } else if (name.length > 100) {
    errors.push('The name field must not be greater than 100 characters.');
  }

  if (!email || !isValidEmail(email)) {
    errors.push('The email field must be a valid email address.');
  } else if (email.length > 150) {
    errors.push('The email field must not be greater than 150 characters.');
  } else if (findUserByEmail(email)) {
    errors.push('The email has already been taken.');
  }

  if (!password) {
    errors.push('The password field is required.');
  } else if (password.length < 10) {
    errors.push('The password field must be at least 10 characters.');
  }

  if (!VALID_ROLES.includes(role as UserRole)) {
    errors.push('The selected role is invalid.');
  }

  if (errors.length > 0) {
    flashErrors(req, errors, {
      name,
      email,
      role,
      is_active: isActive ? '1' : '0',
    });
    res.redirect('/users/create');
    return;
  }

  const now = new Date();
  const id = allocateUserId();
  users.set(id, {
    id,
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    role: role as UserRole,
    isActive,
    createdAt: now,
    updatedAt: now,
  });

  flashSuccess(req, `User "${name}" created successfully.`);
  res.redirect('/users');
});

router.get('/users/:id/edit', requireAuth, requireRole('admin'), (req, res) => {
  const targetId = parsePositiveInt(req.params.id);
  const targetUser = targetId ? users.get(targetId) : undefined;
  if (!targetUser) {
    render404(res, 'User not found.');
    return;
  }

  res.render('users/form', {
    title: `Edit ${targetUser.name}`,
    breadcrumbs: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Users', href: '/users' },
      { label: targetUser.name },
    ],
    targetUser,
  });
});

router.put('/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  const targetId = parsePositiveInt(req.params.id);
  const targetUser = targetId ? users.get(targetId) : undefined;
  if (!targetUser) {
    render404(res, 'User not found.');
    return;
  }

  const currentUser: User = res.locals.currentUser;
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const role = typeof req.body.role === 'string' ? req.body.role : targetUser.role;
  const rawActive = req.body.is_active;
  const isActive = Array.isArray(rawActive)
    ? rawActive.includes('1') || rawActive.includes('true')
    : rawActive === '1' || rawActive === 'true' || rawActive === true;

  const errors: string[] = [];
  if (!name) {
    errors.push('The name field is required.');
  } else if (name.length > 100) {
    errors.push('The name field must not be greater than 100 characters.');
  }

  if (!email || !isValidEmail(email)) {
    errors.push('The email field must be a valid email address.');
  } else if (email.length > 150) {
    errors.push('The email field must not be greater than 150 characters.');
  } else if (findUserByEmail(email, targetUser.id)) {
    errors.push('The email has already been taken.');
  }

  if (password && password.length < 10) {
    errors.push('The password field must be at least 10 characters.');
  }

  if (!VALID_ROLES.includes(role as UserRole)) {
    errors.push('The selected role is invalid.');
  }

  if (currentUser.id === targetUser.id && role !== targetUser.role) {
    errors.push('You cannot change your own role.');
  }

  if (currentUser.id === targetUser.id && !isActive) {
    errors.push('You cannot deactivate your own account.');
  }

  if (errors.length > 0) {
    flashErrors(req, errors, {
      name,
      email,
      role,
      is_active: isActive ? '1' : '0',
    });
    res.redirect(`/users/${targetUser.id}/edit`);
    return;
  }

  targetUser.name = name;
  targetUser.email = email;
  if (password) {
    targetUser.passwordHash = bcrypt.hashSync(password, 10);
  }
  targetUser.role = role as UserRole;
  targetUser.isActive = isActive;
  targetUser.updatedAt = new Date();

  flashSuccess(req, 'User account updated successfully.');
  res.redirect('/users');
});

router.patch('/users/:id/role', requireAuth, requireRole('admin'), (req, res) => {
  const targetId = parsePositiveInt(req.params.id);
  const targetUser = targetId ? users.get(targetId) : undefined;
  if (!targetUser) {
    render404(res, 'User not found.');
    return;
  }

  const currentUser: User = res.locals.currentUser;
  if (currentUser.id === targetUser.id) {
    flashErrors(req, ['You cannot change your own role.']);
    res.redirect('/users');
    return;
  }

  const role = typeof req.body.role === 'string' ? req.body.role : '';
  if (!VALID_ROLES.includes(role as UserRole)) {
    flashErrors(req, ['The selected role is invalid.']);
    res.redirect('/users');
    return;
  }

  targetUser.role = role as UserRole;
  targetUser.updatedAt = new Date();
  flashSuccess(req, `Role updated for ${targetUser.name}.`);
  res.redirect('/users');
});

router.patch('/users/:id/toggle-status', requireAuth, requireRole('admin'), (req, res) => {
  const targetId = parsePositiveInt(req.params.id);
  const targetUser = targetId ? users.get(targetId) : undefined;
  if (!targetUser) {
    render404(res, 'User not found.');
    return;
  }

  const currentUser: User = res.locals.currentUser;
  if (currentUser.id === targetUser.id) {
    flashErrors(req, ['You cannot deactivate your own account.']);
    res.redirect('/users');
    return;
  }

  targetUser.isActive = !targetUser.isActive;
  targetUser.updatedAt = new Date();
  flashSuccess(
    req,
    `User "${targetUser.name}" has been ${targetUser.isActive ? 'activated' : 'deactivated'}.`
  );
  res.redirect('/users');
});

router.delete('/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  const targetId = parsePositiveInt(req.params.id);
  const targetUser = targetId ? users.get(targetId) : undefined;
  if (!targetUser) {
    render404(res, 'User not found.');
    return;
  }

  const currentUser: User = res.locals.currentUser;
  if (currentUser.id === targetUser.id) {
    flashErrors(req, ['You cannot delete your own account.']);
    res.redirect('/users');
    return;
  }

  const hasTickets = Array.from(tickets.values()).some(
    (t) => t.userId === targetUser.id || t.assignedTo === targetUser.id
  );
  const hasComments = Array.from(comments.values()).some((c) => c.userId === targetUser.id);
  if (hasTickets || hasComments) {
    flashErrors(req, [
      `Cannot delete "${targetUser.name}" because they are linked to existing tickets or comments. Deactivate the account instead.`,
    ]);
    res.redirect('/users');
    return;
  }

  users.delete(targetUser.id);
  flashSuccess(req, `User "${targetUser.name}" deleted.`);
  res.redirect('/users');
});

export default router;
