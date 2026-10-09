const assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../js/converter'),G=require('../js/gia');
const input=fs.readFileSync('tests/fixtures/OrangeDisc.gia');
const client=fs.readFileSync('assets/client_mask_off_template.gia'),server=fs.readFileSync('assets/image_template.gia');
for(const classic of [false,true]) {
 const source=classic?G.toClassic(input):input;
 const out=C.convertUiGia(source,client),back=C.convertUiGia(out.bytes,server);
 assert.equal(out.source.kind,'server');assert.equal(out.result.kind,'client');
 assert.equal(out.result.json.elements.length,90);assert.equal(out.result.isClassic,classic);
 assert(C.equalScene(out.source,out.result));assert(C.equalScene(out.source,back.result));
 assert.equal(out.result.model.container.imageAssetRef,100002);
 assert.equal(out.result.model.container.isMask,false);
 const images=out.result.json.elements;
 assert(images.some(o=>o.imported_transform.scale.x>1.2));
 assert(images.some(o=>Math.abs(o.imported_transform.rotation.y)===180));
 assert(images.some(o=>o.imported_name==='Frisbee Outline'));
}
console.log('PASS: OrangeDisc Server → Client → Server in both modes; 90 images, names, scale, full rotation, layering, tint and circular mask preserved');
