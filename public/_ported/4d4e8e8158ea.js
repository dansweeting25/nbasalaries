(()=>{
/* Sidebars follow the header as the team bar hides and shows. */
const header=document.getElementById('nba-site-header');
if(header){const set=()=>{const b=Math.max(0,header.getBoundingClientRect().bottom);document.documentElement.style.setProperty('--nlt-sticky-top',Math.round(b+20)+'px');};set();addEventListener('scroll',set,{passive:true});addEventListener('resize',set);if(window.ResizeObserver)new ResizeObserver(set).observe(header);}

/* Team pages: no gap above the hero on mobile. */
const tMain=document.querySelector('body.nlf-team main');
const setPad=()=>{if(!tMain)return;if(innerWidth<768)tMain.style.setProperty('padding-top','0','important');else tMain.style.removeProperty('padding-top');};
if(tMain){setPad();addEventListener('resize',setPad);}

/* Mobile menu: panel sits on the header line, full width. */
const mm=document.querySelector('.nba-mobile-menu');
if(mm){const row=document.querySelector('#nba-site-header .bde-fancy-container-365-101');const strip=document.querySelector('#nba-site-header .bde-fancy-container-365-111');const pos=()=>{let b=0;[row,strip].forEach(el=>{if(!el)return;const r=el.getBoundingClientRect();if(r.height>1&&r.bottom>b&&getComputedStyle(el).visibility!=='hidden')b=r.bottom;});if(b)document.documentElement.style.setProperty('--nlt-menu-top',Math.round(b-1)+'px');};pos();mm.addEventListener('toggle',pos);if(mm.querySelector('summary'))mm.querySelector('summary').addEventListener('click',pos);addEventListener('scroll',()=>{if(mm.open)pos();},{passive:true});addEventListener('resize',pos);
  const sum=mm.querySelector('summary');
  const close=()=>{if(!mm.open||mm.classList.contains('is-closing'))return;if(matchMedia('(prefers-reduced-motion: reduce)').matches){mm.open=false;return;}mm.classList.add('is-closing');setTimeout(()=>{mm.classList.remove('is-closing');mm.open=false;paint();if(sum){['color','background-color','border-color','-webkit-text-fill-color','background-image','box-shadow'].forEach(p=>sum.style.removeProperty(p));}},330);};
  const nav=mm.querySelector('nav');
  const paint=()=>{if(nav){if(innerWidth<768){nav.style.setProperty('width','100vw','important');nav.style.setProperty('max-width','100vw','important');if(mm.open||mm.classList.contains('is-closing'))nav.style.removeProperty('display');else nav.style.setProperty('display','none','important');}else{['width','max-width','display'].forEach(p=>nav.style.removeProperty(p));}}
    if(!sum)return;if(mm.open&&innerWidth<768){sum.style.setProperty('color','#fff','important');sum.style.setProperty('-webkit-text-fill-color','#fff','important');sum.style.setProperty('background-image','linear-gradient(#17408b,#17408b)','important');sum.style.setProperty('box-shadow','inset 0 0 0 2px #17408b','important');sum.style.setProperty('background-color','#17408b','important');sum.style.setProperty('border-color','#17408b','important');}else{['color','background-color','border-color','-webkit-text-fill-color','background-image','box-shadow'].forEach(p=>sum.style.removeProperty(p));}};
  mm.addEventListener('toggle',paint);addEventListener('resize',paint);paint();
  if(sum)sum.addEventListener('click',e=>{if(mm.open){e.preventDefault();close();}});
  document.addEventListener('click',e=>{if(mm.open&&!mm.contains(e.target))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  mm.querySelectorAll('nav a').forEach(a=>{const p=new URL(a.href,location.href).pathname;if(p===location.pathname||(p!=='/'&&location.pathname.indexOf(p)===0))a.classList.add('is-current');});}

/* Expandable table rows. */
document.addEventListener('click',async e=>{
  const ft=e.target.closest('.nlt-filter-toggle');
  if(ft){const fm=document.getElementById(ft.getAttribute('aria-controls'));const open=ft.getAttribute('aria-expanded')!=='true';ft.setAttribute('aria-expanded',String(open));if(fm)fm.classList.toggle('is-open',open);return;}
  const t=e.target.closest('.nlt-toggle');
  if(t){const row=document.getElementById(t.getAttribute('aria-controls'));const open=t.getAttribute('aria-expanded')!=='true';t.setAttribute('aria-expanded',String(open));t.querySelector('span').textContent=open?'−':'+';if(row)row.hidden=!open;return;}
  const more=e.target.closest('.nlt-more');
  if(more){e.preventDefault();if(more.getAttribute('aria-busy')==='true')return;const box=more.closest('.nlt');more.setAttribute('aria-busy','true');const label=more.textContent;more.textContent='Loading…';
    try{const res=await fetch(more.href,{credentials:'same-origin'});if(!res.ok)throw Error('fail');const doc=new DOMParser().parseFromString(await res.text(),'text/html');const next=doc.querySelector('#salary-directory');const bodies=next?[...next.querySelectorAll('table>tbody')]:[];if(!bodies.length)throw Error('none');const table=box.querySelector('table');
      bodies.forEach(b=>{const tg=b.querySelector('.nlt-toggle'),dt=b.querySelector('.nlt-detail');if(tg&&dt){const id='p'+next.dataset.page+'-'+dt.id;dt.id=id;tg.setAttribute('aria-controls',id);}table.append(document.importNode(b,true));});
      const shown=table.querySelectorAll('tbody').length,start=(Number(box.dataset.page)-1)*Number(box.dataset.perPage)+1;box.querySelector('.nlt-count').textContent='Showing '+start+'–'+(start+shown-1)+' of '+box.dataset.total+' · 2026–27';
      const nm=next.querySelector('.nlt-more');if(nm){more.href=nm.href;more.textContent=nm.textContent;more.removeAttribute('aria-busy');}else more.remove();const pg=next.querySelector('.nlt-pages');if(pg&&box.querySelector('.nlt-pages'))box.querySelector('.nlt-pages').innerHTML=pg.innerHTML;
    }catch(err){more.textContent=label;more.removeAttribute('aria-busy');window.location.href=more.href;}
    return;}
  const r=e.target.closest('.nlt-row');
  if(r&&!e.target.closest('a,button,input,select,label'))r.querySelector('.nlt-toggle')?.click();
});

/* Payroll history: details in a tooltip beside the season, one fact per line. */
const money=n=>'$'+Math.round(n).toLocaleString('en-US'),short=n=>'$'+(n/1e6).toFixed(2)+'M';
const delta=(v,pp)=>{if(Math.abs(v)<(pp?0.005:1))return '<span>No Change</span>';const up=v>0;return '<span class="'+(up?'is-up':'is-down')+'">'+(up?'▲ +':'▼ −')+(pp?Math.abs(v).toFixed(2)+' pp':short(Math.abs(v)))+'</span>';};
document.querySelectorAll('.nlh-chart').forEach(chart=>{
  const data=JSON.parse(chart.dataset.history),bars=chart.querySelector('.nst-bars'),tip=chart.querySelector('.nlh-tip'),buttons=[...chart.querySelectorAll('.nst-bar-button')];
  let mode='dollars',pinned=-1;
  const line=(k,v)=>'<div><span>'+k+'</span><span>'+v+'</span></div>';
  function show(i){const h=data[i],p=data[i-1],pct=100*h.payroll/h.cap;
    let html='<strong>'+h.season+'</strong>'+line('Cap Payroll',money(h.payroll))+line('Salary Cap',money(h.cap))+line('Share of Cap',pct.toFixed(2)+'%');
    if(p){html+=line('Change',delta(h.payroll-p.payroll,false))+line('Cap Share Change',delta(pct-100*p.payroll/p.cap,true));}else html+=line('Change','First Season Shown');
    tip.innerHTML=html;tip.hidden=false;
    const b=buttons[i],w=tip.offsetWidth||230,room=bars.scrollWidth;const vs=chart.scrollLeft-bars.offsetLeft,ve=vs+chart.clientWidth;let left=b.offsetLeft+b.offsetWidth+8;if(left+w>Math.min(room,ve))left=b.offsetLeft-w-8;if(left<vs||left+w>ve)left=vs+(chart.clientWidth-w)/2;tip.style.left=Math.max(0,Math.min(left,room-w))+'px';
    buttons.forEach((x,j)=>x.setAttribute('aria-pressed',String(j===i)));}
  function hide(){if(pinned<0){tip.hidden=true;buttons.forEach(x=>x.setAttribute('aria-pressed','false'));}}
  buttons.forEach((b,i)=>{
    b.addEventListener('click',ev=>{ev.stopPropagation();if(pinned===i){pinned=-1;hide();return;}pinned=i;show(i);});
    b.addEventListener('mouseenter',()=>{if(matchMedia('(hover:hover)').matches)show(i);});
    b.addEventListener('mouseleave',()=>{if(pinned>=0)show(pinned);else hide();});
    b.addEventListener('focus',()=>show(i));b.addEventListener('blur',()=>{if(pinned<0)hide();});
  });
  document.addEventListener('click',ev=>{if(!chart.contains(ev.target)){pinned=-1;hide();}});
  chart.addEventListener('scroll',()=>{if(pinned>=0)show(pinned);},{passive:true});
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){pinned=-1;hide();}});
  const tabs=chart.previousElementSibling;
  if(tabs&&tabs.classList.contains('nlh-tabs'))tabs.querySelectorAll('button').forEach(tab=>tab.addEventListener('click',()=>{
    mode=tab.dataset.chart;tabs.querySelectorAll('button').forEach(t=>t.setAttribute('aria-pressed',String(t===tab)));
    const vals=data.map(h=>mode==='percent'?100*h.payroll/h.cap:h.payroll),max=Math.max(...vals);
    buttons.forEach((b,i)=>{b.querySelector('.nst-bar').style.height=Math.max(8,190*vals[i]/max)+'px';b.querySelector('.nst-bar-value').textContent=mode==='percent'?vals[i].toFixed(2)+'%':short(vals[i]);
      const s=b.querySelector('small');if(i){const v=vals[i]-vals[i-1],up=v>0;s.innerHTML='<span class="nlt-d '+(up?'is-up':'is-down')+'"><i aria-hidden="true">'+(up?'▲':'▼')+'</i>'+(up?'+':'−')+(mode==='percent'?Math.abs(v).toFixed(2)+' pp':short(Math.abs(v)))+'</span>';}});
    if(pinned>=0)show(pinned);
  }));
});
})();
