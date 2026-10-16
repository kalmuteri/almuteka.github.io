import {diagnostics} from './diagnostics.js?v=20261016-time';
import {experiments,experimentSetup} from './experiments.js?v=20261016-time';
import {prepareRun} from './run.js?v=20261016-time';
import {Renderer,drawRecord} from './renderer.js?v=20261016-time';
import {Clock} from './clock.js';
import {receiverArray} from './receivers.js?v=20261016-time';
import {ricker} from './sources.js';
import {$,number,readSetup,sourceLabels,contextualControls} from './controls.js?v=20261016-plot-labels';
let dirty=false,runPlan,stopped=false;
let diagnostic,sourcePlotKey='',lastPaint=0,recordPaint=0;
let config=readSetup(),solver,record,points=[],sourceMarkers=[],playing=false,last=0,activeExperiment='propagation';
const renderer=new Renderer($('waveCanvas')),clock=new Clock();
function text(id,value){const el=$(id);if(el.textContent!==value)el.textContent=value;}
function message(value){text('labMessage',value);bulletize();}
function syncSetup(){
  for(const [key,value] of Object.entries(config)){const el=$(key);if(el){if(el.type==='checkbox')el.checked=value;else el.value=value;}}
  $('dtMs').value=config.dt*1000;
  sourceLabels();contextualControls();dirty=false;updatePending();
}
function updatePending(){
  text('setupStatus',dirty?'Changes not applied. Apply changes to restart with this setup.':'Setup is applied.');
  for(const id of ['simToggle','simStep'])$(id).disabled=dirty||stopped;
  $('applySetup').disabled=!dirty;
}
function receiverBounds(){
  const dx=Number($('dx').value),dz=Number($('dz').value),spacing=Number($('receiverSpacing').value)/dx;
  $('receiverSpacing').min=dx;$('receiverSpacing').step=dx;
  $('receiverDepth').min=0;$('receiverDepth').max=115*dz;$('receiverDepth').step=dz;
  $('receiverCount').max=Number.isFinite(spacing)&&spacing>=1?Math.min(180,Math.floor(179/spacing)+1):180;
}
function safe(action){try{action();}catch(e){playing=false;if(!dirty&&solver){stopped=true;updatePending();}message(e.message);if(dirty)text('setupStatus',e.message);if(solver)draw();}}
function reset(nextConfig=config){
  const nextPoints=receiverArray({nx:180,nz:116},nextConfig.receiverCount,nextConfig.receiverSpacing/nextConfig.dx,nextConfig.receiverDepth/nextConfig.dz);
  const candidate=prepareRun(nextConfig,nextPoints);
  config={...nextConfig};solver=candidate.solver;record=candidate.record;runPlan=candidate.plan;stopped=false;
  points=record.points;sourceMarkers=candidate.markers;
  $('waveCanvas').style.aspectRatio=((solver.config.nx-1)*solver.config.dx)/((solver.config.nz-1)*solver.config.dz);
  diagnostic=diagnostics(solver,config);sourcePlotKey='';recordPaint=0;
  clock.reset();
  const c=solver.config;
  $('receiverLimits').textContent=`Minimum spacing: Δx = ${c.dx} m. Up to ${c.nx} receivers in one row, depending on spacing. Boundary receivers record zero pressure.`;
  playing=false;syncSetup();receiverBounds();
  message('Ready. Press Play to run, or Step to advance once.');draw();
}
function step(){
  if(stopped)return;
  solver.step();record.sample(solver.curr);
  if(solver.steps>=runPlan.steps){
    stopped=true;playing=false;updatePending();
    message(`Maximum time reached at ${solver.time.toFixed(6)} s. Restart to run again.`);
  }
}
function drawSource(){
  const key=JSON.stringify([config.sourceType,config.frequency,config.sourceDelay,config.sourceWidth]);
  if(key===sourcePlotKey)return;sourcePlotKey=key;
  const ctx=$('sourceCanvas').getContext('2d'),w=500,h=100;ctx.fillStyle='#0b1f2b';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#69c3b9';ctx.lineWidth=2;ctx.beginPath();
  for(let i=0;i<w;i++){const q=i/(w-1),value=config.sourceType==='ricker'?ricker(q*3/config.frequency,config.frequency,1.5/config.frequency):Math.exp(-.5*((q-.5)*8)**2);const y=h/2-value*40;if(i)ctx.lineTo(i,y);else ctx.moveTo(i,y);}ctx.stroke();
}
function showExperiment(){const e=experiments.find(e=>e.id===activeExperiment);$('experimentTitle').textContent=e.title;$('experimentObjective').textContent=e.objective;$('experimentPredict').textContent='Predict: '+e.predict;$('experimentObserve').textContent='Observe: '+e.observe;$('experimentExplain').textContent='Explain: '+e.explain;$('experimentChallenge').textContent='Challenge: '+e.challenge;}
function loadExperiment(id){
  const e=experiments.find(e=>e.id===id);config=experimentSetup(id);activeExperiment=id;
  for(const [key,value] of Object.entries(config)){const el=$(key);if(el){if(el.type==='checkbox')el.checked=value;else el.value=value;}}
  $('dtMs').value=config.dt*1000;$('experimentSelect').value=id;
  $('view').value=['layers','slow','fast','inclined'].includes(config.model)?'overlay':'wave';
  $('scaleMode').value=config.sourceType==='ricker'?'adaptive':'fixed';$('fixedLimit').value=1;
  sourceLabels();showExperiment();playing=false;reset();
}
function draw(now=0){
  const limit=Number($('fixedLimit').value),view=$('view').value,c=solver.config;
  const range=renderer.draw(solver,{scale:$('scaleMode').value,limit,grid:$('showGrid').checked,view,sources:$('showSources').checked?sourceMarkers:[],receivers:$('showReceivers').checked?points:[]});
  text('plotTitle',{wave:'Wave amplitude',velocity:'Velocity model',overlay:'Wave amplitude + velocity'}[view]);
  $('fixedLimit').disabled=$('scaleMode').value!=='fixed'||view==='velocity';
  $('fixedLimit').closest('label').hidden=$('fixedLimit').disabled;
  $('scaleMode').closest('label').hidden=view==='velocity';
  text('scaleLow',(-range).toPrecision(3));text('scaleHigh',range.toPrecision(3));
  if(now&&now-recordPaint<100)return;recordPaint=now;
  text('simTime',solver.time.toFixed(3)+' s');text('simStatus',stopped?'Stopped':playing?'Running':'Paused');text('simToggle',playing?'Pause':'Play');
  $('scaleNote').textContent=$('scaleMode').value==='adaptive'?'Adaptive: colors rescale each frame; fading waves can still look strong.':'Fixed: the same color represents the same amplitude throughout the run.';
  $('velocityLegend').textContent=solver.vmin===solver.vmax?`Uniform velocity: ${solver.vmin.toFixed(0)} m/s (blue).`:`Velocity: blue ${solver.vmin.toFixed(0)} → ochre ${solver.vmax.toFixed(0)} m/s.`;
  $('velocityLegend').hidden=view==='wave';$('amplitudeColorbar').hidden=view==='velocity';$('scaleNote').hidden=view==='velocity';
  $('samplingInfo').textContent=`Grid ${c.nx} × ${c.nz} · Δx ${c.dx} m · Δz ${c.dz} m · Δt ${(c.dt*1000).toFixed(3)} ms · CFL ${solver.cfl.toFixed(3)}.`;
  $('xMid').textContent=`x · ${((c.nx-1)*c.dx/2).toFixed(0)} m`;$('xMax').textContent=(c.nx-1)*c.dx+' m';$('zMax').textContent=(c.nz-1)*c.dz+' m';$('zMid').textContent=((c.nz-1)*c.dz/2).toFixed(0)+' m';
  const max=drawRecord($('recordCanvas'),record);
  const recordedTime=Math.max(0,record.count-1)*c.dt;
  text('recordTimeMid',(recordedTime/2).toFixed(3));
  text('recordTimeEnd',recordedTime.toFixed(3));
  text('recordScaleLow',max?(-max).toExponential(2):'0');
  text('recordScaleHigh',max?max.toExponential(2):'0');
  $('recordColorbar').hidden=record.count<2;
  $('recordColorbar').setAttribute('aria-label',`Receiver amplitude: gold ${(-max).toExponential(2)}, zero dark, teal ${max.toExponential(2)} a.u.; adaptive scale`);
  $('recordCanvas').hidden=false;$('recordAxis').hidden=!points.length;
  $('recordLabel').textContent=points.length?`${points.length} receivers · ${record.count} sample${record.count===1?'':'s'} each · Δt ${(c.dt*1000).toFixed(3)} ms.`:'No receivers yet. Add a row in Configuration to record arrivals.';
  if(points.length&&record.count<2)$('recordLabel').textContent='Receivers ready. Press Play or Step once to begin the shot gather.';
  if(points.length>$('recordCanvas').width)$('recordLabel').textContent+=' Plot shows sampled columns; CSV includes every receiver.';
  const spacing=points.length>1?points[1].x-points[0].x:0;
  const regular=points.length>1&&spacing>0&&points.every((p,i)=>p.x===points[0].x+i*spacing&&p.z===points[0].z);
  $('recordAxis').textContent=regular?`Receiver x: ${points[0].x*c.dx}–${points.at(-1).x*c.dx} m · spacing ${spacing*c.dx} m`:`Receiver number: 1–${points.length} (placement order; coordinates in setup)`;
  text('timeLimitInfo',`Last complete time step: ${runPlan.endTime.toFixed(6)} s (${runPlan.steps} steps).`);
  $('downloadCSV').disabled=!points.length||record.count<2;drawSource();

  text('stabilityInfo',`${diagnostic.label} · CFL ${solver.cfl.toFixed(3)} / 1. ${c.boundary==='sponge'?'Sponge damping; outer p = 0.':'Reflecting outer edge: p = 0 (pressure sign reversal).'}`);
  $('stabilityInfo').dataset.unstable=String(solver.cfl>1);
  if(solver.cfl>1)$('stabilityInfo').textContent+=' CFL exceeds 1; numerical growth is expected.';
  bulletize();
}
$('setupForm').addEventListener('submit',e=>{e.preventDefault();safe(()=>{reset(readSetup());});});
$('sourceType').addEventListener('change',()=>{$('sourceAmplitude').value=$('sourceType').value==='ricker'?'.01':'1';sourceLabels();contextualControls();});
$('simToggle').onclick=()=>{playing=!playing;clock.reset();message(playing?'Running. Pause to inspect a moment.':'Paused. Play to continue or Step once.');draw();};
$('simStep').onclick=()=>safe(()=>{playing=false;clock.reset();step();if(!stopped)message(`Paused at ${solver.time.toFixed(3)} s. Play to continue.`);draw();});
$('simReset').onclick=()=>safe(()=>reset());
let validLimit=1;
for(const id of ['scaleMode','fixedLimit','showGrid','showSources','showReceivers','view'])$(id).addEventListener('change',()=>safe(()=>{if(id==='fixedLimit'){try{validLimit=number('fixedLimit');}catch(e){$('fixedLimit').value=validLimit;throw e;}}draw();}));
$('waveCanvas').addEventListener('click',e=>safe(()=>{
  if(dirty)throw Error('Apply your setup changes before interacting with the plot.');
  const r=e.currentTarget.getBoundingClientRect(),c=solver.config,x=Math.max(1,Math.min(c.nx-2,Math.round((e.clientX-r.left)/r.width*(c.nx-1)))),z=Math.max(1,Math.min(c.nz-2,Math.round((e.clientY-r.top)/r.height*(c.nz-1))));
  reset({...config,sourceX:x*c.dx,sourceZ:z*c.dz});
  draw();
}));
$('downloadCSV').onclick=()=>{const url=URL.createObjectURL(new Blob([record.csv()],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='acoustic-receivers.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
document.addEventListener('visibilitychange',()=>{last=0;clock.reset();});
for(const e of experiments){const option=document.createElement('option');option.value=e.id;option.textContent=e.title;$('experimentSelect').append(option);}
$('experimentSelect').onchange=()=>safe(()=>loadExperiment($('experimentSelect').value));
$('resetExperiment').onclick=()=>safe(()=>loadExperiment(activeExperiment));
sourceLabels();contextualControls();loadExperiment('propagation');
function frame(now){if(last&&playing&&!document.hidden){safe(()=>{const count=clock.advance((now-last)/1000,Number($('playback').value),solver.config.dt);for(let i=0;i<count&&playing;i++)step();if(now-lastPaint>=1000/30){draw(now);lastPaint=now;}});}last=now;animation=requestAnimationFrame(frame);}
let animation=requestAnimationFrame(frame);
addEventListener('pagehide',()=>{cancelAnimationFrame(animation);last=0;clock.reset();});
addEventListener('pageshow',e=>{if(e.persisted){cancelAnimationFrame(animation);animation=requestAnimationFrame(frame);}});

$('setupForm').addEventListener('input',()=>{dirty=true;playing=false;sourceLabels();contextualControls();receiverBounds();updatePending();text('simStatus','Paused');text('simToggle','Play');bulletize();});
$('receiverSpacing').addEventListener('input',receiverBounds);

function bulletize(){
  for(const el of document.querySelectorAll('#labShell p, #labShell [data-prose]')){
    if(el.firstElementChild?.tagName==='UL')continue;
    const sentences=el.textContent.trim().split(/(?<=[.!?])\s+(?=[A-ZΔ])/);
    if(sentences.length<2)continue;
    let target=el;
    if(el.tagName==='P'){target=document.createElement('div');for(const attr of el.attributes)target.setAttribute(attr.name,attr.value);el.replaceWith(target);}
    target.dataset.prose='true';const ul=document.createElement('ul');
    for(const sentence of sentences){const li=document.createElement('li');li.textContent=sentence+' ';ul.append(li);}
    target.replaceChildren(ul);
  }
}
