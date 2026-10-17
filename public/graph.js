'use strict';
function historySegments(samples, interval) {
  const segments=[]; let current=[];
  for(const p of samples) {
    if(!Number.isFinite(p.timer)||!Number.isFinite(p.depth)) {current=[];continue;}
    const last=current[current.length-1];
    if(!current.length || p.breakBefore || last && p.timer-last.timer>interval*60000*2.5) {current=[];segments.push(current);}
    current.push(p);
  }
  return segments;
}
// Display only: centered time windows never span observation gaps.
function smoothedSegments(samples, interval, hours = 3) {
  hours = [2,3,4,5,6].includes(Number(hours)) ? Number(hours) : 3;
  return historySegments(samples, interval).map(segment=>{
    function windowMap(points, radius, calculate) {
      let first=0,last=0;
      return points.map(p=>{
        while(points[first].timer<p.timer-radius)first++;
        while(last<points.length && points[last].timer<=p.timer+radius)last++;
        return {...p,depth:calculate(points.slice(first,last),p)};
      });
    }
    const medians=windowMap(segment,7.5*60000,points=>{
      const depths=points.map(p=>p.depth).sort((a,b)=>a-b),middle=Math.floor(depths.length/2);
      return depths.length%2?depths[middle]:(depths[middle-1]+depths[middle])/2;
    });
    return windowMap(medians,hours*30*60000,(points,p)=>{
      let sum=0,weight=0;
      for(const q of points){const w=Math.exp(-0.5*((q.timer-p.timer)/(hours*15*60000))**2);sum+=q.depth*w;weight+=w;}
      return sum/weight;
    });
  });
}
function appearance(mode, override, navigationState) {
  if(override)return override;
  if(mode!=='night')return 'light';
  return typeof navigationState==='string' && navigationState.length>0 && !['anchored','moored'].includes(navigationState)?'red':'dark';
}
if(typeof module!=='undefined') module.exports={historySegments,smoothedSegments,appearance};
if(typeof window!=='undefined') window.drawTideHistory=function(history, units) {
  const host=document.getElementById('graph'), detail=document.getElementById('graph-detail');
  host.replaceChildren();detail.textContent='';
  if(!history || !history.samples.length){host.textContent='Waiting for recorded depth history';return;}
  const ns='http://www.w3.org/2000/svg', w=Math.max(280,host.clientWidth), h=320;
  const left=64,right=w-18,top=30,bottom=258, factor=units==='ft'?3.28084:1;
  const showMeasurements=document.getElementById('show-measurements').checked;
  const smoothed=smoothedSegments(history.samples,history.recordDataInterval,document.getElementById('smoothing-hours').value);
  const values=(showMeasurements?history.samples.concat(history.turns):smoothed.flat()).map(p=>p.depth*factor);
  let lo=Math.min(...values),hi=Math.max(...values);const pad=Math.max((hi-lo)*.12,.02*factor);lo-=pad;hi+=pad;
  const end=Math.max(history.now,...history.futureEvents.map(e=>e.latest));
  const x=t=>left+(t-history.start)/(end-history.start)*(right-left),y=v=>bottom-(v*factor-lo)/(hi-lo)*(bottom-top);
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','Smoothed depth over local time, optional recorded measurements and estimated future turn timing windows');host.append(svg);
  function add(tag,attrs,text){const e=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text!==undefined)e.textContent=text;svg.append(e);return e;}
  for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4,Y=bottom-i/4*(bottom-top);add('line',{x1:left,x2:right,y1:Y,y2:Y,class:'grid'});add('text',{x:left-8,y:Y+4,'text-anchor':'end'},v.toFixed(2));}
  const ticks=w<450?3:5;
  for(let i=0;i<ticks;i++){const t=history.start+(end-history.start)*i/(ticks-1),X=x(t);add('text',{x:X,y:bottom+22,'text-anchor':i===0?'start':i===ticks-1?'end':'middle'},new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}));if(+document.getElementById('history-range').value>24)add('text',{x:X,y:bottom+40,'text-anchor':i===0?'start':i===ticks-1?'end':'middle'},new Date(t).toLocaleDateString([],{month:'short',day:'numeric'}));}
  add('text',{x:(left+right)/2,y:314,'text-anchor':'middle'},'Local time');
  add('text',{transform:`translate(16 ${(top+bottom)/2}) rotate(-90)`,'text-anchor':'middle'},`Depth (${units})`);
  for(const e of history.futureEvents){add('rect',{x:x(Math.max(history.now,e.earliest)),y:top,width:Math.max(1,x(e.latest)-x(Math.max(history.now,e.earliest))),height:bottom-top,class:'estimate'});add('text',{x:Math.min(right-8,Math.max(left+8,x(e.timer))),y:top-9,'text-anchor':'middle'},e.kind==='high'?'H':'L');}
  add('line',{x1:x(history.now),x2:x(history.now),y1:top,y2:bottom,class:'grid'});
  function plot(segments, className){
    for(const segment of segments){
      if(segment.length===1){if(className==='raw-line')add('circle',{cx:x(segment[0].timer),cy:y(segment[0].depth),r:2,class:className});}
      else add('path',{d:segment.map((p,i)=>`${i?'L':'M'}${x(p.timer).toFixed(2)},${y(p.depth).toFixed(2)}`).join(' '),class:className});
    }
  }
  if(showMeasurements)plot(historySegments(history.samples,history.recordDataInterval),'raw-line');
  plot(smoothed,'depth-line');
  if(showMeasurements)for(const t of history.turns){const marker=add('circle',{cx:x(t.timer),cy:y(t.depth),r:5,class:'turn'});const title=document.createElementNS(ns,'title');title.textContent=`${t.kind} · ${new Date(t.timer).toLocaleString()} · ${(t.depth*factor).toFixed(3)} ${units}`;marker.append(title);}
  const trendByTime=new Map(smoothed.flat().map(p=>[p.timer,p]));
  const hit=add('rect',{x:left,y:top,width:right-left,height:bottom-top,fill:'transparent'});
  function inspect(event){const rect=svg.getBoundingClientRect(),px=(event.clientX-rect.left)*w/rect.width,t=history.start+(px-left)/(right-left)*(end-history.start);if(t>history.now){const event=history.futureEvents.find(e=>t>=e.earliest && t<=e.latest);detail.textContent=event?`Estimated ${event.kind} · ${new Date(event.earliest).toLocaleString()} – ${new Date(event.latest).toLocaleString()}`:'No future depth forecast';return;}const p=history.samples.reduce((a,b)=>Math.abs(b.timer-t)<Math.abs(a.timer-t)?b:a);const trend=trendByTime.get(p.timer);detail.textContent=`${new Date(p.timer).toLocaleString()} · Smoothed depth ${(trend.depth*factor).toFixed(3)} ${units}`+(showMeasurements?` · Recorded ${(p.depth*factor).toFixed(3)} ${units}`:'');}
  hit.addEventListener('pointermove',inspect);hit.addEventListener('click',inspect);
};
