# dodo-api

The server half of jigglesaw's paid feature. Two small functions:

| Endpoint | Does |
|---|---|
| `POST /api/checkout` `{ code }` | If the code is right, creates a Dodo checkout for the product with the discount applied, and returns its `checkout_url`. |
| `GET /api/verify?payment_id=pay_…` | Asks Dodo whether that payment succeeded and was made for this app. |

It exists because the site is static and can't hold your secret API key. The
page never sees the key or the discount; it just goes where it's told, and only
unlocks once `/api/verify` says yes. (The redirect back from Dodo carries a
payment id, but that's only a claim anyone could type.)

Everything runs in Dodo's **test mode**. Going live later means a live API key
and `DODO_ENVIRONMENT=live_mode`.

## Deploy it (all in the browser, no terminal)

1. On vercel.com: **Add New → Project**, import `vixipop/repertoire`.
2. Set **Root Directory** to `dodo-api`. Framework preset: **Other**.
3. Add **Environment Variables**:
   - `DODO_PAYMENTS_API_KEY`: your **test-mode** API key (Dodo dashboard →
     Developer → API Keys). Secret. Never put it in the repo or in chat.
   - `DODO_DISCOUNT_CODE`: `dodo`, exactly as created in the dashboard.
   - Optional, all have working defaults: `DODO_ENVIRONMENT` (`test_mode`),
     `DODO_PRODUCT_ID` (`pdt_0NpMzN6HktFZ1qSo2b0jd`), `RETURN_URL`
     (`https://vixipop.github.io/repertoire/jigglesaw/`), `ALLOWED_ORIGIN`
     (`https://vixipop.github.io`).
4. Under **Settings → Git**, set the **Production Branch** to the branch that
   has this folder (`claude/sleepy-newton-xvfow5`, or the default branch once
   it's merged there).
5. Deploy, copy the address (like `https://….vercel.app`), and set it as
   `CHECKOUT_API` in `jigglesaw/src/config.js`, then redeploy jigglesaw to
   GitHub Pages.

Test it: open the site, hover the lock, let it type the code. You should land on
Dodo's test checkout with the product at 100% off, then come back to the
puzzle with the lock gone. If it says it couldn't confirm the payment, the
reason is shown under the code box.

## Notes

- `/api/checkout` has no rate limit. Fine for a demo; add one before it matters.
- Test checkouts can use Dodo's test cards (see Dodo's test-mode docs).
- Not yet seen: whether Dodo's checkout still asks for card details when the
  total is 0. If it does, a test card works.
