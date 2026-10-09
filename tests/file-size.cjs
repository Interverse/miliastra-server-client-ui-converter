// Regression: valid envelopes above the former 32 MiB cutoff remain accepted.
const assert=require('node:assert/strict'),fs=require('node:fs');
const G=require('../js/gia'),C=require('../js/converter');
const b=G.convertJsonToGiaBytes({import_scene:true,group_name:'Size regression',elements:[{type:'rectangle',size:{width:10,height:10}}],mask:{size:{x:20,y:20},enabled:false}},fs.readFileSync('assets/image_template.gia'),G.MODE_IMAGE);
const size=33*1024*1024;
const length=[];let n=size;do{const part=n%128;n=Math.floor(n/128);length.push(part|(n?128:0));}while(n);
// Protobuf permits repeated singular strings: the last value is authoritative.
const contentLength=b.length-24+1+length.length+size;
const large=new Uint8Array(contentLength+24);large.set(b.subarray(0,b.length-4));
let at=b.length-4;large[at++]=26;large.set(length,at);at+=length.length;
large.fill(65,at,at+size);large.set(b.subarray(-4),large.length-4);
const view=new DataView(large.buffer);view.setUint32(0,large.length-4);view.setUint32(16,contentLength);
assert(large.length>32*1024*1024);assert.equal(C.decodeUiGia(large).json.elements.length,1);
console.log('PASS: valid file larger than 32 MiB accepted');
