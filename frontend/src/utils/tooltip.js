/**
 * positionTooltip – keeps a D3 tooltip fully inside the viewport with
 * a smooth fade-in and fluid cursor-following motion.
 *
 * HOW IT WORKS
 * ────────────
 * • CSS supplies `transition: opacity 0.18s ease` so every show/hide fades.
 * • Position transition is suppressed on the FIRST show of each hover cycle
 *   (so the tooltip doesn't slide in from -9999 px) then enabled for all
 *   subsequent position updates so the tooltip glides after the cursor.
 *
 * Two-pass positioning
 * ────────────────────
 * Pass 1 (sync, 0 ms)  – instant rough placement near cursor using a
 *                         conservative size estimate. Tooltip is always
 *                         visible immediately on hover.
 * Pass 2 (150 ms later) – re-reads real pixel dimensions once the browser
 *                         has painted the element, applies precise viewport
 *                         clamping, then enables smooth position transitions.
 *
 * Usage (call from both mouseover AND mousemove handlers):
 *   tip.style('opacity', 1).html('...');
 *   positionTooltip(tip, event);
 */
export function positionTooltip(tip, event) {
  // Guard: bail on empty D3 selections or null nodes
  if (!tip || !tip.node || !tip.node()) return;

  const PAD  = 12;
  const vw   = window.innerWidth;
  const vh   = window.innerHeight;
  const sx   = window.scrollX || 0;
  const sy   = window.scrollY || 0;
  const ex   = event.pageX;   // capture before async pass
  const ey   = event.pageY;
  const node = tip.node();

  /** Clamp coords to viewport given tooltip pixel size tw × th. */
  function clamp(tw, th) {
    let x = ex + PAD;
    let y = ey - th - PAD;
    if (x + tw > sx + vw - PAD) x = ex - tw - PAD;
    x = Math.max(x, sx + PAD);
    if (y < sy + PAD) y = ey + PAD;
    if (y + th > sy + vh - PAD) y = sy + vh - th - PAD;
    return { x, y };
  }

  // ── Pass 1: instant snap, no position transition ────────────────────────
  // Override the CSS so left/top jump instantly (prevents flying from -9999).
  node.style.transition = 'opacity 0.18s ease';
  const p1 = clamp(220, 56);
  tip.style('left', p1.x + 'px').style('top', p1.y + 'px');

  // ── Pass 2: precise clamp + enable smooth following ────────────────────
  setTimeout(() => {
    if (!tip.node()) return;                         // component may have unmounted
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return;         // element not yet laid out

    // Enable position transition NOW (after initial snap, before correction)
    node.style.transition =
      'opacity 0.18s ease, left 0.09s ease, top 0.09s ease';

    const p2 = clamp(rect.width, rect.height);
    tip.style('left', p2.x + 'px').style('top', p2.y + 'px');
  }, 150);
}
