/**
 * POST /api/auth/login
 *
 * Authenticate user and create session
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createSessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password required' },
        { status: 400 }
      );
    }

    const sessionId = await authenticateUser(username, password);

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      username
    });

    response.headers.set('Set-Cookie', createSessionCookie(sessionId));

    return response;

  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      {
        error: 'Login failed',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
