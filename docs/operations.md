# Operations Guide

This document describes the operational expectations for the portal service, including monitoring, availability targets, health checks, and load testing.

## Availability Target

- **SLO:** 99.9% monthly availability for the production deployment.
- **Error Budget:** Approximately 43 minutes of downtime per month.
- **Measurement:** Use the public health check endpoint (`/api/health`) and synthetic API monitors to measure availability from at least two regions.

## Health Checks and Monitoring

1. **HTTP Health Check**
   - Endpoint: `GET /api/health`
   - Response: JSON containing service status, uptime, and dependency flags.
   - Caching: Disabled via `Cache-Control: no-store` header to guarantee freshness.
   - Monitoring: Configure infrastructure probes (e.g., Vercel checks, Kubernetes readiness/liveness probes) to query this endpoint every 30 seconds.

2. **API Response Monitoring**
   - Track latency and error rates for core APIs (`/api/users`, `/api/search`, `/api/documents/*`).
   - Configure alerting when p95 latency exceeds 800ms for 5 minutes or error rate exceeds 2% in a rolling 10 minute window.
   - Integrate logs emitted through `src/lib/logging.ts` with your observability platform (e.g., CloudWatch Logs, Stackdriver) for anomaly detection.

3. **Resource Metrics**
   - Capture CPU, memory, and database connection utilization through your hosting provider or APM tool.
   - Set warning thresholds at 70% utilization and critical alerts at 85%.

## Incident Response

- **Pager Rotation:** Maintain an on-call rotation that can respond within 15 minutes.
- **Runbooks:** Store mitigation steps alongside this document and keep them version controlled.
- **Post-Incident Reviews:** Complete a review within 5 business days for incidents breaching the error budget.

## Load and Stress Testing

- **Baseline Test:** Quarterly k6 or Locust scenario ramping from 0 to 200 concurrent users over 10 minutes; success criteria are <1% error rate and p95 latency under 1s.
- **Spike Test:** Twice per year, simulate 5x normal traffic for 15 minutes to validate autoscaling and caching.
- **Soak Test:** Annually, run a 2-hour steady load equal to peak production traffic to detect resource leaks.
- **Data Capture:** Store test scripts and artifacts in the `docs/performance/` directory (create as needed) and upload metrics to the log archive bucket for long-term retention.

## Alerting and Dashboards

- Configure dashboards that display:
  - Health check success rate.
  - API latency/error trends.
  - Log ingestion success/failure counts from `logAccess`/`logAudit`.
  - Backup job success metrics.
- Alerts should integrate with Slack/Teams and email, escalating to pager duty for critical outages.

## Maintenance Windows

- Schedule planned maintenance outside of regional business hours.
- Announce maintenance at least 72 hours in advance and update the status page during the event.

## Change Management

- Require pull requests with automated tests and manual approvals for production deployments.
- Document deployment impact in the README runbook (see "Deployment" section).

## Continuous Improvement

Review this document quarterly to ensure thresholds, test plans, and alert definitions remain aligned with product requirements.
