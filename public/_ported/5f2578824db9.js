
(function(){
  var h=document.getElementById('nba-site-header')||document.querySelector('.bde-section-365-100');
  if(h){
    var last=-1;
    var set=function(){
      var b=Math.round(h.getBoundingClientRect().bottom);
      if(b<0){b=0;}
      var v=b+15;
      if(v!==last){last=v;document.documentElement.style.setProperty('--nlt-sticky-top',v+'px');}
    };
    set();
    window.addEventListener('scroll',set,{passive:true});
    window.addEventListener('resize',set,{passive:true});
    if(window.ResizeObserver){try{new ResizeObserver(set).observe(h);}catch(e){}}
  }
  function drop(img){
    if(!img||!img.parentNode){return;}
    var fig=img.closest('figure');
    if(fig&&fig.parentNode){fig.parentNode.removeChild(fig);}
    else{img.parentNode.removeChild(img);}
  }
  function sweep(){
    var imgs=document.querySelectorAll('figure img');
    for(var i=0;i<imgs.length;i++){
      var im=imgs[i];
      if(im.complete&&im.naturalWidth===0){drop(im);}
    }
  }
  document.addEventListener('error',function(e){
    var t=e.target;
    if(t&&t.tagName==='IMG'&&t.closest('figure')){drop(t);}
  },true);
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',sweep);}else{sweep();}
  window.addEventListener('load',sweep);
  try{
    var path=(location.pathname||'/').replace(/\/+$/,'')||'/';
    var links=document.querySelectorAll('.nbasalarie-nav a.button-atom--text');
    for(var j=0;j<links.length;j++){
      var hp=(links[j].getAttribute('href')||'').replace(location.origin,'').replace(/\/+$/,'')||'/';
      if(hp===path){links[j].classList.add('is-current');}
    }
  }catch(e){}
})();
