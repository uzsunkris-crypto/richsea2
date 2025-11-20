/* app.js
 * Frontend only: OpenStreetMap (Leaflet) + Firebase Auth + Realtime DB hooks + Paystack popup trigger.
 *
 * IMPORTANT:
 * - Do NOT put Paystack secret here (never).
 * - You must deploy a server/cloud function to verify transactions and set users/{uid}/paidDate.
 * - Replace FIREBASE_CONFIG, PAYSTACK_PUBLIC_KEY and VERIFY_PAYMENT_ENDPOINT values below.
 */

/* ========== CONFIG - REPLACE THESE ========== */
const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};
const PAYSTACK_PUBLIC_KEY = "YOUR_PAYSTACK_PUBLIC_KEY"; // public only
const VERIFY_PAYMENT_ENDPOINT = "https://YOUR_CLOUD_FUNCTION/verifyPaystack"; // server endpoint you will deploy
/* ============================================ */

/////////////////////// Firebase init (compat)
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.database();

/////////// UI nodes
const btnGoogle = document.getElementById('btn-google');
const signoutBtn = document.getElementById('signout');
const userEmailEl = document.getElementById('user-email');
const verifyNote = document.getElementById('verify-note');
const accessPanel = document.getElementById('access-panel');
const accessStatus = document.getElementById('access-status');
const payBtn = document.getElementById('pay-btn');
const rolePassengerBtn = document.getElementById('role-passenger');
const roleDriverBtn = document.getElementById('role-driver');
const routeInput = document.getElementById('route-input');
const goLiveBtn = document.getElementById('go-live');
const saveFavBtn = document.getElementById('save-fav');
const favList = document.getElementById('fav-list');
const countsEl = document.getElementById('counts');
const panicBtn = document.getElementById('panic');
const locateBtn = document.getElementById('locate');
const togglePanelBtn = document.getElementById('toggle-panel');
const controlPanel = document.getElementById('control-panel');

let currentRole = null;
let currentCapacity = 'empty';
let map, meMarker;
let passengerMarkers = {}, driverMarkers = {};
let watchId = null;

/* ------------ THE MAP ------------- */
function setupMap(){
  if (map) return;
  map = L.map('map', {preferCanvas:true}).setView([9.082, 8.6753], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // cluster group for performance
  window.clusterGroup = L.markerClusterGroup();
  map.addLayer(window.clusterGroup);
}

/* center on device location and set watch */
function startGeoWatch(){
  if (!navigator.geolocation) { alert('Geolocation not available'); return; }
  if (watchId) return;
  watchId = navigator.geolocation.watchPosition(pos => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    if (!meMarker) {
      meMarker = L.circleMarker([lat,lng], {radius:8, color:'#0b63ff', fillColor:'#9ed1ff', fillOpacity:0.9}).addTo(map).bindPopup('You');
    } else {
      meMarker.setLatLng([lat,lng]);
    }
    map.setView([lat,lng], 14);

    // if user is signed in and role selected and access granted, update DB
    const u = auth.currentUser;
    if (!u) return;
    if (!currentRole) return;
    // write to /passengersByUser or /driversByUser keyed by uid
    const node = (currentRole === 'passenger') ? 'passengersByUser' : 'driversByUser';
    db.ref(`${node}/${u.uid}`).set({
      lat, lng, direction: routeInput.value || '', capacity: currentCapacity, ts: Date.now()
    });
  }, err => {
    console.warn('geo error', err);
  }, { enableHighAccuracy:true, maximumAge:3000, timeout:8000 });
}

/* stop watch and remove DB entry */
async function stopPublishing(){
  if (watchId) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  const u = auth.currentUser;
  if (!u) return;
  if (currentRole) {
    const node = (currentRole === 'passenger') ? 'passengersByUser' : 'driversByUser';
    await db.ref(`${node}/${u.uid}`).remove();
  }
}

/* cleanup markers */
function clearMarkers(){
  Object.values(passengerMarkers).forEach(m => map.removeLayer(m));
  Object.values(driverMarkers).forEach(m => map.removeLayer(m));
  passengerMarkers = {}; driverMarkers = {};
}

/* live listeners */
function setupLiveListeners(){
  // passengers
  db.ref('passengersByUser').on('value', snap => {
    const all = snap.val() || {};
    countsEl.textContent = `${Object.keys(all).length} passengers · ${Object.keys(driverMarkers).length} drivers`;
    // update markers
    // remove old
    Object.keys(passengerMarkers).forEach(k => {
      if (!all[k]) { map.removeLayer(passengerMarkers[k]); delete passengerMarkers[k]; }
    });
    Object.keys(all).forEach(k => {
      const d = all[k];
      if (!d || !d.lat) return;
      if (passengerMarkers[k]) passengerMarkers[k].setLatLng([d.lat,d.lng]);
      else {
        const mark = L.marker([d.lat,d.lng], {icon: L.divIcon({className:'picon', html:`<div class="pin pin-pass">P</div>`})}).addTo(map);
        passengerMarkers[k] = mark;
      }
    });
  });

  // drivers
  db.ref('driversByUser').on('value', snap => {
    const all = snap.val() || {};
    countsEl.textContent = `${Object.keys(passengerMarkers).length} passengers · ${Object.keys(all).length} drivers`;
    Object.keys(driverMarkers).forEach(k => {
      if (!all[k]) { map.removeLayer(driverMarkers[k]); delete driverMarkers[k]; }
    });
    Object.keys(all).forEach(k => {
      const d = all[k];
      if (!d || !d.lat) return;
      if (driverMarkers[k]) driverMarkers[k].setLatLng([d.lat,d.lng]);
      else {
        const mark = L.marker([d.lat,d.lng], {icon: L.divIcon({className:'picon', html:`<div class="pin pin-driver">D</div>`})}).addTo(map);
        driverMarkers[k] = mark;
      }
    });
  });
}

/* ========== AUTH ============ */
btnGoogle.addEventListener('click', async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await auth.signInWithPopup(provider);
  } catch (e) {
    console.error('signin err', e);
    alert('Sign in failed');
  }
});

signoutBtn.addEventListener('click', async () => {
  await auth.signOut();
  // UI cleanup
  accessPanel.style.display = 'none';
  userEmailEl.textContent = '';
  clearMarkers();
  stopPublishing();
});

auth.onAuthStateChanged(async (user) => {
  setupMap();
  if (user) {
    userEmailEl.textContent = user.email;
    signoutBtn.style.display = 'inline-block';

    // Show access panel but enforce emailVerified
    accessPanel.style.display = 'block';
    if (!user.emailVerified) {
      verifyNote.style.display = 'block';
      accessStatus.textContent = 'Email not verified. Please check your inbox.';
      // send verification email (safe to call)
      try { await user.sendEmailVerification(); } catch(e){ console.warn('verif send err', e); }
      return;
    } else {
      verifyNote.style.display = 'none';
      // check DB for paidDate
      const snap = await db.ref(`users/${user.uid}`).once('value');
      const u = snap.val() || {};
      const paidDate = u.paidDate || null;
      const today = dateISO();
      if (paidDate === today) {
        accessStatus.textContent = `Access active for ${today}`;
        // allow map & listeners
        setupLiveListeners();
        startGeoWatch();
      } else {
        accessStatus.textContent = `No access for ${today}. Please pay ₦100.`;
        // Still allow map view but block publishing until pay
        clearMarkers();
        stopPublishing();
      }
    }

    // load favorites
    loadFavorites();
  } else {
    userEmailEl.textContent = '';
    signoutBtn.style.display = 'none';
    accessPanel.style.display = 'none';
    verifyNote.style.display = 'none';
  }
});

/* ========== PAYMENTS ========== */
payBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return alert('Sign in first');
  if (!user.emailVerified) return alert('Verify email first');

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: user.email,
    amount: 100 * 100, // kobo
    currency: 'NGN',
    ref: 'NRTR_' + user.uid + '_' + Date.now(),
    callback: function(resp){
      // call server to verify (must be server side)
      verifyOnServer(resp.reference, user.uid)
        .then(ok => {
          if (ok) {
            accessStatus.textContent = `Access active for ${dateISO()}`;
            setupLiveListeners();
            startGeoWatch();
            alert('Payment verified. Enjoy the service today.');
          } else {
            alert('Payment verification failed. Contact support.');
          }
        }).catch(err => {
          console.error(err);
          alert('Verification error. Try later.');
        });
    },
    onClose: function(){ console.log('payment closed'); }
  });
  handler.openIframe();
});

/* Verify on server (frontend calls your secure endpoint that uses Paystack secret) */
async function verifyOnServer(reference, uid){
  if (!VERIFY_PAYMENT_ENDPOINT || VERIFY_PAYMENT_ENDPOINT.includes('YOUR_CLOUD_FUNCTION')) {
    alert('Payment verification endpoint not configured. Please deploy server verify function and set VERIFY_PAYMENT_ENDPOINT.');
    return false;
  }
  try {
    const res = await fetch(VERIFY_PAYMENT_ENDPOINT, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ reference, uid })
    });
    if (!res.ok) return false;
    const j = await res.json();
    return j.status === 'success';
  } catch(e){ console.error(e); return false; }
}

/* ========== PUBLISHING ACTIONS ========== */
rolePassengerBtn.addEventListener('click', ()=> { currentRole='passenger'; showToast('Role: Passenger'); });
roleDriverBtn.addEventListener('click', ()=> { currentRole='driver'; showToast('Role: Driver'); });

document.querySelectorAll('.cap-btn').forEach(b => b.addEventListener('click', (e)=> {
  currentCapacity = e.currentTarget.dataset.cap;
  showToast('Capacity: ' + currentCapacity);
}));

goLiveBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return alert('Sign in first');
  // check paidDate again
  const snap = await db.ref(`users/${user.uid}`).once('value');
  const u = snap.val() || {};
  if (u.paidDate !== dateISO()) return alert('Please pay ₦100 for today to publish your location.');

  if (!currentRole) return alert('Select role first');
  // start watching position (will auto-push to DB)
  startGeoWatch();
  showToast('Publishing location live — stay safe.');
});

/* save favorite */
saveFavBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return alert('Sign in first');
  const v = routeInput.value.trim();
  if (!v) return alert('Type a route name');
  await db.ref(`users/${user.uid}/favorites`).push({ name:v, ts:Date.now() });
  showToast('Saved favorite');
  loadFavorites();
});

async function loadFavorites(){
  const user = auth.currentUser;
  if (!user) return;
  const snap = await db.ref(`users/${user.uid}/favorites`).once('value');
  const obj = snap.val() || {};
  favList.innerHTML = '';
  Object.keys(obj).forEach(k => {
    const li = document.createElement('li');
    li.textContent = obj[k].name;
    li.className = 'fav-item';
    li.addEventListener('click', ()=> { routeInput.value = obj[k].name; });
    favList.appendChild(li);
  });
}

/* panic */
panicBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return alert('Sign in first');
  if (!confirm('Send SOS to admin with your location?')) return;
  if (!navigator.geolocation) return alert('Geolocation not available');
  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    await db.ref('adminAlerts').push({ uid:user.uid, email:user.email, lat, lng, ts:Date.now() });
    alert('SOS sent to admin.');
  }, err => alert('Unable to get location'));
});

/* helper: date ISO y-m-d (client) */
function dateISO(){
  const dt = new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,'0');
  const d = String(dt.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

/* small toast */
function showToast(msg){
  console.log(msg);
  // quick UI hint (simple)
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.position='fixed'; el.style.bottom='100px'; el.style.left='50%'; el.style.transform='translateX(-50%)';
  el.style.background='rgba(0,0,0,0.8)'; el.style.color='white'; el.style.padding='8px 12px'; el.style.borderRadius='8px'; el.style.zIndex=99999;
  document.body.appendChild(el);
  setTimeout(()=> el.remove(),2500);
}

/* toggle panel (mobile) */
togglePanelBtn.addEventListener('click', ()=> {
  if (controlPanel.style.display==='none' || !controlPanel.style.display) controlPanel.style.display = 'block';
  else controlPanel.style.display = 'none';
});
locateBtn.addEventListener('click', ()=> {
  if (meMarker) map.setView(meMarker.getLatLng(), 15);
});

/* small UI init */
setupMap();
document.getElementById('access-panel').style.display='none';
btnGoogle.addEventListener('click', ()=>{ document.getElementById('access-panel').style.display='block'; });

/* Setup Live DB listeners (no publishing yet) */
setupLiveListeners();
