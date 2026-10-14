export function amplitudeRange(field,mode='fixed',fixed=1) {
  if(mode==='fixed')return Math.max(1e-12,fixed);
  let a=0;for(const value of field)a=Math.max(a,Math.abs(value));return Math.max(a,1e-12);
}
export function color(value,limit) {
  const u=Math.max(-1,Math.min(1,value/limit)),a=Math.abs(u);
  return u>=0?[11+94*a,31+164*a,43+142*a]:[11+205*a,31+148*a,43+67*a];
}
export class Renderer {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.image=null;}
  draw(solver,{scale='fixed',limit=1,grid=false}={}) {
    const {nx,nz}=solver.config;
    if(this.canvas.width!==nx||this.canvas.height!==nz||!this.image){this.canvas.width=nx;this.canvas.height=nz;this.image=this.ctx.createImageData(nx,nz);}
    const range=amplitudeRange(solver.curr,scale,limit),d=this.image.data;
    for(let k=0;k<solver.n;k++) {
      const rgb=color(solver.curr[k],range),g=grid&&(k%nx%15===0||Math.floor(k/nx)%15===0)?8:0;
      d[k*4]=rgb[0]+g;d[k*4+1]=rgb[1]+g;d[k*4+2]=rgb[2]+g;d[k*4+3]=255;
    }
    this.ctx.putImageData(this.image,0,0);return range;
  }
}
