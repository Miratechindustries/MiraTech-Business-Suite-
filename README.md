# MiraTech Executive Report & Ledger Engine

Enterprise-grade Cloud ERP, Financial Ledger, and Autonomous Operations Suite engineered with Next.js App Router, TypeScript, Google Cloud Firestore, Firebase Auth, Paddle Merchant-of-Record billing, and server-side Gemini AI.

---

## 1. Executive Summary & Architecture

The **MiraTech Executive Report & Ledger Engine** is a multi-tenant SaaS platform built to unify core enterprise operational workflows into a single system of record. It integrates double-entry financial accounting, multi-warehouse inventory management, procurement 3-way matching, automated payroll/tax compliance, multi-tier RBAC, real-time audit governance, transactional email delivery (Brevo + RFC 8058 1-click unsubscribe), and autonomous financial intelligence via Google Gemini.

### Architectural Stack

- **Framework**: Next.js 15+ (App Router, Server Components & Dynamic Route Handlers)
- **Runtime**: Node.js v22 (Type-stripping native execution with custom `server.ts` HTTP runner on port 3000)
- **Database & Identity**: Google Cloud Firestore & Firebase Authentication (`ai-studio-70feb629-4714-4b74-93eb-853bab2b9254`) with security rules enforcement
- **Billing & Subscriptions**: Paddle v2 (Merchant of Record, webhook signature verification, portal sessions, and automated plan synchronization)
- **Transactional & Marketing Email**: Brevo REST API with RFC 8058 List-Unsubscribe headers, cryptographic HMAC token validation, and unsubscribe tracking
- **AI Analytics**: Server-side Google Gemini (`@google/genai`) for executive summaries, financial anomalies, and automated insights
- **Styling & UI**: Tailwind CSS v4, Lucide Icons, and Motion for reactive animations

---

## 2. Core Functional Modules

### 2.1 Multi-Tenant Organization & Workspace Switcher
- Hierarchical multi-tenancy supporting isolated company spaces (`companies` collection).
- Real-time workspace switching (`WorkspaceSwitcher.tsx`) with role-scoped authorization (`Super Admin`, `Company Admin`, `Department Manager`, `Staff`).
- Company provisioning with automated ledger initialization, default chart of accounts, and administrative seed accounts.

### 2.2 Financial Ledger & Double-Entry Accounting
- **General Ledger Engine**: Transaction double-entry validation (`lib/accounting`), debit/credit balance verification, and real-time ledger updates.
- **Invoices & Quotations**: Comprehensive billing pipeline supporting line items, multi-currency conversions, tax profiles, payment terms, and direct PDF/print generation.
- **Receipts & Expense Tracking**: Categorized expense management linked to department budgets and procurement orders.
- **Financial Statements**: Dynamic balance sheets, income statements (P&L), cash flow summaries, and department-level profitability metrics.

### 2.3 Procurement Hub & 3-Way Match Verification
- Automated purchase order (PO) generation, goods received notes (GRN), and vendor invoice reconciliation (`/api/procurement/three-way-match`).
- Discrepancy flagging for quantity variations, price drift, and unauthorized invoice overrides.
- Vendor ledger tracking with automated accounts payable (AP) aging analysis.

### 2.4 Multi-Warehouse Inventory & Point-of-Sale (POS)
- Stock level tracking across distributed storage locations and warehouses.
- Barcode scanning integration, low-stock threshold triggers, and automated reorder requests.
- **POS Hub**: Offline-resilient transaction interface with local caching and optimistic reconciliation when online connectivity resumes.

### 2.5 Automated Payroll & HR Compliance
- Employee payroll profiles with dynamic allowances, deductions, and statutory withholdings.
- Historical payroll batch runs (`PayrollHistoricalLogs.tsx`) with immutable run signatures.
- Automated payslip distribution via transactional email.

### 2.6 Department Management & Role-Based Access Control (RBAC)
- Fine-grained department scoping (`DepartmentManager.tsx`, `withDepartmentAccess.tsx`).
- Granular permission matrix covering read, write, export, approve, and delete permissions across all organizational entities.
- Sub-admin delegation and audit monitoring for high-privilege access grants.

### 2.7 Paddle Merchant of Record (MoR) Integration
- Embedded and overlay checkout workflows (`PaddleCheckoutModal.tsx`) for multi-tier SaaS subscriptions:
  - **Starter**, **Growth**, **Professional**, **Elite**, **Enterprise**.
- Secure webhook listener (`/api/paddle/webhook`) processing subscription lifecycle events:
  - `subscription.created`, `subscription.updated`, `subscription.canceled`, `subscription.paused`, `transaction.completed`.
- Customer billing self-service portal integration (`/api/paddle/portal`).

### 2.8 Transactional & Subscription Email System
- Brevo transactional delivery engine (`lib/email-service.ts`, `lib/subscription-email-service.ts`).
- Full compliance with CAN-SPAM and RFC 8058:
  - Automated `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` header injection.
  - Dedicated unsubscribe endpoints (`/api/email/unsubscribe`, `/unsubscribe`, `/email-preferences`).
- Cryptographic HMAC tokens ensuring unforgeable preference modification links (`lib/email-tokens.ts`).
- Administrative email audit dashboard for delivery logs, bounce monitoring, and subscriber preference control.

### 2.9 Security Operations, Audit Trails & GDPR Governance
- Structured audit logging (`AuditLogs.tsx`, `lib/auditLogger.ts`) capturing actor ID, timestamp, IP address, user agent, action signature, and affected entity snapshot.
- Automated GDPR data scrubbing and anonymization routes (`/api/governance/gdpr-anonymize`).
- Audit log retention policies with automated pruning jobs (`/api/governance/prune-audit`).
- Cryptographic OTP verification for high-risk operations (`lib/otp.ts`).

### 2.10 AI-Powered Financial Intelligence
- Server-side Gemini integration (`/api/gemini/insights`) generating executive briefs, identifying cost overruns, forecasting cash flows, and highlighting operational bottlenecks.

---

## 3. Directory Structure

```text
├── app/
│   ├── (public pages)/          # Landing, features, pricing, legal, auth, support
│   ├── actions/                 # Server actions for background tasks
│   ├── api/                     # REST Route Handlers
│   │   ├── actions/execute/     # Generic action dispatcher
│   │   ├── admin/               # Backup, maintenance, subscription/marketing emails
│   │   ├── analytics/           # Department and revenue performance APIs
│   │   ├── audit/               # Compliance and audit querying
│   │   ├── auth/                # MFA verification, OTP, session webhooks
│   │   ├── cron/                # Scheduled tasks (e.g. trial reminders)
│   │   ├── email/               # Brevo transactional, preference, and unsubscribe APIs
│   │   ├── gemini/              # AI financial insights
│   │   ├── governance/          # GDPR anonymization, audit pruning, billing webhooks
│   │   ├── legal/               # Legal documents seed
│   │   ├── paddle/              # Webhooks, customer portal, transactions
│   │   └── procurement/         # 3-way matching engine
│   ├── dashboard/               # Tenant dashboard & deep financial views
│   ├── layout.tsx               # Root application layout
│   └── page.tsx                 # Public executive portal
├── components/                  # Domain components (Accounting, Payroll, POS, RBAC, etc.)
│   ├── finance/                 # Ledger, reporting, and cash flow visualizers
│   ├── governance/              # Compliance and audit drawers
│   └── ui/                      # Base buttons, dialogs, inputs, and tables
├── lib/
│   ├── accounting/              # Double-entry ledger logic and balance calculators
│   ├── auditLogger.ts           # Unified server and client audit event dispatchers
│   ├── brevo-client.ts          # Brevo API client configuration
│   ├── email-service.ts         # RFC 8058 transactional email service
│   ├── firebase.ts              # Client-side Firebase SDK configuration
│   ├── firebase-admin.ts        # Server-side Firebase Admin SDK
│   ├── paddle-server.ts         # Paddle API client & webhook signature verifier
│   └── types.ts                 # TypeScript interfaces and domain schemas
├── firestore.rules              # Granular Firestore security rules
├── next.config.ts               # Standalone output configuration
├── package.json                 # Project dependencies and production build commands
└── server.ts                    # Production HTTP entry point
```

---

## 4. Environment Variables

All environment variables must be declared in `.env.example`. Secrets must be provisioned via environment configuration:

| Variable | Description | Tier |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Google Gemini API key for server-side business insights | Server |
| `BREVO_API_KEY` | Brevo transactional email API key | Server |
| `BREVO_SENDER_EMAIL` | Default verified transactional sender email | Server |
| `BREVO_SENDER_NAME` | Default sender display name | Server |
| `OTP_SECRET` | Cryptographic secret for OTP HMAC generation | Server |
| `NEXT_PUBLIC_PADDLE_ENV` | Paddle environment (`sandbox` or `production`) | Client |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | Paddle public client token for checkout overlay | Client |
| `PADDLE_API_KEY` | Paddle server API access key | Server |
| `PADDLE_NOTIFICATION_WEBHOOK_SECRET` | Secret used to verify Paddle webhook signatures | Server |
| `NEXT_PUBLIC_PADDLE_PRICE_*` | Paddle price catalog IDs across subscription tiers | Client |

---

## 5. Development & Deployment

### Local Development
```bash
npm install
npm run dev
```
The development server listens on `http://0.0.0.0:3000`.

### Production Build & Verification
```bash
npm run build
```
The build executes with `NODE_ENV=production next build`, producing both the `.next/standalone` container distribution and a synchronized `./dist` artifact directory compatible with Google Cloud Run.

### Linting
```bash
npm run lint
```
