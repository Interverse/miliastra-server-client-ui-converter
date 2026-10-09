'use strict';
(() => {
  const $=id=>document.getElementById(id), t=(k,p)=>I18N.t('converter.'+k,p);
  let selected=null, bytes=null, scene=null, url=null, issue='empty', issueDetail='', busy=false, generation=0;
  I18N.init();
  for(const l of I18N.LANGUAGES) $('language').add(new Option(l.name,l.code));
  function revoke(){if(url){URL.revokeObjectURL(url);url=null;} $('download').hidden=true;}
  function render(){
    $('language').value=I18N.lang;document.title=t('pageTitle');
    $('source').textContent=scene?t(scene.kind):'—';
    $('target').textContent=scene?t(scene.kind==='server'?'client':'server'):'—';
    $('mode').textContent=scene?(scene.isClassic?'Classic':'Beyond'):'—';
    $('group').textContent=scene?scene.json.group_name:'—';$('images').textContent=scene?scene.json.elements.length:'—';
    $('status').hidden=['empty','ready','done'].includes(issue);$('status').textContent=issueDetail||t(issue);$('status').classList.toggle('error',!['empty','ready','inferred','done','working'].includes(issue));
    $('convert').disabled=!scene||busy||!!scene.unsupportedControls?.length;$('file').disabled=busy;$('clear').disabled=busy;
  }
  I18N.onChange(render);$('language').addEventListener('change',()=>I18N.setLang($('language').value));
  $('theme').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('theme',next)}catch(e){}});
  window.addEventListener('storage',e=>{if(e.key==='theme'&&['light','dark'].includes(e.newValue))document.documentElement.dataset.theme=e.newValue;});
  async function load(file){
    const token=++generation;revoke();scene=null;bytes=null;selected=file;issue='empty';issueDetail='';
    $('file-info').hidden=!file;$('file-name').textContent=file?file.name:'';$('file-size').textContent=file?(file.size/1024).toFixed(1)+' KB':'';render();
    if(!file)return;
    if(!/\.gia$/i.test(file.name)){issue='invalid';render();return;}
    try {const data=new Uint8Array(await file.arrayBuffer());if(token!==generation)return;const decoded=UiConverter.decodeUiGia(data);bytes=data;scene=decoded;issue=decoded.inferredBounds?'inferred':'ready';if(decoded.unsupportedControls?.length){issue='unsupportedControls';issueDetail=t('noServerEquivalent')+': '+decoded.unsupportedControls.join(', ');}}
    catch(e){if(token!==generation)return;issue=e.code||'invalid';issueDetail=e.detail||'';}
    render();
  }
  $('file').addEventListener('change',()=>load($('file').files[0]));
  $('clear').addEventListener('click',()=>{$('file').value='';load(null);});
  let dragDepth=0;
  const hasFiles=e=>e.dataTransfer && (Array.from(e.dataTransfer.types||[]).includes('Files') || e.dataTransfer.files.length>0);
  function resetDrag(){dragDepth=0;document.body.classList.remove('file-drag');$('dropzone').classList.remove('drag');}
  window.addEventListener('dragenter',e=>{
    if(!hasFiles(e))return;e.preventDefault();dragDepth++;
    if(!busy){document.body.classList.add('file-drag');$('dropzone').classList.add('drag');}
  });
  window.addEventListener('dragover',e=>{
    if(!hasFiles(e))return;e.preventDefault();e.dataTransfer.dropEffect=busy?'none':'copy';
  });
  window.addEventListener('dragleave',e=>{
    if(!hasFiles(e))return;dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)resetDrag();
  });
  window.addEventListener('drop',e=>{
    if(!hasFiles(e))return;e.preventDefault();resetDrag();if(busy)return;
    if(e.dataTransfer.files.length!==1){load(null);issue='invalid';render();return;}
    load(e.dataTransfer.files[0]);
  });
  window.addEventListener('dragend',resetDrag);
  window.addEventListener('blur',resetDrag);
  $('convert').addEventListener('click',async()=>{
    if(!scene||busy)return;busy=true;issue='working';issueDetail='';revoke();render();
    try {
      const path=scene.kind==='server'?'assets/client_mask_off_template.gia':'assets/image_template.gia';
      const response=await fetch(path);if(!response.ok)throw new Error('template');
      const template=new Uint8Array(await response.arrayBuffer());
      const result=UiConverter.convertUiGia(bytes,template);
      url=URL.createObjectURL(new Blob([result.bytes],{type:'application/octet-stream'}));
      $('download').href=url;$('download').download=selected.name.replace(/\.gia$/i,'')+'_'+result.result.kind+'.gia';$('download').hidden=false;issue='done';
    }catch(e){issue=e.code||'fetch';issueDetail=e.detail||'';}
    finally{busy=false;render();}
  });
  window.addEventListener('pagehide',revoke);render();
})();

