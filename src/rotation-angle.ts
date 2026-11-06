/** One absolute, plan-space rotation contract for Background handles. */
export function rotationAngle(angle0:number,start:number,current:number,shift:boolean,defaultStep=0):number {
  let angle=Number(angle0)+(Number(current)-Number(start));
  if(![angle,start,current].every(Number.isFinite))angle=0;
  if(shift){const steps=angle/45;angle=(steps<0?-Math.round(Math.abs(steps)):Math.round(steps))*45;}
  else if(defaultStep)angle=Math.round(angle/defaultStep)*defaultStep;
  angle=((angle%360)+360)%360;
  return angle>180?angle-360:angle;
}
