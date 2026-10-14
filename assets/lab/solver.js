import {makeModel} from './models.js';
import {makeSource,sourceValue} from './sources.js';
import {damping} from './boundaries.js';
export const defaults = {nx:180, nz:116, dx:10, dz:10, dt:0.002, velocity:1500, boundary:'sponge', spongeWidth:15, spongeStrength:60};
export function cfl(vmax, dt, dx, dz) {return vmax*dt*Math.hypot(1/dx,1/dz);}
export function laplacian(p,k,nx,dx,dz) {
  return (p[k-1]-2*p[k]+p[k+1])/(dx*dx)+(p[k-nx]-2*p[k]+p[k+nx])/(dz*dz);
}
export class Solver {
  constructor(options={}) {
    this.config={...defaults,...options};
    const c=this.config;
    for (const key of ['nx','nz']) if (!Number.isInteger(c[key])||c[key]<8||c[key]>400) throw Error('Grid dimensions must be integers from 8 to 400.');
    for (const key of ['dx','dz','dt','velocity']) if (!Number.isFinite(c[key])||c[key]<=0) throw Error('Sampling and velocity must be positive and finite.');
    if(!['sponge','reflecting'].includes(c.boundary)||!Number.isFinite(c.spongeWidth)||c.spongeWidth<=0||!Number.isFinite(c.spongeStrength)||c.spongeStrength<0)throw Error('Invalid boundary settings.');
    this.n=c.nx*c.nz;this.velocity=makeModel(c);
    this.vmin=Infinity;this.vmax=0;for(const v of this.velocity){if(!Number.isFinite(v)||v<=0)throw Error('Velocity is outside the supported numeric range.');this.vmin=Math.min(this.vmin,v);this.vmax=Math.max(this.vmax,v);}
    this.sources=[];this.force=new Float32Array(this.n);
    if(c.autoDt)c.dt=.6/(this.vmax*Math.hypot(1/c.dx,1/c.dz));
    this.validateStability();
    this.prev=new Float32Array(this.n);this.curr=new Float32Array(this.n);this.next=new Float32Array(this.n);
    this.sigma=damping(c.nx,c.nz,c.spongeWidth,c.spongeStrength,c.boundary);
    this.steps=0;this.maxAmplitude=0;
  }
  get time(){return this.steps*this.config.dt;}
  get cfl(){const c=this.config;return cfl(this.vmax,c.dt,c.dx,c.dz);}
  validateStability(){if(this.cfl>1)throw Error('Unstable time step: CFL must not exceed 1.');}
  reset(){this.prev.fill(0);this.curr.fill(0);this.next.fill(0);this.steps=0;this.maxAmplitude=0;this.sources=[];this.force.fill(0);}
  // A zero-initial-velocity Gaussian, with a second-order Taylor start.
  pulse(x=this.config.nx*.49,z=this.config.nz*.5,amplitude=1,width=4.8) {
    const c=this.config;
    if(![x,z,amplitude,width].every(Number.isFinite)||width<=0)throw Error('Invalid Gaussian source.');
    const shape=new Float32Array(this.n);
    for(let j=1;j<c.nz-1;j++)for(let i=1;i<c.nx-1;i++) shape[j*c.nx+i]=amplitude*Math.exp(-(((i-x)*c.dx)**2+((j-z)*c.dz)**2)/(2*(width*c.dx)**2));
    for(let j=1;j<c.nz-1;j++)for(let i=1;i<c.nx-1;i++) {
      const k=j*c.nx+i;this.curr[k]+=shape[k];
      this.prev[k]+=shape[k]+.5*this.velocity[k]**2*c.dt**2*laplacian(shape,k,c.nx,c.dx,c.dz);
    }
    this.measure();
  }
  addSource(options){if(this.sources.length>=16)throw Error('At most 16 source events per run. Reset to start again.');const source=makeSource(options,this.config);this.sources.push(source);return source;}
  forcing(){this.force.fill(0);for(const source of this.sources)this.force[source.k]+=sourceValue(source,this.time);}
  measure(){let a=0;for(let k=0;k<this.n;k++)a=Math.max(a,Math.abs(this.curr[k]));this.maxAmplitude=a;return a;}
  step() {
    const c=this.config,{nx,nz,dx,dz,dt}=c;let a=0;this.forcing();
    for(let z=1;z<nz-1;z++)for(let x=1;x<nx-1;x++) {
      const k=z*nx+x,q=this.sigma[k]*dt;
      const value=(2*this.curr[k]-(1-q)*this.prev[k]+this.velocity[k]**2*dt**2*(laplacian(this.curr,k,nx,dx,dz)+this.force[k]))/(1+q);
      if(!Number.isFinite(value)||Math.abs(value)>1e12)throw Error('Wavefield exceeded the safety limit. Reset with stable parameters.');
      this.next[k]=value;a=Math.max(a,Math.abs(value));
    }
    const old=this.prev;this.prev=this.curr;this.curr=this.next;this.next=old;
    this.steps++;this.maxAmplitude=a;
  }
}
