import crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { formatDate, formatDateTime, formatLabel, TicketPolicy, ucfirst } from './helpers.js';
import { notifications, users } from './store.js';
import { User, UserRole } from './types.js';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    csrfToken?: string;
    intendedUrl?: string;
    flashSuccess?: string;
    flashErrors?: string[];
    flashOld?: Record<string, string>;
  }
}

export function flashSuccess(req: Request, message: string): void {
  req.session.flashSuccess = message;
}

export function flashErrors(
  req: Request,
  errors: string[],
  oldInput?: Record<string, unknown>
): void {
  req.session.flashErrors = errors;
  if (oldInput) {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(oldInput)) {
      if (
        k === 'password' ||
        k === 'password_confirmation' ||
        k === '_csrf' ||
        k === '_method'
      ) {
        continue;
      }
      if (typeof v === 'string') {
        cleaned[k] = v;
      }
    }
    req.session.flashOld = cleaned;
  }
}

export function localsMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }

  let currentUser: User | null = req.session.userId
    ? (users.get(req.session.userId) ?? null)
    : null;

  if (currentUser && !currentUser.isActive) {
    currentUser = null;
  }

  if (req.session.userId && !currentUser) {
    delete req.session.userId;
  }

  let unreadNotificationsCount = 0;
  if (currentUser) {
    for (const n of notifications.values()) {
      if (n.userId === currentUser.id && !n.isRead) {
        unreadNotificationsCount++;
      }
    }
  }

  res.locals.currentUser = currentUser;
  res.locals.currentPath = req.path;
  res.locals.unreadNotificationsCount = unreadNotificationsCount;
  res.locals.csrfToken = req.session.csrfToken;
  res.locals.success = req.session.flashSuccess ?? null;
  res.locals.errors = req.session.flashErrors ?? [];
  const oldData = req.session.flashOld ?? {};
  res.locals.old = (key: string, fallback: unknown = ''): string => {
    if (Object.prototype.hasOwnProperty.call(oldData, key)) {
      return oldData[key];
    }
    return fallback === null || fallback === undefined ? '' : String(fallback);
  };
  res.locals.query = req.query;
  res.locals.formatDate = formatDate;
  res.locals.formatDateTime = formatDateTime;
  res.locals.ucfirst = ucfirst;
  res.locals.formatLabel = formatLabel;
  res.locals.TicketPolicy = TicketPolicy;
  res.locals.breadcrumbs = [];

  delete req.session.flashSuccess;
  delete req.session.flashErrors;
  delete req.session.flashOld;

  next();
}

function isMultipartUploadRoute(req: Request): boolean {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) return false;
  if (req.method !== 'POST') return false;
  return req.path === '/tickets' || /^\/tickets\/\d+\/attachments$/.test(req.path);
}

export function verifyCsrf(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  if (isMultipartUploadRoute(req)) {
    // Verified by verifyMultipartCsrf immediately after multer parses fields
    return next();
  }
  const token = req.body?._csrf || req.headers['x-csrf-token'];
  if (!token || token !== req.session.csrfToken) {
    res.status(419).send('Page expired. Please go back, refresh, and try again.');
    return;
  }
  next();
}

export function verifyMultipartCsrf(req: Request, res: Response, next: NextFunction): void {
  const token = req.body?._csrf || req.headers['x-csrf-token'];
  if (!token || token !== req.session.csrfToken) {
    res.status(419).send('Page expired. Please go back, refresh, and try again.');
    return;
  }
  next();
}

export function requireGuest(req: Request, res: Response, next: NextFunction): void {
  if (res.locals.currentUser) {
    res.redirect('/dashboard');
    return;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!res.locals.currentUser) {
    if (req.method === 'GET') {
      req.session.intendedUrl = req.originalUrl;
    }
    res.redirect('/login');
    return;
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const user: User | null = res.locals.currentUser;
    if (!user || !roles.includes(user.role)) {
      res.status(403).render('errors/403', {
        title: 'Access denied',
        breadcrumbs: [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Access Denied' }],
      });
      return;
    }
    next();
  };
}

export function render403(res: Response): void {
  res.status(403).render('errors/403', {
    title: 'Access denied',
    breadcrumbs: [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Access Denied' }],
  });
}

export function render404(res: Response, message = 'The requested resource could not be found.'): void {
  res.status(404).render('errors/404', {
    title: 'Not found',
    message,
    breadcrumbs: [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Not Found' }],
  });
}
