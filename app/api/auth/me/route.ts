import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sessionCookie = cookies().get(AUTH_COOKIE_NAME)?.value;
  const session = await verifySessionToken(sessionCookie);

  if (!session) {
    return NextResponse.json({
      authenticated: false,
    });
  }

  return NextResponse.json({
    authenticated: true,
    username: session.username,
  });
}

