import {inspect} from './inspector.js';
import {diagnostics} from './diagnostics.js';
import {experiments,experimentSetup} from './experiments.js';
import {Solver} from './solver.js';
import {Renderer,drawRecord} from './renderer.js';
import {Clock} from './clock.js';
import {Receivers,receiverArray} from './receivers.js';
import {ricker} from './sources.js';
import {$,number,readSetup,sourceLabels} from './controls.js';
let config=readSetup(),solver,record,points=[],sourceMarkers=[],playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,last=0,selected=null,activeExperiment='propagation',comparison='';
const renderer=new Renderer($('waveCanvas')),clock=new Clock();
function message(text){$('labMessage').textContent=text;}
function safe(action){try{action();}catch(e){playing=false;message(e.message);if(solver)draw();}}
function source(s=solver,base=config,delayBase=0){
  const c=s.config,x=base.sourceX/c.dx,z=base.sourceZ/c.dz;
  if(base.sourceType==='ricker')s.addSource({x,z,amplitude:base.sourceAmplitude,frequency:base.frequency,start:delayBase+base.sourceDelay});
  else s.pulse(x,z,base.sourceAmplitude,base.sourceWidth/c.dx);
  sourceMarkers.push({x,z});
}
function reset(){
  const next=new Solver(config);
  if(config.sourceX<next.config.dx||config.sourceX>(next.config.nx-2)*next.config.dx||config.sourceZ<next.config.dz||config.sourceZ>(next.config.nz-2)*next.config.dz)throw Error('Source lies outside the interior domain. Adjust source coordinates for the new spacing.');
  sourceMarkers=[];source(next);solver=next;
  record=new Receivers(points,solver.config);record.sample(solver.curr);clock.reset();selected=null;comparison='';
  $('traceSelect').innerHTML='<option value="-1">Shot gather</option>';
  points.forEach((_,i)=>{const o=document.createElement('option');o.value=i;o.textContent='Receiver '+(i+1);$('traceSelect').append(o);});
  message('Run reset.');draw();
}
function step(){
  if(record.count>=record.capacity){playing=false;message('Recording limit reached (5000 time steps). Export the data or reset.');return;}
  solver.step();record.sample(solver.curr);
}
function drawSource(){
  const ctx=$('sourceCanvas').getContext('2d'),w=500,h=100;ctx.fillStyle='#0b1f2b';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#69c3b9';ctx.lineWidth=2;ctx.beginPath();
  for(let i=0;i<w;i++){const q=i/(w-1),value=config.sourceType==='ricker'?ricker(q*3/config.frequency,config.frequency,1.5/config.frequency):Math.exp(-.5*((q-.5)*8)**2);const y=h/2-value*40;if(i)ctx.lineTo(i,y);else ctx.moveTo(i,y);}ctx.stroke();
  $('sourcePlotLabel').textContent=config.sourceType==='ricker'?`Normalized Ricker waveform · time ${config.sourceDelay.toFixed(2)}–${(config.sourceDelay+3/config.frequency).toFixed(2)} s · frequency ${config.frequency} Hz`:`Normalized Gaussian spatial profile · −4σ to +4σ · σ = ${config.sourceWidth} m`;
}
function setMode(mode){
  $('labShell').dataset.mode=mode;
  document.querySelectorAll('.lab-modes button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  $('modeHelp').textContent={explore:'Explore: choose a guided experiment and watch the physics.',understand:'Understand: inspect cells, follow the discrete equation, and connect wavefields to recordings.',experiment:'Experiment: open Configure model & sources for numerical spacing, time step, and boundary controls.'}[mode];
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
function draw(){
  const limit=Number($('fixedLimit').value),view=$('view').value,c=solver.config;
  const range=renderer.draw(solver,{scale:$('scaleMode').value,limit,grid:$('showGrid').checked,view,sources:sourceMarkers,receivers:points,selected});
  $('scaleLow').textContent=(-range).toPrecision(3);$('scaleHigh').textContent=range.toPrecision(3);
  $('simTime').textContent=solver.time.toFixed(3)+' s';$('simStatus').textContent=playing?'Running':'Paused';$('simToggle').textContent=playing?'Pause':'Play';
  $('scaleNote').textContent=$('scaleMode').value==='adaptive'?'Adaptive: colors rescale each frame; fading waves can still look strong.':'Fixed: the same color represents the same amplitude throughout the run.';
  $('velocityLegend').textContent=`Velocity palette: blue ${solver.vmin.toFixed(0)} → ochre ${solver.vmax.toFixed(0)} m/s. White crosses: sources; pink squares: receivers.`;
  $('velocityLegend').hidden=view==='wave';
  $('samplingInfo').textContent=`Grid ${c.nx} × ${c.nz} · Δx ${c.dx} m · Δz ${c.dz} m · Δt ${(c.dt*1000).toFixed(3)} ms · CFL ${solver.cfl.toFixed(3)}. Playback never changes Δt.`;
  $('xMid').textContent=`x · ${((c.nx-1)*c.dx/2).toFixed(0)} m`;$('xMax').textContent=(c.nx-1)*c.dx+' m';$('zMax').textContent=(c.nz-1)*c.dz+' m';
  if(selected){const k=selected.z*c.nx+selected.x;$('pointInfo').textContent=`Cell (${selected.x}, ${selected.z}) · x=${selected.x*c.dx} m, z=${selected.z*c.dz} m · v=${solver.velocity[k]} m/s · p=${solver.curr[k].toExponential(3)} a.u.`;}
  else $('pointInfo').textContent='Choose Inspect cell and tap the wavefield to read its velocity and amplitude.';
  const channel=Number($('traceSelect').value),max=drawRecord($('recordCanvas'),record,channel);
  $('recordLabel').textContent=points.length?`${record.count} samples/channel · Δt ${c.dt} s · ${channel<0?'Horizontal: receiver index 1–'+points.length+' (left to right); vertical: time 0–'+solver.time.toFixed(3)+' s (down).':'Horizontal: time 0–'+solver.time.toFixed(3)+' s; vertical: signed amplitude.'} Color/trace range ±${max.toExponential(2)} a.u. (adaptive).`:'No receivers yet. Add an array or select Add receiver and tap the model.';
  $('downloadCSV').disabled=!points.length;drawSource();
  const diagnostic=diagnostics(solver,config);
  $('stabilityInfo').textContent=`${diagnostic.label} · CFL ${solver.cfl.toFixed(3)} / 1 · ${c.autoDt?'Automatic Δt (CFL 0.6)':'Manual Δt'}. ${c.boundary==='sponge'?'Sponge damping; outer p = 0.':'Reflecting outer edge: p = 0 (pressure sign reversal).'}`;
  $('dispersionInfo').textContent=`${config.sourceType==='ricker'?'Ricker 1%-of-peak upper spectral frequency':'Gaussian conservative 1% spatial-spectrum equivalent frequency'}: ${diagnostic.fmax.toFixed(2)} Hz; λmin ${diagnostic.wavelength.toFixed(1)} m; ${diagnostic.ppw.toFixed(1)} points/wavelength. ${diagnostic.ppw<10?'Coarse sampling: significant numerical dispersion is likely.':'Sampling is at least 10 points/wavelength; this is guidance, not a guarantee.'} ${diagnostic.phaseError===null?'Upper bandwidth is beyond a resolvable grid direction.':'Stencil phase-speed error at this bandwidth: up to '+diagnostic.phaseError.toFixed(1)+'% at vmin over 0°, 45°, 90°.'}`;
  renderInspector();
}
$('setupForm').addEventListener('submit',e=>{e.preventDefault();safe(()=>{const next=readSetup();new Solver(next);config=next;reset();});});
$('sourceType').addEventListener('change',()=>{$('sourceAmplitude').value=$('sourceType').value==='ricker'?'.01':'1';sourceLabels();});
$('simToggle').onclick=()=>{playing=!playing;clock.reset();draw();};
$('simStep').onclick=()=>safe(()=>{playing=false;clock.reset();step();draw();});
$('simReset').onclick=()=>safe(reset);
$('simPulse').onclick=()=>safe(()=>{if(sourceMarkers.length>=16)throw Error('Reset before adding more than 16 sources.');source(solver,config,solver.time);if(config.sourceType==='gaussian'){for(let i=0;i<record.points.length;i++){const p=record.points[i];record.traces[i][record.count-1]=solver.curr[p.z*solver.config.nx+p.x];}}draw();});
for(const id of ['scaleMode','fixedLimit','showGrid','view','traceSelect'])$(id).addEventListener('change',()=>safe(draw));
$('addArray').onclick=()=>safe(()=>{const c=solver.config;points=receiverArray(c,number('receiverCount'),number('receiverSpacing')/c.dx,number('receiverDepth')/c.dz);reset();});
$('clearReceivers').onclick=()=>safe(()=>{points=[];reset();});
$('waveCanvas').addEventListener('click',e=>safe(()=>{
  const r=e.currentTarget.getBoundingClientRect(),c=solver.config,x=Math.max(1,Math.min(c.nx-2,Math.round((e.clientX-r.left)/r.width*(c.nx-1)))),z=Math.max(1,Math.min(c.nz-2,Math.round((e.clientY-r.top)/r.height*(c.nz-1))));
  if($('clickAction').value==='receiver'){if(points.length>=24)throw Error('Maximum 24 receivers.');points.push({x,z});reset();}
  else if($('clickAction').value==='inspect'){playing=false;selected={x,z};comparison='';}
  else{config.sourceX=x*c.dx;config.sourceZ=z*c.dz;$('sourceX').value=config.sourceX;$('sourceZ').value=config.sourceZ;$('simPulse').click();}
  draw();
}));
$('downloadCSV').onclick=()=>{const url=URL.createObjectURL(new Blob([record.csv()],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='acoustic-receivers.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
document.addEventListener('visibilitychange',()=>{last=0;clock.reset();});
for(const e of experiments){const option=document.createElement('option');option.value=e.id;option.textContent=e.title;$('experimentSelect').append(option);}
document.querySelectorAll('.lab-modes button').forEach(b=>b.onclick=()=>{setMode(b.dataset.mode);draw();});
$('loadExperiment').onclick=()=>safe(()=>loadExperiment($('experimentSelect').value));
$('resetExperiment').onclick=()=>safe(()=>loadExperiment(activeExperiment));
$('autoDt').onchange=()=>{$('dtMs').disabled=$('autoDt').checked;};
$('inspectCell').onclick=()=>safe(()=>{playing=false;selected={x:number('inspectX'),z:number('inspectZ')};inspect(solver,selected.x,selected.z);comparison='';draw();});
$('predictStep').onclick=()=>safe(()=>{playing=false;if(record.count>=record.capacity)throw Error('Reset before another step.');if(!selected)selected={x:number('inspectX'),z:number('inspectZ')};const before=inspect(solver,selected.x,selected.z);step();const actual=solver.curr[before.k];comparison=`Prediction from t=${before.time.toFixed(6)} s: ${before.predicted.toExponential(8)}; actual stored result: ${actual.toExponential(8)}; absolute difference: ${Math.abs(actual-before.predicted).toExponential(2)}.`;draw();});
sourceLabels();$('dtMs').disabled=$('autoDt').checked;showExperiment();reset();
function frame(now){if(last&&playing&&!document.hidden){safe(()=>{const count=clock.advance((now-last)/1000,Number($('playback').value),solver.config.dt);for(let i=0;i<count&&playing;i++)step();draw();});}last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);
