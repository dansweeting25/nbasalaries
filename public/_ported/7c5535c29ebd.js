document.addEventListener('DOMContentLoaded', function(){ 
(function(){
  var SEL='#salary-directory';
  function headerOffset(){
    var hd=document.querySelector('.bde-header-builder,header');
    if(!hd)return 12;
    var p=getComputedStyle(hd).position;
    return (p==='sticky'||p==='fixed'?hd.getBoundingClientRect().height:0)+12;
  }
  function samePage(href){
    try{var u=new URL(href,location.href);return (u.origin===location.origin&&u.pathname===location.pathname)?u:null;}catch(e){return null;}
  }
  async function load(box,href){
    if(box.getAttribute('aria-busy')==='true')return;
    box.setAttribute('aria-busy','true');
    box.style.opacity='.55';
    try{
      var u=new URL(href,location.href);u.hash='';
      var res=await fetch(u.href,{credentials:'same-origin'});
      if(!res.ok)throw Error('fail');
      var doc=new DOMParser().parseFromString(await res.text(),'text/html');
      var next=doc.querySelector(SEL);
      if(!next)throw Error('none');
      var fresh=document.importNode(next,true);
      box.replaceWith(fresh);
      var off=headerOffset(),top=fresh.getBoundingClientRect().top;
      if(top<off||top>innerHeight*0.5)window.scrollTo({top:top+scrollY-off,behavior:'smooth'});
    }catch(err){
      location.href=href;
    }
  }
  document.addEventListener('click',function(e){
    if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    var a=e.target.closest&&e.target.closest('a[href]');
    if(!a)return;
    var box=document.querySelector(SEL);
    if(!box)return;
    var u=samePage(a.href);
    if(!u)return;
    if(box.contains(a)){
      if(!a.closest('.nlt-pages')&&!a.classList.contains('nlt-reset'))return;
    }else if(u.hash!=='#salary-directory'||!u.search){
      return;
    }
    e.preventDefault();
    load(box,a.href);
  });
  document.addEventListener('submit',function(e){
    var f=e.target;
    if(!f.classList||!f.classList.contains('nlt-filters'))return;
    var box=f.closest(SEL);
    if(!box)return;
    e.preventDefault();
    var u=new URL(f.getAttribute('action')||location.href,location.href);
    var q=new URLSearchParams();
    new FormData(f).forEach(function(v,k){if(v!=='')q.append(k,v);});
    u.search=q.toString();
    load(box,u.href);
  });
})();

 }) 