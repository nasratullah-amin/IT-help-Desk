import crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { formatDate, formatDateTime, formatLabel, TicketPolicy, ucfirst } from './helpers.js';
import { users } from './store.js';
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
      if (k === 'password' || k === 'password_confirmation' || k === '_csrf' || k === '_method') {
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

  const currentUser: User | null = req.session.userId
    ? (users.get(req.session.userId) ?? null)
    : null;

  if (req.session.userId && !currentUser) {
    delete req.session.userId;
  }

  res.locals.currentUser = currentUser;
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

  delete req.session.flashSuccess;
  delete req.session.flashErrors;
  delete req.session.flashOld;

  next();
}

export function verifyCsrf(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data') && !req.body?._csrf) {
    // Multipart forms will be checked right after multer parses fields
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
  const token = req.body?._csrf;
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
  return (req: Request, res: Response, next: NextFunction): void => {
    const user: User | null = res.locals.currentUser;
    if (!user || !roles.includes(user.role)) {
      res.status(403).render('errors/403', { title: 'Access denied' });
      return;
    }
    next();
  };
}

export function render403(res: Response): void {
  res.status(403).render('errors/403', { title: 'Access denied' });
}
