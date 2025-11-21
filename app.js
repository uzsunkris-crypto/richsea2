/* app.js — full demo controller (complete, feature-rich) */
/* Replace any previous app.js with this file. Works with the HTML above. */

/* ===== helpers ===== */
function q(id){return document.getElementById(id)}
function el(tag,cls){const e=document.createElement(tag); if(cls) e.className=cls; return e;}
function toast(msg, t=2200){ const n=el('div','_toast'); n.textContent=msg; Object.assign(n.style,{position:'fixed',right:'16px',bottom:'24px',background:'#081018',color:'#fff',padding:'10px 14px',borderRadius:'10px',zIndex:9999}); document.body.appendChild(n); setTimeout(()=>n.remove(),t); }
function toFixedNum(n,dec=1){ return Math.round(n * Math.pow(10,dec)) / Math.pow(10,dec); }
function distanceKm(a,b){ const R=6371; const toRad=(x)=>x*Math.PI/180; const dLat=toRad(b.lat-a.lat); const dLon=toRad(b.lng-a.lng); const A=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)*Math.sin(dLon/2); const C=2*Math.atan2(Math.sqrt(A), Math.sqrt(1-A)); return R*C; }

/* ===== state ===== */
let mode = localStorage.getItem('search_mode') || null;
let demoUser = JSON.parse(localStorage.getItem('search_user')||'null') || null;
let passengerPublished = JSON.parse(localStorage.getItem('passenger_published')||'null') || null;
let demoDrivers = {}; // { id: {id,name,lat,lng,price,seats,rating} }

/* require mode */
function requireModeOrRedirect(){ if(!mode) { location.href='index.html'; return false; } return true; }

/* ===== init on DOM ready ===== */
document.addEventListener('DOMContentLoaded', ()=> {
  if(!requireModeOrRedirect()) return;

  const togglePass = q('toggle-pass'), toggleDrive = q('toggle-drive');

  function setHeaderActive(m){
    if(!togglePass||!toggleDrive) return;
    if(m==='passenger'){ togglePass.classList.add('active'); toggleDrive.classList.remove('active'); } else { toggleDrive.classList.add('active'); togglePass.classList.remove('active'); }
  }
  setHeaderActive(mode);

  togglePass && togglePass.addEventListener('click', ()=> { mode='passenger'; localStorage.setItem('search_mode',mode); setHeaderActive(mode); adaptUI(); });
  toggleDrive && toggleDrive.addEventListener('click', ()=> { mode='driver'; localStorage.setItem('search_mode',mode); setHeaderActive(mode); adaptUI(); });

  q('ui-mode-pass') && q('ui-mode-pass').addEventListener('click', ()=> { mode='passenger'; localStorage.setItem('search_mode',mode); setHeaderActive(mode); adaptUI(); });
  q('ui-mode-drive') && q('ui-mode-drive').addEventListener('click', ()=> { mode='driver'; localStorage.setItem('search_mode',mode); setHeaderActive(mode); adaptUI(); });

  q('logout') && q('logout').addEventListener('click', ()=> { localStorage.removeItem('search_user'); location.href='index.html'; });

  q('locate') && q('locate').addEventListener('click', ()=> { if(window.focusOnMe) window.focusOnMe(); });

  q('toggle-panel') && q('toggle-panel').addEventListener('click', ()=> { const cp=q('control-panel'); cp.style.display=(cp.style.display==='none'||cp.style.display==='')?'block':'none'; });

  q('find-btn') && q('find-btn').addEventListener('click', passengerFindDriversHandler);
  q('publish-btn') && q('publish-btn').addEventListener('click', publishHandler);
  q('save-fav') && q('save-fav').addEventListener('click', saveFavorite);
  q('panic') && q('panic').addEventListener('click', ()=> { if(confirm('Send SOS (demo)?')) { const user = demoUser||{email:'guest'}; const alerts = JSON.parse(localStorage.getItem('sos_alerts')||'[]'); alerts.push({user:user.email,ts:Date.now()}); localStorage.setItem('sos_alerts', JSON.stringify(alerts)); toast('SOS sent (demo)'); } });

  refreshUserBadge(); renderFavorites(); adaptUI();
});

/* ===== UI helpers ===== */
function refreshUserBadge(){ const b=q('user-badge'); if(!b) return; const u=demoUser; b.textContent = u ? (u.name? u.name.split(' ')[0] : u.email) : 'Guest'; }

/* ===== adapt UI based on mode & publish state ===== */
function adaptUI(){
  const controls = q('controls'), driverCard = q('driver-list-card');
  const welcomeTitle = q('welcome-title'), sub = q('sub-welcome');
  if(mode==='passenger'){
    if(controls) controls.style.display='block';
    if(driverCard) driverCard.style.display = passengerPublished ? 'block' : 'none';
    if(welcomeTitle) welcomeTitle.textContent = 'Passenger mode';
    if(sub) sub.textContent = passengerPublished ? 'Published — drivers available' : 'Enter pickup & destination then publish to see drivers';
    q('find-btn') && (q('find-btn').disabled = !passengerPublished);
    q('publish-btn') && (q('publish-btn').textContent = passengerPublished ? 'Update my destination' : 'Publish my location');
  } else {
    if(controls) controls.style.display='block';
    if(driverCard) driverCard.style.display='block';
    if(welcomeTitle) welcomeTitle.textContent = 'Driver mode';
    if(sub) sub.textContent = 'Publish route, set seats & price to be visible to passengers';
    q('find-btn') && (q('find-btn').disabled = true);
    q('publish-btn') && (q('publish-btn').textContent = 'Publish my vehicle (demo)');
  }
}

/* ===== favorites ===== */
function saveFavorite(){
  const name = (q('dest-input') && q('dest-input').value || '').trim();
  if(!name) return toast('Type destination then save');
  const uid = (demoUser && demoUser.uid) || 'guest';
  const favs = JSON.parse(localStorage.getItem('favs_'+uid) || '[]');
  favs.push({name,ts:Date.now()}); localStorage.setItem('favs_'+uid, JSON.stringify(favs)); toast('Saved favorite'); renderFavorites();
}
function renderFavorites(){
  const listEl = q('fav-list'); if(!listEl) return;
  const uid = (demoUser && demoUser.uid) || 'guest';
  const favs = JSON.parse(localStorage.getItem('favs_'+uid) || '[]');
  listEl.innerHTML=''; favs.slice().reverse().forEach(f=>{ const li=el('li','fav-item'); li.textContent=f.name; li.addEventListener('click', ()=>{ if(q('dest-input')) q('dest-input').value=f.name; toast('Destination selected'); }); listEl.appendChild(li);});
}

/* ===== publish handlers ===== */
function passengerFindDriversHandler(){ if(mode!=='passenger'){ toast('Switch to passenger mode'); return; } if(!passengerPublished){ toast('Please publish pickup & destination first'); q('publish-btn') && q('publish-btn').classList.add('pulse'); setTimeout(()=> q('publish-btn') && q('publish-btn').classList.remove('pulse'),900); return; } findDriversDemo(); }
function publishHandler(){ if(mode==='passenger') return publishPassenger(); return publishDriver(); }

function publishPassenger(){
  const pickup = (q('pickup-input') && q('pickup-input').value || '').trim();
  const dest = (q('dest-input') && q('dest-input').value || '').trim();
  if(!pickup||!dest) return toast('Please enter pickup and destination');
  passengerPublished = { pickup, dest, lat: window.myPos && window.myPos.lat || null, lng: window.myPos && window.myPos.lng || null, ts:Date.now() };
  localStorage.setItem('passenger_published', JSON.stringify(passengerPublished));
  toast('Published — searching drivers nearby'); adaptUI(); findDriversDemo();
}

function publishDriver(){
  if(!navigator.geolocation) return toast('Geolocation not available');
  const seats = parseInt((q('seats-input')&&q('seats-input').value)||'0',10);
  const price = (q('price-input') && q('price-input').value) || null;
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat=pos.coords.latitude, lng=pos.coords.longitude;
    const id='me_demo';
    demoDrivers[id] = { id, name:(demoUser && demoUser.name)? demoUser.name.split(' ')[0] : 'You', lat, lng, seats, price, rating:'4.9' };
    if(window.pushDriverMarker) window.pushDriverMarker({ pos:{lat,lng}, name: demoDrivers[id].name, seats, price });
    toast('Published driver (demo)'); adaptUI();
  }, ()=> toast('Location denied — allow GPS to publish'), {enableHighAccuracy:true});
}

/* ===== demo feed ===== */
function spawnDemoDrivers(count=18){
  demoDrivers = {};
  const names = ['John','Mary','Tunde','Aisha','Emeka','Ngozi','Ife','Chike','Sade','Bola','James','Amaka','Lucky','Promise','Blessing','Chinedu'];
  const latMin=4.3, latMax=13.6, lngMin=2.8, lngMax=14.4;
  for(let i=0;i<count;i++){
    const id='d_'+i;
    const lat = latMin + Math.random()*(latMax-latMin);
    const lng = lngMin + Math.random()*(lngMax-lngMin);
    demoDrivers[id] = { id, name: names[Math.floor(Math.random()*names.length)], lat, lng, price: Math.round(200 + Math.random()*1200), seats: Math.floor(Math.random()*12), rating: (3.5+Math.random()*1.5).toFixed(1) };
  }
  const list=Object.values(demoDrivers).map(d=>({ name:d.name, pos:{lat:d.lat,lng:d.lng}, meta:d }));
  if(window.showDemoDrivers) window.showDemoDrivers(list);
}

function animateDemoDrivers(){
  setInterval(()=>{
    Object.keys(demoDrivers).forEach(k=>{ demoDrivers[k].lat += (Math.random()-0.5)*0.02; demoDrivers[k].lng += (Math.random()-0.5)*0.02; });
    const list=Object.values(demoDrivers).map(d=>({name:d.name,pos:{lat:d.lat,lng:d.lng},meta:d}));
    if(window.updateDriverMarkers) window.updateDriverMarkers(list);
  }, 2200);
}

/* ===== find drivers demo ===== */
function findDriversDemo(){
  const myPos = (window.myPos && {lat:window.myPos.lat,lng:window.myPos.lng}) || {lat:6.5,lng:7.0};
  const arr = Object.values(demoDrivers).map(d=>{ const km = toFixedNum(distanceKm(myPos,{lat:d.lat,lng:d.lng}),1); return { id:d.id, name:d.name, km, price:d.price, seats:d.seats, rating:d.rating, lat:d.lat, lng:d.lng }; }).sort((a,b)=>a.km-b.km).slice(0,12);
  renderDriverList(arr);
}

function renderDriverList(list){
  const container = q('drivers-list'); if(!container) return;
  container.innerHTML='';
  if(!list||list.length===0){ container.innerHTML='<div class="muted small">No drivers found</div>'; q('driver-list-card') && (q('driver-list-card').style.display='block'); return; }
  list.forEach(d=>{
    const card = el('div','driver-card');
    const top = el('div','driver-row');
    top.innerHTML = `<div><strong>${d.name}</strong> · <span class="muted">⭐ ${d.rating}</span></div><div><strong>₦${d.price}</strong></div>`;
    const mid = el('div'); mid.innerHTML = `<div class="muted small">${(d.km<1?Math.round(d.km*1000)+'m':d.km.toFixed(1)+' km')} · Seats ${d.seats}</div>`;
    const btnRow = el('div','row'); btnRow.style.marginTop='8px';
    const choose = el('button','primary'); choose.textContent='Choose Driver';
    choose.addEventListener('click', ()=> {
      toast(`You selected ${d.name}`);
      if(window.map) window.map.setView([d.lat,d.lng],14);
      setTimeout(()=> { if(confirm('Simulate arrival? Press OK to confirm arrival and rate driver.')) location.href='rating.html'; }, 2500);
    });
    btnRow.appendChild(choose);
    card.appendChild(top); card.appendChild(mid); card.appendChild(btnRow);
    container.appendChild(card);
  });
  q('driver-list-card') && (q('driver-list-card').style.display='block');
}

/* ===== integration start ===== */
function startDemoFeeds(){
  if(window.setupMap) window.setupMap();
  spawnDemoDrivers(18);
  animateDemoDrivers();
  // get geolocation for myPos
  if(navigator.geolocation){ navigator.geolocation.getCurrentPosition(p=>{ window.myPos={lat:p.coords.latitude,lng:p.coords.longitude}; if(window.focusOnMe) window.focusOnMe(); }, ()=>{/*ignore*/}); }
}
if(document.readyState==='complete' || document.readyState==='interactive'){ setTimeout(()=>{ startDemoFeeds(); adaptUI(); },300); } else { document.addEventListener('DOMContentLoaded', ()=> { setTimeout(()=>{ startDemoFeeds(); adaptUI(); },300); }); }

/* ===== small API for external pages ===== */
window.setDemoUser = function(u){ demoUser = u; localStorage.setItem('search_user', JSON.stringify(u)); refreshUserBadge(); }
window.getPassengerPublished = function(){ return passengerPublished; }
