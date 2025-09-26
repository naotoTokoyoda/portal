import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { hasDepartmentAccess } from '@/lib/access-control';
import { getDocumentById, getLatestDocumentVersion } from '@/lib/documents';

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  const document = await getDocumentById(context.params.id);
  if (!document) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === 'admin';
  const hasAccess = hasDepartmentAccess(
    session?.user?.department,
    document.departments,
    {
      allowAllForAdmins: true,
      isAdmin,
    }
  );

  if (!hasAccess) {
    return NextResponse.json(
      { error: 'You do not have access to this document.' },
      { status: 403 }
    );
  }

  const latest = getLatestDocumentVersion(document);
  if (!latest) {
    return NextResponse.json(
      { error: 'Document has no versions.' },
      { status: 404 }
    );
  }

  const body = Buffer.from(latest.content, 'utf8');
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(latest.fileName)}"`,
    },
  });
}
