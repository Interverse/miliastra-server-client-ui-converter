const assert=require('node:assert/strict'),fs=require('node:fs');
const G=require('../js/gia'),C=require('../js/converter');
const input=fs.readFileSync('tests/fixtures/Terra_Blade.gia');
const client=fs.readFileSync('assets/client_mask_off_template.gia'),server=fs.readFileSync('assets/image_template.gia');
for(const classic of [false,true]) {
 const bytes=classic?G.toClassic(input):input;
 const out=C.convertUiGia(bytes,client),back=C.convertUiGia(out.bytes,server);
 assert.equal(out.source.kind,'server');assert.equal(out.result.kind,'client');
 assert.equal(out.result.json.elements.length,128);assert.equal(out.result.isClassic,classic);
 assert(C.equalScene(out.source,out.result));assert(C.equalScene(out.source,back.result));
 for(const image of out.result.json.elements) {
  const platforms=image.imported_transform.platforms;
  assert.equal(platforms.length,4);
  assert(Math.abs(platforms[0].size.x/platforms[1].size.x-3)<1e-5);
 }
 // Semantic verification must notice corruption confined to a non-primary platform.
 const altered=structuredClone(out.result);
 altered.json.elements[0].imported_transform.platforms[2].offset.x+=1;
 assert.equal(C.equalScene(out.source,altered),false);
}
console.log('PASS: Terra Blade, 128 images and all four platform layouts preserved through both-mode round trips');
