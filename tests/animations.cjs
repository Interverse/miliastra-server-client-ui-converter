const assert=require('node:assert/strict'),fs=require('node:fs'),G=require('../js/gia'),C=require('../js/converter'),W=G.controlWire;
function settings(o,type,tag){const comp=o.components.find(c=>c.type===type);return W.parse(W.bytes(W.parse(W.bytes(W.parse(Buffer.from(comp.rawHex,'hex')),503)),tag));}
for(const name of ['z_ui_animation_client','z_ui_animation_server','z_ui_animation_server_asset_group'])for(const classic of [false,true]){
 const input=fs.readFileSync('tests/fixtures/'+name+'.gia'),bytes=classic?G.toClassic(input):input,r=C.convertUiGia(bytes),back=C.convertUiGia(r.bytes);
 assert(C.equalScene(r.source,r.result));assert(C.equalScene(r.source,back.result));assert.equal(r.result.isClassic,classic);
 const source=r.source.groups||[r.source],result=r.result.groups||[r.result];assert.equal(source.length,result.length);
 const fullscreen=source.some(g=>g.json.elements.some(e=>e.type==='fullscreenAnimation'));
 assert(C.availableFormats(r.source).includes('asset-group'));
 assert.equal(C.hasFullscreenAnimations(r.source),fullscreen);
 if(fullscreen){
  const asset=C.convertUiGia(bytes,null,'asset-group');
  assert(!C.hasFullscreenAnimations(asset.result));assert.equal(asset.result.isClassic,classic);
  assert.deepEqual(asset.result.json.elements.map(e=>e.imported_name),r.source.json.elements.filter(e=>e.type!=='fullscreenAnimation').map(e=>e.imported_name));
  const target=r.source.kind==='server'?'client-control':'server-control';
  assert(C.equalScene(r.source,C.convertUiGia(bytes,null,target).result));
  const bundle=G.mergeUiGroups([bytes,bytes]);
  const bundled=C.convertUiGia(bundle,null,'asset-group');assert(!C.hasFullscreenAnimations(bundled.result));assert.equal(bundled.result.groups.length,source.length*2);
 }
 for(let i=0;i<source.length;i++)for(let j=0;j<source[i].json.elements.length;j++){
  const a=source[i].json.elements[j],b=result[i].json.elements[j],server=source[i].kind==='server'?a.model:b.model,client=source[i].kind==='client'?a.model:b.model;
  if(a.type==='animation'){
   const s=settings(server,39,32),c=settings(client,98,86);assert.equal(W.value(c,501),W.value(s,502));assert.equal(W.value(c,502)||0,W.value(s,503)||0);
   assert.equal(server.transform.platformDiscriminator,10);assert.equal(client.transform.platformDiscriminator,29);assert.deepEqual(server.transform.platformTransforms,client.transform.platformTransforms);
  }else if(a.type==='fullscreenAnimation'){
   assert.equal(W.value(settings(server,57,49),501),W.value(settings(client,99,87),501));assert(server.componentTypes.includes(11));assert.equal(client.transform.platformDiscriminator,30);
   if(source[i].kind==='server')for(const t of client.transform.platformTransforms){assert.equal((t.anchorMax.x-t.anchorMin.x)*1600+t.size.x,1600);assert.equal((t.anchorMax.y-t.anchorMin.y)*900+t.size.y,900);assert.deepEqual(t.offset,{x:0,y:0});}
  }else assert.fail('Expected animation');
 }
 if(!classic)fs.writeFileSync('output/'+name+'_converted.gia',r.bytes);
}
console.log('PASS: UI and fullscreen animation assets/playback, standalone bundles and asset groups, both directions and Classic/Beyond modes');
