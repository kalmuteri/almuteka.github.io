export function ricker(time,frequency=12,peakTime=1.5/frequency,amplitude=1) {
  const a=(Math.PI*frequency*(time-peakTime))**2;return amplitude*(1-2*a)*Math.exp(-a);
}
export function makeSource({x,z,amplitude=.01,frequency=12,start=0},c) {
  if(![x,z,amplitude,frequency,start].every(Number.isFinite)||frequency<=0||start<0)throw Error('Invalid source parameters.');
  x=Math.max(1,Math.min(c.nx-2,Math.round(x)));z=Math.max(1,Math.min(c.nz-2,Math.round(z)));
  return {x,z,k:z*c.nx+x,amplitude,frequency,start,peakTime:start+1.5/frequency};
}
export function sourceValue(s,time){return time<s.start?0:ricker(time,s.frequency,s.peakTime,s.amplitude);}
