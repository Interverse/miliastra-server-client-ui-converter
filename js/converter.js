/* Direct UI import adapter. Coordinates are game units, in painter order. */
(function (root) {
  'use strict';
  const profiles=typeof module==='object'?require('./import-profiles.js'):ImportProfiles;
  const Controls=typeof module==='object'?require('./control-converter.js'):root.ControlConverter;
  const G = typeof module === 'object' ? require('./gia.js') : root.GIA;
  class ConversionError extends Error { constructor(code, detail='') { super(detail || code); this.code=code; this.detail=detail; } }
  const fail=(code, detail)=>{throw new ConversionError(code,detail);};
  const near=(a,b)=>Math.abs(a-b)<=1e-4;
  function envelope(bytes) {
    bytes=bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if(bytes.length<24) fail('invalid');
    const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if(v.getUint32(0)!==bytes.length-4 || v.getUint32(16)!==bytes.length-24 || v.getUint32(bytes.length-4)!==0x679) fail('invalid');
    if(Array.from(bytes.slice(4,16)).map(x=>x.toString(16).padStart(2,'0')).join('')!=='000000010000032600000003') fail('invalid');
    return bytes;
  }
  function transform(t, parent=false) {
    if(!t) fail('transform');
    if(t.platformTransforms) {
      if(t.platformCount!==4 || t.platformIds.length!==4 || new Set(t.platformIds).size!==4 || t.platformIds.some(id=>!Number.isInteger(id)||id<0||id>3)) fail('transform');
      t.platformTransforms.forEach(p=>transform(p,parent));
    }
    for(const k of ['scale','anchorMin','anchorMax','offset','size','pivot']) if(!t[k] || !Object.values(t[k]).every(Number.isFinite)) fail('transform');
    if(!Number.isFinite(t.rotationZ)) fail('transform');
    if((parent && !Object.values(t.scale).every(x=>near(x,1))) || !['anchorMin','anchorMax','pivot'].every(k=>near(t[k].x,.5)&&near(t[k].y,.5))) fail('transform');
    if(!t.rotation || !Object.values(t.rotation).every(Number.isFinite) || (parent && Object.values(t.rotation).some(x=>!near(x,0)))) fail('transform');
    if(t.size.x<=0 || t.size.y<=0 || (parent&&!near(t.rotationZ,0))) fail('transform');
  }
  function bounds(images) {
    let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity;
    images.forEach(e=>{
      const tr=e.imported_transform, rad=Math.PI/180;
      const rx=tr.rotation.x*rad,ry=tr.rotation.y*rad,rz=tr.rotation.z*rad;
      const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
      const width=e.size.width*Math.abs(tr.scale.x),height=e.size.height*Math.abs(tr.scale.y);
      const w=(Math.abs(cz*cy)*width+Math.abs(cz*sy*sx-sz*cx)*height)/2;
      const h=(Math.abs(sz*cy)*width+Math.abs(sz*sy*sx+cz*cx)*height)/2;
      left=Math.min(left,e.relative.x-w);right=Math.max(right,e.relative.x+w);
      bottom=Math.min(bottom,e.relative.y-h);top=Math.max(top,e.relative.y+h);
    });
    return {x:(left+right)/2,y:(bottom+top)/2,width:right-left,height:top-bottom};
  }
  function decodeSingleUiGia(input) {
    const bytes=envelope(input); let m;
    try {m=G.describeGia(bytes);} catch(e) {fail('invalid',e.message);}
    if(!['server','client'].includes(m.templateKind)||!m.container||!m.children.length) fail('unsupported');
    if(m.rootTags.filter(t=>t===1).length!==1 || m.rootTags.some(t=>![1,2,3,4,5].includes(t))) fail('unsupported');
    const parent=m.container, all=[parent,...m.children], ids=new Set();
    for(const o of all) {
      if(!Number.isSafeInteger(o.guid)||ids.has(o.guid)) fail('links'); ids.add(o.guid);
      if(o.hasDecorationPayload || o.fieldTags.some(t=>![1,2,3,5,19].includes(t)) || !o.contentFieldTags || o.contentFieldTags.some(t=>![501,502,503,504,505].includes(t))) fail('unsupported');
      if(o.resourceGuid!==o.guid) fail('links');
      if(o.infoSlots.some(s=>!(o===parent?[1,2,4,6]:[1,2]).includes(s.slot))) fail('unsupported');
      const allowed=m.templateKind==='server' ? (o===parent?[15,12,23,56]:[15,23,12,38]) : [15,86,12,83,90,91,96,97];
      for(const c of o.components) {
        if(!(profiles[m.templateKind][c.type]||[]).includes(G.importComponentSignature(c.rawHex,o.guid))) fail('unsupported');
      }
      if(o.componentTypes.some(t=>!allowed.includes(t)) || new Set(o.componentTypes).size!==o.componentTypes.length) fail('unsupported');
    }
    if(parent.parentGuid!==null && parent.parentGuid!==0) fail('links');
    if(parent.referenceGuids.length!==m.children.length || new Set(parent.referenceGuids).size!==m.children.length || parent.referenceGuids.some(g=>!ids.has(g)||g===parent.guid)) fail('links');
    if(parent.childGuids.length!==m.children.length || new Set(parent.childGuids).size!==m.children.length) fail('links');
    const byId=new Map(m.children.map(o=>[o.guid,o]));
    let ordered=parent.childGuids.map(g=>byId.get(g));
    if(ordered.some(o=>!o)) fail('links');
    // Normalize Client child traversal to Server order; the two editors display
    // their serialized child sequences in opposite directions.
    if(m.templateKind==='client') ordered.reverse();

    if(new Set(ordered.map(o=>o.index)).size!==ordered.length || ordered.some(o=>!Number.isInteger(o.index))) fail('links');
    for(const o of ordered) {
      if(o.resourceClass!==15||o.parentGuid!==parent.guid||o.childGuids.length||o.referenceGuids.length) fail('links');
      if(o.mask||o.isMask) fail('mask');
      transform(o.transform);
      if(![0,1].includes(o.imageOption)) fail('unsupported');
      if(!Number.isSafeInteger(o.imageAssetRef)||o.imageAssetRef<=0||!Number.isSafeInteger(o.packedColor)) fail('unsupported');
    }
    let offset={x:0,y:0}, rect, maskEnabled=false, maskShape=1;
    if(m.templateKind==='client') {
      transform(parent.transform,true); offset=parent.transform.offset;
      if(parent.imageAssetRef!==null) {
        if(![100001,100002].includes(parent.imageAssetRef) || (parent.packedColor>>>24)!==0) fail('mask');
        rect={...offset,width:parent.transform.size.x,height:parent.transform.size.y}; maskEnabled=parent.isMask;maskShape=parent.imageAssetRef===100002?2:1;
      }
    } else {
      if(parent.transform) {transform(parent.transform,true); offset=parent.transform.offset;}
      if(parent.mask) {
        const a=parent.mask;
        if(![1,2].includes(a.shapeType) || ![a.position.x,a.position.y,a.size.x,a.size.y].every(Number.isFinite) || a.size.x<=0||a.size.y<=0) fail('mask');
        rect={x:a.position.x+offset.x,y:a.position.y+offset.y,width:a.size.x,height:a.size.y};maskEnabled=a.enabled;maskShape=a.shapeType;
      }

    }
    const parentVariants=parent.transform ? variants(parent.transform) : Array.from({length:4},()=>({offset:{x:0,y:0}}));
    const elements=ordered.map(o=>({type:'rectangle',imported_index:o.index,image_option:o.imageOption, imported_name:o.resourceName, imported_component_name:o.componentName || '',imported_transform:{scale:{...o.transform.scale},rotation:{...o.transform.rotation},platforms:variants(o.transform).map((p,i)=>({...p,offset:{x:p.offset.x+parentVariants[i].offset.x,y:p.offset.y+parentVariants[i].offset.y}}))}, relative:{x:o.transform.offset.x+offset.x,y:o.transform.offset.y+offset.y},size:{width:o.transform.size.x,height:o.transform.size.y},rotation:{z:o.transform.rotationZ},image_asset_ref:o.imageAssetRef,packed_color:o.packedColor}));
    const inferred=!rect; rect=rect||bounds(elements);
    const name=parent.resourceName;
    if(!name || name.trim()!==name || (parent.componentName!==undefined && parent.componentName!==name)) fail('unsupported');
    return {kind:m.templateKind,isClassic:m.isClassic,inferredBounds:inferred,model:m,json:{import_scene:true,group_name:name,elements,image_bounds:rect,client_mask_enabled:maskEnabled,mask:{position:{x:rect.x,y:rect.y},size:{x:rect.width,y:rect.height},shape_type:maskShape,enabled:maskEnabled}}};
  }
  function variants(t) {
    if(!t.platformTransforms) return Array.from({length:4},()=>t);
    const out=[];t.platformTransforms.forEach((p,i)=>out[t.platformIds[i]]=p);return out;
  }
  function equalPlatforms(a,b) {
    return a.length===b.length && a.every((p,i)=>['offset','size','scale','rotation','anchorMin','anchorMax','pivot'].every(k=>Object.keys(p[k]).every(axis=>near(p[k][axis],b[i][k][axis]))));
  }
  function equalScene(a,b) {
    if(a.groups||b.groups){const ga=a.groups||[a],gb=b.groups||[b];return ga.length===gb.length&&ga.every((g,i)=>equalScene(g,gb[i]));}
    if(a.mixedControls||b.mixedControls){const comparable=s=>{if(s.mixedControls)return s;const n=Controls.decodeModel(s.model);n.json.elements=n.json.elements.filter(e=>e.model!==s.model.container);return n;};return Controls.equalScene(comparable(a),comparable(b));}
    if(a.json.group_name!==b.json.group_name || a.isClassic!==b.isClassic || a.json.elements.length!==b.json.elements.length || a.json.mask.enabled!==b.json.mask.enabled || a.json.mask.shape_type!==b.json.mask.shape_type) return false;
    if(a.json.mask.enabled && !['x','y','width','height'].every(k=>near(a.json.image_bounds[k],b.json.image_bounds[k]))) return false;
    return a.json.elements.every((e,i)=>{
      const f=b.json.elements[i];
      return e.imported_index===f.imported_index && e.imported_name===f.imported_name && e.imported_component_name===f.imported_component_name && e.image_option===f.image_option && e.image_asset_ref===f.image_asset_ref && (e.packed_color>>>0)===(f.packed_color>>>0) && ['x','y'].every(k=>near(e.relative[k],f.relative[k])) && ['width','height'].every(k=>near(e.size[k],f.size[k])) && near(e.rotation.z,f.rotation.z) && equalPlatforms(e.imported_transform.platforms,f.imported_transform.platforms) && ['x','y','z'].every(k=>near(e.imported_transform.scale[k],f.imported_transform.scale[k]) && near(e.imported_transform.rotation[k],f.imported_transform.rotation[k]));
    });
  }
  function convertSingleUiGia(bytes,targetTemplate) {
    const source=decodeSingleUiGia(bytes), target=source.kind==='server'?'client':'server';
    // Reverse the complete child records for Client serialization, keeping each
    // child's index, name, transform and image properties together.
    const targetJson=target==='client'?{...source.json,elements:source.json.elements.slice().reverse()}:source.json;
    let out=G.convertJsonToGiaBytes(targetJson,targetTemplate,target==='client'?G.MODE_CLIENT_IMAGE:G.MODE_IMAGE);
    out=source.isClassic?G.toClassic(out):G.toOverlimit(out);
    const result=decodeSingleUiGia(out);
    if(result.kind!==target || !equalScene(source,result)) fail('validation');
    if(target==='client') {
      const scene=G.buildImageScene(targetJson);
      // Decoder + semantic validation also checks independently preserved component names.
      const report=G.validateClientImage(out, {groupName:scene.group_name,container:scene.clientContainer,hierarchyIndices:scene.clientObjects.map(o=>o.index)});
      if(!report.ok) fail('validation',report.errors.join('; '));
    }
    return {bytes:out,source,result};
  }
  function summarizeGroups(groups) {
    const first=groups[0];
    if(groups.some(g=>g.kind!==first.kind||g.isClassic!==first.isClassic))fail('unsupported');
    return {...first,groups,mixedControls:groups.some(g=>g.mixedControls),unsupportedControls:groups.flatMap(g=>g.unsupportedControls||[]),inferredBounds:groups.some(g=>g.inferredBounds),json:{...first.json,group_name:groups.map(g=>g.json.group_name).join(', '),elements:groups.flatMap(g=>g.json.elements)}};
  }
  function decodeUiGia(input) {
    envelope(input);let parts;try{parts=G.splitUiGroups(input);}catch(e){fail('links',e.message);}
    const groups=parts.map(p=>{const g=Controls.handles(p)?Controls.decode(p):decodeSingleUiGia(p);g.format=g.model.containerClass===70?'client-control':g.model.containerClass===21?'server-control':'asset-group';return g;});if(groups.some(g=>g.format!==groups[0].format))fail('unsupported','Mixed export formats are not supported in one file');return groups.length===1?groups[0]:summarizeGroups(groups);
  }
  function convertUiGia(input,targetTemplate,targetFormat) {
    if(targetFormat)return convertToFormat(input,targetTemplate,targetFormat);
    envelope(input);
    const source=decodeUiGia(input), parts=G.splitUiGroups(input);
    const outputs=parts.map(p=>{const m=G.describeGia(p);if(m.containerClass===21&&m.children.length&&m.children.every(o=>o.componentTypes.includes(38)&&o.parentGuid===m.container.guid&&!o.childGuids.length))return convertSingleUiGia(G.setServerExportFormat(p,61),targetTemplate);return Controls.handles(p)?Controls.convert(p):convertSingleUiGia(p,targetTemplate);});
    const bytes=G.mergeUiGroups(outputs.map(o=>o.bytes)),result=decodeUiGia(bytes);
    if(!equalScene(source,result))fail('validation');
    return {bytes,source,result};
  }
  const FORMATS=['asset-group','server-control','client-control'];
  function convertToFormat(input,targetTemplate,targetFormat){
    if(!FORMATS.includes(targetFormat))fail('unsupported','Unknown output format');
    const source=decodeUiGia(input),side=targetFormat==='client-control'?'client':'server';
    const parts=G.splitUiGroups(input).map(part=>{
      const original=decodeUiGia(part);
      const converted=original.kind===side?part:convertUiGia(part,targetTemplate).bytes;
      return side==='client'?converted:targetFormat==='server-control'?Controls.serverTemplate(converted):Controls.assetTemplate(converted);
    });
    const bytes=G.mergeUiGroups(parts);if(side==='server')Controls.validateServerExport(bytes,targetFormat);const result=decodeUiGia(bytes);
    if(result.format!==targetFormat||!equalScene(source,result))fail('validation','Output format or controls did not match');
    return {bytes,source,result};
  }
  const api={decodeUiGia,convertUiGia,equalScene,ConversionError,FORMATS};
  if(typeof module==='object') module.exports=api; else root.UiConverter=api;
})(typeof window==='object'?window:globalThis);

