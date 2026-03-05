import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@hn-digest/db';
import { config } from '../config';

const connectionString = config.env.DATABASE_URL;

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
