// Upper frequency where Ricker amplitude spectrum is 1% of its peak:
// ratio(f/f0) = (f/f0)^2 exp(1-(f/f0)^2). Ricker has no hard cutoff.
export function rickerBandwidth(f0){let lo=1,hi=5;for(let i=0;i<60;i++){const x=(lo+hi)/2;if(x*x*Math.exp(1-x*x)>.01)lo=x;else hi=x;}return f0*(lo+hi)/2;}
export function phaseRatio(v,frequency,dx,dz,dt,angle=0){
 const k=2*Math.PI*frequency/v,kx=k*Math.cos(angle),kz=k*Math.sin(angle);
 if(Math.abs(kx*dx)>Math.PI||Math.abs(kz*dz)>Math.PI)return null;
 const arg=v*dt*Math.sqrt(Math.sin(kx*dx/2)**2/dx**2+Math.sin(kz*dz/2)**2/dz**2);
 if(arg>1||frequency<=0)return null;
 return 2*Math.asin(arg)/(dt*v*k);
}
export function diagnostics(s,source){
 const c=s.config;
 const fmax=source.sourceType==='ricker'?rickerBandwidth(source.frequency):s.vmax*Math.sqrt(2*Math.log(100))/(2*Math.PI*source.sourceWidth);
 const wavelength=s.vmin/fmax,ppw=wavelength/Math.max(c.dx,c.dz);
 const ratios=[0,Math.PI/4,Math.PI/2].map(a=>phaseRatio(s.vmin,fmax,c.dx,c.dz,c.dt,a));
 return {fmax,wavelength,ppw,ratios,phaseError:ratios.some(r=>r===null)?null:100*Math.max(...ratios.map(r=>Math.abs(1-r))),label:s.cfl>1?'Unstable':s.cfl>.9?'Near limit':'Stable'};
}
