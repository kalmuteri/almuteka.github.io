import test from 'node:test';
import assert from 'node:assert/strict';
import {Solver,laplacian,cfl} from '../assets/lab/solver.js';
import {amplitudeRange,color} from '../assets/lab/renderer.js';
import {Clock} from '../assets/lab/clock.js';
const near=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol,`${a} ≠ ${b}, tolerance ${tol}`);
test('Laplacian reproduces a quadratic with unequal spacings',()=>{
 const nx=20,dx=3,dz=7,p=new Float32Array(400);
 for(let z=0;z<20;z++)for(let x=0;x<20;x++)p[z*nx+x]=(x*dx)**2+3*(z*dz)**2;
 near(laplacian(p,210,nx,dx,dz),8);
});
test('constant field preserved away from Dirichlet edges; buffers rotate, time advances',()=>{
 const s=new Solver({nx:20,nz:20,boundary:'reflecting'});s.curr.fill(2);s.prev.fill(2);
 const before=s.curr,old=s.prev,target=s.next;s.step();near(s.curr[210],2);
 assert.equal(s.prev,before);assert.equal(s.curr,target);assert.equal(s.next,old);near(s.time,.002);s.reset();assert.equal(s.time,0);assert.equal(s.measure(),0);
});
test('zero field stays zero',()=>{const s=new Solver();for(let n=0;n<20;n++)s.step();assert.equal(s.measure(),0);});
test('CFL uses vmax and both spacings; invalid inputs rejected',()=>{
 near(cfl(1500,.002,10,20),.3354101966);assert.throws(()=>new Solver({dt:.1}),/Unstable/);assert.throws(()=>new Solver({dx:0}),/positive/);
});
test('Gaussian startup produces second-order zero-velocity first step',()=>{
 const s=new Solver({boundary:'reflecting'});s.pulse(90,58);const k=58*180+90;
 const expected=s.curr[k]+.5*1500**2*.002**2*laplacian(s.curr,k,180,10,10);s.step();near(s.curr[k],expected,2e-7);
});
test('stable Gaussian evolution remains finite and symmetric',()=>{
 const s=new Solver({nx:101,nz:101,boundary:'reflecting'});s.pulse(50,50);
 for(let n=0;n<150;n++)s.step();assert.ok(Number.isFinite(s.measure())&&s.maxAmplitude<2);
 for(let d=1;d<40;d++)near(s.curr[50*101+50+d],s.curr[(50+d)*101+50],1e-6);
});
test('one update agrees with direct undamped stencil',()=>{
 const s=new Solver({nx:20,nz:20,dx:10,dz:20,boundary:'reflecting'}),k=210;
 s.curr[k]=1;s.prev[k]=.8;s.curr[k+1]=.5;s.curr[k-20]=.2;
 const expected=2*s.curr[k]-s.prev[k]+1500**2*.002**2*((s.curr[k-1]-2*s.curr[k]+s.curr[k+1])/100+(s.curr[k-20]-2*s.curr[k]+s.curr[k+20])/400);
 s.step();near(s.curr[k],expected,1e-7);
});
test('fixed/adaptive scales and signed colors',()=>{
 const p=new Float32Array([0,-3,2]);near(amplitudeRange(p,'fixed',2),2);near(amplitudeRange(p,'adaptive'),3);assert.ok(amplitudeRange(new Float32Array(4),'adaptive')>0);
 assert.deepEqual(color(0,1),[11,31,43]);assert.ok(color(-1,1)[0]>color(1,1)[0]);assert.ok(color(1,1)[1]>color(-1,1)[1]);
});
test('playback integrates physical time independently of refresh rate',()=>{
 const a=new Clock(),b=new Clock();let n=0,m=0;
 for(let i=0;i<60;i++)n+=a.advance(1/60,.5,.002);for(let i=0;i<120;i++)m+=b.advance(1/120,.5,.002);
 assert.equal(n,250);assert.equal(m,250);assert.ok(a.advance(60,1,.002)<=32);
});
import {makeModel} from '../assets/lab/models.js';
import {ricker} from '../assets/lab/sources.js';
import {Receivers,receiverArray} from '../assets/lab/receivers.js';
test('layered and anomaly velocities are assigned at the correct cells',()=>{
 const c={nx:100,nz:80,dx:10,dz:10,velocity:1500,lowerVelocity:2500,interfaceDepth:400};
 const layered=makeModel({...c,model:'layers'});assert.equal(layered[39*100+20],1500);assert.equal(layered[40*100+20],2500);
 assert.equal(makeModel({...c,model:'slow'})[44*100+60],975);assert.equal(makeModel({...c,model:'fast'})[44*100+60],2250);
 const s=new Solver({...c,model:'fast'});near(s.cfl,cfl(2250,.002,10,10));
});
test('Ricker source follows normalized PDE injection exactly',()=>{
 near(ricker(.125,12,.125),1);const s=new Solver({nx:30,nz:30,boundary:'reflecting'});
 const source=s.addSource({x:15,z:15,frequency:12,amplitude:.01,start:0});s.steps=50;
 const expected=1500**2*.002**2*ricker(.1,12,source.peakTime,.01);s.step();near(s.curr[15*30+15],expected,1e-8);near(s.curr[15*30+16],0);
});
test('source activation is not advanced by render calls; reset removes events',()=>{
 const s=new Solver();s.addSource({x:50,z:30,start:.2,frequency:10});for(let i=0;i<50;i++)s.step();near(s.measure(),0);s.reset();assert.equal(s.sources.length,0);
});
test('receiver sampling is once per numerical step, including initial time; CSV matches',()=>{
 const s=new Solver({nx:30,nz:30});const r=new Receivers([{x:15,z:15}],s.config,5);s.pulse(15,15);r.sample(s.curr);
 for(let i=0;i<4;i++){s.step();r.sample(s.curr);}assert.equal(r.count,5);assert.equal(r.sample(s.curr),false);near(r.traces[0][4],s.curr[465]);
 assert.ok(r.csv().includes('0.008,1,150,150,0.002,'));assert.equal(r.csv().split('\n').length,6);
 assert.throws(()=>receiverArray(s.config,20,20,5),/does not fit/);
});
test('discrete standing mode follows analytic propagation speed (under 1% error)',()=>{
 for(const velocity of [1000,2000]){
 const s=new Solver({nx:81,nz:81,dx:10,dz:10,dt:.001,velocity,boundary:'reflecting'}),c=s.config;
 const omega=velocity*Math.PI*Math.SQRT2/800;
 for(let z=1;z<80;z++)for(let x=1;x<80;x++){const k=z*81+x,p=Math.sin(Math.PI*x/80)*Math.sin(Math.PI*z/80);s.curr[k]=p;s.prev[k]=p*Math.cos(omega*c.dt);}
 for(let n=0;n<100;n++)s.step();near(s.curr[40*81+40],Math.cos(omega*.1),.002);
 }
});
test('two-layer model produces reflected and transmitted energy',()=>{
 const base={nx:101,nz:141,dx:10,dz:10,dt:.001,boundary:'sponge',spongeWidth:10,interfaceDepth:700};
 const a=new Solver({...base,model:'homogeneous'}),b=new Solver({...base,model:'layers',lowerVelocity:2500});a.pulse(50,45,1,4);b.pulse(50,45,1,4);
 let reflected=0,transmitted=0;
 for(let n=0;n<500;n++){a.step();b.step();if(n>280)reflected=Math.max(reflected,Math.abs(b.curr[45*101+50]-a.curr[45*101+50]));transmitted=Math.max(transmitted,Math.abs(b.curr[90*101+50]));}
 assert.ok(reflected>.005,`reflection ${reflected}`);assert.ok(transmitted>.01,`transmission ${transmitted}`);
});
import {inspect} from '../assets/lab/inspector.js';
import {diagnostics,rickerBandwidth,phaseRatio} from '../assets/lab/diagnostics.js';
import {experiments,experimentSetup} from '../assets/lab/experiments.js';
test('inspector exactly predicts Float32 engine updates including damping and multiple forces',()=>{
 const s=new Solver({nx:40,nz:40,model:'layers',interfaceDepth:150,lowerVelocity:2500});s.pulse(10,10);
 s.addSource({x:4,z:4,frequency:20,start:0,amplitude:.1});s.addSource({x:4,z:4,frequency:12,start:0,amplitude:.03});
 for(let n=0;n<50;n++)s.step();
 const a=inspect(s,4,4),b=inspect(s,20,20);assert.ok(a.q>0);assert.notEqual(a.undamped,a.damped);s.step();assert.equal(s.curr[a.k],a.predicted);assert.equal(s.curr[b.k],b.predicted);
});
test('Ricker bandwidth is 1% of spectral peak; stencil dispersion tends to continuum limit',()=>{
 const x=rickerBandwidth(12)/12;near(x*x*Math.exp(1-x*x),.01,1e-12);assert.ok(x>2.7&&x<2.8);
 near(phaseRatio(1500,.01,10,10,.002),1,1e-7);assert.equal(phaseRatio(1500,100,10,10,.002),null);
 const s=new Solver();assert.ok(diagnostics(s,{sourceType:'ricker',frequency:40}).ppw<10);
});
test('every guided setup constructs a stable reproducible solver',()=>{
 for(const e of experiments){const c=experimentSetup(e.id),a=new Solver(c),b=new Solver(c);assert.ok(a.cfl<=1);assert.equal(a.config.dt,b.config.dt);assert.deepEqual(a.velocity,b.velocity);}
});
test('sponge reduces late returning energy relative to reflecting boundaries',()=>{
 const options={nx:81,nz:81,dt:.002,spongeWidth:16,spongeStrength:100};
 const a=new Solver({...options,boundary:'reflecting'}),b=new Solver({...options,boundary:'sponge'});a.pulse(40,40);b.pulse(40,40);
 for(let n=0;n<450;n++){a.step();b.step();}
 const energy=s=>s.curr.reduce((sum,p)=>sum+p*p,0);assert.ok(energy(b)<energy(a)*.3,`${energy(b)} / ${energy(a)}`);
});
import {prepareRun} from '../assets/lab/run.js';
test('invalid replacement run leaves the prior solver and recording untouched',()=>{
 const c=experimentSetup('interface'),original=prepareRun(c,[{x:50,z:20}]);original.solver.step();original.record.sample(original.solver.curr);
 const saved=original.solver.curr.slice();
 assert.throws(()=>prepareRun({...c,sourceX:99999}),/outside/);
 assert.throws(()=>prepareRun(c,[{x:NaN,z:20}]),/inside/);
 assert.throws(()=>prepareRun({...c,boundary:'unknown'}),/boundary/);
 assert.throws(()=>prepareRun({...c,spongeStrength:-1}),/boundary/);
 assert.throws(()=>receiverArray(original.solver.config,0,10,20),/Invalid/);
 assert.equal(original.record.count,2);assert.deepEqual(original.solver.curr,saved);
});
test('direct Gaussian peak agrees with travel time; slow and fast anomalies delay and advance it',()=>{
 const arrival={};
 for(const model of ['homogeneous','slow','fast']){
  const s=new Solver({nx:180,nz:180,dt:.001,model});s.pulse(30,99,1,3);let peak=0;
  for(let n=0;n<1100;n++){s.step();const a=Math.abs(s.curr[99*180+150]);if(a>peak){peak=a;arrival[model]=s.time;}}
 }
 // Finite-width pulses are not impulses: allow 30 ms about 1200 m / 1500 m/s.
 near(arrival.homogeneous,.8,.03);
 assert.ok(arrival.slow>arrival.homogeneous+.1);assert.ok(arrival.fast<arrival.homogeneous-.05);
});
test('all presets run finite and reset reproducibly with their actual source',()=>{
 for(const e of experiments){const c=experimentSetup(e.id),a=prepareRun(c).solver,b=prepareRun(c).solver;
  for(let n=0;n<80;n++){a.step();b.step();}
  assert.deepEqual(a.curr,b.curr);assert.ok(Number.isFinite(a.measure()));
 }
});
test('receiver limits follow grid cells, spacing and unique occupancy',()=>{
 const c={nx:180,nz:116,dx:10,dz:10,dt:.002};
 const row=receiverArray(c,180,1,20);assert.equal(row.length,180);assert.equal(row[0].x,0);assert.equal(row[179].x,179);
 assert.throws(()=>receiverArray(c,181,1,20),/Invalid/);assert.throws(()=>receiverArray(c,10,.5,20),/Invalid/);
 assert.throws(()=>new Receivers([{x:1,z:1},{x:1,z:1}],c),/already/);
 const all=Array.from({length:c.nx*c.nz},(_,k)=>({x:k%c.nx,z:Math.floor(k/c.nx)}));
 const recording=new Receivers(all,c);assert.equal(recording.points.length,c.nx*c.nz);assert.ok(recording.capacity*all.length<=2000000);
 recording.sample(new Float32Array(c.nx*c.nz));assert.equal(recording.count,1);
});
test('three guided experiments each provide a working default receiver row',()=>{
 assert.deepEqual(experiments.map(e=>e.id),['propagation','interface','anomaly']);
 for(const e of experiments){const c=experimentSetup(e.id),points=receiverArray({nx:180,nz:116},c.receiverCount,c.receiverSpacing/c.dx,c.receiverDepth/c.dz),run=prepareRun(c,points);
 assert.equal(run.record.points.length,12);run.solver.step();run.record.sample(run.solver.curr);assert.equal(run.record.count,2);}
});
