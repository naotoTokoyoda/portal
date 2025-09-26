import { NextResponse } from 'next/server';

const startedAt = Date.now();

export async function GET() {
  const now = new Date();
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);

  return NextResponse.json(
    {
      status: 'ok',
      timestamp: now.toISOString(),
      uptimeSeconds,
      checks: {
        database: 'unknown',
        storage: process.env.LOG_ARCHIVE_BUCKET
          ? 'configured'
          : 'not-configured',
      },
    },
    {
      headers: {
        'cache-control': 'no-store, max-age=0',
      },
    }
  );
}
