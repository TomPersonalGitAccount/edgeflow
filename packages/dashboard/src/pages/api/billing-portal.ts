import type { APIRoute } from 'astro';
import { getStripe } from '../../lib/stripe';

export const POST: APIRoute = async (ctx) => {
  const { userId } = ctx.locals.auth();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const stripeKey =
    import.meta.env.STRIPE_SECRET_KEY ||
    ctx.locals.runtime?.env?.STRIPE_SECRET_KEY;
  const stripe = getStripe(stripeKey);

  // Look up Stripe customer ID from D1
  const db = ctx.locals.runtime.env.DB;
  const customer = await db
    .prepare('SELECT stripe_customer_id FROM customers WHERE google_id = ?')
    .bind(userId)
    .first();

  if (!customer?.stripe_customer_id) {
    return new Response('No subscription found', { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.stripe_customer_id as string,
    return_url: `${new URL(ctx.request.url).origin}/dashboard`,
  });

  return ctx.redirect(session.url, 303);
};
