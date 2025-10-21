/**
 * POST /api/auth/logout
 *
 * Destroy session and logout user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie, destroySession, createLogoutCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const sessionId = getSessionFromCookie(request.headers.get('cookie'));

    if (sessionId) {
      destroySession(sessionId);
    }

    // Create response with expired session cookie
    const response = NextResponse.json({
      success: true
    });

    response.headers.set('Set-Cookie', createLogoutCookie());

    return response;

  } catch (error) {
    console.error('Logout API error:', error);
    return NextResponse.json(
      {
        error: 'Logout failed',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
