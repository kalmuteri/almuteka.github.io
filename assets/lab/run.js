import {Solver} from './solver.js';
import {Receivers} from './receivers.js';

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
  const record=new Receivers(points,c);record.sample(solver.curr);
  return {solver,record,markers:[position]};
}
