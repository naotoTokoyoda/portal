import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { logAccess } from '@/lib/logging';
import { searchResources } from '@/lib/search';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = url.searchParams.get('query') ?? '';
  const session = await getServerSession(authOptions);
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.ip ??
    null;
  const userAgent = request.headers.get('user-agent');

  const results = await searchResources({
    query,
    userDepartment: session?.user?.department ?? null,
    isAdmin: session?.user?.role === 'admin',
  });

  await logAccess({
    actorId: session?.user?.id,
    actorRole: session?.user?.role,
    actorDepartment: session?.user?.department,
    actorIp: clientIp,
    method: request.method,
    resource: '/api/search',
    statusCode: 200,
    userAgent,
    metadata: { queryLength: query.length },
  });

  return NextResponse.json({ results });
}
