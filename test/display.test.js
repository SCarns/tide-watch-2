'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {historySegments,smoothedSegments,appearance}=require('../public/graph');
test('day/night and explicit override precedence',()=>{
 assert.equal(appearance('night',null),'dark');assert.equal(appearance('day',null),'light');
 assert.equal(appearance(undefined,null),'light');assert.equal(appearance('bad',null),'light');
 assert.equal(appearance('night','light'),'light');assert.equal(appearance('day','dark'),'dark');
});
test('history preserves every sample and breaks at pause or long gap',()=>{
 const samples=[{timer:0,depth:1},{timer:60000,depth:2},{timer:120000,depth:3,breakBefore:true},{timer:180000,depth:4},{timer:600000,depth:5}];
 const segments=historySegments(samples,1);assert.deepEqual(segments.map(s=>s.length),[2,2,1]);
 assert.deepEqual(segments.flat(),samples);
});
test('web page initializes preferred units once and preserves temporary switching',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 function page(){
  const elements=new Map();
  function element(id){if(!elements.has(id))elements.set(id,{value:id==='history-range'?'24':id==='units'?'m':'',dataset:{},classList:{toggle(){},add(){}},setAttribute(k,v){this[k]=v;},replaceChildren(){},appendChild(){},addEventListener(k,fn){this[k]=fn;}});return elements.get(id);}
  const response={displayUnits:'ft',displaySmoothingHours:5,environmentMode:'night',navigationState:'anchored',captureLocation:null,depth:2,state:'unknown',predictionReasons:[],futureEvents:[],observedTurns:[]};
  const context=vm.createContext({document:{getElementById:element,body:element('body'),createElement:()=>element('generated')},appearance,drawTideHistory(){},ResizeObserver:class{observe(){}},setInterval(){},fetch:async()=>({ok:true,json:async()=>response}),prompt(){}});
  vm.runInContext(fs.readFileSync(require.resolve('../public/local.js'),'utf8'),context);
  return {context,element,response};
 }
 const p=page();await vm.runInContext('refresh()',p.context);assert.equal(p.element('units').value,'ft');assert.equal(p.element('smoothing-hours').value,'5');
 assert.equal(p.element('body').dataset.theme,'dark');
 p.element('smoothing-hours').value='2';p.element('smoothing-hours').change();p.response.displaySmoothingHours=6;
 p.element('units').value='m';await vm.runInContext('refresh()',p.context);assert.equal(p.element('units').value,'m');assert.equal(p.element('smoothing-hours').value,'2');
 p.element('theme-toggle').click();assert.equal(p.element('body').dataset.theme,'red');
 await vm.runInContext('refresh()',p.context);assert.equal(p.element('body').dataset.theme,'red');
 p.element('theme-toggle').click();assert.equal(p.element('body').dataset.theme,'light');
 p.element('theme-auto').click();assert.equal(p.element('body').dataset.theme,'dark');
 p.response.navigationState='sailing';await vm.runInContext('refresh()',p.context);assert.equal(p.element('body').dataset.theme,'red');
 p.response.navigationState='moored';await vm.runInContext('refresh()',p.context);assert.equal(p.element('body').dataset.theme,'dark');
 p.response.environmentMode='day';await vm.runInContext('refresh()',p.context);assert.equal(p.element('body').dataset.theme,'light');
 const reopened=page();await vm.runInContext('refresh()',reopened.context);assert.equal(reopened.element('units').value,'ft');
});

test('display smoothing suppresses isolated spikes without changing stored readings',()=>{
 const samples=Array.from({length:121},(_,i)=>({timer:i*60000,depth:7.5}));
 samples[60].depth=5.6;
 const before=JSON.stringify(samples),smoothed=smoothedSegments(samples,1).flat();
 assert.equal(smoothed.length,samples.length);
 assert.ok(smoothed.every(p=>Math.abs(p.depth-7.5)<1e-10));
 assert.equal(JSON.stringify(samples),before);
});
test('display smoothing preserves sustained rises and separates pauses and gaps',()=>{
 const ramp=Array.from({length:361},(_,i)=>({timer:i*60000,depth:7+i/120}));
 const trend=smoothedSegments(ramp,1).flat();
 assert.ok(trend[240].depth-trend[120].depth>.9);
 assert.ok(Math.abs(trend[180].depth-8.5)<1e-10);
 const samples=[{timer:0,depth:2},{timer:60000,depth:2},
 {timer:120000,depth:8,breakBefore:true},{timer:180000,depth:8},
 {timer:600000,depth:4}];
 assert.deepEqual(smoothedSegments(samples,1).map(s=>s.map(p=>p.depth)),[[2,2],[8,8],[4]]);
});
test('smoothing uses elapsed time and finite values at sparse endpoints',()=>{
 const samples=[{timer:0,depth:2},{timer:60000,depth:2},{timer:600000,depth:8}];
 const result=smoothedSegments(samples,5).flat();
 const w1=Math.exp(-0.5*(1/45)**2),w10=Math.exp(-0.5*(10/45)**2);
 const expected=(2+2*w1+8*w10)/(1+w1+w10);
 assert.ok(Math.abs(result[0].depth-expected)<1e-10);
 assert.ok(result.every(p=>Number.isFinite(p.depth)));
 assert.deepEqual(smoothedSegments([],1),[]);
});
test('graph toggle reveals raw line and turns while keeping the smoothed curve',()=>{
 const vm=require('node:vm'),fs=require('node:fs');let checked=false,nodes=[];
 const host={clientWidth:800,replaceChildren(){nodes=[];},append(){}};
 const detail={textContent:''};
 const document={getElementById:id=>id==='graph'?host:id==='graph-detail'?detail:id==='show-measurements'?{checked}:{value:'24'},
 createElementNS(ns,tag){const node={tag,attrs:{},setAttribute(k,v){this.attrs[k]=v;},append(){},addEventListener(){}};nodes.push(node);return node;}};
 const context=vm.createContext({window:{},document});
 vm.runInContext(fs.readFileSync(require.resolve('../public/graph.js'),'utf8'),context);
 const samples=Array.from({length:61},(_,i)=>({timer:i*60000,depth:i===30?5.6:7.5,breakBefore:i===40}));
 const history={samples,turns:[{timer:60000,depth:7.5,kind:'high'}],start:0,now:3600000,futureEvents:[],recordDataInterval:1};
 context.window.drawTideHistory(history,'ft');
 assert.equal(nodes.filter(n=>n.attrs.class==='depth-line').length,2);
 assert.equal(nodes.filter(n=>n.attrs.class==='raw-line').length,0);
 assert.equal(nodes.filter(n=>n.attrs.class==='turn').length,0);
 checked=true;context.window.drawTideHistory(history,'m');
 assert.equal(nodes.filter(n=>n.attrs.class==='depth-line').length,2);
 assert.equal(nodes.filter(n=>n.attrs.class==='raw-line').length,2);
 assert.equal(nodes.filter(n=>n.attrs.class==='turn').length,1);
});

test('three-hour display preserves a tidal-scale cycle while damping short oscillations',()=>{
 const samples=Array.from({length:1441},(_,i)=>({timer:i*60000,depth:7+0.3*Math.cos(2*Math.PI*i/745)+0.1*Math.sin(2*Math.PI*i/20)}));
 const trend=smoothedSegments(samples,1).flat();
 let error=0;
 for(let i=100;i<1340;i++)error+=Math.abs(trend[i].depth-(7+0.3*Math.cos(2*Math.PI*i/745)));
 assert.ok(error/1240<0.025);
 assert.ok(trend[745].depth-trend[372].depth>0.5);
});

test('isolated samples appear only in Show measurements, never as smoothed dots',()=>{
 const vm=require('node:vm'),fs=require('node:fs');let checked=false,nodes=[];
 const host={clientWidth:800,replaceChildren(){nodes=[];},append(){}};
 const detail={textContent:''};
 const document={getElementById:id=>id==='graph'?host:id==='graph-detail'?detail:id==='show-measurements'?{checked}:{value:'24'},
 createElementNS(ns,tag){const node={tag,attrs:{},setAttribute(k,v){this.attrs[k]=v;},append(){},addEventListener(){}};nodes.push(node);return node;}};
 const context=vm.createContext({window:{},document});
 vm.runInContext(fs.readFileSync(require.resolve('../public/graph.js'),'utf8'),context);
 const history={samples:[{timer:0,depth:2},{timer:600000,depth:3}],turns:[],start:0,now:660000,futureEvents:[],recordDataInterval:1};
 context.window.drawTideHistory(history,'m');
 assert.equal(nodes.filter(n=>n.tag==='circle').length,0);
 checked=true;context.window.drawTideHistory(history,'m');
 assert.equal(nodes.filter(n=>n.tag==='circle'&&n.attrs.class==='raw-line').length,2);
 assert.equal(nodes.filter(n=>n.attrs.class==='depth-line').length,0);
 assert.equal(history.samples.length,2);
});

test('automatic red mode requires night and a non-anchored/non-moored navigation state',()=>{
 for(const state of ['sailing','motoring','under way using engine','unknown'])assert.equal(appearance('night',null,state),'red');
 for(const state of ['anchored','moored',null,undefined,''])assert.equal(appearance('night',null,state),'dark');
 for(const mode of ['day',null,undefined,'other'])assert.equal(appearance(mode,null,'sailing'),'light');
 assert.equal(appearance('day','red','anchored'),'red');
});
