import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import Settings from '@/models/Settings';
import {
  AUTH_COOKIE_NAME,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_SESSION_EXPIRY_SECONDS,
  REMEMBER_SESSION_EXPIRY_SECONDS,
  verifyPassword,
  hashPassword,
  generateSalt,
  createSessionToken,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, rememberMe } = body;

    const cleanUsername = String(username || '').trim();
    const cleanPassword = String(password || '');

    if (!cleanUsername || !cleanPassword) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required.' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    let settings = await Settings.findOne();

    let isValid = false;
    let authenticatedUsername = cleanUsername;

    const storedAuth = settings?.adminAuth;

    if (storedAuth?.passwordHash && storedAuth?.salt) {
      // Validate against stored credentials in DB
      const usernameMatches =
        storedAuth.username.toLowerCase() === cleanUsername.toLowerCase();
      const passwordMatches = await verifyPassword(
        cleanPassword,
        storedAuth.passwordHash,
        storedAuth.salt
      );

      if (usernameMatches && passwordMatches) {
        isValid = true;
        authenticatedUsername = storedAuth.username;
      }
    } else {
      // First-time fallback initialization
      const usernameMatches =
        cleanUsername.toLowerCase() === DEFAULT_ADMIN_USERNAME.toLowerCase();
      const passwordMatches = cleanPassword === DEFAULT_ADMIN_PASSWORD;

      if (usernameMatches && passwordMatches) {
        isValid = true;
        authenticatedUsername = DEFAULT_ADMIN_USERNAME;

        // Auto-initialize DB hash with default credentials
        try {
          const salt = generateSalt();
          const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD, salt);

          if (!settings) {
            settings = await Settings.create({
              adminAuth: {
                username: DEFAULT_ADMIN_USERNAME,
                passwordHash,
                salt,
                updatedAt: new Date(),
              },
            });
          } else {
            settings.adminAuth = {
              username: DEFAULT_ADMIN_USERNAME,
              passwordHash,
              salt,
              updatedAt: new Date(),
            };
            await settings.save();
          }
        } catch (initErr) {
          console.warn('Could not persist default admin credentials:', initErr);
        }
      }
    }

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password.' },
        { status: 401 }
      );
    }

    // Generate signed session token
    const expirySeconds = rememberMe
      ? REMEMBER_SESSION_EXPIRY_SECONDS
      : DEFAULT_SESSION_EXPIRY_SECONDS;

    const token = await createSessionToken(
      { username: authenticatedUsername },
      expirySeconds
    );

    // Set HTTP-only session cookie
    const isProd = process.env.NODE_ENV === 'production';
    cookies().set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: expirySeconds,
    });

    return NextResponse.json({
      success: true,
      message: 'Signed in successfully.',
      username: authenticatedUsername,
    });
  } catch (err: any) {
    console.error('Error in login route:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Login failed.' },
      { status: 500 }
    );
  }
}

