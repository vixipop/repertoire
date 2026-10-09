// "Use your own image" is a paid feature, with a wink: the Dodo team's code is
// right there, blurred until you hover it. Hovering reveals it and types it in
// for you; the lock then pops off in a burst of sparkles.
//
// Two modes, chosen by CHECKOUT_API in config.js:
//  - empty: a standalone demo. The right code unlocks at once, no payment. The
//    code is in the page, so this is a showpiece, not security.
//  - set: the right code starts a Dodo Payments checkout (100% off, test mode),
//    and the lock only comes off after the server confirms the payment when
//    Dodo sends the visitor back (see dodo-api/).
import { CHECKOUT_API } from './config.js';

const CODE = 'DODO';
const KEY = 'jigglesaw-unlocked';
const TYPE_MS = 150; // between auto-typed letters
const SPARKLE_COLOURS = ['#ffc94d', '#ffd77a', '#ffe7a3', '#ffb3c8', '#ffffff'];

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function wasUnlocked() {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function remember() {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Without storage it simply locks again on reload.
  }
}

// `button` is the "Use your own image" pill (it carries the lock); `onUnlock`
// runs once, when the lock comes off. Returns { isLocked, open }.
export function createUnlock(button, onUnlock) {
  const popup = document.getElementById('unlock');
  const form = document.getElementById('unlock-form');
  const input = document.getElementById('unlock-code');
  const reveal = document.getElementById('unlock-reveal');
  const note = document.getElementById('unlock-note');
  const win = document.getElementById('unlock-win');
  const close = document.getElementById('unlock-close');

  let locked = !wasUnlocked();
  let typing = false;
  let revealed = false;

  const setLockedLook = () => {
    document.body.classList.toggle('is-locked', locked);
    button.setAttribute('aria-label', locked ? 'Use your own image (a paid feature, locked)' : 'Use your own image');
  };
  setLockedLook();

  function open() {
    if (!locked || !popup.hidden) return;
    popup.hidden = false;
    // One frame later, so the entrance transition has something to start from.
    requestAnimationFrame(() => popup.classList.add('is-open'));
  }

  function shut() {
    popup.classList.remove('is-open');
    setTimeout(() => {
      if (!popup.classList.contains('is-open')) popup.hidden = true;
    }, 220);
  }

  // The reveal types the code in for you, once per reveal.
  async function typeCode() {
    if (typing || !locked) return;
    typing = true;
    note.textContent = '';
    input.value = '';
    for (const letter of CODE) {
      input.value += letter;
      if (!reduceMotion()) await wait(TYPE_MS);
    }
    typing = false;
    await wait(reduceMotion() ? 0 : 380);
    submit();
  }

  function showReveal() {
    reveal.classList.add('is-revealed');
    if (!revealed) {
      revealed = true;
      typeCode();
    }
  }

  function wrong() {
    note.textContent = 'not quite. hover the blurred bit?';
    form.classList.remove('shake');
    void form.offsetWidth; // restart the animation
    form.classList.add('shake');
  }

  function submit() {
    if (!locked) return;
    if (input.value.trim().toUpperCase() !== CODE) return wrong();
    if (CHECKOUT_API) startCheckout();
    else celebrate();
  }

  // Ask the server for a checkout and go there. The server applies the discount.
  async function startCheckout() {
    note.textContent = 'taking you to checkout…';
    input.disabled = true;
    try {
      const r = await fetch(`${CHECKOUT_API}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: input.value }),
      });
      const { checkout_url: url } = await r.json();
      if (!r.ok || !url) throw new Error(`checkout answered ${r.status}`);
      location.assign(url);
    } catch (err) {
      console.error(err);
      note.textContent = "checkout isn't answering right now. try again?";
      input.disabled = false;
    }
  }

  // Back from Dodo: the address carries ?payment_id=…&status=…, but that is
  // only a claim, so the server is asked before anything unlocks.
  async function handleReturn() {
    const q = new URLSearchParams(location.search);
    const id = q.get('payment_id');
    if (!id || !locked) return;
    const status = q.get('status');
    for (const k of ['payment_id', 'status', 'email', 'license_key']) q.delete(k);
    history.replaceState(null, '', `${location.pathname}${q.size ? `?${q}` : ''}${location.hash}`);

    open();
    if (status !== 'succeeded') {
      note.textContent = status === 'processing' ? 'your payment is still processing. check back shortly.' : "that payment didn't go through.";
      return;
    }
    note.textContent = 'checking your payment…';
    try {
      const r = await fetch(`${CHECKOUT_API}/api/verify?payment_id=${encodeURIComponent(id)}`);
      const { ok, reason } = await r.json();
      if (ok) celebrate();
      else note.textContent = `couldn't confirm the payment${reason ? `: ${reason}` : ''}.`;
    } catch (err) {
      console.error(err);
      note.textContent = "couldn't check the payment right now.";
    }
  }

  function celebrate() {
    locked = false;
    remember();
    form.hidden = true;
    note.hidden = true;
    reveal.hidden = true;
    document.getElementById('unlock-title').hidden = true;
    win.hidden = false;
    popup.classList.add('is-won');
    sparkle();
    setTimeout(() => {
      shut();
      // The lock shrinks away after the popup has gone.
      setTimeout(() => {
        setLockedLook();
        onUnlock?.();
      }, 260);
    }, reduceMotion() ? 900 : 2000);
  }

  // Four-point stars bursting out round the popup.
  function sparkle() {
    const layer = document.getElementById('unlock-sparks');
    layer.replaceChildren();
    const count = reduceMotion() ? 0 : 28;
    for (let i = 0; i < count; i++) {
      const s = document.createElement('i');
      const angle = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 130;
      s.style.setProperty('--x', `${(Math.cos(angle) * dist).toFixed(0)}px`);
      s.style.setProperty('--y', `${(Math.sin(angle) * dist * 0.8 - 16).toFixed(0)}px`);
      s.style.setProperty('--s', (0.6 + Math.random() * 1.1).toFixed(2));
      s.style.setProperty('--d', `${(Math.random() * 0.35).toFixed(2)}s`);
      s.style.setProperty('--r', `${Math.round((Math.random() - 0.5) * 120)}deg`);
      s.style.background = SPARKLE_COLOURS[i % SPARKLE_COLOURS.length];
      layer.append(s);
    }
  }

  // Hover (or a tap, or keyboard focus) opens the popup; it then stays until
  // dismissed, because it sits far from the button.
  button.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && open());
  button.addEventListener('focus', open);
  button.addEventListener('click', (e) => {
    if (!locked) return;
    e.preventDefault(); // don't open the file picker while locked
    open();
  });
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (locked) open();
      else document.getElementById('file').click();
    }
  });

  reveal.addEventListener('pointerenter', showReveal);
  reveal.addEventListener('focus', showReveal);
  reveal.addEventListener('click', showReveal);

  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^a-z]/gi, '').slice(0, 4).toUpperCase();
    note.textContent = '';
    if (input.value.length === 4 && !typing) submit();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit();
  });
  close.addEventListener('click', shut);
  window.addEventListener('keydown', (e) => e.key === 'Escape' && !popup.hidden && locked && shut());
  window.addEventListener('pointerdown', (e) => {
    if (!popup.hidden && locked && !popup.contains(e.target) && !button.contains(e.target)) shut();
  });

  if (CHECKOUT_API) handleReturn();

  return { isLocked: () => locked, open };
}
