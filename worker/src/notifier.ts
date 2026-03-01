import { Worker, Job } from 'bullmq';
import { connection } from './queue';
import { db } from './db';
import { users } from '@hn-digest/db';
import { eq } from 'drizzle-orm';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock');

export async function processNotification(job: Job) {
  const { userId, topics } = job.data;
  console.log(`[Notifier] Sending notification to user: ${userId} for topics: ${topics.join(', ')}`);

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !user.email) {
      console.warn(`[Notifier] User ${userId} not found or has no email.`);
      return;
    }

    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'HN Digest <onboarding@resend.dev>',
        to: user.email,
        subject: 'Your HN Intelligence Briefing',
        html: `<p>Hello ${user.name}, your preferences for ${topics.join(', ')} have been updated!</p>`
      });
    } else {
      console.log(`[Notifier] MOCK EMAIL SENT to ${user.email}`);
    }

  } catch (error: any) {
    console.error(`[Notifier] Failed to send notification:`, error.message);
    throw error;
  }
}

export const notificationWorker = new Worker('notification-queue', processNotification, {
  connection,
  concurrency: 2
});

notificationWorker.on('completed', (job) => {
  console.log(`[Notifier] Notification job ${job.id} completed.`);
});
