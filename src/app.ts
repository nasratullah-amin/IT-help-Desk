import crypto from 'node:crypto';
import path from 'node:path';
import express, { Express, NextFunction, Request, Response } from 'express';
import session from 'express-session';
import methodOverride from 'method-override';
import { localsMiddleware, render404, verifyCsrf } from './middleware.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import dashboardRoutes from './routes/dashboard.js';
import notificationRoutes from './routes/notifications.js';
import ticketRoutes from './routes/tickets.js';
import userRoutes from './routes/users.js';

export function createApp(): Express {
  const app = express();
  const sessionSecret =
    process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

  app.set('trust proxy', 1);
  app.set('view engine', 'ejs');
  app.set('views', path.join(process.cwd(), 'views'));

  app.use(express.static(path.join(process.cwd(), 'public')));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(
    methodOverride((req) => {
      if (req.body && typeof req.body === 'object' && '_method' in req.body) {
        const method = String(req.body._method).toUpperCase();
        delete req.body._method;
        return method;
      }
      return req.method;
    })
  );

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: 'auto',
        sameSite: 'lax',
      },
    })
  );

  app.use((req, _res, next) => {
    if (req.secure && req.session) {
      req.session.cookie.sameSite = 'none';
      req.session.cookie.secure = true;
    }
    next();
  });

  app.use(localsMiddleware);
  app.use(verifyCsrf);

  app.get('/', (req, res) => {
    if (req.session.userId) {
      res.redirect('/dashboard');
      return;
    }
    res.redirect('/login');
  });

  app.use(authRoutes);
  app.use(dashboardRoutes);
  app.use(ticketRoutes);
  app.use(categoryRoutes);
  app.use(userRoutes);
  app.use(notificationRoutes);

  app.use((_req, res) => {
    render404(res);
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).send('Internal server error');
  });

  return app;
}
