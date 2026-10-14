export class Receivers {
  constructor(points,c,capacity=5001){
    if(points.length>32)throw Error('At most 32 receivers are supported.');
    this.config={...c};this.capacity=capacity;this.count=0;
    this.points=points.map(p=>({x:Math.max(1,Math.min(c.nx-2,Math.round(p.x))),z:Math.max(1,Math.min(c.nz-2,Math.round(p.z)))}));
    this.traces=this.points.map(()=>new Float32Array(capacity));
  }
  sample(field){if(this.count>=this.capacity)return false;for(let i=0;i<this.points.length;i++){const p=this.points[i];this.traces[i][this.count]=field[p.z*this.config.nx+p.x];}this.count++;return true;}
  csv(){
    const {dx,dz,dt}=this.config;const lines=['time_s,receiver,x_m,z_m,dt_s,amplitude_au'];
    for(let n=0;n<this.count;n++)for(let i=0;i<this.points.length;i++){const p=this.points[i];lines.push([n*dt,i+1,p.x*dx,p.z*dz,dt,this.traces[i][n]].join(','));}
    return lines.join('\n');
  }
}
export function receiverArray(c,count=12,spacing=10,depth=20) {
  const first=(c.nx-1-(count-1)*spacing)/2;
  if(first<1||first+(count-1)*spacing>c.nx-2||depth<1||depth>c.nz-2)throw Error('Receiver array does not fit inside the model. Reduce spacing/count or change depth.');
  return Array.from({length:count},(_,i)=>({x:Math.round(first+i*spacing),z:Math.round(depth)}));
}
