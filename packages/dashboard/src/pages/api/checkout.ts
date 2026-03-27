import type { APIRoute } from 'astro';
import { getStripe } from '../../lib/stripe';

export const POST: APIRoute = async (ctx) => {
  const { userId } = ctx.locals.auth();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const formData = await ctx.request.formData();
  const priceId = formData.get('priceId') as string;

  if (!priceId) {
    return new Response('Missing priceId', { status: 400 });
  }

  const stripeKey =
    import.meta.env.STRIPE_SECRET_KEY ||
    ctx.locals.runtime?.env?.STRIPE_SECRET_KEY;
  const stripe = getStripe(stripeKey);

  // Look up customer email from D1
  const db = ctx.locals.runtime.env.DB;
  const customer = await db
    .prepare('SELECT id, email, stripe_customer_id FROM customers WHERE google_id = ?')
    .bind(userId)
    .first();

  if (!customer) {
    return new Response('Customer not found', { status: 404 });
  }

  // Reuse existing Stripe customer or let Checkout create one
  const sessionParams: Record<string, unknown> = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${new URL(ctx.request.url).origin}/dashboard?checkout=success`,
    cancel_url: `${new URL(ctx.request.url).origin}/pricing?checkout=cancelled`,
    client_reference_id: customer.id as string,
    metadata: { customer_id: customer.id as string },
  };

  if (customer.stripe_customer_id) {
    sessionParams.customer = customer.stripe_customer_id;
  } else {
    sessionParams.customer_email = customer.email;
  }

  const session = await stripe.checkout.sessions.create(
    sessionParams as Stripe.Checkout.SessionCreateParams
  );

  return ctx.redirect(session.url!, 303);
};
