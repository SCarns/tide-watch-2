'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {smoothedSegments,historySegments,appearance}=require('../public/graph');
const original=require('./fixtures/installed-graph');
const minute=60000;
const samples=Array.from({length:49},(_,i)=>({timer:i*10*minute,depth:2+Math.sin(i/2)*.15+(i>24?.3:0)}));
test('default three-hour smoothing exactly preserves installed display calculation',()=>{
 assert.deepEqual(smoothedSegments(samples,10),original.smoothedSegments(samples,10));
});
test('display accepts 2–6-hour windows and retains raw samples and times',()=>{
 const before=JSON.stringify(samples),defaultCurve=smoothedSegments(samples,10);
 for(const hours of [2,3,4,5,6]){
  const curve=smoothedSegments(samples,10,hours);
  assert.equal(curve.flat().length,samples.length);
  assert.deepEqual(curve.flat().map(p=>p.timer),samples.map(p=>p.timer));
  if(hours!==3)assert.notDeepEqual(curve,defaultCurve);
 }
 assert.equal(JSON.stringify(samples),before);
 for(const hours of [null,0,1,7,Infinity,'invalid'])assert.deepEqual(smoothedSegments(samples,10,hours),defaultCurve);
});
test('smoothing never joins gaps, explicit breaks, or invalid observations',()=>{
 const data=[{timer:0,depth:2},{timer:minute,depth:2},{timer:10*minute,depth:8},{timer:11*minute,depth:8},{timer:12*minute,depth:4,breakBefore:true},{timer:13*minute,depth:null},{timer:14*minute,depth:9}];
 for(const hours of [2,3,4,5,6])assert.deepEqual(smoothedSegments(data,1,hours).map(s=>s.map(p=>p.depth)),[[2,2],[8,8],[4],[9]]);
 assert.equal(historySegments(data,1).length,4);
});
test('existing Day/Night/Red and Auto behavior is unchanged',()=>{
 for(const mode of ['day','night',null])for(const override of [null,'light','dark','red'])for(const state of ['sailing','motoring','anchored','moored',null])assert.equal(appearance(mode,override,state),original.appearance(mode,override,state));
});
