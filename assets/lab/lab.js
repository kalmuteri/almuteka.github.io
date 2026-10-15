import {inspect} from './inspector.js';
import {diagnostics} from './diagnostics.js';
import {experiments,experimentSetup} from './experiments.js';
import {prepareRun} from './run.js?v=20261015-ux';
import {Renderer,drawRecord} from './renderer.js?v=20261015-ux';
import {Clock} from './clock.js';
import {receiverArray} from './receivers.js?v=20261015-ux';
import {ricker} from './sources.js';
import {$,number,readSetup,sourceLabels} from './controls.js';
let diagnostic,sourcePlotKey='',lastPaint=0,recordPaint=0;
let config=readSetup(),solver,record,points=[],sourceMarkers=[],playing=false,last=0,selected=null,activeExperiment='propagation',comparison='';
const renderer=new Renderer($('waveCanvas')),clock=new Clock();
function text(id,value){const el=$(id);if(el.textContent!==value)el.textContent=value;}
function message(value){text('labMessage',value);}
function safe(action){try{action();}catch(e){playing=false;message(e.message);if(solver)draw();}}
function source(s=solver,base=config,delayBase=0){
  const c=s.config,x=base.sourceX/c.dx,z=base.sourceZ/c.dz;
  if(base.sourceType==='ricker')s.addSource({x,z,amplitude:base.sourceAmplitude,frequency:base.frequency,start:delayBase+base.sourceDelay});
  else s.pulse(x,z,base.sourceAmplitude,base.sourceWidth/c.dx);
  sourceMarkers.push({x,z});
}
function reset(nextConfig=config,nextPoints=points){
  const candidate=prepareRun(nextConfig,nextPoints);
  config={...nextConfig};solver=candidate.solver;record=candidate.record;
  points=record.points;sourceMarkers=candidate.markers;
  $('waveCanvas').style.aspectRatio=((solver.config.nx-1)*solver.config.dx)/((solver.config.nz-1)*solver.config.dz);
  diagnostic=diagnostics(solver,config);sourcePlotKey='';recordPaint=0;
  clock.reset();selected=null;comparison='';
  const c=solver.config;
  $('receiverCount').max=c.nx;
  $('receiverSpacing').min=c.dx;$('receiverSpacing').step=c.dx;
  $('receiverSpacing').value=Math.max(1,Math.round(Number($('receiverSpacing').value)/c.dx))*c.dx;
  $('receiverDepth').min=0;$('receiverDepth').max=(c.nz-1)*c.dz;$('receiverDepth').step=c.dz;
  $('receiverX').min=0;$('receiverX').max=(c.nx-1)*c.dx;
  $('receiverZ').min=0;$('receiverZ').max=(c.nz-1)*c.dz;
  $('receiverLimits').textContent=`Up to ${c.nx} receivers per horizontal array; minimum spacing Δx = ${c.dx} m. One receiver per cell, up to ${c.nx*c.nz} across the model. Current recording capacity: ${record.capacity} samples per receiver.`;
  $('receiverCoordinates').textContent=points.slice(0,180).map((p,i)=>`R${i+1}: x=${p.x*c.dx} m, z=${p.z*c.dz} m`).join(' · ')+(points.length>180?' · More coordinates available in CSV.':'')||'No receivers.';
  playing=false;
  message('Ready. Press Play to run, or Step to advance once.');draw();
}
function step(){
  if(record.count>=record.capacity){playing=false;message(`Recording limit reached (${record.capacity} samples). Export the data or reset.`);return;}
  solver.step();record.sample(solver.curr);
}
function drawSource(){
  const key=JSON.stringify([config.sourceType,config.frequency,config.sourceDelay,config.sourceWidth]);
  if(key===sourcePlotKey)return;sourcePlotKey=key;
  const ctx=$('sourceCanvas').getContext('2d'),w=500,h=100;ctx.fillStyle='#0b1f2b';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#69c3b9';ctx.lineWidth=2;ctx.beginPath();
  for(let i=0;i<w;i++){const q=i/(w-1),value=config.sourceType==='ricker'?ricker(q*3/config.frequency,config.frequency,1.5/config.frequency):Math.exp(-.5*((q-.5)*8)**2);const y=h/2-value*40;if(i)ctx.lineTo(i,y);else ctx.moveTo(i,y);}ctx.stroke();
  $('sourcePlotLabel').textContent=config.sourceType==='ricker'?`Normalized Ricker waveform · time ${config.sourceDelay.toFixed(2)}–${(config.sourceDelay+3/config.frequency).toFixed(2)} s · frequency ${config.frequency} Hz`:`Normalized Gaussian spatial profile · −4σ to +4σ · σ = ${config.sourceWidth} m`;
}
function setMode(mode){
  if(mode==='explore'){$('clickAction').value='source';selected=null;}
  document.querySelector('.setup-details').open=mode==='experiment';
  $('labShell').dataset.mode=mode;
  document.querySelectorAll('.lab-modes button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  $('modeHelp').textContent={explore:'Explore: model and source controls only. Choose an experiment, then press Play. Switch to Understand to reveal receivers, recordings and the stencil.',understand:'Understand: receiver configuration, shot gathers, sampling diagnostics and the stencil inspector are now visible. Numerical settings stay hidden.',experiment:'Experiment: all learning tools plus editable grid spacing, time step and boundaries. Configure model & sources is open below.'}[mode];
}
function showExperiment(){const e=experiments.find(e=>e.id===activeExperiment);$('experimentTitle').textContent=e.title;$('experimentObjective').textContent=e.objective;$('experimentPredict').textContent='Predict: '+e.predict;$('experimentObserve').textContent='Observe: '+e.observe;$('experimentExplain').textContent='Explain: '+e.explain;$('experimentChallenge').textContent='Challenge: '+e.challenge;}
function loadExperiment(id){
  const e=experiments.find(e=>e.id===id);config=experimentSetup(id);activeExperiment=id;
  for(const [key,value] of Object.entries(config)){const el=$(key);if(el){if(el.type==='checkbox')el.checked=value;else el.value=value;}}
  $('dtMs').value=config.dt*1000;$('dtMs').disabled=config.autoDt;$('experimentSelect').value=id;
  points=e.receivers?receiverArray({nx:180,nz:116},12,10,20):[];
  $('view').value=['layers','slow','fast','inclined'].includes(config.model)?'overlay':'wave';
  $('scaleMode').value=config.sourceType==='ricker'?'adaptive':'fixed';$('fixedLimit').value=1;
  sourceLabels();setMode(e.mode);showExperiment();playing=false;reset();
  if(id==='stencil'){selected={x:Math.round(config.sourceX/solver.config.dx),z:Math.round(config.sourceZ/solver.config.dz)};draw();}
}
function renderInspector(){
  if(!selected){$('inspectorValues').textContent='Select a cell to inspect its numerical update.';$('stencilGrid').replaceChildren();$('inspectorComparison').textContent='';return;}
  const d=inspect(solver,selected.x,selected.z),fmt=x=>x.toExponential(6);
  $('inspectX').value=d.x;$('inspectZ').value=d.z;
  const grid=$('stencilGrid');grid.replaceChildren();
  for(const [name,value] of [['Up',d.up],['Left',d.left],['Center',d.p],['Right',d.right],['Down',d.down]]){const el=document.createElement('span');el.textContent=name+': '+fmt(value);grid.append(el);}
  $('inspectorValues').textContent=`At t=${d.time.toFixed(6)} s | v=${d.velocity} m/s | Previous=${fmt(d.previous)} | Laplacian=${fmt(d.lap)} a.u./m² | Source=${fmt(d.force)} a.u./m² | 2p−previous=${fmt(d.memory)} | Spatial term=${fmt(d.spatial)} | Forcing term=${fmt(d.forcing)} | Undamped PDE=${fmt(d.undamped)} | σΔt=${fmt(d.q)} | Damped update=${fmt(d.damped)} | Stored Float32 prediction=${fmt(d.predicted)}`;
  $('inspectorComparison').textContent=comparison;
}
function draw(now=0){
  const limit=Number($('fixedLimit').value),view=$('view').value,c=solver.config;
  const range=renderer.draw(solver,{scale:$('scaleMode').value,limit,grid:$('showGrid').checked,view,sources:$('showSources').checked?sourceMarkers:[],receivers:$('labShell').dataset.mode!=='explore'&&$('showReceivers').checked?points:[],selected});
  text('scaleLow',(-range).toPrecision(3));text('scaleHigh',range.toPrecision(3));
  if(now&&now-recordPaint<100)return;recordPaint=now;
  text('simTime',solver.time.toFixed(3)+' s');text('simStatus',playing?'Running':'Paused');text('simToggle',playing?'Pause':'Play');
  $('scaleNote').textContent=$('scaleMode').value==='adaptive'?'Adaptive: colors rescale each frame; fading waves can still look strong.':'Fixed: the same color represents the same amplitude throughout the run.';
  $('velocityLegend').textContent=`Velocity palette: blue ${solver.vmin.toFixed(0)} → ochre ${solver.vmax.toFixed(0)} m/s. White crosses: sources; pink squares: receivers.`;
  $('velocityLegend').hidden=view==='wave';$('amplitudeColorbar').hidden=view==='velocity';$('scaleNote').hidden=view==='velocity';
  $('samplingInfo').textContent=`Grid ${c.nx} × ${c.nz} · Δx ${c.dx} m · Δz ${c.dz} m · Δt ${(c.dt*1000).toFixed(3)} ms · CFL ${solver.cfl.toFixed(3)}. Playback never changes Δt.`;
  $('xMid').textContent=`x · ${((c.nx-1)*c.dx/2).toFixed(0)} m`;$('xMax').textContent=(c.nx-1)*c.dx+' m';$('zMax').textContent=(c.nz-1)*c.dz+' m';$('zMid').textContent=((c.nz-1)*c.dz/2).toFixed(0)+' m';
  if(selected){const k=selected.z*c.nx+selected.x;$('pointInfo').textContent=`Cell (${selected.x}, ${selected.z}) · x=${selected.x*c.dx} m, z=${selected.z*c.dz} m · v=${solver.velocity[k]} m/s · p=${solver.curr[k].toExponential(3)} a.u.`;}
  else $('pointInfo').textContent='Choose Inspect cell and tap the wavefield to read its velocity and amplitude.';
  const channel=-1,max=$('labShell').dataset.mode==='explore'?0:drawRecord($('recordCanvas'),record);
  $('recordLabel').textContent=points.length?`${record.count} samples/channel · Δt ${(c.dt*1000).toFixed(3)} ms · ${channel<0?'Horizontal: receiver index 1–'+points.length+' (left to right); vertical: time 0–'+solver.time.toFixed(3)+' s (down).':'Horizontal: time 0–'+solver.time.toFixed(3)+' s; vertical: signed amplitude.'} Color/trace range ±${max.toExponential(2)} a.u. (adaptive).`:'No receivers yet. Add an array or select Add receiver and tap the model.';
  if(channel<0&&points.length>1) $('recordLabel').textContent+=` Receiver x: ${points[0].x*c.dx}–${points.at(-1).x*c.dx} m; coordinates listed in Configure model & sources. Positive amplitudes are teal; negative amplitudes are gold.`;
  if(points.length>$('recordCanvas').width)$('recordLabel').textContent+=' Display samples receiver columns to fit the plot; CSV contains every receiver.';
  const spacing=points.length>1?points[1].x-points[0].x:0;
  const regular=points.length>1&&spacing>0&&points.every((p,i)=>p.x===points[0].x+i*spacing&&p.z===points[0].z);
  $('recordAxis').textContent=channel>=0?`Time (s): 0 → ${solver.time.toFixed(3)}`:regular?`Receiver x (m): ${points[0].x*c.dx} → ${points.at(-1).x*c.dx} · spacing ${spacing*c.dx} m`:'Receiver index (coordinates listed above)';
  $('downloadCSV').disabled=!points.length;drawSource();

  text('stabilityInfo',`${diagnostic.label} · CFL ${solver.cfl.toFixed(3)} / 1 · ${c.autoDt?'Automatic Δt (CFL 0.6)':'Manual Δt'}. ${c.boundary==='sponge'?'Sponge damping; outer p = 0.':'Reflecting outer edge: p = 0 (pressure sign reversal).'}`);
  $('dispersionInfo').textContent=`${config.sourceType==='ricker'?'Ricker 1%-of-peak upper spectral frequency':'Gaussian conservative 1% spatial-spectrum equivalent frequency'}: ${diagnostic.fmax.toFixed(2)} Hz; λmin ${diagnostic.wavelength.toFixed(1)} m; ${diagnostic.ppw.toFixed(1)} points/wavelength. ${diagnostic.ppw<10?'Coarse sampling: inspect dispersion estimates and compare a finer grid.':'Sampling is at least 10 points/wavelength; this is guidance, not a guarantee.'} ${diagnostic.phaseError===null?'Upper bandwidth is beyond a resolvable grid direction.':'Stencil phase-speed error at this bandwidth: up to '+diagnostic.phaseError.toFixed(1)+'% at vmin over 0°, 45°, 90°.'}`;
  if($('labShell').dataset.mode!=='explore')renderInspector();
}
$('setupForm').addEventListener('submit',e=>{e.preventDefault();safe(()=>{reset(readSetup());});});
$('sourceType').addEventListener('change',()=>{$('sourceAmplitude').value=$('sourceType').value==='ricker'?'.01':'1';sourceLabels();});
$('simToggle').onclick=()=>{playing=!playing;clock.reset();draw();};
$('simStep').onclick=()=>safe(()=>{playing=false;clock.reset();step();draw();});
$('simReset').onclick=()=>safe(reset);
$('simPulse').onclick=()=>safe(()=>{if(sourceMarkers.length>=16)throw Error('Reset before adding more than 16 sources.');source(solver,config,solver.time);if(config.sourceType==='gaussian'){for(let i=0;i<record.points.length;i++){const p=record.points[i];record.traces[i][record.count-1]=solver.curr[p.z*solver.config.nx+p.x];}}draw();});
let validLimit=1;
for(const id of ['scaleMode','fixedLimit','showGrid','showSources','showReceivers','view'])$(id).addEventListener('change',()=>safe(()=>{if(id==='fixedLimit'){try{validLimit=number('fixedLimit');}catch(e){$('fixedLimit').value=validLimit;throw e;}}draw();}));
$('addArray').onclick=()=>safe(()=>{const c=solver.config;reset(config,receiverArray(c,number('receiverCount'),number('receiverSpacing')/c.dx,number('receiverDepth')/c.dz));});
$('clearReceivers').onclick=()=>safe(()=>{reset(config,[]);});
$('waveCanvas').addEventListener('click',e=>safe(()=>{
  const r=e.currentTarget.getBoundingClientRect(),c=solver.config,x=Math.max(1,Math.min(c.nx-2,Math.round((e.clientX-r.left)/r.width*(c.nx-1)))),z=Math.max(1,Math.min(c.nz-2,Math.round((e.clientY-r.top)/r.height*(c.nz-1))));
  if($('clickAction').value==='receiver'){reset(config,[...points,{x,z}]);}
  else if($('clickAction').value==='inspect'){playing=false;selected={x,z};comparison='';}
  else{config.sourceX=x*c.dx;config.sourceZ=z*c.dz;$('sourceX').value=config.sourceX;$('sourceZ').value=config.sourceZ;$('simPulse').click();}
  draw();
}));
$('addReceiver').onclick=()=>safe(()=>{const c=solver.config;reset(config,[...points,{x:number('receiverX')/c.dx,z:number('receiverZ')/c.dz}]);});
$('removeReceiver').onclick=()=>safe(()=>{const c=solver.config,x=Math.round(number('receiverX')/c.dx),z=Math.round(number('receiverZ')/c.dz);if(!points.some(p=>p.x===x&&p.z===z))throw Error('No receiver at these coordinates.');reset(config,points.filter(p=>p.x!==x||p.z!==z));});
$('downloadCSV').onclick=()=>{const url=URL.createObjectURL(new Blob([record.csv()],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='acoustic-receivers.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
document.addEventListener('visibilitychange',()=>{last=0;clock.reset();});
for(const e of experiments){const option=document.createElement('option');option.value=e.id;option.textContent=e.title;$('experimentSelect').append(option);}
document.querySelectorAll('.lab-modes button').forEach(b=>b.onclick=()=>{setMode(b.dataset.mode);draw();});
$('loadExperiment').onclick=()=>safe(()=>loadExperiment($('experimentSelect').value));
$('resetExperiment').onclick=()=>safe(()=>loadExperiment(activeExperiment));
$('autoDt').onchange=()=>{$('dtMs').disabled=$('autoDt').checked;};
$('inspectCell').onclick=()=>safe(()=>{playing=false;const candidate={x:number('inspectX'),z:number('inspectZ')};inspect(solver,candidate.x,candidate.z);selected=candidate;comparison='';draw();});
$('predictStep').onclick=()=>safe(()=>{playing=false;if(record.count>=record.capacity)throw Error('Reset before another step.');const candidate=selected||{x:number('inspectX'),z:number('inspectZ')};const before=inspect(solver,candidate.x,candidate.z);selected=candidate;step();const actual=solver.curr[before.k];comparison=`Prediction from t=${before.time.toFixed(6)} s: ${before.predicted.toExponential(8)}; actual stored result: ${actual.toExponential(8)}; absolute difference: ${Math.abs(actual-before.predicted).toExponential(2)}.`;draw();});
sourceLabels();$('dtMs').disabled=$('autoDt').checked;setMode('explore');showExperiment();reset();
function frame(now){if(last&&playing&&!document.hidden){safe(()=>{const count=clock.advance((now-last)/1000,Number($('playback').value),solver.config.dt);for(let i=0;i<count&&playing;i++)step();if(now-lastPaint>=1000/30){draw(now);lastPaint=now;}});}last=now;animation=requestAnimationFrame(frame);}
let animation=requestAnimationFrame(frame);
addEventListener('pagehide',()=>{cancelAnimationFrame(animation);last=0;clock.reset();});
addEventListener('pageshow',e=>{if(e.persisted){cancelAnimationFrame(animation);animation=requestAnimationFrame(frame);}});
