'use strict';
(() => {
  const $=id=>document.getElementById(id), t=(k,p)=>I18N.t('converter.'+k,p);
  let scene=null, outputs=[], issue='empty', issueDetail='', busy=false, generation=0, controller=null, pending=null;
  I18N.init();
  for(const l of I18N.LANGUAGES) $('language').add(new Option(l.name,l.code));
  function revoke(){for(const output of outputs)URL.revokeObjectURL(output.url);outputs=[];$('downloads').replaceChildren();$('downloads').hidden=true;}
  function render(){
    $('language').value=I18N.lang;document.title=t('pageTitle');
    $('source').textContent=scene?t(scene.format):'—';
    $('mode').textContent=scene?(scene.isClassic?'Classic':'Beyond'):'—';
    $('group').textContent=scene?scene.json.group_name:'—';$('images').textContent=scene?scene.json.elements.length:'—';
    $('status').hidden=['empty','ready','done'].includes(issue);$('status').textContent=issueDetail||t(issue);$('status').classList.toggle('error',!['empty','ready','inferred','done','working'].includes(issue));
    $('convert').disabled=!pending||busy;$('convert').hidden=outputs.length>0;
    $('convert').textContent=busy?t('working'):t('convert');
    $('downloads').setAttribute('aria-busy',String(busy));
    $('downloads').replaceChildren(...outputs.map(output=>{
      const link=document.createElement('a');link.className='primary-button download';link.href=output.url;link.download=output.filename;link.dataset.format=output.format;
      link.setAttribute('aria-label',t('download')+' — '+t(output.format));
      const label=document.createElement('strong');label.textContent=t(output.format);
      const action=document.createElement('small');action.textContent=t('download');link.append(label,action);return link;
    }));
    $('downloads').hidden=!outputs.length;
  }
  I18N.onChange(render);$('language').addEventListener('change',()=>I18N.setLang($('language').value));
  $('theme').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('theme',next)}catch(e){}});
  window.addEventListener('storage',e=>{if(e.key==='theme'&&['light','dark'].includes(e.newValue))document.documentElement.dataset.theme=e.newValue;});
  async function load(file){
    const token=++generation;controller?.abort();pending=null;
    revoke();scene=null;busy=false;issue='empty';issueDetail='';
    $('file-info').hidden=!file;$('file-name').textContent=file?file.name:'';$('file-size').textContent=file?(file.size/1024).toFixed(1)+' KB':'';render();
    if(!file)return;
    if(!/\.gia$/i.test(file.name)){issue='invalid';render();return;}
    try{
      const bytes=new Uint8Array(await file.arrayBuffer());if(token!==generation)return;
      scene=UiConverter.decodeUiGia(bytes);
      if(scene.unsupportedControls?.length){issue='unsupportedControls';issueDetail=t('noServerEquivalent')+': '+scene.unsupportedControls.join(', ');render();return;}
      pending={file,bytes,format:scene.format};issue='ready';
    }catch(e){if(token!==generation)return;issue=e.code||'invalid';issueDetail=e.detail||'';}
    finally{if(token===generation)render();}
  }
  async function convert(){
    if(!pending||busy)return;
    const token=generation,job=pending;controller?.abort();controller=new AbortController();const signal=controller.signal;
    busy=true;issue='working';issueDetail='';revoke();render();
    try{
      const targets=UiConverter.FORMATS.filter(format=>format!==job.format),templates=new Map();
      const results=await Promise.all(targets.map(async format=>{
        const path=format==='client-control'?'assets/client_mask_off_template.gia':'assets/image_template.gia';
        if(!templates.has(path))templates.set(path,(async()=>{const response=await fetch(path,{signal});if(!response.ok)throw Error('template');return new Uint8Array(await response.arrayBuffer());})());
        const template=await templates.get(path);if(token!==generation)return null;
        return {format,bytes:UiConverter.convertUiGia(job.bytes,template,format).bytes};
      }));
      if(token!==generation)return;
      outputs=results.map(result=>({format:result.format,url:URL.createObjectURL(new Blob([result.bytes],{type:'application/octet-stream'})),filename:job.file.name.replace(/\.gia$/i,'')+'_'+result.format+'.gia'}));
      issue='done';
    }catch(e){if(token!==generation)return;issue=e.code||'fetch';issueDetail=e.detail||'';}
    finally{if(token===generation){busy=false;render();}}
  }
  $('convert').addEventListener('click',convert);
  $('file').addEventListener('change',()=>{const file=$('file').files[0];$('file').value='';load(file);});
  $('clear').addEventListener('click',()=>{$('file').value='';load(null);});
  let dragDepth=0;
  const hasFiles=e=>e.dataTransfer && (Array.from(e.dataTransfer.types||[]).includes('Files') || e.dataTransfer.files.length>0);
  function resetDrag(){dragDepth=0;document.body.classList.remove('file-drag');$('dropzone').classList.remove('drag');}
  window.addEventListener('dragenter',e=>{
    if(!hasFiles(e))return;e.preventDefault();dragDepth++;
    document.body.classList.add('file-drag');$('dropzone').classList.add('drag');
  });
  window.addEventListener('dragover',e=>{
    if(!hasFiles(e))return;e.preventDefault();e.dataTransfer.dropEffect='copy';
  });
  window.addEventListener('dragleave',e=>{
    if(!hasFiles(e))return;dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)resetDrag();
  });
  window.addEventListener('drop',e=>{
    if(!hasFiles(e))return;e.preventDefault();resetDrag();
    if(e.dataTransfer.files.length!==1){load(null);issue='invalid';render();return;}
    load(e.dataTransfer.files[0]);
  });
  window.addEventListener('dragend',resetDrag);
  window.addEventListener('blur',resetDrag);
  window.addEventListener('pagehide',revoke);render();
})();

