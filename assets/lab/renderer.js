export function amplitudeRange(field,mode='fixed',fixed=1) {
  if(mode==='fixed')return Number.isFinite(fixed)&&fixed>0?fixed:1;
  let a=0;for(const value of field)a=Math.max(a,Math.abs(value));return Math.max(a,1e-12);
}
export function color(value,limit) {
  const u=Math.max(-1,Math.min(1,value/limit)),a=Math.abs(u);
  return u>=0?[11+94*a,31+164*a,43+142*a]:[11+205*a,31+148*a,43+67*a];
}
export class Renderer {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.image=null;}
  draw(solver,{scale='fixed',limit=1,grid=false,view='wave',sources=[],receivers=[],selected=null}={}) {
    const {nx,nz}=solver.config;
    if(this.canvas.width!==nx||this.canvas.height!==nz||!this.image){this.canvas.width=nx;this.canvas.height=nz;this.image=this.ctx.createImageData(nx,nz);}
    const range=amplitudeRange(solver.curr,scale,limit),d=this.image.data;
    for(let k=0;k<solver.n;k++) {
      const u=Math.max(-1,Math.min(1,solver.curr[k]/range)),a=Math.abs(u);
      let r=11+(u>=0?94:205)*a,g=31+(u>=0?164:148)*a,b=43+(u>=0?142:67)*a;
      if(view!=='wave') {
        const v=(solver.velocity[k]-solver.vmin)/(solver.vmax-solver.vmin||1),vr=35+170*v,vg=48+130*v,vb=130-60*v;
        const mix=view==='velocity'?0:Math.min(1,a*3);
        r=mix*r+(1-mix)*vr;g=mix*g+(1-mix)*vg;b=mix*b+(1-mix)*vb;
      }
      const line=grid&&(k%nx%15===0||Math.floor(k/nx)%15===0)?10:0;
      d[k*4]=r+line;d[k*4+1]=g+line;d[k*4+2]=b+line;d[k*4+3]=255;
    }
    const ctx=this.ctx;ctx.putImageData(this.image,0,0);
    ctx.lineWidth=1;
    for(const p of sources){ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(p.x-3,p.z);ctx.lineTo(p.x+3,p.z);ctx.moveTo(p.x,p.z-3);ctx.lineTo(p.x,p.z+3);ctx.stroke();}
    for(const p of receivers){ctx.strokeStyle='#ff8cbe';ctx.strokeRect(p.x-2,p.z-2,4,4);}
    if(selected){ctx.strokeStyle='#fff';for(const [x,z]of [[0,0],[-1,0],[1,0],[0,-1],[0,1]])ctx.strokeRect(selected.x+x-.5,selected.z+z-.5,1,1);}
    return range;
  }
}
export function drawRecord(canvas,record,channel=-1) {
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.fillStyle='#0b1f2b';ctx.fillRect(0,0,w,h);
  if(!record||record.count<2||!record.points.length){
    ctx.strokeStyle='#29414d';ctx.lineWidth=1;
    for(let y=0;y<h;y+=h/4){ctx.beginPath();ctx.moveTo(0,y+.5);ctx.lineTo(w,y+.5);ctx.stroke();}
    ctx.fillStyle='#c7d9df';ctx.font='16px system-ui';ctx.textAlign='center';
    ctx.fillText('Receivers ready — press Play or Step once',w/2,h/2);ctx.textAlign='start';return 0;
  }
  let max=1e-12;for(const trace of record.traces)for(let n=0;n<record.count;n++)max=Math.max(max,Math.abs(trace[n]));
  if(channel>=0){
    const trace=record.traces[Math.min(channel,record.traces.length-1)];ctx.strokeStyle='#69c3b9';ctx.lineWidth=1.5;ctx.beginPath();
    for(let n=0;n<record.count;n++){const x=n/(record.count-1)*w,y=h/2-trace[n]/max*h*.45;if(n)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.stroke();
  } else {
    // Horizontal receiver index; vertical recording time, increasing downward.
    const columns=Math.min(w,record.traces.length);
    for(let column=0;column<columns;column++)for(let y=0;y<h;y++) {
      const i=Math.floor(column*record.traces.length/columns);
      const n=Math.min(record.count-1,Math.floor(y/h*record.count)),rgb=color(record.traces[i][n],max);
      ctx.fillStyle=`rgb(${rgb.join(',')})`;ctx.fillRect(column*w/columns,y,Math.ceil(w/columns),1);
    }
  }
  return max;
}
