'use strict';
// Progressive enhancement: all task descriptions remain available without JS.
document.documentElement.classList.add('js');
for (const list of document.querySelectorAll('[data-tabs]')) {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  function activate(tab, moveFocus = false) {
    for (const item of tabs) {
      const selected = item === tab;
      const panel = document.getElementById(item.getAttribute('aria-controls'));
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      panel.hidden = !selected;
      if (!selected) panel.querySelectorAll('video').forEach(video => { if (!video.paused) pauseManaged(video); });
    }
    if (moveFocus) tab.focus();
    snapVideoFrames();
    requestAnimationFrame(syncPlayback);
  }
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); activate(tabs[next], true); }
    });
  }
  activate(tabs[0]);
}
// A centered layout can leave a video's left edge on a half pixel; the edge then shimmers while it plays.
// Shift each frame by the fractional remainder so both vertical edges sit on whole pixels.
function snapVideoFrames() {
  for (const frame of document.querySelectorAll('.video-frame')) {
    frame.style.transform = '';
    const rect = frame.getBoundingClientRect();
    if (!rect.width) continue;
    const dx = Math.round(rect.left) - rect.left;
    if (Math.abs(dx) > 0.01) frame.style.transform = `translateX(${dx.toFixed(3)}px)`;
  }
}
window.addEventListener('resize', snapVideoFrames);
window.addEventListener('load', snapVideoFrames);
const videos = [...document.querySelectorAll('video')];
// Silent demos play only when visible; preserve explicit pauses and sound playback.
const visibility = new Map();
const userPaused = new WeakSet();
const managedPauses = new WeakSet();
const pendingPlay = new WeakSet();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function pauseManaged(video) {
  if (!video.paused) { managedPauses.add(video); video.pause(); }
}
function isVisibleVideo(video) {
  return (visibility.get(video) || 0) >= 0.35 && !video.closest('[hidden], [inert]');
}
function syncPlayback() {
  const soundPlaying = videos.some(video => !video.defaultMuted && !video.paused);
  for (const video of videos) {
    const visible = !document.hidden && isVisibleVideo(video);
    if (!visible) { pauseManaged(video); continue; }
    if (!video.defaultMuted) continue; // Sonification remains a user-started, audible demo.
    if (soundPlaying) { pauseManaged(video); continue; }
    if (video.hasAttribute('data-manual-play') || reducedMotion.matches || userPaused.has(video) || !video.paused || pendingPlay.has(video)) continue;
    video.muted = true;
    pendingPlay.add(video);
    video.play().catch(() => {}).finally(() => {
      pendingPlay.delete(video);
      if (document.hidden || !isVisibleVideo(video)) pauseManaged(video);
    });
  }
}
for (const video of videos) {
  if (video.defaultMuted) video.loop = true;
  video.addEventListener('pause', () => {
    if (managedPauses.has(video)) managedPauses.delete(video);
    else userPaused.add(video);
  });
  video.addEventListener('play', () => {
    userPaused.delete(video);
    if (!video.defaultMuted) videos.forEach(other => { if (other !== video) pauseManaged(other); });
  });
  if (!video.defaultMuted) {
    video.addEventListener('pause', syncPlayback);
    video.addEventListener('ended', syncPlayback);
  }
}
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => visibility.set(entry.target, entry.intersectionRatio));
    syncPlayback();
  }, {threshold: [0, 0.35, 0.6, 1]});
  videos.forEach(video => observer.observe(video));
}
document.addEventListener('visibilitychange', syncPlayback);
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) videos.filter(video => video.defaultMuted).forEach(pauseManaged);
  else syncPlayback();
});

// Keep each carousel independent; play only its visible, selected slide.
for (const carousel of document.querySelectorAll('[data-carousel]')) {
  const track = carousel.querySelector('.carousel-track');
  const slides = [...carousel.querySelectorAll('.carousel-slide')];
  const dots = [...carousel.querySelectorAll('[data-slide]')];
  const previous = carousel.querySelector('.carousel-prev');
  const next = carousel.querySelector('.carousel-next');
  let current = 0;
  function update(index) {
    current = index;
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('is-current', active);
      slide.inert = !active;
      if (!active) pauseManaged(slide.querySelector('video'));
      if (active) dots[i].setAttribute('aria-current', 'true');
      else dots[i].removeAttribute('aria-current');
    });
    previous.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    requestAnimationFrame(syncPlayback);
  }
  function go(index, smooth = true) {
    index = Math.max(0, Math.min(slides.length - 1, index));
    update(index);
    track.scrollTo({left: slides[index].offsetLeft - (track.clientWidth - slides[index].offsetWidth) / 2,
      behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant'});
  }
  previous.addEventListener('click', () => go(current - 1));
  next.addEventListener('click', () => go(current + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => go(i)));
  track.addEventListener('keydown', event => {
    if (event.target !== track) return;
    const index = {ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: slides.length - 1}[event.key];
    if (index !== undefined) { event.preventDefault(); go(index); }
  });
  let scrollFrame;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      const center = track.scrollLeft + track.clientWidth / 2;
      const distances = slides.map(slide => Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - center));
      update(distances.indexOf(Math.min(...distances)));
    });
  }, {passive: true});
  new ResizeObserver(() => go(current, false)).observe(track);
  update(0);
}

window.addEventListener('message',event=>{const frame=document.getElementById('touch-interactive');if(frame&&event.origin===location.origin&&event.source===frame.contentWindow&&event.data?.type==='panotac-touch-height'&&Number.isFinite(event.data.height)){frame.style.height=Math.max(200,Math.min(1800,event.data.height))+'px';}});
