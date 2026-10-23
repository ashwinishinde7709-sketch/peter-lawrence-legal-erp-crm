# Peter Lawrence Legal ERP & CRM System

A full-stack MERN project built around the supplied React/Vite frontend. The visual design is preserved; the placeholder service has been replaced with a real Express/MongoDB API.

## Structure

- `frontend/` – React + Vite user interface
- `backend/` – Express + MongoDB REST API

## Requirements

- Node.js 20+ recommended (Node 22 works)
- MongoDB Atlas or local MongoDB

## 1. Configure backend

Copy `backend/.env.example` to `backend/.env` and set your real MongoDB URI:

```env
PORT=5000
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/peter_lawrence_erp?retryWrites=true&w=majority
JWT_SECRET=replace-this-with-a-long-random-secret
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:3000
UPLOAD_DIR=uploads
```

## 2. Install dependencies

From the project root:

```powershell
npm install
npm run install:all
```

Or separately:

```powershell
cd backend
npm install
cd ..\frontend
npm install
```

## 3. Create the first admin

From the root:

```powershell
npm run seed
```

This clears application collections and creates only:

- Email: `admin@lawfirm.com`
- Password: `admin123`

No business mock data is inserted.

## 4. Run

From the root:

```powershell
npm run dev
```

Or run separately:

Backend:
```powershell
cd backend
npm run dev
```

Frontend (new terminal):
```powershell
cd frontend
npm run dev
```

- Frontend: http://localhost:3000
- Backend health: http://localhost:5000/api/health

## Roles

- **Admin:** firm-wide user, client, lawyer, case, appointment, document, billing, and report access.
- **Reception:** client registration and appointment booking/assignment.
- **Lawyer:** assigned clients, cases, appointments, documents, and progress updates.
- **Client:** own cases, documents, appointments, invoices, and receipts. Clients can also self-register.
- **Accountant:** invoices, payment records, receipts, payroll, expenses, and reports.
- Existing HR and employee workspaces remain available for non-legal operations.

Admins can search and edit client, lawyer, and user profiles from their management pages. Delete actions require confirmation and perform a soft delete by setting the record status to `Inactive`; linked user accounts are deactivated while historical legal and financial records are retained. Inactive records can be reactivated.

The admin overview shows backend counts for total clients, total lawyers, total employees, active cases, pending consultations, pending documents, and pending invoices, plus total revenue, monthly revenue, and pending payment value. It does not render the generic chart, activity, quick-action, or focus-note widgets used by other role dashboards. HR has a separate live-data dashboard for active employees, today's attendance, and pending leave requests.

## Legal workflow

1. Reception creates the client profile. A client may also create their portal account through public registration.
2. A client requests an appointment; reception assigns the client and lawyer.
3. The assigned lawyer completes the consultation. An admin or lawyer then approves it to create its linked case.
4. Lawyers request case documents; clients upload files; the assigned lawyer approves, rejects, or requests a re-upload.
5. Lawyers update case progress through the progress endpoint. At 100%, the case is completed and becomes available for finance to invoice.
6. Admins or accountants create an invoice for a completed case. Clients can submit payment details; an admin or accountant confirms settlement, updates the invoice, and generates a receipt.

This project does not integrate a payment gateway. Client-submitted payment details remain pending until an admin or accountant confirms that settlement was received; only confirmed payments mark an invoice paid and generate a receipt.

## People and finance workflows

- Admin and HR manage employee login accounts and employee profile data (department, designation, joining date, and active status). Deactivation disables login but retains payroll, leave, and attendance history.
- HR records attendance for a selected UTC work date. A unique employee/date key ensures each day's mark is an upsert rather than a duplicate. Approved leave requests create corresponding leave attendance marks.
- Employees submit their own leave requests and can read only their own attendance, leave, and payroll records. HR and admins review leave requests.
- Admin/HR create at most one payroll entry per employee and month; net salary is calculated from basic salary, allowances, and deductions. Accountants can mark payroll as paid.
- Admin/accountant invoice entry is limited to completed cases. Legacy auto-generated invoices can be completed with invoice details; invoices store linked client and case references and have Pending, Paid, Overdue, or Cancelled status.
- Clients can view their invoice and payment history, submit Cash, UPI, Card, or Bank Transfer details for confirmation, and view/print receipts after settlement is confirmed. Payments, invoices, and receipts remain linked to the client and case.
- Admins can reassign case lawyers and manage persisted firm contact, logo URL, currency, timezone, and branding settings.

## API and performance notes

- `GET /api/:resource` supports `page`, `limit` (maximum 100), `status`, `caseId`, and `search` filters. The response includes `data` and `pagination` metadata.
- `POST /api/appointments/:id/approve-consultation` creates or returns the case linked to a completed consultation. Optional fields include `title`, `type`, `description`, `priority`, and `fee`.
- `PATCH /api/cases/:id/progress` accepts a progress value from 0 to 100. Completing a case makes it available for invoice entry.
- `PATCH /api/cases/:id/lawyer` reassigns a case to an active lawyer (admin only).
- `POST /api/invoices/:id/payment-submissions` saves client-submitted payment details as pending. `POST /api/invoices/:id/payments` records or confirms full settlement and issues a receipt.
- `PATCH /api/invoices/:id/payments/:paymentId/reject` lets finance reject an unconfirmed submission so the client can resubmit details.
- `PATCH /api/invoices/:id/cancel` cancels an unpaid invoice; overdue status is derived from its due date.
- `GET/PUT /api/settings` reads or updates singleton firm settings (admin only).
- `GET /api/reports` returns database-backed revenue, invoice, case, lawyer, and recruitment metrics. Revenue uses confirmed payments plus legacy paid invoices without payment records.
- `GET /api/attendance/workday?date=YYYY-MM-DD` loads the active employee register and saved marks; `PUT /api/attendance/workday` upserts the daily marks.
- `PATCH /api/leave/:id/review` approves or rejects a pending leave request. Approval also marks each requested day as leave.
- `GET /api/billing/options` returns limited client and uninvoiced completed-case options for finance invoice entry.
- Workflow collections have indexes on their lawyer/client/case/status references. Lists use bounded pagination and lean MongoDB reads.
- Dashboard data is consolidated into one role-aware API request and only queries metrics needed by that role. Dashboard response time depends on MongoDB capacity and network latency; the application cannot guarantee a fixed sub-three-second response on every deployment.
- Uploaded legal files are no longer served as public static assets. Authenticated users can download only documents within their role/ownership scope.

The backend retains the existing JWT login and profile endpoints. Before deploying to a populated MongoDB database, clean up duplicate employee/date attendance marks; the employee/month payroll uniqueness index is partial so legacy payroll rows without a month remain readable while new monthly records are constrained.
