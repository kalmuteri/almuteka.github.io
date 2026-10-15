import {Solver} from './solver.js?v=20261016-time';
import {Receivers} from './receivers.js?v=20261015-ux';

export function timePlan(maxTime,dt,receivers=0){
  if(!Number.isFinite(maxTime)||maxTime<=0)throw Error('Maximum time must be positive and finite.');
  if(!Number.isFinite(dt)||dt<=0)throw Error('Time step must be positive and finite.');
  const steps=Math.floor(maxTime/dt+1e-9);
  if(steps<1)throw Error('Maximum time must be at least one time step.');
  const capacity=steps+1;
  if(capacity>100001||capacity*Math.max(1,receivers)>2000000)throw Error('Requested recording exceeds the memory limit. Reduce maximum time or receiver count, or increase Δt.');
  return {steps,capacity,endTime:steps*dt};
}

// Construct a complete candidate before the UI replaces its current run.
export function prepareRun(config, points=[]) {
  const solver=new Solver(config),c=solver.config;
  const {sourceX:x,sourceZ:z}=config;
  if(!Number.isFinite(x)||!Number.isFinite(z)||x<c.dx||x>(c.nx-2)*c.dx||z<c.dz||z>(c.nz-2)*c.dz)
    throw Error('Source lies outside the interior domain. Adjust source coordinates for the new spacing.');
  const position={x:Math.round(x/c.dx),z:Math.round(z/c.dz)};
  if(config.sourceType==='ricker')solver.addSource({...position,amplitude:config.sourceAmplitude,frequency:config.frequency,start:config.sourceDelay});
  else if(config.sourceType==='gaussian')solver.pulse(position.x,position.z,config.sourceAmplitude,config.sourceWidth/c.dx);
  else throw Error('Unknown source mechanism.');
  const plan=config.maxTime===undefined?null:timePlan(config.maxTime,c.dt,points.length);
  const record=new Receivers(points,c,plan?.capacity);record.sample(solver.curr);
  return {solver,record,markers:[position],plan};
}
