export const modelNames={homogeneous:'Homogeneous',layers:'Two horizontal layers',slow:'Low-velocity anomaly',fast:'High-velocity anomaly',inclined:'Inclined interface'};
export function makeModel(c) {
  if(!modelNames[c.model||'homogeneous'])throw Error('Unknown velocity model.');
  const out=new Float32Array(c.nx*c.nz),base=c.velocity,lower=c.lowerVelocity??2500,depth=c.interfaceDepth??((c.nz-1)*c.dz/2);
  if(!Number.isFinite(lower)||lower<=0)throw Error('Layer velocity must be positive.');
  if(!Number.isFinite(depth))throw Error('Interface depth must be finite.');
  for(let z=0;z<c.nz;z++)for(let x=0;x<c.nx;x++) {
    let v=base;
    if(c.model==='layers'&&z*c.dz>=depth)v=lower;
    if(c.model==='inclined'&&z*c.dz>=depth+.3*(x-(c.nx-1)/2)*c.dx)v=lower;
    const ellipse=((x-c.nx*.6)/(c.nx*.14))**2+((z-c.nz*.55)/(c.nz*.2))**2;
    if(ellipse<1&&c.model==='slow')v=base*.65;
    if(ellipse<1&&c.model==='fast')v=base*1.5;
    out[z*c.nx+x]=v;
  }
  return out;
}
