import type { APIRoute } from 'astro';
import Stripe from 'stripe';

async function verifyStripeWebhook(
  body: string,
  signature: string,
  secret: string
): Promise<Stripe.Event> {
  // Parse the signature header
  const parts = signature.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts['t'];
  const sig = parts['v1'];

  if (!timestamp || !sig) {
    throw new Error('Invalid signature header');
  }

  // Check timestamp tolerance (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    throw new Error('Webhook timestamp too old');
  }

  // Compute expected signature using Web Crypto API
  const payload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  );
  const expectedSig = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (expectedSig !== sig) {
    throw new Error('Signature mismatch');
  }

  return JSON.parse(body) as Stripe.Event;
}

// Safely convert Stripe date values (could be Unix timestamp, Date, or string)
function safeDate(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'number') {
    // Unix timestamp — if it's small enough to be seconds (not ms), multiply
    return new Date(val < 1e12 ? val * 1000 : val).toISOString();
  }
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return new Date(val).toISOString();
  return new Date().toISOString();
}

export const POST: APIRoute = async (ctx) => {
  const stripeKey =
    import.meta.env.STRIPE_SECRET_KEY ||
    ctx.locals.runtime?.env?.STRIPE_SECRET_KEY;
  const webhookSecret =
    import.meta.env.STRIPE_WEBHOOK_SECRET ||
    ctx.locals.runtime?.env?.STRIPE_WEBHOOK_SECRET;

  const body = await ctx.request.text();
  const signature = ctx.request.headers.get('stripe-signature');

  if (!signature || !webhookSecret) {
    return new Response('Missing signature or webhook secret', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await verifyStripeWebhook(body, signature, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook verification failed:', err);
    return new Response(`Webhook verification failed: ${err}`, { status: 400 });
  }

  const db = ctx.locals.runtime.env.DB;
  const stripe = new Stripe(stripeKey);

  try {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.client_reference_id || session.metadata?.customer_id;
      const stripeCustomerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (customerId) {
        // Update customer with Stripe customer ID
        await db
          .prepare("UPDATE customers SET stripe_customer_id = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(stripeCustomerId, customerId)
          .run();

        // Get subscription details for plan info
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;

        // Determine plan from price ID
        const priceStarter = import.meta.env.STRIPE_PRICE_STARTER || ctx.locals.runtime?.env?.STRIPE_PRICE_STARTER;
        const priceGrowth = import.meta.env.STRIPE_PRICE_GROWTH || ctx.locals.runtime?.env?.STRIPE_PRICE_GROWTH;
        const priceScale = import.meta.env.STRIPE_PRICE_SCALE || ctx.locals.runtime?.env?.STRIPE_PRICE_SCALE;

        let planId = 'starter';
        if (priceId === priceGrowth) planId = 'growth';
        else if (priceId === priceScale) planId = 'scale';

        // Create subscription record
        await db
          .prepare(
            `INSERT INTO subscriptions (id, customer_id, stripe_subscription_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'active', ?, ?, datetime('now'), datetime('now'))
             ON CONFLICT(stripe_subscription_id) DO UPDATE SET
               plan_id = excluded.plan_id,
               status = 'active',
               current_period_start = excluded.current_period_start,
               current_period_end = excluded.current_period_end,
               updated_at = datetime('now')`
          )
          .bind(
            crypto.randomUUID(),
            customerId,
            subscriptionId,
            planId,
            safeDate(subscription.current_period_start),
            safeDate(subscription.current_period_end)
          )
          .run();
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeSubId = subscription.id;
      const status = subscription.status === 'active' ? 'active' : subscription.status;

      await db
        .prepare(
          `UPDATE subscriptions SET
            status = ?,
            current_period_start = ?,
            current_period_end = ?,
            updated_at = datetime('now')
          WHERE stripe_subscription_id = ?`
        )
        .bind(
          status,
          safeDate(subscription.current_period_start),
          safeDate(subscription.current_period_end),
          stripeSubId
        )
        .run();
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await db
        .prepare("UPDATE subscriptions SET status = 'cancelled', updated_at = datetime('now') WHERE stripe_subscription_id = ?")
        .bind(subscription.id)
        .run();
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  } catch (err) {
    console.error('Stripe webhook processing error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
