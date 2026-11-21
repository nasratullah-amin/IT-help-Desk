# IT Help Desk Ticketing System

An IT Help Desk Ticketing System ported for Node.js, Express, TypeScript, and EJS templates with role-aware workflows, notifications, activity history, attachments, server-side search/filtering/pagination, and full user/category management.

## Requirements

- Node.js 20+ (Node.js 22 recommended)
- npm

## Installation & Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.
4. To build and run for production:
   ```bash
   npm run build
   npm start
   ```

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@helpdesk.test` | `Admin@12345` |
| Technician | `technician@helpdesk.test` | `Tech@12345` |
| User | `user@helpdesk.test` | `User@12345` |

You can also register a new standard user account from `/register`.

## Tests & Checks

```bash
npm run lint
npm run build
npm test
```
