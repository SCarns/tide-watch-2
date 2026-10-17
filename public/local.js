'use strict';
let data=null, history=null, unitsInitialized=false, smoothingInitialized=false, themeOverride=null;
let historyRequest = 0;
function applyAppearance() {
  const theme=appearance(data && data.environmentMode,themeOverride,data && data.navigationState);
  document.body.dataset.theme=theme;
  const names={light:'☀ Day',dark:'☾ Night',red:'◉ Red'},next={light:'dark',dark:'red',red:'light'};
  document.getElementById('theme-toggle').textContent=names[theme];
  document.getElementById('theme-toggle').setAttribute('aria-label',names[theme].slice(2)+' appearance; switch to '+names[next[theme]].slice(2)+' appearance');
  document.getElementById('theme-auto').setAttribute('aria-pressed',String(themeOverride===null));
}
async function refreshHistory() {
  const request = ++historyRequest;
  try {
    const hours=document.getElementById('history-range').value;
    const response=await fetch('/plugins/signalk-tide-watch/api/history?hours='+hours);
    if(!response.ok)throw new Error('Depth history unavailable');
    const result=await response.json();
    if(request !== historyRequest || document.getElementById('history-range').value!==hours)return;
    history=result;drawTideHistory(history,document.getElementById('units').value);
  }catch(error){if(request !== historyRequest)return;history=null;document.getElementById('graph').textContent='Depth history unavailable — retrying';}
}
const el=id=>document.getElementById(id);
const time=t=>new Date(t).toLocaleString();
function depth(v) {return Number.isFinite(v)?(v*(el('units').value==='ft'?3.28084:1)).toFixed(3)+' '+el('units').value:'—';}
function rows(id,values) {
  el(id).replaceChildren();
  for(const valuesRow of values) {const row=document.createElement('tr'); for(const value of valuesRow) {const cell=document.createElement('td');cell.textContent=value;row.appendChild(cell);}el(id).appendChild(row);}
}
function render() {
  if(!data) return;
  if(!unitsInitialized){el('units').value=data.displayUnits==='ft'?'ft':'m';unitsInitialized=true;}
  if(!smoothingInitialized){el('smoothing-hours').value=String([2,3,4,5,6].includes(Number(data.displaySmoothingHours))?Number(data.displaySmoothingHours):3);el('smoothing-label').textContent=el('smoothing-hours').value+'-hour';smoothingInitialized=true;}
  applyAppearance();
  drawTideHistory(history,el('units').value);
  const location=data.captureLocation;
  const automatic=!location || !location.name || /^Location \{/.test(location.name) || location.name==='Current location';
  el('location').textContent=location?(automatic?'Current location':location.name):'Waiting for location';
  el('rename').disabled=!location;
  const states={rising:'Water level rising',falling:'Water level falling','near-steady':'No established rise or fall',unknown:'Gathering observations'};
  el('state').textContent=data.reason || states[data.state] || 'Gathering observations';
  for(const [id,value,waiting] of [['depth',data.depth,'Waiting for depth'],['rate',data.rateMetresPerHour,'Learning the trend'],['range',data.observedRangeMetres,'Waiting for two turns']]) {
    el(id).textContent=Number.isFinite(value)?depth(value)+(id==='rate'?'/h':''):waiting;
    el(id).classList.toggle('waiting',!Number.isFinite(value));
  }
  el('recorded').textContent=data.lastReading?'Last recorded '+time(data.lastReading):'No observations recorded yet';
  const pos=location && location.pos;
  el('coordinates').textContent=pos && Number.isFinite(pos.latitude) && Number.isFinite(pos.longitude)?Math.abs(pos.latitude).toFixed(5)+'° '+(pos.latitude<0?'S':'N')+' · '+Math.abs(pos.longitude).toFixed(5)+'° '+(pos.longitude<0?'W':'E'):'';
  el('source').textContent='Depth: '+data.depthPath+' · Source: '+(data.source || 'Waiting')+' · Trend window: '+data.trendMinutes+' minutes · '+(data.reason || 'Watching local depth');
  el('prediction').textContent=data.predictionReasons.join('. ');
  rows('future',data.futureEvents.map(e=>[e.kind,time(e.timer),e.timingDescription || time(e.earliest)+' – '+time(e.latest)]));
  rows('past',data.observedTurns.length?data.observedTurns.slice().reverse().map(e=>[e.kind,time(e.timer),depth(e.depth)]):[['No turning points recorded yet','—','—']]);
}
async function refresh() {
  try {const response=await fetch('/plugins/signalk-tide-watch/api/status');if(!response.ok)throw new Error('Tide Watch is unavailable');data=await response.json();el('error').textContent='';render();await refreshHistory();}
  catch(error){++historyRequest;history=null;drawTideHistory(null,el('units').value);data=null;el('error').textContent=error.message;el('state').textContent='Unavailable';for(const id of ['depth','rate','range']){el(id).textContent='—';el(id).classList.add('waiting');}el('recorded').textContent='';rows('future',[]);rows('past',[]);el('rename').disabled=true;}
}
el('units').addEventListener('change',render);
el('smoothing-hours').addEventListener('change',()=>{el('smoothing-label').textContent=el('smoothing-hours').value+'-hour';drawTideHistory(history,el('units').value);});
el('show-measurements').addEventListener('change',()=>drawTideHistory(history,el('units').value));
el('history-range').addEventListener('change',refreshHistory);
el('theme-toggle').addEventListener('click',()=>{themeOverride={light:'dark',dark:'red',red:'light'}[document.body.dataset.theme];applyAppearance();});
el('theme-auto').addEventListener('click',()=>{themeOverride=null;applyAppearance();});
new ResizeObserver(()=>drawTideHistory(history,el('units').value)).observe(el('graph'));
applyAppearance();
el('rename').addEventListener('click',async()=>{
  if(!data || !data.captureLocation)return;
  const name=prompt('Location name',/^Location \{/.test(data.captureLocation.name)?'':data.captureLocation.name);if(name===null)return;
  try {const response=await fetch('/plugins/signalk-tide-watch/api/location',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:data.captureLocation.id,name})});if(!response.ok)throw new Error('Could not save location name');await refresh();}catch(error){el('error').textContent=error.message;}
});
refresh();setInterval(refresh,15000);
