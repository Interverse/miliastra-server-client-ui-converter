const assert=require('node:assert/strict'),fs=require('node:fs');
const G=require('../js/gia'),C=require('../js/converter');
const input=fs.readFileSync('tests/fixtures/z_bigbanner.gia');
const client=fs.readFileSync('assets/client_mask_off_template.gia'),server=fs.readFileSync('assets/image_template.gia');
for(const classic of [false,true]) {
 const source=classic?G.toClassic(input):input;
 const out=C.convertUiGia(source,client),back=C.convertUiGia(out.bytes,server);
 assert(C.equalScene(out.source,out.result));assert(C.equalScene(out.source,back.result));
 assert.equal(out.result.isClassic,classic);assert.equal(out.result.json.elements.length,1);
 const p=out.result.model.container,image=out.result.model.children[0];
 assert.equal(p.isMask,true);assert.equal(p.imageAssetRef,100001);assert.equal(p.packedColor>>>24,0);
 for(const t of p.transform.platformTransforms){assert.equal(t.size.x,700);assert.equal(t.size.y,50);}
 assert.equal(image.imageAssetRef,106057);assert.equal(image.packedColor,2785017855);assert.equal(image.imageOption,1);
 for(const t of image.transform.platformTransforms){assert(Math.abs(t.size.x-700)<.001);assert(Math.abs(t.size.y-200)<.001);}
 const corrupt=structuredClone(out.result);corrupt.json.image_bounds.height=200;assert.equal(C.equalScene(out.source,corrupt),false);
}
console.log('PASS: Big Banner in both modes; active 700 × 50 parent mask, 700 × 200 child, custom asset, tint and image option preserved');
