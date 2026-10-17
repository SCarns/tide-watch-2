'use strict';
const fs=require('fs');
const originalFactory=require('./OriginalPlugin');
const {msPhaseLength}=require('./TideAnalysis');

// UI adapter only. OriginalPlugin and TideAnalysis retain upstream processing
// and publications. Capture copies for the graph; never feed smoothing back.
function attachHistory(plugin) {
  const analyzer=plugin.tideInfo;
  plugin.graphSamples=[];plugin.graphTurns=[];let pending=true;
  const start=analyzer.start,reset=analyzer.resetPhaseTracking,include=analyzer.includeData;
  analyzer.start=function(){plugin.graphSamples=[];plugin.graphTurns=[];return start.apply(this,arguments);};
  analyzer.resetPhaseTracking=function(){pending=true;return reset.apply(this,arguments);};
  analyzer.includeData=function(data,live){
    const previous={high:this.highestKnown&&this.highestKnown.timer,low:this.lowestKnown&&this.lowestKnown.timer};
    const result=include.apply(this,arguments);
    if(Number.isFinite(data.timer)&&Number.isFinite(data.depth)){
      const last=plugin.graphSamples[plugin.graphSamples.length-1];
      if(!last||data.timer>last.timer){plugin.graphSamples.push({timer:data.timer,depth:data.depth,breakBefore:pending});pending=false;}
      const cutoff=data.timer-30*24*3600000;
      plugin.graphSamples=plugin.graphSamples.filter(p=>p.timer>=cutoff);
      for(const [kind,key] of [['high','highestKnown'],['low','lowestKnown']]){
        const turn=this[key];
        if(turn&&Number.isFinite(turn.timer)&&Number.isFinite(turn.depth)&&turn.timer!==previous[kind])plugin.graphTurns.push({kind,timer:turn.timer,depth:turn.depth});
      }
      plugin.graphTurns=plugin.graphTurns.filter(p=>p.timer>=cutoff);
    }
    return result;
  };
}
function displayStatus(plugin){
  const s=plugin.tideInfo.lowestKnown?plugin.tideInfo.getTideStatus():{lowestKnown:{},highestKnown:{},curTidePhase:'',lastReading:null},latest=plugin.graphSamples[plugin.graphSamples.length-1];
  const future=[];
  for(const [kind,key] of [['low','nextLowestKnown'],['high','nextHighestKnown']]){
    const event=s[key];if(event&&Number.isFinite(event.timer))future.push({kind,timer:event.timer,earliest:event.timer,latest:event.timer,timingDescription:'Fixed 12 h 25 min cycle'});
  }
  const phase=s.curTidePhase;
  const range=[s.highestKnown.waveHeight,s.lowestKnown.waveHeight].find(Number.isFinite);
  return {captureLocation:plugin.captureLocation,recordingData:plugin.recordingData,
    state:plugin.recordingData?(phase==='flood'?'rising':phase==='ebb'?'falling':'unknown'):'unknown',
    reason:plugin.recordingData?null:'Not recording — original engine/depth tracking',
    depth:latest?latest.depth:null,rateMetresPerHour:Number.isFinite(s.curTideDir)?s.curTideDir*36:null,
    observedRangeMetres:Number.isFinite(range)?Math.abs(range):null,lastReading:s.lastReading,
    depthPath:plugin.options.depthPath,source:plugin.options.depthSource||'Original source filters',
    trendMinutes:30,observedTurns:plugin.graphTurns.slice(-12),futureEvents:future,
    predictionReasons:[future.length?'Original prediction: fixed 12 h 25 min repeat cycle; no calibrated timing allowance.':'Original analysis is gathering observations.'],
    displaySmoothingHours:[2,3,4,5,6].includes(Number(plugin.options.displaySmoothingHours))?Number(plugin.options.displaySmoothingHours):3,
    displayUnits:plugin.options.displayUnits==='ft'?'ft':'m',environmentMode:plugin.environmentMode,navigationState:plugin.navigationState};
}
module.exports=function(app){
  const p=originalFactory(app);
  p.name='Tide Watch 2';
  p.optNum('displaySmoothingHours','Preferred chart smoothing (hours)',3,false,'Display only: 2–6 hours. The graph selector temporarily overrides this preference; tide calculations are unchanged.');
  p._schema.properties.displaySmoothingHours.enum=[2,3,4,5,6];
  p.optStr('displayUnits','Preferred display units','m',false,'Display only; original Signal K outputs remain in their original units.');
  p._schema.properties.displayUnits.enum=['m','ft'];p._schema.properties.displayUnits.enumNames=['Metres','Feet'];
  p.optStr('depthSource','Depth source ID filter','');
  const bus=p.getSKBus;
  p.getSKBus=function(path,all){const stream=bus.call(this,path,all);return path===this.options.depthPath&&this.options.depthSource?stream.filter(e=>e.$source===this.options.depthSource):stream;};
  const started=p.onPluginStarted;
  p.onPluginStarted=function(){
    fs.mkdirSync(this.dataDir,{recursive:true});this.graphSamples=[];this.graphTurns=[];
    started.apply(this,arguments);attachHistory(this);
    const initial=typeof app.getSelfPath==='function'?app.getSelfPath('environment.mode'):null;
    this.environmentMode=initial&&['day','night'].includes(initial.value)?initial.value:null;
    const navigation=typeof app.getSelfPath==='function'?app.getSelfPath('navigation.state'):null;
    this.navigationState=navigation&&typeof navigation.value==='string'?navigation.value:null;
    this.subscribeVal(this.getSKBus('navigation.state'),e=>{this.navigationState=e&&typeof e.value==='string'?e.value:null;});
    this.subscribeVal(this.getSKBus('environment.mode'),e=>{this.environmentMode=e&&['day','night'].includes(e.value)?e.value:null;});
  };
  p.registerWithRouter=function(router){
    router.get('/api/status',(req,res)=>this.running?res.json(displayStatus(this)):res.status(503).json({error:'Plugin stopped'}));
    router.get('/api/history',(req,res)=>{
      if(!this.running)return res.status(503).json({error:'Plugin stopped'});
      const hours=req.query&&req.query.hours!==undefined?Number(req.query.hours):24;
      if(!Number.isFinite(hours)||hours<=0||hours>720)return res.status(400).json({error:'Hours must be between 0 and 720'});
      const now=this.getTime(),start=now-hours*3600000;
      res.json({start,now,recordDataInterval:this.options.recordDataInterval,
        samples:this.graphSamples.filter(p=>p.timer>=start&&p.timer<=now),
        turns:this.graphTurns.filter(p=>p.timer>=start&&p.timer<=now),futureEvents:displayStatus(this).futureEvents});
    });
    router.put('/api/location',(req,res)=>{
      if(!this.captureLocation||!req.body||req.body.id!==this.captureLocation.id||typeof req.body.name!=='string'||req.body.name.length>200)return res.status(400).json({error:'Invalid location name'});
      try{const loc={...this.captureLocation,name:req.body.name};this.locationManager.saveLocation(loc);this.captureLocation=loc;res.json({status:'OK'});}catch(error){res.status(500).json({error:error.message});}
    });
  };
  return p;
};
module.exports.attachHistory=attachHistory;
module.exports.displayStatus=displayStatus;
