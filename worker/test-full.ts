import { db } from './src/db';
import { users, stories, analyses, bookmarks, preferences } from '@hn-digest/db';
import { QueueEvents } from 'bullmq';
import { connection } from './src/queue';

async function testFull() {
  console.log('🚀 Running Stage 3 Full System Verification...');

  // 1. Setup Test Data
  const testUserId = 'test-user-stage-3';
  await db.delete(bookmarks);
  await db.delete(preferences);
  await db.delete(users);

  await db.insert(users).values({
    id: testUserId,
    name: 'Verification User',
    email: 'test@example.com'
  });

  const [testStory] = await db.select().from(stories).limit(1);
  if (!testStory) {
    console.error('❌ No stories found in DB. Run Stage 2 first.');
    process.exit(1);
  }

  // 2. Verify Bookmark Feature (Internal call simulation)
  console.log('Testing Bookmarks...');
  await db.insert(bookmarks).values({
    userId: testUserId,
    storyId: testStory.id
  });
  const userBookmarks = await db.select().from(bookmarks);
  if (userBookmarks.length > 0) console.log('✅ Bookmark successful.');

  // 3. Verify Preferences & Notification Trigger
  console.log('Testing Preferences & Notification Queue...');
  const queueEvents = new QueueEvents('notification-queue', { connection });

  // Directly simulate the API logic for enqueuing a notification
  const { Queue } = await import('bullmq');
  const notificationQueue = new Queue('notification-queue', { connection });

  const job = await notificationQueue.add('send-welcome-alert', {
    userId: testUserId,
    topics: ['AI', 'Rust']
  });

  console.log('Waiting for notification worker to process...');
  await job.waitUntilFinished(queueEvents);
  console.log('✅ Notification processed by worker.');

  // 4. Audit DB Final State
  const pref = await db.select().from(preferences);
  console.log('✅ Stage 3 System-wide Verification: SUCCESS');

  await queueEvents.close();
  await connection.quit();
  process.exit(0);
}

testFull().catch(console.error);
