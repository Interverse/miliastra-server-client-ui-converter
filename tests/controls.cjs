const assert=require('node:assert/strict'),fs=require('node:fs');
const G=require('../js/gia'),C=require('../js/converter'),M=require('../js/control-converter'),W=G.controlWire;
const source=fs.readFileSync('tests/fixtures/z_scoreboard.gia'),reference=fs.readFileSync('tests/fixtures/z_clientcontrol.gia');
const hex=s=>Buffer.from(s,'hex');
function payload(o,type,tag){const c=o.components.find(c=>c.type===type);return W.parse(W.bytes(W.parse(W.bytes(W.parse(hex(c.rawHex)),503)),tag));}
for(const classic of [false,true]){
 const input=classic?G.toClassic(source):source,r=C.convertUiGia(input),back=C.convertUiGia(r.bytes);
 assert.equal(r.result.kind,'client');assert.equal(r.result.isClassic,classic);assert.equal(r.result.json.elements.length,83);
 assert.equal(r.result.json.elements.filter(e=>e.type==='text').length,67);assert.equal(r.result.json.elements.filter(e=>e.type==='image').length,16);
 assert(C.equalScene(r.source,r.result));assert(C.equalScene(r.source,back.result));
 const before=r.source.model,after=r.result.model;
 const byId=new Map(after.children.map(o=>[o.guid,o]));
 assert.deepEqual(after.container.childGuids.map(id=>byId.get(id).resourceName),before.children.map(o=>o.resourceName).reverse());
 for(const o of before.children){const p=byId.get(o.guid);assert.equal(p.parentGuid,after.container.guid);assert.equal(p.index,o.index);assert.deepEqual(p.transform.platformTransforms,o.transform.platformTransforms);
  if(o.componentTypes.includes(25)){
   assert(p.componentTypes.includes(84));assert.equal(p.transform.platformDiscriminator,31);
   const a=payload(o,25,19),b=payload(p,84,75);
   for(const [server,client] of [[502,512],[503,508],[504,509],[505,510],[506,502],[507,513],[510,504],[511,505],[515,507]]){
    const x=a.find(f=>f.tag===server),y=b.find(f=>f.tag===client);assert(x&&y,'Mapped text field');if(x.data)assert.deepEqual(Array.from(x.data),Array.from(y.data));else assert.equal(y.value,x.value);
   }
  }else{assert(p.componentTypes.includes(96));assert.equal(p.imageAssetRef,o.imageAssetRef);assert.equal(p.packedColor,o.packedColor);}
 }
 const altered=structuredClone(r.result);altered.json.elements[0].model.transform.offset.x+=1;assert.equal(C.equalScene(r.source,altered),false);
 if(!classic){fs.writeFileSync('output/z_scoreboard_client.gia',r.bytes);fs.writeFileSync('output/z_scoreboard_server.gia',back.bytes);}
}
// Independently repaired in-game image: compare actual settings, not round trips.
const repaired=G.describeGia(fs.readFileSync('tests/fixtures/z_scoreboard_2.gia'));
const fixed=repaired.children.find(o=>o.resourceName==='Score BG - Fixed');
const fixedSettings=payload(fixed,96,84),generated=C.convertUiGia(source).result.model.children;
const matching=generated.filter(o=>o.resourceName==='Score BG'&&o.imageAssetRef===fixed.imageAssetRef&&o.packedColor===fixed.packedColor);
assert(matching.length>0);
for(const o of matching){const actual=payload(o,96,84);for(const tag of [502,503,504])assert.equal(W.value(actual,tag),W.value(fixedSettings,tag));assert(!actual.some(f=>f.tag===501));}
assert.equal(fixed.imageOption,1);
const fixedText=repaired.children.find(o=>o.resourceName==='Text Box - Fixed'),generatedText=generated.find(o=>o.resourceName==='Text Box');
const expectedText=payload(fixedText,84,75),actualText=payload(generatedText,84,75);
assert.deepEqual(actualText.map(f=>[f.tag,f.data?Array.from(f.data):f.value]).sort((a,b)=>a[0]-b[0]),expectedText.map(f=>[f.tag,f.data?Array.from(f.data):f.value]).sort((a,b)=>a[0]-b[0]),'All populated repaired text settings must match independently');

const original=G.describeGia(source);
for(const o of generated.filter(o=>o.componentTypes.includes(96))){const before=original.children.find(x=>x.guid===o.guid);const actual=payload(o,96,84);assert.equal(W.value(actual,504)||0,before.imageOption);assert(!actual.some(f=>f.tag===501));}
const unsupported=C.decodeUiGia(reference);assert.equal(unsupported.unsupportedControls.length,6);
assert.throws(()=>C.convertUiGia(reference),e=>e.code==='unsupportedControls'&&e.detail.includes('GridScrollerControl')&&e.detail.includes('TextWindowControl'));
// Keep only shared children in the independent Client reference, rebuilding its hierarchy.
const model=G.describeGia(reference),keep=model.children.filter(o=>o.componentTypes.includes(84)||o.componentTypes.includes(96)),ids=new Set(keep.map(o=>o.guid));
const parsed=W.parseRoot(reference),fields=W.parse(reference.subarray(20,reference.length-4));
const subset=fields.filter(f=>f.tag!==2||ids.has(W.value(W.parse(W.bytes(W.parse(W.bytes(W.parse(f.data),19)),1)),501)));
const root=subset.find(f=>f.tag===1);let entry=root.data,ef=W.parse(entry),ui=W.bytes(ef,19),content=W.bytes(W.parse(ui),1);
content=W.setBytes(content,503,W.packed(keep.map(o=>o.guid)));
entry=W.setBytes(entry,19,W.setBytes(ui,1,content));entry=W.build(W.parse(entry).filter(f=>f.tag!==2||ids.has(W.value(W.parse(f.data),4))));root.data=entry;
const shared=W.wrap(subset,parsed),r=C.convertUiGia(shared),back=C.convertUiGia(r.bytes);
assert.equal(r.result.kind,'server');assert.equal(r.result.json.elements.length,2);assert(C.equalScene(r.source,back.result));
// A nested Client container must keep its children and relative transforms.
const nestedFields=W.parse(shared.subarray(20,shared.length-4)),textId=keep.find(o=>o.componentTypes.includes(84)).guid;
const extraId=1073900000,parent=model.container.guid;
let container=fields.find(f=>f.tag===1).data;
container=W.build(W.parse(container).filter(f=>f.tag!==2));container=W.setValue(container,5,15);
let u=W.bytes(W.parse(container),19),c=W.bytes(W.parse(u),1);
c=W.setValue(c,501,extraId);c=W.setValue(c,504,parent);c=W.setBytes(c,503,W.packed([textId]));
c=W.build(W.parse(c).map(f=>f.tag===502?W.len(502,W.patchInfo(f.data,extraId,5000)):f));
// Patch component asset locators without changing the nested container's geometry.
c=W.build(W.parse(c).map(f=>f.tag===505?W.len(505,W.patchComponent(f.data,parent,extraId,{name:model.container.componentName,offset_x:0,offset_y:0,size_x:150,size_y:150,rot_z:0,imported_transform:{scale:{x:1,y:1,z:1},rotation:{x:0,y:0,z:0}}})):f));
container=W.setBytes(container,19,W.setBytes(u,1,c));
let ident=W.bytes(W.parse(container),1);container=W.setBytes(container,1,W.setValue(ident,4,extraId));
const top=nestedFields.find(f=>f.tag===1);u=W.bytes(W.parse(top.data),19);c=W.bytes(W.parse(u),1);c=W.setBytes(c,503,W.packed([extraId,...keep.filter(o=>o.guid!==textId).map(o=>o.guid)]));top.data=W.setBytes(top.data,19,W.setBytes(u,1,c));
const text=nestedFields.find(f=>f.tag===2&&W.value(W.parse(W.bytes(W.parse(W.bytes(W.parse(f.data),19)),1)),501)===textId);
u=W.bytes(W.parse(text.data),19);c=W.bytes(W.parse(u),1);text.data=W.setBytes(text.data,19,W.setBytes(u,1,W.setValue(c,504,extraId)));
nestedFields.push(W.len(2,container));const nested=W.wrap(nestedFields,parsed),nr=C.convertUiGia(nested),nb=C.convertUiGia(nr.bytes);
assert(C.equalScene(nr.source,nr.result));assert(C.equalScene(nr.source,nb.result));
// Independent and mixed groups may share template GUIDs; merging must remap them safely.
const bundle=G.mergeUiGroups([source,source]);const b=C.convertUiGia(bundle);assert.equal(b.result.groups.length,2);assert.equal(b.result.json.elements.length,166);assert(C.equalScene(b.source,b.result));
console.log('PASS: scoreboard 67 text / 16 image controls, both modes and directions, independent Client reference, field mappings, layouts, child order, bundles, unsupported-control reporting');
