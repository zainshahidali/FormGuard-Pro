import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const isProd = process.env.NODE_ENV === 'production';
  cookies().set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return NextResponse.json({
    success: true,
    message: 'Signed out successfully.',
  });
}

