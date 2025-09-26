# Portal

An internal portal built with Next.js. This document describes how to develop, secure, deploy, and operate the service.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `env.example` to `.env.local` and fill in required secrets.
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Visit [http://localhost:3000](http://localhost:3000) to access the app.

### Environment Variables

Key variables required for secure operation:

| Name | Description |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Base HTTPS URL used for redirects and security metadata. |
| `LOG_ARCHIVE_BUCKET` | S3 (or compatible) bucket for audit/access log archival. |
| `LOG_ARCHIVE_PREFIX` | Optional prefix within the log bucket. |
| `LOG_ARCHIVE_SSE` | Server-side encryption setting (default `AES256`). |
| `LOG_ARCHIVE_STORAGE_CLASS` | Storage class for log objects (default `STANDARD_IA`). |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Credentials used by the log uploader and backups. |
| `BACKUP_BUCKET` | Destination bucket for nightly backups (used by CI workflow). |
| `DATABASE_URL` | PostgreSQL connection string used for application data and backups. |

See [`env.example`](env.example) for the full list.

## Security Hardening

- `next.config.ts` enforces HTTPS redirects when requests arrive over HTTP and sets secure headers (HSTS, CSP, Referrer-Policy, etc.).
- Additional guidance for enforcing TLS 1.2+ at the infrastructure layer is documented in [`docs/security/tls.md`](docs/security/tls.md).

## Logging & Audit Trail

- Centralized logging utilities live in [`src/lib/logging.ts`](src/lib/logging.ts) and record structured access and audit entries to S3 using AWS Signature Version 4.
- API routes (users, search, init-user bootstrap) emit access and audit logs for both successful and failed operations, enabling compliance monitoring.
- When persistent storage is not configured (e.g., local development) logs fall back to stdout.
- Configure lifecycle rules on the log bucket to retain audit data for at least one year.

## Backups

- [`scripts/backup.sh`](scripts/backup.sh) performs a full snapshot of the database and uploaded assets, then uploads the archive to S3 with server-side encryption.
- A nightly GitHub Actions workflow (`.github/workflows/nightly-backup.yml`) runs the script at 03:00 UTC and can be triggered manually via the "Run workflow" button.
- Ensure the following secrets are set in the repository:
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
  - `DATABASE_URL`
  - `BACKUP_BUCKET`
- Review backup job results in the "Actions" tab and verify archives regularly by performing restore drills.

## Deployment Runbook (≤10 minutes)

1. **Pre-flight checks (2 minutes):**
   - `npm run lint`
   - `npm run type-check`
   - Review CI status for the target branch.
2. **Build artifact (3 minutes):**
   ```bash
   npm run build
   ```
3. **Provision configuration (1 minute):**
   - Ensure `.env.production` includes all variables listed above.
   - Confirm TLS enforcement per [`docs/security/tls.md`](docs/security/tls.md).
4. **Deploy (3 minutes):**
   - Vercel: `vercel deploy --prod`
   - Self-managed: build Docker image, push to registry, and roll out via your orchestrator (Kubernetes `kubectl rollout restart` or equivalent).
5. **Post-deploy verification (≤1 minute):**
   - Check `/api/health` returns status `ok`.
   - Confirm synthetic monitors remain green.
   - Tail access logs for anomalies using your log aggregation tooling.

Document any deviations or incidents in your change log.

## Monitoring & Operations

- Health check endpoint: [`GET /api/health`](src/app/api/health/route.ts)
- Operational policies, alert thresholds, and load testing plans are described in [`docs/operations.md`](docs/operations.md).
- Configure uptime checks targeting both the health endpoint and representative API calls (e.g., `/api/search?query=ping`).

## Observability Tips

- Subscribe your SIEM or log analytics platform to the log archive bucket for long-term retention and search.
- Use CloudWatch Metric Filters or GCP Log-based Metrics to trigger alerts when repeated access denials or audit events occur.

## Contributing

1. Fork and clone the repository.
2. Create a feature branch.
3. Make changes following the coding standards.
4. Run tests and linting.
5. Submit a pull request referencing relevant documentation updates if operational procedures change.

## Additional Documentation

- [`docs/security/tls.md`](docs/security/tls.md): TLS and HTTPS enforcement guide.
- [`docs/operations.md`](docs/operations.md): Monitoring, uptime, and load testing plan.

