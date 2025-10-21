/**
 * GET /api/auth/me
 *
 * Get current user session info
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie, validateSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const sessionId = getSessionFromCookie(request.headers.get('cookie'));

    if (!sessionId) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    const username = validateSession(sessionId);

    if (!username) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      username
    });

  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { authenticated: false },
      { status: 500 }
    );
  }
}
