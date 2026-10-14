import {Solver} from './solver.js';
import {Renderer} from './renderer.js';
import {Clock} from './clock.js';
const $=id=>document.getElementById(id),solver=new Solver(),renderer=new Renderer($('waveCanvas')),clock=new Clock();
let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,last=0;
function draw(){
  const range=renderer.draw(solver,{scale:$('scaleMode').value,limit:Number($('fixedLimit').value),grid:$('showGrid').checked});
  $('scaleLow').textContent=(-range).toPrecision(3);$('scaleHigh').textContent=range.toPrecision(3);
  $('simTime').textContent=solver.time.toFixed(3)+' s';$('simStatus').textContent=playing?'Running':'Paused';$('simToggle').textContent=playing?'Pause':'Play';
  $('scaleNote').textContent=$('scaleMode').value==='adaptive'?'Adaptive: colors rescale each frame; fading waves can still look strong.':'Fixed: the same color represents the same amplitude throughout the run.';
}
function reset(){solver.reset();solver.pulse();clock.reset();draw();}
$('simToggle').onclick=()=>{playing=!playing;clock.reset();draw();};
$('simStep').onclick=()=>{playing=false;clock.reset();solver.step();draw();};
$('simReset').onclick=reset;
$('simPulse').onclick=()=>{solver.pulse();draw();};
for(const id of ['scaleMode','fixedLimit','showGrid'])$(id).addEventListener('change',draw);
$('waveCanvas').addEventListener('click',e=>{const r=e.currentTarget.getBoundingClientRect();solver.pulse((e.clientX-r.left)/r.width*(solver.config.nx-1),(e.clientY-r.top)/r.height*(solver.config.nz-1));draw();});
document.addEventListener('visibilitychange',()=>{last=0;clock.reset();});
reset();
function frame(now){
  if(last&&playing&&!document.hidden) {
    try{const count=clock.advance((now-last)/1000,Number($('playback').value),solver.config.dt);for(let i=0;i<count;i++)solver.step();}
    catch(e){playing=false;$('labMessage').textContent=e.message;}
    draw();
  }
  last=now;requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
