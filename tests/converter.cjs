const assert=require('node:assert/strict'),fs=require('node:fs');
const G=require('../js/gia'),C=require('../js/converter');
const read=n=>fs.readFileSync('assets/'+n+'.gia'),server=read('image_template'),client=read('client_mask_off_template');
let checks=0;
const json={import_scene:true,group_name:'猫 • UI',image_bounds:{x:12.5,y:-6.25,width:200,height:180},client_mask_enabled:true,mask:{position:{x:12.5,y:-6.25},size:{x:200,y:180},shape_type:1,enabled:true},elements:[{type:'rectangle',imported_name:'底层 α',imported_component_name:'',relative:{x:-20.125,y:3.25},size:{width:50,height:20},rotation:{z:32.5},image_asset_ref:123456,packed_color:0x80334455},{type:'ellipse',imported_name:'上层 β',imported_component_name:'上层 β',relative:{x:1.25,y:-30.75},size:{rx:15,ry:12},rotation:{z:-14},packed_color:0xffaabbcc}]};
for(const kind of ['server','client']) for(const classic of [false,true]) {
 let bytes=G.convertJsonToGiaBytes(json,kind==='server'?server:client,kind==='server'?G.MODE_IMAGE:G.MODE_CLIENT_IMAGE);
 bytes=classic?G.toClassic(bytes):G.toOverlimit(bytes);
 const a=C.decodeUiGia(bytes),b=C.convertUiGia(bytes,kind==='server'?client:server),c=C.convertUiGia(b.bytes,kind==='server'?server:client);
 assert(C.equalScene(a,c.result));assert.equal(b.result.isClassic,classic); checks+=2;
}
for(const n of ['client_image_template','client_mask_off_template','client_mask_template']) {const a=C.decodeUiGia(read(n));const b=C.convertUiGia(read(n),a.kind==='server'?client:server); assert(C.equalScene(a,b.result));checks++;}
for(const change of [b=>b.slice(0,-1), b=>{b[3]=0;return b;},b=>{b[b.length-1]=0;return b;}]) {assert.throws(()=>C.decodeUiGia(change(new Uint8Array(client))));checks++;}
function parse(b){let at=0;const vi=()=>{let n=0n,shift=0n,x;do{x=b[at++];n|=BigInt(x&127)<<shift;shift+=7n;}while(x&128);return n;};let a=[];while(at<b.length){const k=Number(vi()),wire=k&7,tag=k>>3;let data;if(wire===0)data=vi();else{const n=wire===2?Number(vi()):wire===5?4:8;data=b.slice(at,at+n);at+=n;}a.push({tag,wire,data});}return a;}
function encode(a){const out=[];function vi(n){n=BigInt(n);do{let x=Number(n&127n);n>>=7n;out.push(x|(n?128:0));}while(n);}for(const f of a){vi(f.tag*8+f.wire);if(f.wire===0)vi(f.data);else{if(f.wire===2)vi(f.data.length);out.push(...f.data);}}return Uint8Array.from(out);}
function nested(f,tag,fn){const x=f.find(v=>v.tag===tag);const a=parse(x.data);fn(a);x.data=encode(a);}
function mutate(bytes,fn){const a=parse(bytes.slice(20,-4));fn(a);const data=encode(a);const b=new Uint8Array(data.length+24);b.set(bytes.slice(0,20));b.set(data,20);b.set(bytes.slice(-4),b.length-4);const v=new DataView(b.buffer);v.setUint32(0,b.length-4);v.setUint32(16,data.length);return b;}
function content(a,fn){nested(a,2,r=>nested(r,19,u=>nested(u,1,fn)));}
function rect(a,fn){content(a,c=>{const comp=c.find(v=>v.tag===505&&parse(v.data).some(q=>q.tag===502&&q.data===12n));const cf=parse(comp.data);nested(cf,503,d=>nested(d,11,t=>nested(t,12,mp=>{for(const platform of mp.filter(v=>v.tag===501)){const pl=parse(platform.data);nested(pl,502,fn);platform.data=encode(pl);}})));comp.data=encode(cf);});}
const valid=G.convertJsonToGiaBytes(json,client,G.MODE_CLIENT_IMAGE);
const bad=[
 ['unknown component',a=>content(a,c=>{const f=c.find(x=>x.tag===505),cf=parse(f.data);cf.find(x=>x.tag===502).data=999n;f.data=encode(cf);})],
 ['broken parent',a=>content(a,c=>{c.find(x=>x.tag===504).data=1n;})],
 ['nested child',a=>content(a,c=>c.push({tag:503,wire:0,data:1n}))],
 ['duplicate ID',a=>{a.push(a.find(x=>x.tag===2));}],
 ['non-finite scale',a=>rect(a,r=>nested(r,501,v=>{const q=v.find(x=>x.tag===501);new DataView(q.data.buffer,q.data.byteOffset,4).setFloat32(0,NaN,true);}))],
 ['pivot',a=>rect(a,r=>nested(r,506,v=>{const q=v.find(x=>x.tag===501);new DataView(q.data.buffer,q.data.byteOffset,4).setFloat32(0,0,true);}))],
 ['anchor',a=>rect(a,r=>nested(r,502,v=>{const q=v.find(x=>x.tag===501);new DataView(q.data.buffer,q.data.byteOffset,4).setFloat32(0,0,true);}))],
 ['NaN',a=>rect(a,r=>nested(r,504,v=>{const q=v.find(x=>x.tag===501);new DataView(q.data.buffer,q.data.byteOffset,4).setFloat32(0,NaN,true);}))],
 ['changed opaque setting',a=>content(a,c=>{const f=c.find(x=>x.tag===505&&parse(x.data).some(q=>q.tag===502&&q.data===83n)),cf=parse(f.data);cf.push({tag:100,wire:0,data:1n});f.data=encode(cf);})]
];
for(const [label,fn] of bad){assert.throws(()=>C.decodeUiGia(mutate(valid,fn)),undefined,label);checks++;}
assert.throws(()=>C.decodeUiGia(read('image_template')));checks++;
const noMask={...json,mask:{...json.mask,enabled:false},client_mask_enabled:false};
for(const kind of ['server','client']){const b=G.convertJsonToGiaBytes(noMask,kind==='server'?server:client,kind==='server'?G.MODE_IMAGE:G.MODE_CLIENT_IMAGE);const r=C.convertUiGia(b,kind==='server'?client:server);assert.equal(r.result.json.mask.enabled,false);checks++;}
const single={...noMask,elements:[json.elements[0]]};const b=G.convertJsonToGiaBytes(single,server,G.MODE_IMAGE);assert.equal(C.convertUiGia(b,client).result.json.elements.length,1);checks++;
const large={...noMask,elements:Array.from({length:1000},(_,i)=>({...json.elements[i%2],imported_name:String(i)}))};const big=G.convertJsonToGiaBytes(large,server,G.MODE_IMAGE);assert.equal(C.convertUiGia(big,client).result.json.elements.length,1000);checks++;
console.log('PASS: '+checks+' direct conversion and rejection checks');



