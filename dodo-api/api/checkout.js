import { APP_TAG, config, cors, dodo } from './_shared.js';

// POST { code }  ->  { checkout_url }
// Starts a Dodo checkout for the one product, with the discount applied here
// on the server, so the visitor never handles it. Only creates the session
// when the code typed in the popup is right.
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const code = String(req.body?.code ?? '').trim();
  if (code.toLowerCase() !== config.discountCode.toLowerCase()) {
    return res.status(403).json({ error: 'wrong code' });
  }

  try {
    const session = await dodo().checkoutSessions.create({
      product_cart: [{ product_id: config.productId, quantity: 1 }],
      discount_codes: [config.discountCode],
      return_url: config.returnUrl,
      metadata: { app: APP_TAG },
    });
    return res.status(200).json({ checkout_url: session.checkout_url });
  } catch (err) {
    console.error('checkout failed', err);
    return res.status(502).json({ error: 'could not start checkout' });
  }
}
