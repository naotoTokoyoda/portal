# TLS Enforcement Guide

This guide documents how to enforce HTTPS and modern TLS for the portal application across common hosting environments.

## Application-Level Controls

- `next.config.ts` sets a global HTTPS redirect when traffic arrives over HTTP (detected via `x-forwarded-proto`).
- Security headers applied to every response:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `Content-Security-Policy` restricting sources to `self`.
  - `X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy`, and `Referrer-Policy` hardening.

These controls assume the origin is reachable via HTTPS.

## Infrastructure Requirements

1. **Minimum TLS Version**
   - Enforce TLS 1.2 or newer at the edge (load balancer, CDN, or reverse proxy).
   - Disable legacy cipher suites such as RC4, 3DES, and SHA-1. Prefer TLS 1.2 suites using AES-GCM or CHACHA20-POLY1305.

2. **Certificate Management**
   - Use certificates signed by a publicly trusted CA (Let's Encrypt, AWS Certificate Manager, Google Managed Certificates, etc.).
   - Rotate certificates automatically and monitor expiration (alert 30 days before expiry).

3. **HSTS Preload Eligibility**
   - Ensure apex and subdomains respond over HTTPS.
   - Submit the domain to the [HSTS preload list](https://hstspreload.org/) once HTTPS is fully enforced.

## Environment-Specific Steps

### Vercel

1. Enable the **Enforce HTTPS** option in the project settings.
2. Under "Domains", enable **HSTS** with a 1-year max age and include subdomains.
3. Verify TLS version policy in the Vercel dashboard (under "Security") is set to **TLS 1.2 minimum**.
4. Optionally add WAF/Edge Config rules to block insecure cipher suites if custom domains are proxied through third-party CDNs.

### Self-Managed Infrastructure (NGINX / Kubernetes)

1. Configure your ingress to redirect HTTP to HTTPS:
   ```nginx
   server {
     listen 80;
     server_name portal.example.com;
     return 301 https://$host$request_uri;
   }
   ```
2. Enforce TLS 1.2+ in the HTTPS server block:
   ```nginx
   ssl_protocols TLSv1.2 TLSv1.3;
   ssl_ciphers 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256';
   ssl_prefer_server_ciphers on;
   add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
   ```
3. Automate certificate issuance and renewal via Cert-Manager or ACME clients.
4. For Kubernetes, use annotations on the ingress (e.g., `nginx.ingress.kubernetes.io/ssl-protocols: TLSv1.2 TLSv1.3`).

### Google Cloud / Cloud Run

1. Terminate TLS using Google Cloud HTTPS Load Balancer.
2. Configure the load balancer's SSL policy to **MODERN** or custom policy with TLS 1.2 minimum.
3. Enable "Redirect HTTP to HTTPS" in the frontend configuration.
4. Use Google-managed certificates and monitor using Cloud Monitoring uptime checks.

## Validation Checklist

- [ ] Automated tests confirm HTTP → HTTPS redirect.
- [ ] SSL Labs scan scores A or better.
- [ ] Monitoring alerts for TLS handshake failures or downgrade attempts.
- [ ] Documented recovery steps if certificates fail to renew.

Keep this document updated as infrastructure changes. Link it from the README so operators can find the guidance quickly.
