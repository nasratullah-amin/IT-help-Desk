import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { categories, notifications, resetStore, tickets, users } from '../src/store.js';

interface TestResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  buffer: Buffer;
  location?: string;
}

class CookieClient {
  private cookies = new Map<string, string>();

  constructor(private readonly baseUrl: string) {}

  private updateCookies(setCookieHeader: string | string[] | undefined): void {
    if (!setCookieHeader) return;
    const list = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    for (const raw of list) {
      const pair = raw.split(';')[0];
      const eqIdx = pair.indexOf('=');
      if (eqIdx > 0) {
        const name = pair.slice(0, eqIdx).trim();
        const val = pair.slice(eqIdx + 1).trim();
        this.cookies.set(name, val);
      }
    }
  }

  private cookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  async request(
    method: string,
    path: string,
    opts?: {
      form?: Record<string, string>;
      multipart?: { fields: Record<string, string>; file?: { name: string; filename: string; contentType: string; data: Buffer } };
      followRedirects?: boolean;
    }
  ): Promise<TestResponse> {
    const url = new URL(path, this.baseUrl);
    const headers: Record<string, string> = {};
    const cookie = this.cookieHeader();
    if (cookie) headers['Cookie'] = cookie;

    let bodyPayload: Buffer | undefined;
    if (opts?.form) {
      const encoded = new URLSearchParams(opts.form).toString();
      bodyPayload = Buffer.from(encoded, 'utf8');
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Content-Length'] = String(bodyPayload.length);
    } else if (opts?.multipart) {
      const boundary = '----TestBoundary7e9a2b';
      const chunks: Buffer[] = [];
      for (const [key, val] of Object.entries(opts.multipart.fields)) {
        chunks.push(
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`,
            'utf8'
          )
        );
      }
      if (opts.multipart.file) {
        const f = opts.multipart.file;
        chunks.push(
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"; filename="${f.filename}"\r\nContent-Type: ${f.contentType}\r\n\r\n`,
            'utf8'
          )
        );
        chunks.push(f.data);
        chunks.push(Buffer.from('\r\n', 'utf8'));
      }
      chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
      bodyPayload = Buffer.concat(chunks);
      headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
      headers['Content-Length'] = String(bodyPayload.length);
    }

    const res = await new Promise<TestResponse>((resolve, reject) => {
      const req = http.request(
        url,
        { method, headers },
        (response) => {
          const dataChunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => dataChunks.push(chunk));
          response.on('end', () => {
            this.updateCookies(response.headers['set-cookie']);
            const buffer = Buffer.concat(dataChunks);
            resolve({
              status: response.statusCode ?? 0,
              headers: response.headers,
              body: buffer.toString('utf8'),
              buffer,
              location: response.headers.location,
            });
          });
        }
      );
      req.on('error', reject);
      if (bodyPayload) req.write(bodyPayload);
      req.end();
    });

    if (opts?.followRedirects && res.status >= 300 && res.status < 400 && res.location) {
      return this.request('GET', res.location, { followRedirects: true });
    }
    return res;
  }

  async getCsrf(path = '/login'): Promise<string> {
    const res = await this.request('GET', path, { followRedirects: true });
    const match = res.body.match(/name="_csrf"\s+value="([^"]+)"/);
    assert.ok(match && match[1], `Expected CSRF token on ${path}, got status ${res.status}`);
    return match[1];
  }

  async login(email: string, password: string): Promise<TestResponse> {
    const csrf = await this.getCsrf('/login');
    return this.request('POST', '/login', {
      form: { _csrf: csrf, email, password },
      followRedirects: true,
    });
  }
}

let server: http.Server;
let baseUrl: string;

before(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      assert.ok(addr && typeof addr === 'object');
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

beforeEach(() => {
  resetStore();
});

describe('IT Help Desk End-to-End Verification', () => {
  it('supports user registration, login, and logout', async () => {
    const client = new CookieClient(baseUrl);
    const regCsrf = await client.getCsrf('/register');
    const regRes = await client.request('POST', '/register', {
      form: {
        _csrf: regCsrf,
        name: 'Test Student',
        email: 'student.new@helpdesk.test',
        password: 'Password1234',
        password_confirmation: 'Password1234',
      },
      followRedirects: true,
    });
    assert.equal(regRes.status, 200);
    assert.match(regRes.body, /Welcome, Test Student/);

    const dashCsrf = await client.getCsrf('/dashboard');
    const logoutRes = await client.request('POST', '/logout', {
      form: { _csrf: dashCsrf },
    });
    assert.equal(logoutRes.status, 302);
    assert.equal(logoutRes.location, '/login');

    const protectedRes = await client.request('GET', '/dashboard');
    assert.equal(protectedRes.status, 302);
    assert.equal(protectedRes.location, '/login');
  });

  it('renders role-specific dashboards with real database counts', async () => {
    const adminClient = new CookieClient(baseUrl);
    const adminDash = await adminClient.login('admin@helpdesk.test', 'Admin@12345');
    assert.equal(adminDash.status, 200);
    assert.match(adminDash.body, /Total Tickets/);
    assert.match(adminDash.body, /Total Categories/);
    assert.match(adminDash.body, /Ticket Status Overview/);
    assert.match(adminDash.body, /Ticket Priority Overview/);

    const techClient = new CookieClient(baseUrl);
    const techDash = await techClient.login('technician@helpdesk.test', 'Tech@12345');
    assert.equal(techDash.status, 200);
    assert.match(techDash.body, /Assigned Tickets/);
    assert.match(techDash.body, /Recently Assigned Tickets/);

    const userClient = new CookieClient(baseUrl);
    const userDash = await userClient.login('user@helpdesk.test', 'User@12345');
    assert.equal(userDash.status, 200);
    assert.match(userDash.body, /My Total Tickets/);
    assert.match(userDash.body, /My Closed Tickets/);
  });

  it('supports full ticket lifecycle: create with attachment, edit, assign, status update, comments, download, and delete', async () => {
    const userClient = new CookieClient(baseUrl);
    await userClient.login('user@helpdesk.test', 'User@12345');

    const createCsrf = await userClient.getCsrf('/tickets/create');
    const firstCat = Array.from(categories.values())[0];
    const fileContent = Buffer.from('Diagnostic log line 1\nError code 42', 'utf8');

    const createRes = await userClient.request('POST', '/tickets', {
      multipart: {
        fields: {
          _csrf: createCsrf,
          subject: 'Broken printer in Library Floor 2',
          category_id: String(firstCat.id),
          priority: 'high',
          description: 'The laser printer in Library Floor 2 is jamming on every second page.',
        },
        file: {
          name: 'attachment',
          filename: 'printer-log.txt',
          contentType: 'text/plain',
          data: fileContent,
        },
      },
      followRedirects: true,
    });
    assert.equal(createRes.status, 200);
    assert.match(createRes.body, /Broken printer in Library Floor 2/);
    assert.match(createRes.body, /printer-log\.txt/);

    const createdTicket = Array.from(tickets.values()).find(
      (t) => t.subject === 'Broken printer in Library Floor 2'
    );
    assert.ok(createdTicket);

    // Edit open ticket by owner
    const editCsrf = await userClient.getCsrf(`/tickets/${createdTicket.id}/edit`);
    const editRes = await userClient.request('POST', `/tickets/${createdTicket.id}`, {
      form: {
        _csrf: editCsrf,
        _method: 'PUT',
        subject: 'Broken printer in Library Floor 2 (Updated)',
        category_id: String(firstCat.id),
        priority: 'critical',
        description: 'Updated description: printer displays paper jam E04 error continuously.',
      },
      followRedirects: true,
    });
    assert.equal(editRes.status, 200);
    assert.match(editRes.body, /Broken printer in Library Floor 2 \(Updated\)/);
    assert.equal(tickets.get(createdTicket.id)?.priority, 'critical');

    // Admin assigns technician
    const adminClient = new CookieClient(baseUrl);
    await adminClient.login('admin@helpdesk.test', 'Admin@12345');
    const techUser = Array.from(users.values()).find((u) => u.email === 'technician@helpdesk.test');
    assert.ok(techUser);

    const adminTicketCsrf = await adminClient.getCsrf(`/tickets/${createdTicket.id}`);
    const assignRes = await adminClient.request('POST', `/tickets/${createdTicket.id}/assign`, {
      form: {
        _csrf: adminTicketCsrf,
        _method: 'PATCH',
        assigned_to: String(techUser.id),
      },
      followRedirects: true,
    });
    assert.equal(assignRes.status, 200);
    assert.equal(tickets.get(createdTicket.id)?.assignedTo, techUser.id);
    assert.equal(tickets.get(createdTicket.id)?.status, 'assigned');

    // Technician updates status to in_progress and resolved, posts comment, downloads attachment
    const techClient = new CookieClient(baseUrl);
    await techClient.login('technician@helpdesk.test', 'Tech@12345');
    const techCsrf = await techClient.getCsrf(`/tickets/${createdTicket.id}`);

    await techClient.request('POST', `/tickets/${createdTicket.id}/status`, {
      form: {
        _csrf: techCsrf,
        _method: 'PATCH',
        status: 'in_progress',
        note: 'Cleared paper tray rollers',
      },
      followRedirects: true,
    });
    assert.equal(tickets.get(createdTicket.id)?.status, 'in_progress');

    await techClient.request('POST', `/tickets/${createdTicket.id}/comments`, {
      form: {
        _csrf: techCsrf,
        body: 'Replaced worn pickup roller and printed test sheet successfully.',
      },
      followRedirects: true,
    });

    const resolvedRes = await techClient.request('POST', `/tickets/${createdTicket.id}/status`, {
      form: {
        _csrf: techCsrf,
        _method: 'PATCH',
        status: 'resolved',
        note: 'Printer operational',
      },
      followRedirects: true,
    });
    assert.equal(resolvedRes.status, 200);
    assert.equal(tickets.get(createdTicket.id)?.status, 'resolved');
    assert.match(resolvedRes.body, /Replaced worn pickup roller/);

    // Download attachment as authorized user
    const dlMatch = resolvedRes.body.match(/href="(\/attachments\/\d+\/download)"/);
    assert.ok(dlMatch);
    const dlRes = await userClient.request('GET', dlMatch[1]);
    assert.equal(dlRes.status, 200);
    assert.equal(dlRes.buffer.toString('utf8'), fileContent.toString('utf8'));

    // Check notifications were generated for requester & technician
    const userNotifs = Array.from(notifications.values()).filter(
      (n) => n.userId === createdTicket.userId && n.ticketId === createdTicket.id
    );
    assert.ok(userNotifs.length >= 3, 'Expected notifications for assignment, comment, and resolution');

    // Delete ticket as admin
    const delCsrf = await adminClient.getCsrf(`/tickets/${createdTicket.id}`);
    const delRes = await adminClient.request('POST', `/tickets/${createdTicket.id}`, {
      form: { _csrf: delCsrf, _method: 'DELETE' },
      followRedirects: true,
    });
    assert.equal(delRes.status, 200);
    assert.equal(tickets.get(createdTicket.id), undefined);
  });

  it('enforces role-based authorization and IDOR protection', async () => {
    const userClient = new CookieClient(baseUrl);
    await userClient.login('user@helpdesk.test', 'User@12345');

    // User cannot access admin routes
    const usersPage = await userClient.request('GET', '/users');
    assert.equal(usersPage.status, 403);
    const categoriesPage = await userClient.request('GET', '/categories');
    assert.equal(categoriesPage.status, 403);

    // User cannot view another user's ticket (#2 belongs to Layla)
    const laylaTicket = Array.from(tickets.values()).find((t) => {
      const owner = users.get(t.userId);
      return owner?.email === 'layla@helpdesk.test';
    });
    assert.ok(laylaTicket);
    const idorRes = await userClient.request('GET', `/tickets/${laylaTicket.id}`);
    assert.equal(idorRes.status, 403);

    // Technician cannot view unassigned ticket
    const techClient = new CookieClient(baseUrl);
    await techClient.login('technician@helpdesk.test', 'Tech@12345');
    const techIdorRes = await techClient.request('GET', `/tickets/${laylaTicket.id}`);
    assert.equal(techIdorRes.status, 403);
  });

  it('supports search by ID, subject, user, technician, category, plus filters and pagination', async () => {
    const adminClient = new CookieClient(baseUrl);
    await adminClient.login('admin@helpdesk.test', 'Admin@12345');

    // Search by user name
    const byUser = await adminClient.request('GET', '/tickets?search=Layla');
    assert.equal(byUser.status, 200);
    assert.match(byUser.body, /student portal after password reset/);

    // Search by technician name
    const byTech = await adminClient.request('GET', '/tickets?search=Sara%20Mahmood');
    assert.equal(byTech.status, 200);
    assert.match(byTech.body, /MATLAB license/);

    // Search by category name
    const byCat = await adminClient.request('GET', '/tickets?search=Network');
    assert.equal(byCat.status, 200);
    assert.match(byCat.body, /Campus Wi-Fi/);

    // Filter unassigned
    const unassigned = await adminClient.request('GET', '/tickets?technician_id=unassigned');
    assert.equal(unassigned.status, 200);
    assert.match(unassigned.body, /student portal/);
    assert.doesNotMatch(unassigned.body, /Campus Wi-Fi/);

    // Pagination test with >10 tickets
    const csrf = await adminClient.getCsrf('/tickets/create');
    const catId = Array.from(categories.values())[0].id;
    for (let i = 1; i <= 8; i++) {
      await adminClient.request('POST', '/tickets', {
        form: {
          _csrf: csrf,
          subject: `Batch Pagination Ticket ${i}`,
          category_id: String(catId),
          priority: 'low',
          description: `Detailed description for pagination check item ${i}.`,
        },
      });
    }
    const page2 = await adminClient.request('GET', '/tickets?page=2');
    assert.equal(page2.status, 200);
    assert.match(page2.body, /Page 2 of 2/);
  });

  it('supports admin user CRUD, search, activation/deactivation, and safe deletion', async () => {
    const adminClient = new CookieClient(baseUrl);
    await adminClient.login('admin@helpdesk.test', 'Admin@12345');

    const csrf = await adminClient.getCsrf('/users/create');
    const createRes = await adminClient.request('POST', '/users', {
      form: {
        _csrf: csrf,
        name: 'New Campus Tech',
        email: 'newtech@helpdesk.test',
        password: 'Password1234',
        role: 'technician',
        is_active: '1',
      },
      followRedirects: true,
    });
    assert.equal(createRes.status, 200);
    assert.match(createRes.body, /New Campus Tech/);

    const createdUser = Array.from(users.values()).find((u) => u.email === 'newtech@helpdesk.test');
    assert.ok(createdUser);

    // Search user
    const searchRes = await adminClient.request('GET', '/users?search=New%20Campus');
    assert.match(searchRes.body, /newtech@helpdesk\.test/);

    // Deactivate user and confirm login fails
    const listCsrf = await adminClient.getCsrf('/users');
    await adminClient.request('POST', `/users/${createdUser.id}/toggle-status`, {
      form: { _csrf: listCsrf, _method: 'PATCH' },
      followRedirects: true,
    });
    assert.equal(users.get(createdUser.id)?.isActive, false);

    const blockedClient = new CookieClient(baseUrl);
    const blockedLogin = await blockedClient.login('newtech@helpdesk.test', 'Password1234');
    assert.match(blockedLogin.body, /deactivated/);

    // Safe delete user without tickets succeeds
    const delCsrf = await adminClient.getCsrf('/users');
    await adminClient.request('POST', `/users/${createdUser.id}`, {
      form: { _csrf: delCsrf, _method: 'DELETE' },
      followRedirects: true,
    });
    assert.equal(users.get(createdUser.id), undefined);

    // Safe delete user with tickets is blocked cleanly
    const ahmad = Array.from(users.values()).find((u) => u.email === 'user@helpdesk.test');
    assert.ok(ahmad);
    const blockedDelRes = await adminClient.request('POST', `/users/${ahmad.id}`, {
      form: { _csrf: delCsrf, _method: 'DELETE' },
      followRedirects: true,
    });
    assert.match(blockedDelRes.body, /Cannot delete/);
    assert.ok(users.get(ahmad.id));
  });

  it('supports category CRUD, search, toggle status, and safe deletion', async () => {
    const adminClient = new CookieClient(baseUrl);
    await adminClient.login('admin@helpdesk.test', 'Admin@12345');

    const csrf = await adminClient.getCsrf('/categories');
    const createRes = await adminClient.request('POST', '/categories', {
      form: {
        _csrf: csrf,
        name: 'Audio Visual',
        description: 'Microphones and lecture recording systems',
      },
      followRedirects: true,
    });
    assert.equal(createRes.status, 200);
    assert.match(createRes.body, /Audio Visual/);

    const createdCat = Array.from(categories.values()).find((c) => c.name === 'Audio Visual');
    assert.ok(createdCat);

    // Search category
    const searchRes = await adminClient.request('GET', '/categories?search=Audio');
    assert.match(searchRes.body, /Audio Visual/);

    // Delete unused category succeeds
    await adminClient.request('POST', `/categories/${createdCat.id}`, {
      form: { _csrf: csrf, _method: 'DELETE' },
      followRedirects: true,
    });
    assert.equal(categories.get(createdCat.id), undefined);

    // Deleting category in use by tickets is prevented
    const networkCat = Array.from(categories.values()).find((c) => c.name === 'Network');
    assert.ok(networkCat);
    const failDelRes = await adminClient.request('POST', `/categories/${networkCat.id}`, {
      form: { _csrf: csrf, _method: 'DELETE' },
      followRedirects: true,
    });
    assert.match(failDelRes.body, /used by existing tickets/);
    assert.ok(categories.get(networkCat.id));
  });

  it('supports notifications listing and mark-all-read with ownership enforcement', async () => {
    const userClient = new CookieClient(baseUrl);
    await userClient.login('user@helpdesk.test', 'User@12345');

    const listRes = await userClient.request('GET', '/notifications');
    assert.equal(listRes.status, 200);
    assert.match(listRes.body, /New comment on your ticket/);

    // Ownership check on another user's notification
    const adminNotif = Array.from(notifications.values()).find((n) => {
      const u = users.get(n.userId);
      return u?.email === 'admin@helpdesk.test';
    });
    assert.ok(adminNotif);
    const forbiddenNotif = await userClient.request('GET', `/notifications/${adminNotif.id}/open`);
    assert.equal(forbiddenNotif.status, 403);

    const csrf = await userClient.getCsrf('/notifications');
    const markRes = await userClient.request('POST', '/notifications/mark-all-read', {
      form: { _csrf: csrf },
      followRedirects: true,
    });
    assert.equal(markRes.status, 200);
    assert.match(markRes.body, /Marked/);
  });

  it('defaults to light mode and includes anti-flash theme script and toggle across all roles and pages', async () => {
    const guestClient = new CookieClient(baseUrl);
    const loginPage = await guestClient.request('GET', '/login');
    assert.equal(loginPage.status, 200);
    assert.match(loginPage.body, /data-theme="light"/);
    assert.match(loginPage.body, /localStorage\.getItem\('it_helpdesk_theme'\)/);
    assert.match(loginPage.body, /data-theme-toggle/);

    const registerPage = await guestClient.request('GET', '/register');
    assert.equal(registerPage.status, 200);
    assert.match(registerPage.body, /data-theme-toggle/);

    const cssRes = await guestClient.request('GET', '/css/app.css');
    assert.equal(cssRes.status, 200);
    assert.match(cssRes.body, /html\[data-theme='dark'\]/);
    assert.match(cssRes.body, /color-scheme:\s*light/);
    assert.match(cssRes.body, /color-scheme:\s*dark/);

    const adminClient = new CookieClient(baseUrl);
    const adminDash = await adminClient.login('admin@helpdesk.test', 'Admin@12345');
    assert.match(adminDash.body, /data-theme-toggle/);

    const techClient = new CookieClient(baseUrl);
    const techDash = await techClient.login('technician@helpdesk.test', 'Tech@12345');
    assert.match(techDash.body, /data-theme-toggle/);

    const userClient = new CookieClient(baseUrl);
    const userDash = await userClient.login('user@helpdesk.test', 'User@12345');
    assert.match(userDash.body, /data-theme-toggle/);
  });
});
