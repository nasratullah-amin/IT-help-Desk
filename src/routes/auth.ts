import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { flashErrors, requireAuth, requireGuest } from '../middleware.js';
import { allocateUserId, findUserByEmail, users } from '../store.js';

const router = Router();

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.get('/login', requireGuest, (_req, res) => {
  res.render('auth/login', { title: 'Sign in' });
});

router.post('/login', requireGuest, (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const remember = req.body.remember === '1' || req.body.remember === 'on';

  const errors: string[] = [];
  if (!email || !isValidEmail(email)) {
    errors.push('The email field must be a valid email address.');
  }
  if (!password) {
    errors.push('The password field is required.');
  }
  if (errors.length > 0) {
    flashErrors(req, errors, { email });
    res.redirect('/login');
    return;
  }

  const key = `${email.toLowerCase()}|${req.ip || 'unknown'}`;
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS) {
    const secs = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    flashErrors(
      req,
      [`Too many login attempts. Please try again in ${secs} seconds.`],
      { email }
    );
    res.redirect('/login');
    return;
  }

  const user = findUserByEmail(email);
  const valid = user ? bcrypt.compareSync(password, user.passwordHash) : false;

  if (!user || !valid) {
    if (!entry || entry.resetAt <= now) {
      loginAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    } else {
      entry.count += 1;
    }
    flashErrors(req, ['The provided credentials do not match our records.'], { email });
    res.redirect('/login');
    return;
  }

  if (!user.isActive) {
    flashErrors(
      req,
      ['Your account has been deactivated. Please contact an administrator.'],
      { email }
    );
    res.redirect('/login');
    return;
  }

  loginAttempts.delete(key);

  const intendedUrl = req.session.intendedUrl;
  req.session.regenerate((err) => {
    if (err) {
      flashErrors(req, ['Unable to start session. Please try again.'], { email });
      res.redirect('/login');
      return;
    }
    req.session.userId = user.id;
    if (remember) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    }
    const safeRedirect =
      intendedUrl && intendedUrl.startsWith('/') && !intendedUrl.startsWith('//')
        ? intendedUrl
        : '/dashboard';
    res.redirect(safeRedirect);
  });
});

router.get('/register', requireGuest, (_req, res) => {
  res.render('auth/register', { title: 'Create account' });
});

router.post('/register', requireGuest, (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const passwordConfirmation =
    typeof req.body.password_confirmation === 'string' ? req.body.password_confirmation : '';

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
  } else if (password !== passwordConfirmation) {
    errors.push('The password field confirmation does not match.');
  }

  if (errors.length > 0) {
    flashErrors(req, errors, { name, email });
    res.redirect('/register');
    return;
  }

  const now = new Date();
  const id = allocateUserId();
  const user = {
    id,
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'user' as const,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  users.set(id, user);

  req.session.regenerate((err) => {
    if (err) {
      res.redirect('/login');
      return;
    }
    req.session.userId = user.id;
    res.redirect('/dashboard');
  });
});

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

export default router;
