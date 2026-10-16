const assert=require('node:assert/strict'),fs=require('node:fs'),G=require('../js/gia'),C=require('../js/converter');
const templates={client:fs.readFileSync('assets/client_mask_off_template.gia'),server:fs.readFileSync('assets/image_template.gia')};
const W=G.controlWire;
function assertServerMetadata(bytes){for(const part of G.splitUiGroups(bytes)){const model=G.describeGia(part),root=W.parse(part.subarray(20,part.length-4)).find(f=>f.tag===1),content=W.parse(W.bytes(W.parse(W.bytes(W.parse(root.data),19)),1));const record=content.find(f=>f.tag===502&&W.value(W.parse(f.data),501)===6);const detail=W.parse(W.bytes(W.parse(record.data),503));assert.equal(W.value(detail,502),13);assert.equal(W.value(W.parse(W.bytes(detail,504)),4),model.container.guid,'Server metadata locator must point to the remapped parent');assert(!model.children.some(o=>o.index===model.container.index),'Parent and child indices must be distinct');}}
function assertAssetMetadata(bytes){
 const fixture=fs.readFileSync('tests/fixtures/z_ui_animation_server_asset_group.gia');
 const prototypePath=G.describeGia(fixture).sourcePath;
 for(const part of G.splitUiGroups(bytes)){
  const model=G.describeGia(part),parent=model.container,root=W.parse(part.subarray(20,part.length-4)).find(f=>f.tag===1),content=W.parse(W.bytes(W.parse(W.bytes(W.parse(root.data),19)),1));
  assert.equal(parent.resourceClass,61);assert.deepEqual(parent.infoSlots.map(s=>[s.slot,s.type]),[[1,5],[2,6],[4,4],[6,55]]);
  const record=content.find(f=>f.tag===502&&W.value(W.parse(f.data),501)===6),detail=W.parse(W.bytes(W.parse(record.data),503));
  assert.equal(W.value(detail,502),55);assert.equal(W.value(W.parse(W.bytes(detail,504)),4),parent.guid,'Asset metadata locator must follow bundle GUID remapping');
  assert(parent.componentTypes.includes(12));assert(parent.componentTypes.includes(56));assert.equal(model.sourcePath,prototypePath,'Asset export provenance must not retain the Server template namespace');
 }
}
const classes={'asset-group':61,'server-control':21,'client-control':70};
for(const classic of [false,true])for(const name of ['ServerControlTemplate','OrangeDisc','z_bigbanner','z_frisbee_all','z_ui_animation_server']){
 const fixture=fs.readFileSync('tests/fixtures/'+name+'.gia'),input=classic?G.toClassic(fixture):fixture;
 const initial=C.decodeUiGia(input);
 const versions=Object.fromEntries(C.FORMATS.map(format=>{const r=C.convertUiGia(input,format==='client-control'?templates.client:templates.server,format);assert.equal(r.result.format,format);assert.equal(r.result.isClassic,classic);assert(C.equalScene(initial,r.result));for(const g of r.result.groups||[r.result])assert.equal(g.model.containerClass,classes[format]);return [format,r.bytes];}));
 for(const from of C.FORMATS)for(const to of C.FORMATS.filter(f=>f!==from)){
  const r=C.convertUiGia(versions[from],to==='client-control'?templates.client:templates.server,to);
  assert.equal(r.result.format,to);
  if(to==='asset-group')assertAssetMetadata(r.bytes);
  if(to==='server-control')assertServerMetadata(r.bytes);
  if(to==='server-control')for(const group of r.result.groups||[r.result]){const parent=group.model.container;assert.deepEqual(parent.componentTypes,[15,23]);assert.equal(parent.transform,null);assert.equal(parent.mask,null);assert.deepEqual(parent.infoSlots.map(s=>[s.slot,s.type]),[[1,5],[2,6],[4,4],[6,13]]);assert(group.model.children.every(o=>!o.componentTypes.includes(56)));}const baseline=from==='server-control'?C.decodeUiGia(versions[from]):initial;assert(C.equalScene(baseline,r.result),name+' '+from+' -> '+to);
 }
 if(name==='ServerControlTemplate'&&!classic)for(const [format,bytes]of Object.entries(versions))fs.writeFileSync('output/ServerControlTemplate_'+format+'.gia',bytes);
}
// Parent sizing regression: rotated/scaled asymmetric contents need a real frame.
const shapes=G.convertJsonToGiaBytes({import_scene:true,group_name:'Frame bounds',elements:[
 {type:'rectangle',imported_name:'Rotated',relative:{x:-100,y:-25},size:{width:80,height:20},rotation:{z:90},imported_transform:{scale:{x:2,y:1,z:1},rotation:{x:0,y:0,z:90}}},
 {type:'rectangle',imported_name:'Offset',relative:{x:200,y:75},size:{width:40,height:20}}
],mask:{position:{x:0,y:0},size:{x:1000,y:1000},shape_type:1,enabled:false}},templates.server,G.MODE_IMAGE);
const serverShapes=C.convertUiGia(shapes,templates.server,'server-control');
const assetShapes=C.convertUiGia(serverShapes.bytes,templates.server,'asset-group');
const clientShapes=C.convertUiGia(serverShapes.bytes,templates.client,'client-control');
for(let i=0;i<4;i++){
 const asset=assetShapes.result.model.container.transform.platformTransforms[i],client=clientShapes.result.model.container.transform.platformTransforms[i];
 assert.deepEqual(asset.size,{x:330,y:190});assert.deepEqual(asset.offset,{x:55,y:-10});assert.deepEqual(asset.size,client.size);assert.deepEqual(asset.offset,client.offset);
}
assert(C.equalScene(serverShapes.result,assetShapes.result));
for(const file of ['ServerControlTemplate','z_scoreboard']){
 const source=fs.readFileSync('tests/fixtures/'+file+'.gia'),asset=C.convertUiGia(source,templates.server,'asset-group'),client=C.convertUiGia(source,templates.client,'client-control');
 for(let i=0;i<4;i++)assert.deepEqual(asset.result.model.container.transform.platformTransforms[i].size,client.result.model.container.transform.platformTransforms[i].size);
 if(file==='z_scoreboard')fs.writeFileSync('output/z_scoreboard_asset-group.gia',asset.bytes);
}
// Regression: a class-only relabel must never qualify as a valid Asset Group.
const controls=require('../js/control-converter'),server=fs.readFileSync('tests/fixtures/ServerControlTemplate.gia');
assert.throws(()=>controls.validateServerExport(G.setServerExportFormat(server,61),'asset-group'),/metadata disagree/);
assert.equal(C.decodeUiGia(fs.readFileSync('tests/fixtures/ServerControlTemplate.gia')).format,'server-control');
console.log('PASS: all six conversion directions in both modes; mixed controls, masks, multiple groups and standalone animations');
