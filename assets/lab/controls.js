export const $=id=>document.getElementById(id);
export function number(id){const el=$(id),v=Number(el.value);if(el.value.trim()===''||!el.checkValidity()||!Number.isFinite(v))throw Error('Check '+(el.closest('label')?.textContent.trim()||id)+'.');return v;}
export function readSetup(){return {dx:number('dx'),dz:number('dz'),dt:$('autoDt').checked?.002:number('dtMs')/1000,autoDt:$('autoDt').checked,boundary:$('boundary').value,spongeWidth:$('spongeWidth').disabled?15:number('spongeWidth'),spongeStrength:$('spongeStrength').disabled?60:number('spongeStrength'),model:$('model').value,velocity:number('velocity'),lowerVelocity:$('lowerVelocity').disabled?2500:number('lowerVelocity'),interfaceDepth:$('interfaceDepth').disabled?580:number('interfaceDepth'),sourceType:$('sourceType').value,sourceAmplitude:number('sourceAmplitude'),sourceWidth:$('sourceWidth').disabled?48:number('sourceWidth'),frequency:$('frequency').disabled?12:number('frequency'),sourceDelay:$('sourceDelay').disabled?0:number('sourceDelay'),sourceX:number('sourceX'),sourceZ:number('sourceZ')};}
export function sourceLabels(){const isRicker=$('sourceType').value==='ricker';$('sourceUnits').textContent=isRicker?'(a.u./m²)':'(a.u.)';$('frequency').disabled=!isRicker;$('sourceDelay').disabled=!isRicker;$('sourceWidth').disabled=isRicker;$('sourceHelp').textContent=isRicker?'Ricker: a time-dependent force in one grid cell. Peak time = activation + 1.5 / frequency. Amplitude is source density (a.u./m²).':'Gaussian: a zero-initial-velocity displacement with spatial standard deviation “Width”. Adding one is a single event, not continuous forcing.';}

export function contextualControls(){
  const layers=['layers','inclined'].includes($('model').value);
  for(const id of ['lowerVelocity','interfaceDepth']){$(id).disabled=!layers;$(id).closest('label').hidden=!layers;}
  const sponge=$('boundary').value==='sponge';
  for(const id of ['spongeWidth','spongeStrength']){$(id).disabled=!sponge;$(id).closest('label').hidden=!sponge;}
  for(const id of ['frequency','sourceDelay','sourceWidth'])$(id).closest('label').hidden=$(id).disabled;
}
