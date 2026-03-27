import type { APIRoute } from 'astro';
import { verifyWebhook } from '@clerk/astro/webhooks';

export const POST: APIRoute = async (ctx) => {
  try {
    const signingSecret =
      import.meta.env.CLERK_WEBHOOK_SIGNING_SECRET ||
      ctx.locals.runtime?.env?.CLERK_WEBHOOK_SIGNING_SECRET;

    const evt = await verifyWebhook(ctx.request, { signingSecret });

    if (evt.type === 'user.created') {
      const { id, email_addresses, first_name, last_name } = evt.data;
      const primaryEmail = email_addresses?.[0]?.email_address;

      if (!primaryEmail) {
        return new Response('No email found', { status: 400 });
      }

      const name = [first_name, last_name].filter(Boolean).join(' ') || null;
      const customerId = crypto.randomUUID();

      const db = ctx.locals.runtime.env.DB;
      await db
        .prepare(
          `INSERT INTO customers (id, email, name, google_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
           ON CONFLICT(email) DO UPDATE SET
             name = excluded.name,
             google_id = excluded.google_id,
             updated_at = datetime('now')`
        )
        .bind(customerId, primaryEmail, name, id)
        .run();

      console.log(`Customer created/updated: ${primaryEmail} (clerk_id: ${id})`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return new Response('Webhook verification failed', { status: 400 });
  }
};
