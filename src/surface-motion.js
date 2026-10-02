/* Surface Desk motion. Owns transient shadows and transforms, never app data or window geometry.
 * create({desk,reduced,timing}) -> open/sink(root,rect,done), drag/release(root), ripple({x,y}), cancel/dispose(root).
 * rect is a snapshot {x,y,w,h}; completion belongs to the window manager and is cancelled on reopen.
 */
window.BDPSurfaceMotion = (function () {
  'use strict';
  function create({ desk, reduced, timing = {} }) {
    const wait = timing.wait ?? 160, rise = timing.rise ?? 1120, sink = timing.sink ?? 620;
    const states = new WeakMap();
    const ripples = [];
    function ripple({ x, y, color }) {
      if (reduced()) return () => {};
      // Dock buttons may be replaced by focus/restore; the desk owns the ripple.
      while (ripples.length >= 4) ripples[0]();
      const el = document.createElement('div');
      el.className = 'surface-ripple';
      el.setAttribute('aria-hidden', 'true');
      Object.assign(el.style, { left: x + 'px', top: y + 'px' });
      if (color) el.style.setProperty('--surface-ripple-color', color);
      let timer, finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        el.removeEventListener('animationend', onEnd);
        el.remove();
        const index = ripples.indexOf(finish);
        if (index >= 0) ripples.splice(index, 1);
      };
      const onEnd = ev => { if (ev.target === el && ev.animationName === 'surface-ripple') finish(); };
      el.addEventListener('animationend', onEnd);
      desk.appendChild(el);
      ripples.push(finish);
      timer = setTimeout(finish, (timing.ripple ?? 420) + 100);
      return finish;
    }
    const state = root => {
      if (!states.has(root)) states.set(root, { timer: null, listener: null, shadow: null, shadowTimer: null, elastic: null });
      return states.get(root);
    };
    function cancel(root) {
      const s = state(root);
      clearTimeout(s.timer); clearTimeout(s.shadowTimer);
      if (s.listener) root.removeEventListener('animationend', s.listener);
      if (s.shadow) s.shadow.remove();
      if (s.elastic) s.elastic.cancel();
      s.timer = s.listener = s.shadow = s.shadowTimer = s.elastic = null;
      root.classList.remove('surface-opening', 'surface-sinking', 'surface-drag');
      for (const name of ['tilt', 'skew-x', 'skew-y', 'scale-x', 'scale-y']) root.style.removeProperty('--liquid-' + name);
      root.style.removeProperty('--surface-lag-x');
      root.style.removeProperty('--surface-lag-y');
    }
    function shadow(root, rect, phase) {
      const s = state(root), el = document.createElement('div');
      el.className = 'surface-shadow surface-shadow-' + phase;
      el.setAttribute('aria-hidden', 'true');
      Object.assign(el.style, {left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px', zIndex: Math.max(0, Number(root.style.zIndex || 10) - 1)});
      el.style.setProperty('--shadow-x', Math.min(1, 112 / rect.w));
      el.style.setProperty('--shadow-y', Math.min(1, 112 / rect.h));
      desk.appendChild(el); s.shadow = el;
      const finish = () => { el.remove(); if (s.shadow === el) s.shadow = null; clearTimeout(s.shadowTimer); s.shadowTimer = null; };
      el.addEventListener('animationend', ev => { if (ev.target === el && ev.animationName === 'surface-shadow-' + phase) finish(); });
      s.shadowTimer = setTimeout(finish, (phase === 'rise' ? wait + rise + 180 : sink + 160) + 100);
    }
    function play(root, rect, phase, done) {
      cancel(root);
      root.style.setProperty('--droplet-x', Math.min(1, 56 / rect.w));
      root.style.setProperty('--droplet-y', Math.min(1, 56 / rect.h));
      if (reduced()) { if (done) done(); return; }
      shadow(root, rect, phase);
      const s = state(root), className = phase === 'rise' ? 'surface-opening' : 'surface-sinking';
      const finish = () => {
        clearTimeout(s.timer); s.timer = null;
        if (s.listener) root.removeEventListener('animationend', s.listener);
        s.listener = null; root.classList.remove(className);
        if (done) done();
      };
      s.listener = ev => { if (ev.target === root && ev.animationName === 'surface-' + phase) finish(); };
      root.addEventListener('animationend', s.listener);
      void root.offsetWidth;
      root.classList.add(className);
      s.timer = setTimeout(finish, (phase === 'rise' ? wait + rise : sink) + 100);
    }
    function drag(root, vx, vy) {
      if (reduced()) return;
      const s = state(root);
      if (s.elastic) { s.elastic.cancel(); s.elastic = null; }
      vx = Math.max(-2, Math.min(2, vx)); vy = Math.max(-2, Math.min(2, vy));
      root.classList.add('surface-drag');
      const x = Math.abs(vx), y = Math.abs(vy);
      const values = {tilt: vx * .65 + 'deg', 'skew-x': -vx * 1.15 + 'deg', 'skew-y': -vy * .65 + 'deg', 'scale-x': 1 + x * .014 - y * .006, 'scale-y': 1 + y * .014 - x * .006};
      for (const [key,value] of Object.entries(values)) root.style.setProperty('--liquid-' + key, value);
      root.style.setProperty('--surface-lag-x', -vx * 14 + 'px');
      root.style.setProperty('--surface-lag-y', -vy * 10 + 'px');
    }
    function release(root) {
      const transform = getComputedStyle(root).transform;
      cancel(root);
      if (reduced() || transform === 'none' || !root.animate) return;
      const s = state(root);
      const elastic = root.animate([{transform}, {transform: 'scale(.994,1.006)', offset: .58}, {transform: 'none'}], {duration: 430, easing: 'cubic-bezier(.2,.75,.25,1)'});
      s.elastic = elastic;
      elastic.onfinish = () => { if (s.elastic === elastic) s.elastic = null; };
    }
    return {open: (root,rect,done) => play(root,rect,'rise',done), sink: (root,rect,done) => play(root,rect,'sink',done), drag, release, ripple, cancel, dispose: cancel};
  }
  return { create };
})();
