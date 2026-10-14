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
