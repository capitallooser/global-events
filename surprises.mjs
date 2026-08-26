export function calculateSurprise(actual,forecast){
  const a=Number(actual),f=Number(forecast);
  if(actual===null||actual===undefined||actual===''||forecast===null||forecast===undefined||forecast===''||!Number.isFinite(a)||!Number.isFinite(f))return null;
  const absolute=Number((a-f).toFixed(4));
  const pct=f===0?null:Number((((a-f)/Math.abs(f))*100).toFixed(2));
  return {absolute,pct};
}
