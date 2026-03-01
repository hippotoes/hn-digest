import { Client } from 'pg';
import Redis from 'ioredis';

async function verify() {
  console.log('Verifying infrastructure...');

  // 1. Verify PostgreSQL
  const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/hndigest';
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    const res = await client.query('SELECT 1 as result');
    if (res.rows[0].result === 1) {
      console.log('✅ PostgreSQL is reachable and responsive.');
    }
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }

  // 2. Verify Redis
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6380';
  const redis = new Redis(redisUrl);
  try {
    await redis.ping();
    console.log('✅ Redis is reachable and responsive.');
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    process.exit(1);
  } finally {
    redis.quit();
  }

  console.log('✅ All local infrastructure components verified successfully!');
}

verify();
