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

// Endpoint previews make each failure carousel a continuous loop.
for (const carousel of document.querySelectorAll('[data-carousel]')) {
  const track = carousel.querySelector('.carousel-track');
  const originals = [...track.querySelectorAll('.carousel-slide')];
  const dots = [...carousel.querySelectorAll('[data-slide]')];
  const previous = carousel.querySelector('.carousel-prev');
  const next = carousel.querySelector('.carousel-next');
  const count = originals.length;
  function previewOf(slide) {
    const clone = slide.cloneNode(true);
    clone.dataset.loopPreview = 'true';
    clone.setAttribute('aria-hidden', 'true');
    clone.inert = true;
    clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    clone.querySelectorAll('video').forEach(video => { video.removeAttribute('autoplay'); video.preload = 'none'; });
    return clone;
  }
  track.prepend(previewOf(originals[count - 1]));
  track.append(previewOf(originals[0]));
  const slides = [...track.querySelectorAll('.carousel-slide')];
  let current = 0, physical = 1, settling, scrollFrame;
  const logicalIndex = index => (index - 1 + count) % count;
  function update(index) {
    physical = index;
    current = logicalIndex(index);
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('is-current', active);
      slide.inert = !active || Boolean(slide.dataset.loopPreview);
      if (!active) pauseManaged(slide.querySelector('video'));
    });
    dots.forEach((dot, i) => {
      if (i === current) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    previous.disabled = next.disabled = false;
    requestAnimationFrame(syncPlayback);
  }
  function position(index, smooth) {
    if (!track.clientWidth) return;
    track.scrollTo({left: slides[index].offsetLeft - (track.clientWidth - slides[index].offsetWidth) / 2,
      behavior: smooth && !reducedMotion.matches ? 'smooth' : 'instant'});
  }
  function normalize() {
    clearTimeout(settling);
    if (physical === 0 || physical === count + 1) {
      const index = current + 1;
      update(index);
      position(index, false);
    }
  }
  function go(index, smooth = true) {
    normalize();
    const target = index < 0 ? 0 : index >= count ? count + 1 : index + 1;
    update(target);
    position(target, smooth);
    if (!smooth || reducedMotion.matches) normalize();
  }
  previous.addEventListener('click', () => go(current - 1));
  next.addEventListener('click', () => go(current + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => go(i)));
  track.addEventListener('keydown', event => {
    if (event.target !== track) return;
    const index = {ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: count - 1}[event.key];
    if (index !== undefined) { event.preventDefault(); go(index); }
  });
  track.addEventListener('scroll', () => {
    clearTimeout(settling);
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      const center = track.scrollLeft + track.clientWidth / 2;
      const distances = slides.map(slide => Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - center));
      update(distances.indexOf(Math.min(...distances)));
      settling = setTimeout(normalize, 180);
    });
  }, {passive:true});
  track.addEventListener('scrollend', normalize);
  new ResizeObserver(() => { update(current + 1); position(current + 1, false); }).observe(track);
  update(1);
  position(1, false);
}

window.addEventListener('message',event=>{const frame=document.getElementById('touch-interactive');if(frame&&event.origin===location.origin&&event.source===frame.contentWindow&&event.data?.type==='panotac-touch-height'&&Number.isFinite(event.data.height)){frame.style.height=Math.max(200,Math.min(1800,event.data.height))+'px';}});

// Track both chapters and their visible subsections at the reading position.
const toc = document.querySelector('.page-toc');
const tocToggle = document.querySelector('.toc-toggle');
const tocGroups = [...toc.querySelectorAll('[data-section]')];
const tocLinks = [...toc.querySelectorAll('a')];
function updateToc() {
  const readingLine = Math.min(180, window.innerHeight * .25);
  let active = tocGroups[0];
  for (const group of tocGroups) {
    if (document.getElementById(group.dataset.section).getBoundingClientRect().top <= readingLine) active = group;
  }
  let current = active.querySelector('a');
  for (const link of active.querySelectorAll('ul a')) {
    if (document.querySelector(link.hash).getBoundingClientRect().top <= readingLine) current = link;
  }
  tocGroups.forEach(group => group.classList.toggle('is-active', group === active));
  tocLinks.forEach(link => {
    if (link === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
let tocScheduled = false;
window.addEventListener('scroll', () => {
  if (!tocScheduled) { tocScheduled = true; requestAnimationFrame(() => { updateToc(); tocScheduled = false; }); }
}, {passive:true});
window.addEventListener('resize', updateToc);
window.addEventListener('load', updateToc);
updateToc();
function closeToc() { toc.classList.remove('is-open'); tocToggle.setAttribute('aria-expanded','false'); tocToggle.setAttribute('aria-label','Show table of contents'); }
tocToggle.addEventListener('click', () => {
  const open = tocToggle.getAttribute('aria-expanded') !== 'true';
  tocToggle.setAttribute('aria-expanded', String(open)); tocToggle.setAttribute('aria-label',open ? 'Hide table of contents' : 'Show table of contents'); toc.classList.toggle('is-open',open);
});
tocLinks.forEach(link => link.addEventListener('click',closeToc));
document.addEventListener('click', event => { if (!toc.contains(event.target) && !tocToggle.contains(event.target)) closeToc(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && toc.classList.contains('is-open')) { closeToc(); tocToggle.focus(); } });
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.getElementById('nav-menu');
function closeNavMenu() { navToggle.setAttribute('aria-expanded','false'); navMenu.classList.remove('is-open'); }
navToggle.addEventListener('click', () => {
  const open = navToggle.getAttribute('aria-expanded') !== 'true';
  navToggle.setAttribute('aria-expanded',String(open));
  navMenu.classList.toggle('is-open',open);
});
navMenu.querySelectorAll('a').forEach(link => link.addEventListener('click',closeNavMenu));
navMenu.addEventListener('keydown', event => { if (event.key === 'Escape') { closeNavMenu(); navToggle.focus(); } });
