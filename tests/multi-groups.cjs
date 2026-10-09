const assert=require('node:assert/strict'),fs=require('node:fs');
const G=require('../js/gia'),C=require('../js/converter');
const input=fs.readFileSync('tests/fixtures/z_frisbee_all.gia'),client=fs.readFileSync('assets/client_mask_off_template.gia'),server=fs.readFileSync('assets/image_template.gia');
for(const classic of [false,true]){
 const source=classic?G.toClassic(input):input;
 const r=C.convertUiGia(source,client),back=C.convertUiGia(r.bytes,server);
 assert(C.equalScene(r.source,r.result));assert(C.equalScene(r.source,back.result));
 assert.equal(r.result.kind,'client');assert.equal(r.result.isClassic,classic);assert.equal(r.result.json.elements.length,289);
 assert.deepEqual(r.result.groups.map(g=>g.json.group_name),['PurpleDisc','CyanDisc','OrangeDisc']);
 assert.deepEqual(r.result.groups.map(g=>g.json.elements.length),[46,153,90]);
 const ids=[];
 for(const group of r.result.groups){
  ids.push(group.model.container.guid,...group.model.children.map(o=>o.guid));
  assert(!group.model.children.some(o=>o.index===group.model.container.index),'Parent index must not collide with a child');
  const report=G.validateClientImage(G.splitUiGroups(r.bytes)[r.result.groups.indexOf(group)],{container:G.buildImageScene(group.json).clientContainer,hierarchyIndices:group.model.container.childGuids.map(g=>group.model.children.find(o=>o.guid===g).index)});assert(report.ok,report.errors.join('; '));
 }
 assert.equal(new Set(ids).size,292);
 for(let i=0;i<r.source.groups.length;i++) {
  const before=r.source.groups[i].model,after=r.result.groups[i].model;
  const list=m=>{const by=new Map(m.children.map(o=>[o.guid,o]));return m.container.childGuids.map(g=>{const o=by.get(g);return [o.resourceName,o.index,o.imageAssetRef,o.packedColor];});};
  const beforeList=list(before),afterList=list(after);
  assert.deepEqual(afterList,beforeList.slice().reverse());
  assert.deepEqual(after.children.map(o=>[o.resourceName,o.index,o.imageAssetRef,o.packedColor]),before.children.map(o=>[o.resourceName,o.index,o.imageAssetRef,o.packedColor]).reverse());
  const restored=list(back.result.groups[i].model);
  assert.deepEqual(restored,beforeList);
 }

 const altered=structuredClone(r.result);altered.groups[1].json.elements[0].image_asset_ref+=1;assert.equal(C.equalScene(r.source,altered),false);
}
console.log('PASS: three groups / 289 images in one Client GIA, unique GUIDs, individual masks, validation and both-mode round trips');
