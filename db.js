// Simple IndexedDB layer
const DB_NAME='pennywise-db'; const DB_VER=1;
function openDB(){
  return new Promise((res, rej)=>{
    const req=indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains('transactions')){
        const s=db.createObjectStore('transactions',{keyPath:'id',autoIncrement:true});
        s.createIndex('by_date','date',{unique:false});
        s.createIndex('by_category','category',{unique:false});
      }
      if(!db.objectStoreNames.contains('categories')) db.createObjectStore('categories',{keyPath:'name'});
      if(!db.objectStoreNames.contains('settings')) db.createObjectStore('settings',{keyPath:'key'});
    };
    req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error);
  });
}
async function withStore(name, mode, fn){
  const db=await openDB();
  return new Promise((res, rej)=>{
    const tx=db.transaction(name, mode); const st=tx.objectStore(name);
    const out=fn(st); tx.oncomplete=()=>res(out); tx.onerror=()=>rej(tx.error);
  });
}
// Transactions
export async function addTxn(tx){ return withStore('transactions','readwrite',st=>st.add(tx)); }
export async function updateTxn(tx){ return withStore('transactions','readwrite',st=>st.put(tx)); }
export async function deleteTxn(id){ return withStore('transactions','readwrite',st=>st.delete(id)); }
export async function allTxns(){
  return withStore('transactions','readonly',st=>new Promise((res,rej)=>{
    const items=[]; const req=st.openCursor(null,'prev');
    req.onsuccess=()=>{ const c=req.result; if(c){ items.push(c.value); c.continue(); } else res(items); };
    req.onerror=()=>rej(req.error);
  }));
}
// Categories
export async function upsertCat({name,budget=0,color}){
  return withStore('categories','readwrite',st=>st.put({name, budget:Number(budget)||0, color: color||autoColor(name)}));
}
export async function deleteCat(name){ return withStore('categories','readwrite',st=>st.delete(name)); }
export async function allCats(){
  return withStore('categories','readonly',st=>new Promise((res,rej)=>{
    const items=[]; const req=st.openCursor();
    req.onsuccess=()=>{const c=req.result; if(c){ items.push(c.value); c.continue(); } else res(items)};
    req.onerror=()=>rej(req.error);
  }));
}
// Settings
export async function setSetting(key, value){ return withStore('settings','readwrite',st=>st.put({key,value})); }
export async function getSetting(key){
  return withStore('settings','readonly',st=>new Promise((res,rej)=>{
    const r=st.get(key); r.onsuccess=()=>res(r.result?.value); r.onerror=()=>rej(r.error);
  }));
}
// Helpers
function autoColor(name){
  let hash=0; for (let i=0;i<name.length;i++) hash = name.charCodeAt(i) + ((hash<<5)-hash);
  const hue = Math.abs(hash)%360; return `hsl(${hue},70%,55%)`;
}
export function monthRange(ym){
  const [y,m]=ym.split('-').map(Number);
  const start=new Date(y,m-1,1); const end=new Date(y,m,0,23,59,59,999);
  return {start,end};
}
