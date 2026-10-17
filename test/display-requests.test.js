'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(){
 const elements=new Map(),requests=[],draws=[];
 function element(id){if(!elements.has(id))elements.set(id,{value:id==='units'?'ft':id==='history-range'?'24':'',textContent:'',dataset:{},classList:{add(){},toggle(){}},replaceChildren(){},appendChild(){},addEventListener(){},setAttribute(){}});return elements.get(id);}
 const context=vm.createContext({document:{getElementById:element,body:{dataset:{}},createElement:()=>element('temporary')},appearance:()=> 'light',drawTideHistory:h=>draws.push(h),ResizeObserver:class{observe(){}},setInterval(){},fetch:url=>new Promise((resolve,reject)=>requests.push({url,resolve,reject}))});
 vm.runInContext(fs.readFileSync(require.resolve('../public/local.js'),'utf8'),context);
 return {context,requests,draws};
}
test('a failed older history request cannot clear a newer successful chart',async()=>{
 const h=harness();
 const first=vm.runInContext('refreshHistory()',h.context),second=vm.runInContext('refreshHistory()',h.context);
 const latest={samples:[{timer:100,depth:2}]};
 h.requests[2].resolve({ok:true,json:async()=>latest});await second;
 h.requests[1].reject(new Error('Old request failed'));await first;
 assert.equal(h.draws.at(-1),latest);assert.equal(vm.runInContext('history',h.context),latest);
});
test('status failure clears the old chart and invalidates in-flight history',async()=>{
 const h=harness(),pending=vm.runInContext('refreshHistory()',h.context);
 h.requests[0].reject(new Error('Server unavailable'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.draws.at(-1),null);
 h.requests[1].resolve({ok:true,json:async()=>({samples:[{timer:100,depth:2}]})});await pending;
 assert.equal(h.draws.at(-1),null);assert.equal(vm.runInContext('history',h.context),null);
});
