/* app.js — frontend controller (demo-ready). No backend secrets here. */

/* ---------- UTIL ---------- */
function q(id){return document.getElementById(id)}
function el(tag, cls){const e=document.createElement(tag); if(cls) e.className=cls; return e;}
function distanceKm(a,b){
  const R=6371; const toRad=(x)=>x*Math.PI/180;
  const dLat=toRad(b.lat-a.lat); const dLon=toRad(b.lng-a.lng);
  const A=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)*Math.sin(dLon/2);
  const C=2*Math.atan2(Math.sqrt(A), Math.sqrt(1-A));
  return R*C;
}

/* ---------- MODE INIT ---------- */
let mode = localStorage.getItem('search_mode') || null;
if (!mode) {
  location.href = 'index.html';
} else {
  document.addEventListener('DOMContentLoaded', ()=> {
    const togglePass = q('toggle-pass'), toggleDrive = q('toggle-drive');

    const setActiveHeader = (m)=> {
      if(m==='passenger'){ 
        togglePass.classList.add('active'); 
        toggleDrive.classList.remove('active'); 
      }
      else { 
        toggleDrive.classList.add('active'); 
        togglePass.classList.remove('active'); 
      }
    };

    setActiveHeader(mode);

    togglePass.addEventListener('click', ()=> {
      mode='passenger'; 
      localStorage.setItem('search_mode', mode); 
      setActiveHeader(mode); 
      adaptUI();
    });

    toggleDrive.addEventListener('click', ()=> {
      mode='driver'; 
      localStorage.setItem('search_mode', mode); 
      setActiveHeader(mode); 
      adaptUI();
    });

    q('ui-mode-pass') && q('ui-mode-pass').addEventListener('click', ()=> {
      mode='passenger'; 
      localStorage.setItem('search_mode', mode); 
      setActiveHeader(mode); 
      adaptUI();
    });
    q('ui-mode-drive') && q('ui-mode-drive').addEventListener('click', ()=> {
      mode='driver'; 
      localStorage.setItem('search_mode', mode); 
      setActiveHeader(mode); 
      adaptUI();
    });

    q('logout').addEventListener('click', ()=> {
      localStorage.removeItem('search_user');
      location.href='index.html';
    });

    q('locate').addEventListener('click', ()=> { 
      if(window.focusOnMe) window.focusOnMe(); 
    });

    q('toggle-panel').addEventListener('click', ()=> {
      const cp = q('control-panel');
      cp.style.display = (cp.style.display === 'none' || cp.style.display === '') ? 'block' : 'none';
    });

    q('find-btn').addEventListener('click', ()=> {
      findDriversDemo();
    });

    q('publish-btn').addEventListener('click', ()=> {
      publishDemo();
    });

    q('panic').addEventListener('click', ()=> {
      if(confirm('Send demo SOS?')) alert('SOS sent (demo).');
    });

    adaptUI();
  });
}

/* ---------- MAP ---------- */
window.addEventListener('load', ()=> {
  if (window.setupMap) window.setupMap();
  startDemoFeeds();
});

/* ---------- ADAPT UI BASED ON MODE ---------- */
function adaptUI(){
  const controls = q('controls'), driverCard = q('driver-list-card');
  const welcomeTitle = q('welcome-title'), sub = q('sub-welcome');

  if (mode === 'passenger') {
    controls.style.display='block';
    driverCard.style.display='none';
    welcomeTitle.textContent = 'Passenger mode';
    sub.textContent = 'Search destination, view drivers heading your way';
  } else {
    controls.style.display='block';
    driverCard.style.display='block';
    welcomeTitle.textContent = 'Driver mode';
    sub.textContent = 'Publish your location and set seats & price';
  }

  /* ✔️ Show Stored Demo User Name */
  const userJson = localStorage.getItem('search_user');
  if (userJson) {
    const user = JSON.parse(userJson);
    const elUser = q('user-label');
    if (elUser) elUser.textContent = user.name || 'User';
  }
}

/* ---------- PASSENGER DEMO: FIND DRIVERS ---------- */
function findDriversDemo(){
  if (!window.demoDrivers) return alert("Map not ready.");
  const listBox = q('driver-list');
  listBox.innerHTML = '';

  const me = window.myPos || {lat:4.85, lng:7.02};

  window.demoDrivers.forEach(d=>{
    const dist = distanceKm(me, d.pos).toFixed(1);

    const item = el('div','driver-item');
    item.innerHTML = `
      <div class="driver-name">${d.name}</div>
      <div class="driver-meta">
        <span>Distance: ${dist} km</span>
      </div>
      <button class="choose">Choose Driver</button>
    `;

    item.querySelector('.choose').addEventListener('click',()=>{
      alert(`Driver selected: ${d.name} (demo)`);
      if (window.followDriver) window.followDriver(d);
    });

    listBox.appendChild(item);
  });

  q('driver-list-card').style.display='block';
}

/* ---------- DRIVER DEMO: PUBLISH LOCATION ---------- */
function publishDemo(){
  const seats = q('seat-count').value;
  const price = q('price-input').value;

  if (!seats || !price) return alert("Enter seats & price.");

  alert(`Published:\nSeats: ${seats}\nPrice: ₦${price}\n(Demo only)`);

  if (window.pushDriverMarker) {
    window.pushDriverMarker({
      name: "You",
      pos: window.myPos,
      seats,
      price
    });
  }
}

/* ---------- DEMO DRIVER FEEDS ---------- */
window.demoDrivers = [];

function startDemoFeeds(){
  const sample = [
    {name:"Lucky",    pos:{lat:4.86, lng:7.04}},
    {name:"Promise",  pos:{lat:4.88, lng:7.02}},
    {name:"Blessing", pos:{lat:4.87, lng:7.05}},
    {name:"Chinedu",  pos:{lat:4.83, lng:7.03}}
  ];

  window.demoDrivers = sample;

  if (window.showDemoDrivers){
    window.showDemoDrivers(sample);
  }

  // Simulate live movement
  setInterval(()=>{
    window.demoDrivers.forEach(d=>{
      d.pos.lat += (Math.random()-0.5)*0.002;
      d.pos.lng += (Math.random()-0.5)*0.002;
    });

    if(window.updateDriverMarkers){
      window.updateDriverMarkers(window.demoDrivers);
    }
  }, 4000);
}
