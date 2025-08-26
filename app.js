import { addTxn, updateTxn, deleteTxn, allTxns, upsertCat, deleteCat, allCats, setSetting, getSetting, monthRange } from './db.js';
import { $, $all, money, setTab, clear, chip, iOSTip } from './ui.js';

// Tabs
$all('.tabs button').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
window.addEventListener('load', iOSTip);

// Elements
const incomeTotal=$('#incomeTotal'), expenseTotal=$('#expenseTotal'), leftToSpend=$('#leftToSpend');
const topCategories=$('#topCategories'), catChart=$('#catChart');
const donut=$('#donut'), bars=$('#bars');
const quickAdd=$('#quickAdd');

const txForm=$('#txForm'), txAmount=$('#txAmount'), txDate=$('#txDate'), txDesc=$('#txDesc'), txIncome=$('#txIncome'), txRecurring=$('#txRecurring');
const categoryChips=$('#categoryChips');
const txTableBody=$('#txTable tbody'), filterMonth=$('#filterMonth'), filterSearch=$('#filterSearch');

const catForm=$('#catForm'), catName=$('#catName'), catBudget=$('#catBudget'), catTableBody=$('#catTable tbody');

const exportJSONBtn=$('#exportJSON'), exportCSVBtn=$('#exportCSV'), importFile=$('#importFile'), importBtn=$('#importBtn'), resetBtn=$('#resetBtn');

let categories=[], transactions=[], chart1, chart2, chart3;

function ym(d=new Date()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function within(d, start, end){ const t=new Date(d); return t>=start && t<=end; }
function byCatThisMonth(){
  const {start,end}=monthRange(filterMonth.value||ym());
  const spend={}; let inc=0, exp=0;
  for (const t of transactions){
    if(!within(t.date,start,end)) continue;
    if(t.isIncome){ inc+=Number(t.amount); } else { exp+=Number(t.amount); spend[t.category]=(spend[t.category]||0)+Number(t.amount); }
  }
  return {spend, inc, exp};
}
function totalBudget(){ return categories.reduce((s,c)=>s+(Number(c.budget)||0),0); }

async function refresh(){
  categories = await allCats();
  transactions = await allTxns();
  renderChips(); renderHome(); renderTxns(); renderCats(); renderReports();
}
function renderChips(){
  clear(categoryChips);
  for(const c of categories){
    const el=chip(c.name);
    el.style.borderColor = '#2a3340'; el.style.color = '#cdd6e1';
    el.addEventListener('click',()=>{
      $all('.chip').forEach(x=>x.classList.remove('active')); el.classList.add('active');
      el.dataset.selected='1'; el.style.outlineColor=c.color;
    });
    categoryChips.appendChild(el);
  }
}
function selectedCategory(){ const el=$all('.chip').find(x=>x.classList.contains('active')); return el?.textContent; }

function renderHome(){
  const {spend,inc,exp}=byCatThisMonth();
  incomeTotal.textContent=money(inc);
  expenseTotal.textContent=money(exp);
  leftToSpend.textContent=money(Math.max(0, totalBudget()-exp));

  // Top categories
  clear(topCategories);
  const arr=Object.entries(spend).sort((a,b)=>b[1]-a[1]).slice(0,5);
  for (const [name,amt] of arr){
    const li=document.createElement('li'); li.textContent=`${name} — ${money(amt)}`; topCategories.appendChild(li);
  }

  // Chart
  if(chart1) chart1.destroy();
  const labels = categories.map(c=>c.name);
  const data = labels.map(n=>spend[n]||0);
  chart1 = new Chart(catChart, { type:'bar', data:{labels, datasets:[{label:'Spent', data}]}, options:{plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}} });
}

function filteredTxns(){
  const m = filterMonth.value || ym();
  const q = (filterSearch.value||'').toLowerCase();
  const {start,end}=monthRange(m);
  return transactions.filter(t=>within(t.date,start,end) && (!q || (t.category?.toLowerCase().includes(q) || (t.note||'').toLowerCase().includes(q))));
}
function renderTxns(){
  clear(txTableBody);
  for (const t of filteredTxns()){
    const tr=document.createElement('tr');
    const del=document.createElement('button'); del.textContent='Delete';
    del.addEventListener('click', async()=>{ await deleteTxn(t.id); await refresh(); });
    tr.innerHTML=`<td>${t.date}</td><td>${t.category||''}</td><td>${t.note||''}</td><td>${t.isIncome?'Income':'Expense'}</td><td class="num">${money(t.amount)}</td><td></td>`;
    tr.lastElementChild.appendChild(del);
    txTableBody.appendChild(tr);
  }
}

function renderCats(){
  clear(catTableBody);
  const {start,end}=monthRange(filterMonth.value||ym());
  const spentBy={};
  for (const t of transactions){
    if(!t.isIncome && within(t.date,start,end)){
      spentBy[t.category]=(spentBy[t.category]||0)+Number(t.amount);
    }
  }
  for (const c of categories){
    const spent=spentBy[c.name]||0;
    const left=Math.max(0,(Number(c.budget)||0)-spent);
    const tr=document.createElement('tr');
    const del=document.createElement('button'); del.textContent='Delete';
    del.addEventListener('click', async()=>{ await deleteCat(c.name); await refresh(); });
    tr.innerHTML=`<td>${c.name}</td><td class="num" contenteditable="true" data-cat="${c.name}">${money(c.budget)}</td><td class="num">${money(spent)}</td><td class="num">${money(left)}</td><td></td>`;
    tr.lastElementChild.appendChild(del);
    catTableBody.appendChild(tr);
  }
  // Inline edit budgets
  $all('[data-cat]').forEach(cell=>cell.addEventListener('blur', async()=>{
    const name=cell.dataset.cat; const raw=cell.textContent.replace(/[^0-9.\-]/g,''); const budget=Number(raw)||0;
    const existing=categories.find(c=>c.name===name); await upsertCat({name, budget, color: existing?.color});
    await refresh();
  }));
}

function renderReports(){
  const month=filterMonth.value||ym();
  const {start,end}=monthRange(month);
  const byCat={}, byMonth=new Map();
  for (const t of transactions){
    const d=new Date(t.date);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const isInRange=within(t.date,start,end);
    if(!t.isIncome){
      byCat[t.category]=(byCat[t.category]||0)+Number(t.amount);
      byMonth.set(key,(byMonth.get(key)||0)+Number(t.amount));
    }
  }
  // Donut
  if(chart2) chart2.destroy();
  const dLabels=Object.keys(byCat), dVals=Object.values(byCat);
  chart2 = new Chart(donut, { type:'doughnut', data:{labels:dLabels, datasets:[{data:dVals}]}, options:{plugins:{legend:{position:'bottom'}}} });
  // Bars (last 12 months)
  if(chart3) chart3.destroy();
  const months=[...new Set(transactions.map(t=>t.date.slice(0,7)))].sort().slice(-12);
  const series=months.map(m=>byMonth.get(m)||0);
  chart3 = new Chart(bars, { type:'bar', data:{labels:months, datasets:[{label:'Monthly Spend', data:series}]}, options:{plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}} });
}

// Handlers
quickAdd.addEventListener('click',()=>setTab('log'));
txForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const cat = selectedCategory();
  if(!cat) return alert('Pick a category (Budgets tab to add new ones).');
  const tx = {
    date: (txDate.value || new Date().toISOString().slice(0,10)),
    note: txDesc.value.trim(),
    amount: Number(txAmount.value||0),
    category: cat,
    isIncome: !!txIncome.checked,
    recurring: !!txRecurring.checked
  };
  if(!(tx.amount>0)) return alert('Enter a valid amount.');
  await addTxn(tx);
  txForm.reset(); $all('.chip').forEach(c=>c.classList.remove('active'));
  await refresh();
  setTab('home');
});
filterMonth.addEventListener('change', ()=>{ renderHome(); renderTxns(); renderCats(); renderReports(); });
filterSearch.addEventListener('input', ()=>renderTxns());

catForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const name=catName.value.trim(); const budget=Number(catBudget.value)||0;
  if(!name) return;
  await upsertCat({name, budget});
  catForm.reset(); await refresh();
});

function download(filename, text, type='text/plain'){
  const blob=new Blob([text], {type}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}
exportJSONBtn.addEventListener('click', async ()=>{
  const data={ categories, transactions };
  download(`pennywise-backup-${Date.now()}.json`, JSON.stringify(data,null,2), 'application/json');
});
function toCSV(tx){
  const headers=['date','category','note','type','amount','recurring'];
  const lines=[headers.join(',')];
  for (const t of tx){
    const esc=s=>`"${(s||'').replaceAll('"','""')}"`;
    lines.push([t.date, esc(t.category), esc(t.note), t.isIncome?'income':'expense', t.amount, t.recurring?1:0].join(','));
  }
  return lines.join('\n');
}
exportCSVBtn && exportCSVBtn.addEventListener('click', async ()=>{
  download(`pennywise-transactions-${Date.now()}.csv`, toCSV(transactions), 'text/csv');
});
importBtn.addEventListener('click', async ()=>{
  const file=importFile.files?.[0]; if(!file) return alert('Choose a file.');
  const text=await file.text();
  if(file.name.endsWith('.json')){
    const data=JSON.parse(text);
    if(Array.isArray(data.categories)){ for (const c of data.categories) await upsertCat(c); }
    if(Array.isArray(data.transactions)){ for (const t of data.transactions) await addTxn(t); }
  }else if(file.name.endsWith('.csv')){
    const rows=text.split(/\r?\n/).filter(Boolean); const headers=rows.shift().split(',').map(h=>h.trim().toLowerCase());
    const idx=Object.fromEntries(headers.map((h,i)=>[h,i]));
    for (const r of rows){
      const vals=r.match(/(".*?"|[^",]+)(?=,|$)/g).map(s=>s.replace(/^"|"$/g,'').replace(/""/g,'"'));
      const tx={
        date: vals[idx.date],
        category: vals[idx.category],
        note: vals[idx.note],
        isIncome: (vals[idx.type]||'expense').toLowerCase()==='income',
        amount: Number(vals[idx.amount]||0),
        recurring: (vals[idx.recurring]||'0')==='1'
      };
      await addTxn(tx);
    }
  } else return alert('Unsupported file type.');
  alert('Import complete.'); await refresh();
});
resetBtn.addEventListener('click', async ()=>{
  if(confirm('Really delete ALL data? This cannot be undone.')){
    // Brute reset by nuking DB
    indexedDB.deleteDatabase('pennywise-db');
    location.reload();
  }
});

// Seed defaults on first run
(async function seed(){
  const seeded = await getSetting('seeded');
  if(!seeded){
    await upsertCat({name:'Groceries', budget:300});
    await upsertCat({name:'Rent', budget:1200});
    await upsertCat({name:'Utilities', budget:200});
    await upsertCat({name:'Dining', budget:150});
    await addTxn({date:new Date().toISOString().slice(0,10), category:'Income', note:'Paycheck', isIncome:true, amount:2500, recurring:true});
    await addTxn({date:new Date().toISOString().slice(0,10), category:'Groceries', note:'Starter', isIncome:false, amount:40});
    await setSetting('seeded', true);
  }
  filterMonth.value = ym();
  await refresh();
})();
