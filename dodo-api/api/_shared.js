import DodoPayments from 'dodopayments';

// All settings come from environment variables, set in the host's dashboard.
// Only the API key is secret; the rest have working defaults for this project.
export const config = {
  apiKey: process.env.DODO_PAYMENTS_API_KEY,
  environment: process.env.DODO_ENVIRONMENT || 'test_mode', // 'live_mode' when you go live
  productId: process.env.DODO_PRODUCT_ID || 'pdt_0NpMzN6HktFZ1qSo2b0jd',
  discountCode: process.env.DODO_DISCOUNT_CODE || 'dodo', // exactly as created in the dashboard
  returnUrl: process.env.RETURN_URL || 'https://vixipop.github.io/repertoire/jigglesaw/',
  allowedOrigin: process.env.ALLOWED_ORIGIN || 'https://vixipop.github.io',
};

// Marks payments made for this app, so a payment from anything else on the
// same Dodo account can't unlock it.
export const APP_TAG = 'jigglesaw';

export function dodo() {
  if (!config.apiKey) throw new Error('DODO_PAYMENTS_API_KEY is not set');
  return new DodoPayments({ bearerToken: config.apiKey, environment: config.environment });
}

// The site lives on github.io and this on another host, so the browser asks
// first (CORS). Answers the preflight; returns true if the request is done.
export function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', config.allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
