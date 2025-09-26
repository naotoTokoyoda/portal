import type { Header, NextConfig } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com';
const sanitizedSiteUrl = siteUrl.replace(/\/$/, '');

if (!sanitizedSiteUrl.startsWith('https://')) {
  throw new Error(
    'NEXT_PUBLIC_SITE_URL must be an https:// URL to enable HTTPS redirects.'
  );
}

const securityHeaders: Header[] = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "img-src 'self' data:",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "font-src 'self' data:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  {
    key: 'Referrer-Policy',
    value: 'no-referrer',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: `${sanitizedSiteUrl}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
