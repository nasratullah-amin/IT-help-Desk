# IT Help Desk Ticketing System

A Laravel 12 application for reporting, assigning and resolving IT support tickets. The existing Laravel application structure is retained and extended with role-aware workflows, activity history, secure private attachments, server-side filtering and feature tests.

## Requirements

- PHP 8.2+
- Composer 2
- MySQL 8+ or MariaDB (SQLite can be used for local testing)
- PHP extensions required by Laravel: Ctype, cURL, DOM, Fileinfo, Filter, Hash, Mbstring, OpenSSL, PDO, Session, Tokenizer, XML
- PDO driver for the database you select

## Installation

1. Extract the project and open a terminal in its root directory.
2. Install dependencies: `composer install`
3. Copy `.env.example` to `.env`.
4. Create a MySQL database, for example:

   ```sql
   CREATE DATABASE it_helpdesk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

5. Set `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME` and `DB_PASSWORD` in `.env`.
6. Generate the application key: `php artisan key:generate`
7. Run migrations and demo seed data: `php artisan migrate --seed`
8. Start the server: `php artisan serve`
9. Open `http://127.0.0.1:8000`.

For a clean local database rebuild, run `php artisan migrate:fresh --seed`. This command deletes existing database data.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@helpdesk.test` | `Admin@12345` |
| Technician | `technician@helpdesk.test` | `Tech@12345` |
| User | Register through the registration page | Set during registration |

Change seeded passwords before exposing the application to a network or using it beyond a local assignment.

## Roles and workflows

- **User:** register and sign in, create tickets, edit their own open tickets, view their own tickets, comment and upload/download authorized attachments.
- **Technician:** view tickets assigned to them, comment, upload attachments, and move assigned tickets through the allowed workflow.
- **Admin:** view all tickets, assign/reassign technicians, manage users and roles, manage categories, change ticket priority/details, and monitor activity.

Ticket statuses are `open`, `assigned`, `in_progress`, `resolved` and `closed`. Allowed transitions are enforced server-side. Admin assignment automatically moves an open ticket to assigned; unassigning an assigned ticket returns it to open.

## Security and storage

- Ticket access, updates, assignment, comments and downloads are authorized server-side.
- Attachments are validated by content type and extension, limited to 5 MB, assigned generated storage names, and stored on Laravel's private local disk.
- Downloads use an authenticated, policy-protected route; files are not exposed through the public storage directory.
- Login attempts are rate limited. Passwords use Laravel's hashed cast and login sessions are regenerated.
- CSRF protection is provided by Laravel's web middleware.

## Tests and checks

Run:

```bash
php artisan optimize:clear
php artisan route:list
php artisan migrate:fresh --seed
php artisan test
php artisan view:clear
php artisan config:clear
php artisan cache:clear
```

Feature tests cover ticket ownership/IDOR, admin assignment, technician status transitions, and private attachment upload/download.

## Notes

The project archive intentionally does not include Composer's `vendor/` directory. Run `composer install` before using Artisan or running tests. The `composer.lock` file was not included in the supplied archive, so Composer resolves dependency versions compatible with `composer.json` during installation.
