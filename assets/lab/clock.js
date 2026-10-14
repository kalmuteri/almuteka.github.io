// Accumulate physical time independently of frame count. Drop excess wall time
// after stalls rather than freezing the UI to catch up. dt never changes.
export class Clock {
  constructor(){this.accumulator=0;}
  reset(){this.accumulator=0;}
  advance(elapsed,speed,dt,maxSteps=32){
    this.accumulator+=Math.min(.1,Math.max(0,elapsed))*speed;
    const count=Math.min(maxSteps,Math.floor((this.accumulator+1e-12)/dt));
    this.accumulator-=count*dt;
    if(count===maxSteps)this.accumulator=0;
    return count;
  }
}
