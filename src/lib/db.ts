/**
 * Database connection pool for pyecod_vis
 *
 * Connects to ecod_protein database on dione:45000
 * Used by all API routes for querying ecod_curation schema
 */

import { Pool, QueryResult } from 'pg';

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'dione',
  port: parseInt(process.env.DB_PORT || '45000'),
  database: process.env.DB_NAME || 'ecod_protein',
  user: process.env.DB_USER || 'ecod',
  password: process.env.DB_PASSWORD, // REQUIRED - must be set in .env file
  max: 20, // Maximum number of connections in pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection can't be established
};

// Validate required environment variables
if (!dbConfig.password) {
  throw new Error('DB_PASSWORD environment variable is required. Please set it in your .env file.');
}

// Create connection pool (singleton)
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(dbConfig);

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
      process.exit(-1);
    });

    console.log(`Database pool created: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  }

  return pool;
}

/**
 * Execute a SQL query with optional parameters
 *
 * @param text - SQL query string
 * @param params - Query parameters
 * @returns Query result
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const pool = getPool();

  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    // Log slow queries (>100ms)
    if (duration > 100) {
      console.warn(`Slow query (${duration}ms):`, {
        text: text.substring(0, 100),
        rows: res.rowCount,
      });
    }

    return res;
  } catch (error) {
    console.error('Database query error:', {
      error: error instanceof Error ? error.message : String(error),
      query: text.substring(0, 200),
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * Remember to call client.release() when done!
 */
export async function getClient() {
  const pool = getPool();
  return await pool.connect();
}

/**
 * Test database connection
 * Returns true if connection is successful
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as now, current_database() as db');
    console.log('Database connection test successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Close the database pool
 * Call this on application shutdown
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database pool closed');
  }
}
