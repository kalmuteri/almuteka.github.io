(() => {
  'use strict';
  const body = document.body;
  const themeButton = document.getElementById('themeButton');
  const menuButton = document.getElementById('menuButton');
  const scrim = document.getElementById('menuScrim');
  const $ = id => document.getElementById(id);

  let savedTheme = '';
  try { savedTheme = localStorage.getItem('km-theme') || ''; } catch (_) {}
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const dark = savedTheme ? savedTheme === 'dark' : !!(media && media.matches);
  body.classList.toggle('dark', dark);
  const setThemeLabel = () => {
    if (themeButton) themeButton.setAttribute('aria-label', body.classList.contains('dark') ? 'Switch to light mode' : 'Switch to dark mode');
  };
  setThemeLabel();
  themeButton?.addEventListener('click', () => {
    const nextDark = !body.classList.contains('dark');
    body.classList.toggle('dark', nextDark);
    try { localStorage.setItem('km-theme', nextDark ? 'dark' : 'light'); } catch (_) {}
    setThemeLabel();
  });

  function closeMenu() {
    body.classList.remove('menu-open');
    menuButton?.setAttribute('aria-expanded', 'false');
  }
  menuButton?.addEventListener('click', () => {
    const nowOpen = body.classList.toggle('menu-open');
    menuButton.setAttribute('aria-expanded', String(nowOpen));
  });
  scrim?.addEventListener('click', closeMenu);
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = String(new Date().getFullYear()); });

  // A lightweight 2-D scalar-wave finite-difference demonstration.
  // Pure browser-side code: no libraries, CDN or network requests.
  const canvas = $('waveCanvas');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d', {alpha: false});
  if (!ctx) return;
  const nx = canvas.width, nz = canvas.height, N = nx * nz;
  let prev = new Float32Array(N);
  let curr = new Float32Array(N);
  let next = new Float32Array(N);
  let playing = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let frame = 0;
  const widthStepSq = 0.18; // v² * dt² / dx²; 2-D stability criterion: <= 0.5
  const imageData = ctx.createImageData(nx, nz);
  const rgba = imageData.data;
  const distEdges = new Float32Array(N);
  for (let z=0; z<nz; z++) {
    for (let x=0; x<nx; x++) {
      const d = Math.min(x, nx - 1 - x, z, nz - 1 - z);
      // Gentle sponge zone: attenuation rises gradually toward edges.
      const normalized = Math.max(0, (15 - d) / 15);
      distEdges[z * nx + x] = 1 - 0.054 * normalized * normalized;
    }
  }
  function pulse(x = nx * .49, z = nz * .5) {
    const r = 4.8, amp = 1.0;
    for (let j=Math.max(1, Math.floor(z - r*4)); j<Math.min(nz-1, Math.ceil(z+r*4)); j++) {
      for (let i=Math.max(1, Math.floor(x - r*4)); i<Math.min(nx-1, Math.ceil(x+r*4)); i++) {
        const d2 = (i-x)*(i-x)+(j-z)*(j-z);
        const u = amp * Math.exp(-d2/(2*r*r));
        curr[j*nx+i] += u;
        prev[j*nx+i] += u;
      }
    }
  }
  function reset() {
    prev.fill(0); curr.fill(0); next.fill(0); frame = 0;
    pulse(); draw();
  }
  function step() {
    for(let z=1; z<nz-1; z++) {
      const row = z*nx;
      for(let x=1; x<nx-1; x++) {
        const k=row+x;
        const lap=curr[k-1]+curr[k+1]+curr[k-nx]+curr[k+nx]-4*curr[k];
        next[k]=(2*curr[k]-prev[k]+widthStepSq*lap)*distEdges[k];
      }
    }
    let t=prev; prev=curr; curr=next; next=t; frame++;
  }
  function draw() {
    // Teal / dark / warm-gold diverging visualization of signed wave amplitudes.
    for(let z=0; z<nz; z++) {
      for(let x=0; x<nx; x++) {
        const k=z*nx+x, r=k*4;
        const u = Math.max(-1, Math.min(1, curr[k]*2.2));
        const a = Math.min(1, Math.abs(u));
        const grid = (x%15===0||z%15===0) ? 4 : 0;
        if(u>=0){rgba[r]=Math.round(11+94*a+grid);rgba[r+1]=Math.round(31+164*a+grid);rgba[r+2]=Math.round(43+142*a+grid);}
        else{rgba[r]=Math.round(11+205*a+grid);rgba[r+1]=Math.round(31+148*a+grid);rgba[r+2]=Math.round(43+67*a+grid);}
        rgba[r+3]=255;
      }
    }
    ctx.putImageData(imageData,0,0);
  }
  const toggle = $('simToggle'), status = $('simStatus');
  function setStatus(){
    if(toggle) toggle.textContent = playing ? 'Pause' : 'Play';
    if(status){ status.textContent = playing ? '● RUNNING' : '◼ PAUSED';status.classList.toggle('paused', !playing); }
  }
  toggle?.addEventListener('click',()=>{playing=!playing;setStatus();});
  $('simPulse')?.addEventListener('click',()=>pulse(nx*.49,nz*.5));
  $('simReset')?.addEventListener('click',reset);
  canvas.addEventListener('click', e=>{
    const box = canvas.getBoundingClientRect();
    pulse((e.clientX-box.left)*nx/box.width,(e.clientY-box.top)*nz/box.height);
  });
  reset();setStatus();
  let raf = 0;
  function animate(){
    if (playing && !document.hidden) {step();step(); draw();}
    raf=window.requestAnimationFrame(animate);
  }
  raf=window.requestAnimationFrame(animate);
  window.addEventListener('pagehide',()=>window.cancelAnimationFrame(raf),{once:true});
})();
