'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {TideAnalyzer,msPhaseLength}=require('../TideAnalysis');
const factory=require('../index'),originalFactory=require('../OriginalPlugin');
const {smoothedSegments,historySegments,appearance}=require('../public/graph');
const samples=()=>Array.from({length:865},(_,i)=>({timer:1700000000000+i*300000,depth:5+0.5*Math.cos(i*300000/(msPhaseLength*2)*Math.PI*2),pos:{latitude:12,longitude:-61}}));
test('custom depth paths accept derived events without source metadata and honor filters',()=>{
 const Bacon=require('baconjs'),fs=require('fs'),os=require('os'),path=require('path');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'tide-input-'));
 const priorPoll=Bacon.fromPoll;Bacon.fromPoll=()=>new Bacon.Bus();
 const buses=new Map(),depthPath='environment.custom.derivedDepth';
 const app={debug(){},setPluginStatus(){},setPluginError(){},getDataDirPath:()=>directory,
 streambundle:{getSelfBus:p=>{if(!buses.has(p))buses.set(p,new Bacon.Bus());return buses.get(p);}},handleMessage(){}};
 let p;
 try{
  p=factory(app);p.start({depthPath});const values=[];
  p.evtDepthVal.onValue(v=>values.push(v));
  buses.get(depthPath).push({value:3.2,$source:'derived.depth'});
  buses.get(depthPath).push({value:3.3,source:null});
  assert.deepEqual(values,[3.2,3.3]);
  p.options.depthSourceType='NMEA2000';
  buses.get(depthPath).push({value:8});
  buses.get(depthPath).push({value:3.4,source:{type:'NMEA2000'}});
  p.options.depthSourceTalker='SD';
  buses.get(depthPath).push({value:9,source:{type:'NMEA2000'}});
  buses.get(depthPath).push({value:3.5,source:{type:'NMEA2000',talker:'SD'}});
  assert.deepEqual(values,[3.2,3.3,3.4,3.5]);
  p.stop();p=factory(app);p.start({depthPath,depthSource:'derived.depth'});
  const selected=[];p.evtDepthVal.onValue(v=>selected.push(v));
  buses.get(depthPath).push({value:9,$source:'other'});
  buses.get(depthPath).push({value:3.6,$source:'derived.depth'});
  assert.deepEqual(selected,[3.6]);
 }finally{if(p)p.stop();Bacon.fromPoll=priorPoll;fs.rmSync(directory,{recursive:true,force:true});}
});
test('UI observation leaves original analysis and phase events unchanged',()=>{
 const make=events=>new TideAnalyzer({push:e=>events.push(JSON.parse(JSON.stringify(e)))},5,25,()=>{});
 const eventsA=[],eventsB=[],a=make(eventsA),b=make(eventsB),p={tideInfo:b};
 factory.attachHistory(p);a.start();b.start();
 a.getTime=b.getTime=()=>1700000000000+72*3600000;
 for(const data of samples()){a.includeData({...data},true);b.includeData({...data},true);}
 assert.deepEqual(b.getTideStatus(),a.getTideStatus());assert.deepEqual(eventsB,eventsA);
 assert.equal(p.graphSamples.length,865);assert.ok(p.graphTurns.length>5);
 assert.equal(msPhaseLength*2,745*60000);
});
test('display preferences do not affect original Signal K publications',()=>{
 const app={debug(){},setPluginStatus(){}};const p=factory(app),original=originalFactory(app);
 for(const plugin of [p,original]){
  plugin.options={recordDataInterval:5,displayUnits:'ft'};
  plugin.tideInfo=new TideAnalyzer({push(){}},5,25,()=>{});plugin.tideInfo.start();
  plugin.tideInfo.getTime=()=>1700000000000+72*3600000;
  plugin.recordingData=true;plugin.graphSamples=[];plugin.graphTurns=[];
 }
 let expected,actual;original.sendSKValues=v=>expected=v;p.sendSKValues=v=>actual=v;
 const event={phase:'flood',lowestKnown:{timer:1700000000000,depth:4.5},highestKnown:{timer:1700000000000+msPhaseLength,depth:5.5}};
 original.onTidePhase(event);p.onTidePhase(event);assert.deepEqual(actual,expected);
 p.options.displayUnits='m';p.options.displaySmoothingHours=6;p.environmentMode='night';p.onTidePhase(event);assert.deepEqual(actual,expected);
 assert.ok(actual.some(v=>v.path==='environment.tide.heightLow'&&v.value===4.5));
});
test('original binary recording and replay rebuild display history',()=>{
 const Bacon=require('baconjs'),fs=require('fs'),os=require('os'),path=require('path');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'tide-original-'));
 const priorPoll=Bacon.fromPoll;Bacon.fromPoll=()=>new Bacon.Bus();
 const buses=new Map();const app={debug(){},setPluginStatus(){},setPluginError(){},getDataDirPath:()=>directory,
 streambundle:{getSelfBus:p=>{if(!buses.has(p))buses.set(p,new Bacon.Bus());return buses.get(p);}},handleMessage(){}};
 let p;
 try{
  p=factory(app);p.start({});assert.equal(p.options.recordDataInterval,5);
  const data=samples().slice(0,30);p.getTime=()=>data[data.length-1].timer;p.startRecording({pos:data[0].pos});
  for(const point of data)p.recordDepth(point);
  assert.equal(p.graphSamples.length,30);
  p.startRecording({pos:data[0].pos});assert.equal(p.graphSamples.length,30);
  assert.ok(Math.abs(p.graphSamples[10].depth-data[10].depth)<0.000001);
  assert.equal(p.graphSamples[0].breakBefore,true);
  const routes={};p.registerWithRouter({get:(u,f)=>routes[u]=f,put(){}});
  let result;const res={json:v=>result=v,status(){return this;}};
  routes['/api/status']({},res);assert.equal(result.displayUnits,'m');assert.equal(result.displaySmoothingHours,3);
  p.options.displaySmoothingHours=6;routes['/api/status']({},res);assert.equal(result.displaySmoothingHours,6);
  assert.deepEqual(p._schema.properties.displaySmoothingHours.enum,[2,3,4,5,6]);
  routes['/api/history']({query:{hours:'24'}},res);assert.equal(result.samples.length,30);
  routes['/api/history']({query:{hours:'bad'}},res);assert.ok(result.error);
 }finally{if(p)p.stop();Bacon.fromPoll=priorPoll;fs.rmSync(directory,{recursive:true,force:true});}
});
test('three-hour smoothing and gaps remain display-only',()=>{
 const data=samples();const saved=JSON.stringify(data);const trend=smoothedSegments(data,5);
 assert.equal(trend.flat().length,data.length);assert.equal(JSON.stringify(data),saved);
 assert.equal(appearance('night',null),'dark');assert.equal(appearance(undefined,null),'light');
 assert.equal(historySegments([{timer:0,depth:2},{timer:600000,depth:3}],1).length,2);
});
