import {laplacian} from './solver.js';
import {sourceValue} from './sources.js';
export function inspect(s,x,z){
 const c=s.config;if(!Number.isInteger(x)||!Number.isInteger(z)||x<1||x>=c.nx-1||z<1||z>=c.nz-1)throw Error('Choose an interior stencil cell.');
 const k=z*c.nx+x,p=s.curr[k],previous=s.prev[k],left=s.curr[k-1],right=s.curr[k+1],up=s.curr[k-c.nx],down=s.curr[k+c.nx];
 // Match Float32 forcing accumulation in the engine, including coincident events.
 let force=0;for(const event of s.sources)if(event.k===k)force=Math.fround(force+sourceValue(event,s.time));
 const lap=laplacian(s.curr,k,c.nx,c.dx,c.dz),coefficient=s.velocity[k]**2*c.dt**2,q=s.sigma[k]*c.dt;
 const memory=2*p-previous,spatial=coefficient*lap,forcing=coefficient*force;
 const undamped=memory+coefficient*(lap+force);
 const damped=(2*p-(1-q)*previous+coefficient*(lap+force))/(1+q);
 return {x,z,k,time:s.time,p,previous,left,right,up,down,lap,force,memory,spatial,forcing,undamped,q,damped,predicted:Math.fround(damped),velocity:s.velocity[k]};
}
