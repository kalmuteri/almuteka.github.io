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
