export function $(sel){ return document.querySelector(sel); }
export function $all(sel){ return Array.from(document.querySelectorAll(sel)); }
export function money(n){ const v=Number(n||0); return v.toLocaleString(undefined,{style:'currency',currency:'USD'}); }
export function setTab(id){
  $all('.tabs button').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  $all('.tab').forEach(s=>s.classList.toggle('active', s.id===id));
}
export function clear(el){ while(el.firstChild) el.removeChild(el.firstChild); }
export function chip(label, active=false){
  const el=document.createElement('span'); el.className='chip'+(active?' active':''); el.textContent=label; return el;
}
export function iOSTip(){
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone=window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if(isIOS && !isStandalone){ const el=$('#installTip'); el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),8000); }
}
