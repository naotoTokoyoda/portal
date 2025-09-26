import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { searchResources } from '@/lib/search';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('query') ?? '';
  const session = await getServerSession(authOptions);

  const results = await searchResources({
    query,
    userDepartment: session?.user?.department ?? null,
    isAdmin: session?.user?.role === 'admin',
  });

  return NextResponse.json({ results });
}
