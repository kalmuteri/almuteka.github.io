export class Receivers {
  constructor(points,c,capacity=Math.min(5001,Math.floor(2000000/Math.max(1,points.length)))){
    if(!Number.isInteger(capacity)||capacity<1||capacity>100001)throw Error('Invalid recording capacity.');
    if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.z)||p.x<0||p.x>c.nx-1||p.z<0||p.z>c.nz-1))throw Error('Receivers must lie inside the model.');
    if(points.length>c.nx*c.nz)throw Error('At most one receiver per grid cell.');
    const keys=points.map(p=>Math.round(p.z)*c.nx+Math.round(p.x));
    if(new Set(keys).size!==keys.length)throw Error('A receiver already occupies that grid cell.');
    this.config={...c};this.capacity=capacity;this.count=0;
    this.points=points.map(p=>({x:Math.max(0,Math.min(c.nx-1,Math.round(p.x))),z:Math.max(0,Math.min(c.nz-1,Math.round(p.z)))}));
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
  if(!Number.isInteger(count)||count<1||count>c.nx||!Number.isFinite(spacing)||spacing<1||!Number.isFinite(depth))throw Error('Invalid receiver array parameters.');
  const first=(c.nx-1-(count-1)*spacing)/2;
  if(first<0||first+(count-1)*spacing>c.nx-1||depth<0||depth>c.nz-1)throw Error('Receiver array does not fit inside the model. Reduce spacing/count or change depth.');
  return Array.from({length:count},(_,i)=>({x:Math.round(first+i*spacing),z:Math.round(depth)}));
}
