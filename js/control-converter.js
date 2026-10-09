/* Mixed control conversion using editor-exported component metadata. */
(function(root){
'use strict';
const G=typeof module==='object'?require('./gia'):root.GIA;
const P=typeof module==='object'?require('./control-profiles'):ControlProfiles;
const W=G.controlWire,hex=s=>Uint8Array.from(s.match(/../g)||[],b=>parseInt(b,16));
const names={84:'Text Box',85:'Cursor Event Area',89:'Reference',91:'Container',92:'Grid Scroller',93:'Preset Button',94:'Text Window',95:'Key Hint',96:'Image',98:'UI Animation',99:'Fullscreen UI Animation'};
function error(code,detail){const e=new Error(detail||code);e.code=code;e.detail=detail;throw e;}
const content=entry=>W.bytes(W.parse(W.bytes(W.parse(entry),19)),1);
const component=(o,type)=>o.components.find(c=>c.type===type);
function payload(c,tag){return W.bytes(W.parse(W.bytes(W.parse(hex(c.rawHex)),503)),tag);}
function kind(o,side){if(component(o,side==='server'?39:98))return 'animation';if(component(o,side==='server'?57:99))return 'fullscreenAnimation';if(component(o,side==='server'?25:84))return 'text';if(component(o,side==='server'?38:96))return 'image';if(o.role==='container'||component(o,91)||(side==='server'&&o.componentTypes.every(t=>[15,23,12].includes(t))))return 'container';return 'unsupported';}
function handles(bytes){const m=G.describeGia(bytes);return m.container.resourceClass===21||m.container.componentTypes.includes(91)||[m.container,...m.children].some(o=>o.componentTypes.some(t=>[25,39,57,84,85,89,92,93,94,95,98,99].includes(t)));}
function ordered(m){const visited=new Set();const by=new Map(m.children.map(o=>[o.guid,o])),out=[];function visit(p){let ids=p.childGuids.slice();if(m.templateKind==='client')ids.reverse();for(const id of ids){const o=by.get(id);if(!o||visited.has(id))error('links');visited.add(id);out.push(o);visit(o);}}visit(m.container);if(out.length!==m.children.length||new Set(out.map(o=>o.guid)).size!==out.length)error('links');return out;}
function decode(bytes){
 const m=G.describeGia(bytes),side=m.templateKind;
 if(!['server','client'].includes(side))error('unsupported');
 const all=[m.container,...m.children],ids=new Set();
 if(m.rootTags.filter(t=>t===1).length!==1||m.rootTags.some(t=>![1,2,3,4,5].includes(t)))error('unsupported');
 for(const o of all){if(o.hasDecorationPayload||o.fieldTags.some(t=>![1,2,3,5,19].includes(t))||o.contentFieldTags.some(t=>![501,502,503,504,505].includes(t)))error('unsupported');if(!Number.isInteger(o.index))error('links');if(!Number.isSafeInteger(o.guid)||ids.has(o.guid)||o.resourceGuid!==o.guid)error('links');ids.add(o.guid);}
 for(const o of all){if(o!==m.container&&!ids.has(o.parentGuid))error('links');if(o.childGuids.length!==new Set(o.childGuids).size)error('links');for(const id of o.referenceGuids)if(!ids.has(id))error('links');for(const id of o.childGuids)if(!ids.has(id)||all.find(x=>x.guid===id).parentGuid!==o.guid)error('links');if(o.transform){if(o.transform.platformCount!==4||new Set(o.transform.platformIds).size!==4||o.transform.platformIds.some(id=>id<0||id>3))error('transform');const ts=o.transform.platformTransforms||[o.transform];for(const t of ts)for(const k of ['scale','rotation','offset','size','anchorMin','anchorMax','pivot'])if(!t[k]||!Object.values(t[k]).every(Number.isFinite))error('transform');}}
 if(m.container.parentGuid!==null&&m.container.parentGuid!==0)error('links');
 const objects=ordered(m);if(kind(m.container,side)!=='container')objects.unshift(m.container);const unsupported=objects.filter(o=>kind(o,side)==='unsupported').map(o=>o.resourceName+' ('+(names[o.componentTypes.find(t=>names[t])]||'unknown control')+')');
 const elements=objects.map(o=>({type:kind(o,side),imported_name:o.resourceName,imported_index:o.index,model:o}));
 return {kind:side,isClassic:m.isClassic,model:m,mixedControls:true,unsupportedControls:unsupported,inferredBounds:false,json:{group_name:m.container.resourceName,elements}};
}
function setPayload(raw,tag,data){let f=W.parse(raw),d=W.bytes(f,503);return W.setBytes(raw,503,W.setBytes(d,tag,data));}
function targetComponent(side,type,guid,obj){const p=P[side].components[type];if(!p)error('unsupported','No component mapping for '+type);return W.patchComponent(hex(p.hex),p.guid,guid,obj||{});}
function transformComponent(o,side,discriminator){
 let raw=hex(component(o,12).rawHex),f=W.parse(raw),d=W.bytes(f,503),trTag=W.bytes(W.parse(d),13)?13:11,tr=W.bytes(W.parse(d),trTag),mp=W.bytes(W.parse(tr),12);
 mp=W.setValue(mp,502,discriminator);tr=W.setBytes(tr,12,mp);return W.setBytes(raw,503,W.setBytes(d,trTag,tr));
}
// Verified against the populated Text Box - Fixed editor export.
const textMap={503:508,504:509,505:510,506:502,507:513,510:504,511:505,515:507};
function textPayload(o,side){
 const from=side==='client'?'server':'client',raw=payload(component(o,from==='server'?25:84),from==='server'?19:75),fields=W.parse(raw),out=[];
 const map=from==='server'?textMap:Object.fromEntries(Object.entries(textMap).map(([a,b])=>[b,+a]));
 const defaults=W.parse(payload({rawHex:P.server.components[25].hex},19));
 for(const f of fields){
  if(map[f.tag]){out.push({...f,tag:map[f.tag]});continue;}
  if(from==='server'&&f.tag===502)continue;
  if(from==='server'&&f.tag===512){if(f.value!==W.value(defaults,512))error('unsupported','Unmapped Server text setting 512 in '+o.resourceName);continue;}
  if(from==='client'&&[501,512].includes(f.tag))continue;
  if(from==='client'&&f.tag===503){if(f.value!==12)error('unsupported','Unmapped Client font in '+o.resourceName);continue;}
  error('unsupported','Unmapped text setting '+f.tag+' in '+o.resourceName);
 }
 if(from==='server'){
  const size=W.value(fields,502)||20,auto=W.value(fields,506)||0;
  out.push(W.variable(501,auto?20:size),W.variable(503,12),W.variable(512,size));
 }else{
  const auto=W.value(fields,502)||0;
  out.push(W.variable(502,(auto?W.value(fields,512):W.value(fields,501))||20));
  // These settings are omitted by the Client editor when at their defaults.
  for(const [tag,value] of [[503,0],[504,0],[506,0],[507,20]])if(!out.some(f=>f.tag===tag))out.push(W.variable(tag,value));
  out.push(W.variable(512,W.value(defaults,512)));
 }
 return W.build(out);
}
function animationPayload(o,from,to){
 const full=kind(o,from)==='fullscreenAnimation',type=from==='server'?(full?57:39):(full?99:98),tag=from==='server'?(full?49:32):(full?87:86);
 const fields=W.parse(payload(component(o,type),tag));
 const mapping=full?{501:501}:from==='server'?{502:501,503:502}:{501:502,502:503};
 if(fields.some(f=>!mapping[f.tag]))error('unsupported','Unmapped animation setting in '+o.resourceName);
 return W.build(fields.map(f=>({...f,tag:mapping[f.tag]})));
}
function objectComponents(o,from,to){
 const k=kind(o,from),guid=o.guid,obj={name:o.componentName||o.resourceName,image_asset_ref:o.imageAssetRef,packed_color:o.packedColor,image_option:o.imageOption,is_mask:o.isMask};
 const allowed=from==='server'?[15,23,11,12,25,38,39,56,57]:[15,86,12,83,90,91,84,96,97,98,99];
 if((component(o,56)&&o.mask?.enabled)||o.isMask)error('unsupported','Mixed control masks are not mapped: '+o.resourceName);
 if(o.components.some(c=>!allowed.includes(c.type)))error('unsupported','Unmapped component in '+o.resourceName);
 let comps=[hex(component(o,15).rawHex),targetComponent(to,to==='client'?86:23,guid)];
 if(k==='fullscreenAnimation'&&to==='server')comps.push(targetComponent(to,11,guid));
 else if(o.transform)comps.push(transformComponent(o,to,to==='server'?(k==='animation'?10:3):k==='text'?31:k==='container'?25:k==='animation'?29:k==='fullscreenAnimation'?30:23));
 else if(k==='fullscreenAnimation'&&to==='client'){const p=P.client.animationTransforms[99];comps.push(W.patchComponent(hex(p.hex),p.guid,guid,{name:o.resourceName,offset_x:0,offset_y:0,size_x:0,size_y:0,rot_z:0,imported_transform:{scale:{x:1,y:1,z:1},rotation:{x:0,y:0,z:0}}}));}
 if(to==='client')comps.push(targetComponent(to,83,guid));
 if(k==='animation'||k==='fullscreenAnimation'){const full=k==='fullscreenAnimation';comps.push(setPayload(targetComponent(to,to==='client'?(full?99:98):(full?57:39),guid),to==='client'?(full?87:86):(full?49:32),animationPayload(o,from,to)));}
 if(k==='text')comps.push(setPayload(targetComponent(to,to==='client'?84:25,guid),to==='client'?75:19,textPayload(o,to)));
 if(k==='image'){
  if(to==='client'){
   comps.push(targetComponent(to,96,guid,obj),targetComponent(to,97,guid,{...obj,is_mask:false}));
  }else{
   const extras=component(o,97);if(extras){const actual=W.deleteField(payload(extras,85),501),expected=W.deleteField(payload({rawHex:P.client.components[97].hex},85),501);if(JSON.stringify(canonicalFields(actual))!==JSON.stringify(canonicalFields(expected)))error('unsupported','Client image effects have no mapped Server equivalent: '+o.resourceName);}
   const p=P.server.components[38],raw=hex(p.hex),d=W.bytes(W.parse(raw),503),pl=W.bytes(W.parse(d),31);
   let mapped=W.setValue(W.setValue(pl,2,o.imageAssetRef||0),4,o.packedColor);mapped=o.imageOption?W.setValue(mapped,5,o.imageOption):W.deleteField(mapped,5);
   comps.push(setPayload(W.patchComponent(raw,p.guid,guid,obj),31,mapped));
  }
 }
 if(k==='container'&&to==='client')comps.push(targetComponent(to,91,guid));
 if(to==='client')comps.push(targetComponent(to,90,guid));
 return comps;
}
function canonicalFields(raw){return W.parse(raw).map(f=>[f.tag,f.wire,f.data?Array.from(f.data):f.raw?Array.from(f.raw):f.value]).sort((a,b)=>a[0]-b[0]);}
function equalScene(a,b){
 if(a.json.group_name!==b.json.group_name||a.isClassic!==b.isClassic||a.json.elements.length!==b.json.elements.length)return false;
 const positions=s=>new Map([[s.model.container.guid,-1],...s.json.elements.map((e,i)=>[e.model.guid,i])]);
 const pa=positions(a),pb=positions(b);
 return a.json.elements.every((e,i)=>{
  const f=b.json.elements[i],o=e.model,p=f.model;
  if(pa.get(o.parentGuid)!==pb.get(p.parentGuid)||JSON.stringify(o.childGuids.map(id=>pa.get(id)).sort((a,b)=>a-b))!==JSON.stringify(p.childGuids.map(id=>pb.get(id)).sort((a,b)=>a-b)))return false;
  if(e.type!==f.type||e.imported_name!==f.imported_name||e.imported_index!==f.imported_index||o.componentName!==p.componentName)return false;
  if(e.type!=='fullscreenAnimation'&&JSON.stringify(o.transform)!==JSON.stringify(p.transform)){
   const tr=t=>t&&({scale:t.scale,anchorMin:t.anchorMin,anchorMax:t.anchorMax,offset:t.offset,size:t.size,pivot:t.pivot,rotation:t.rotation,platformIds:t.platformIds,platformTransforms:t.platformTransforms});
   if(JSON.stringify(tr(o.transform))!==JSON.stringify(tr(p.transform)))return false;
  }
  if(e.type==='animation'||e.type==='fullscreenAnimation'){const norm=(o,side)=>canonicalFields(side==='server'?payload(component(o,e.type==='animation'?39:57),e.type==='animation'?32:49):animationPayload(o,'client','server'));if(JSON.stringify(norm(o,a.kind))!==JSON.stringify(norm(p,b.kind)))return false;}
  if(e.type==='text'){
   const norm=(o,side)=>canonicalFields(side==='server'?payload(component(o,25),19):textPayload(o,'server'));
   if(JSON.stringify(norm(o,a.kind))!==JSON.stringify(norm(p,b.kind)))return false;
  }
  if(e.type==='image'&&((o.imageAssetRef||0)!==(p.imageAssetRef||0)||(o.packedColor>>>0)!==(p.packedColor>>>0)||o.imageOption!==p.imageOption))return false;
  return true;
 });
}
function convert(bytes){
 const source=decode(bytes);if(source.unsupportedControls.length)error('unsupportedControls','No mapped Server equivalent: '+source.unsupportedControls.join(', '));
 const from=source.kind,to=from==='server'?'client':'server',m=source.model,parsed=W.parseRoot(bytes),fields=W.parse(new Uint8Array(bytes).subarray(20,20+parsed.content_len));
 const by=new Map([m.container,...m.children].map(o=>[o.guid,o]));
 function entry(raw,primary){
  let ef=W.parse(raw),c=content(raw),cf=W.parse(c),o=by.get(W.value(cf,501));
  let comps=objectComponents(o,from,to);
  if(primary&&!o.transform&&to==='client'&&kind(o,from)==='container'){
   // A neutral Client container establishes the same coordinate origin.
   const p=P.client.components[12];
   const ob={offset_x:0,offset_y:0,size_x:1,size_y:1,rot_z:0,imported_transform:{scale:{x:1,y:1,z:1},rotation:{x:0,y:0,z:0}}};
   comps.splice(2,0,W.patchComponent(hex(p.hex),p.guid,o.guid,ob));
  }
  const output=cf.filter(f=>f.tag!==505&&f.tag!==503);
  if(o.childGuids.length)output.push(W.len(503,W.packed(o.childGuids.slice().reverse())));
  comps.forEach(c=>output.push(W.len(505,c)));
  c=W.build(output);
  const ui=W.bytes(ef,19);let updated=W.setBytes(raw,19,W.setBytes(ui,1,c));
  if(primary)updated=W.setValue(updated,5,to==='client'?70:21);
  return updated;
 }
 const roots=fields.filter(f=>f.tag===1).map(f=>W.len(1,entry(f.data,true)));
 const children=fields.filter(f=>f.tag===2).reverse().map(f=>W.len(2,entry(f.data,false)));
 const out=W.wrap(roots.concat(children,fields.filter(f=>![1,2].includes(f.tag))),parsed),result=decode(out);
 if(result.kind!==to||!equalScene(source,result))error('validation','Converted controls did not preserve their content');
 return {bytes:out,source,result};
}
const api={handles,decode,convert,textPayload,names,equalScene};if(typeof module==='object')module.exports=api;else root.ControlConverter=api;
})(typeof window==='object'?window:globalThis);
