import { soundBell, soundKey, wakeAudio } from './audio.js';

// "Use your own image" is a paid feature, with a wink: the Dodo team's code is
// right there, blurred until you hover it. Hovering reveals it, you type it in
// (to the sound of a typewriter), and the lock pops off in a burst of sparkles.
//
// This is a showpiece, not security: the code is in the page and the unlocked
// flag lives in sessionStorage. A real gate would check a paid checkout on a
// server (see the Dodo notes in the README).

const CODE = 'DODO';
const KEY = 'jigglesaw-unlocked';
const SPARKLE_COLOURS = ['#ffc94d', '#ffd77a', '#ffe7a3', '#ffb3c8', '#ffffff'];

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  const setLockedLook = () => {
    document.body.classList.toggle('is-locked', locked);
    button.setAttribute('aria-label', locked ? 'Use your own image (a paid feature, locked)' : 'Use your own image');
  };
  setLockedLook();

  function open() {
    if (!locked || !popup.hidden) return;
    popup.hidden = false;
    // One frame later, so the entrance transition has something to start from.
    requestAnimationFrame(() => {
      popup.classList.add('is-open');
      input.focus({ preventScroll: true }); // ready to type
    });
  }

  function shut() {
    popup.classList.remove('is-open');
    setTimeout(() => {
      if (!popup.classList.contains('is-open')) popup.hidden = true;
    }, 220);
  }

  // Hovering the blurred bit shows the code; typing it is up to you.
  const showReveal = () => reveal.classList.add('is-revealed');

  function wrong() {
    note.textContent = 'not quite. hover the blurred bit?';
    form.classList.remove('shake');
    void form.offsetWidth; // restart the animation
    form.classList.add('shake');
    // Clear it for another go once the shake has played.
    setTimeout(() => {
      input.value = '';
      typed = 0;
      input.focus({ preventScroll: true });
    }, 420);
  }

  function submit() {
    if (!locked) return;
    if (input.value.trim().toUpperCase() === CODE) celebrate();
    else wrong();
  }

  function celebrate() {
    soundBell();
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

  // Each letter you type clicks like a typewriter key; backspace is duller.
  let typed = 0;
  input.addEventListener('keydown', wakeAudio);
  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^a-z]/gi, '').slice(0, 4).toUpperCase();
    const len = input.value.length;
    if (len !== typed) soundKey(len < typed);
    typed = len;
    note.textContent = '';
    // Let the last key land before answering.
    if (len === 4) setTimeout(submit, 240);
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

  return { isLocked: () => locked, open };
}
