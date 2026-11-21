import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import session from 'express-session';
import methodOverride from 'method-override';
import { localsMiddleware, verifyCsrf } from './src/middleware.js';
import authRoutes from './src/routes/auth.js';
import categoryRoutes from './src/routes/categories.js';
import dashboardRoutes from './src/routes/dashboard.js';
import ticketRoutes from './src/routes/tickets.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

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
    secret: process.env.SESSION_SECRET || 'it-helpdesk-local-dev-secret',
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

app.get('/', (_req, res) => {
  res.redirect('/login');
});

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(ticketRoutes);
app.use(categoryRoutes);

app.use((_req, res) => {
  res.status(404).send('Not found');
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).send('Internal server error');
});

app.listen(PORT, HOST, () => {
  console.log(`IT Help Desk listening on http://${HOST}:${PORT}`);
});
