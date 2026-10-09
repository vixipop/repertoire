import { APP_TAG, cors, dodo } from './_shared.js';

// GET ?payment_id=pay_...  ->  { ok: true } or { ok: false, reason }
// The redirect back from Dodo carries a payment id, but that's only a claim.
// This asks Dodo whether that payment really succeeded, and was ours.
export default async function handler(req, res) {
  if (cors(req, res)) return;
  const id = String(req.query?.payment_id ?? '');
  if (!/^pay_[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ ok: false, reason: 'bad payment id' });

  try {
    const payment = await dodo().payments.retrieve(id);
    if (payment.status !== 'succeeded') return res.status(200).json({ ok: false, reason: `payment is ${payment.status}` });
    if (payment.metadata?.app !== APP_TAG) return res.status(200).json({ ok: false, reason: 'payment is not for this app' });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('verify failed', err);
    return res.status(502).json({ ok: false, reason: 'could not check the payment' });
  }
}
