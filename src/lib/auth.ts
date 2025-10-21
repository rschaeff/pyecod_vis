/**
 * Simple session-based authentication
 *
 * Uses in-memory session storage (for Phase 1)
 * In production, consider Redis or database-backed sessions
 */

import { query } from './db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

interface Session {
  sessionId: string;
  username: string;
  createdAt: Date;
  expiresAt: Date;
}

// In-memory session store (Phase 1)
// TODO: Move to Redis for production
const sessions = new Map<string, Session>();

// Session TTL: 24 hours
const SESSION_TTL = 24 * 60 * 60 * 1000;

/**
 * Authenticate user with username and password
 * Returns session ID if successful, null otherwise
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<string | null> {
  try {
    // Check if users table exists, if not, use demo mode
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'ecod_curation'
        AND table_name = 'users'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      // Demo mode: accept any username with password "ecod"
      console.log('Users table not found, using demo mode');
      if (password === 'ecod') {
        return createSession(username);
      }
      return null;
    }

    // Production mode: check against users table
    const result = await query(`
      SELECT username, password_hash
      FROM ecod_curation.users
      WHERE username = $1
    `, [username]);

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return null;
    }

    // Create session
    return createSession(username);

  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

/**
 * Create a new session for user
 */
function createSession(username: string): string {
  const sessionId = crypto.randomBytes(32).toString('hex');

  const session: Session = {
    sessionId,
    username,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + SESSION_TTL)
  };

  sessions.set(sessionId, session);

  // Clean up expired sessions
  cleanupExpiredSessions();

  return sessionId;
}

/**
 * Validate session and return username if valid
 */
export function validateSession(sessionId: string): string | null {
  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  if (new Date() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }

  return session.username;
}

/**
 * Destroy a session (logout)
 */
export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions(): void {
  const now = new Date();

  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId);
    }
  }
}

/**
 * Get session from request cookie
 */
export function getSessionFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith('session='));

  if (!sessionCookie) {
    return null;
  }

  return sessionCookie.split('=')[1];
}

/**
 * Create session cookie string
 */
export function createSessionCookie(sessionId: string): string {
  const maxAge = SESSION_TTL / 1000; // Convert to seconds

  return `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

/**
 * Create logout cookie (expires immediately)
 */
export function createLogoutCookie(): string {
  return 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
}
