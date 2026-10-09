const G=require('../js/gia'),fs=require('fs');
const p={server:{},client:{}};
for(const n of ['image_template','client_mask_off_template','client_mask_template','client_image_template']){
 const d=G.describeGia(fs.readFileSync('assets/'+n+'.gia'));
 for(const o of [d.container,...d.children])for(const c of o.components){
  const sig=G.importComponentSignature(c.rawHex,o.guid),list=p[d.templateKind][c.type]??=[];
  if(!list.includes(sig))list.push(sig);
 }
}
for(const fixture of ['OrangeDisc','Terra_Blade']) {
 const m=G.describeGia(fs.readFileSync('tests/fixtures/'+fixture+'.gia'));
 for(const o of [m.container,...m.children])for(const c of o.components){
  if(c.type!==12)continue;const sig=G.importComponentSignature(c.rawHex,o.guid);
  if(!p.server[12].includes(sig))p.server[12].push(sig);
 }
}
fs.writeFileSync('js/import-profiles.js','/* Canonical supplied-template and editor-export component profiles. */\nconst ImportProfiles='+JSON.stringify(p)+';\nif(typeof module==="object")module.exports=ImportProfiles;\n');
console.log('Server transform profiles:',p.server[12].length);
