/* app.js — Frontend UI + map integration (no secrets) */
/* Make sure firebase-config.js is included BEFORE this file */

if (!window.FIREBASE_CLIENT_CONFIG) {
  console.error('Missing firebase client config. Add firebase-config.js with your client config.');
} else {
  firebase.initializeApp(window.FIREBASE_CLIENT_CONFIG);
}

const auth = firebase.auth();
const db = firebase.database();

/* ====== CONFIG (replace) ====== */
const PAYSTACK_PUBLIC_KEY = "YOUR_PAYSTACK_PUBLIC_KEY"; // safe public key
const VERIFY_PAYMENT_ENDPOINT = "https://YOUR_BACKEND/verifyPayment"; // server verifies the paystack ref
/* ============================== */

/* UI refs */
const btnGoogle = document.getElementById('btn-google');
const signoutBtn = document.getElementById('signout');
const userEmailEl = document.getElementById('user-email');
const verifyNote = document.getElementById('verify-note');
const accessPanel = document.getElementById('access-panel');
const accessStatus = document.getElementById('access-status');
const payBtn = document.getElementById('pay-btn');
const controlsCard = document.getElementById('controls-card');
const modePassenger = document.getElementById('mode-passenger');
const modeDriver = document.getElementById('mode-driver');
const pickupInput = document.getElementById('pickup-input');
const destInput = document.getElementById('dest-input');
const seatsInput = document.getElementById('seats-input');
const goLiveBtn = document.getElementById('go-live');
const saveFav = document.getElementById('save-fav');
const favList = document.getElementById('fav-list');
const countsEl = document.getElementById('counts');
const panicBtn = document.getElementById('panic');
const locateBtn = document.getElementById('locate');
const togglePanelBtn = document.getElementById('toggle-panel');

let currentMode = 'passenger'; // passenger | driver
let publishPath = null;
let geoActive = false;

/* small helpers */
function showToast(msg, ms=2800) {
  const t = document.createElement('div'); t.className='_toast'; t.textContent=msg; document.body.appendChild(t);
  setTimeout(()=>t.remove(), ms);
}
function dateISO(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

/* ensure map */
if (window.setupMap) window.setupMap();

/* AUTH flows */
btnGoogle && btnGoogle.addEventListener('click', async ()=> {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  try { await auth.signInWithPopup(provider); } catch(e){ console.error(e); showToast('Google signin failed'); }
});

signoutBtn && signoutBtn.addEventListener('click', async ()=> {
  await auth.signOut();
  showToast('Signed out');
  if (window.stopGeoWatch) window.stopGeoWatch(true);
  accessPanel.style.display='none';
  controlsCard.style.display='none';
});

/* on change */
auth.onAuthStateChanged(async user => {
  if (user) {
    userEmailEl.textContent = user.email || user.displayName;
    signoutBtn.style.display='inline-block';
    accessPanel.style.display='block';

    if (!user.emailVerified) {
      verifyNote.style.display='block';
      accessStatus.textContent = 'Email not verified. Verification email sent.';
      try { await user.sendEmailVerification(); } catch(e){ console.warn(e); }
      controlsCard.style.display='none';
      return;
    } else {
      verifyNote.style.display='none';
    }

    /* check paid status */
    const snap = await db.ref(`users/${user.uid}`).once('value');
    const u = snap.val() || {};
    if (u.paidDate === dateISO()) {
      accessStatus.textContent = `Access active for ${dateISO()}`;
      controlsCard.style.display='block';
      startLiveListeners();
    } else {
      accessStatus.textContent = `No access for ${dateISO()}. Please pay ₦100.`;
      controlsCard.style.display='none';
    }
    loadFavorites();
  } else {
    userEmailEl.textContent='';
    signoutBtn.style.display='none';
    accessPanel.style.display='none';
    controlsCard.style.display='none';
  }
});

/* PAYSTACK pay flow (frontend triggers inline) */
payBtn && payBtn.addEventListener('click', async ()=> {
  const user = auth.currentUser; if (!user) return showToast('Sign in first');
  if (!user.emailVerified) return showToast('Verify email first');
  if (!PAYSTACK_PUBLIC_KEY || PAYSTACK_PUBLIC_KEY.includes('YOUR_PAYSTACK')) { showToast('Paystack key not configured'); return; }

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: user.email,
    amount: 100 * 100,
    currency: 'NGN',
    ref: 'SEARCH_' + user.uid + '_' + Date.now(),
    callback: async function(resp) {
      showToast('Verifying payment...');
      try {
        // call secure backend to verify the Paystack reference
        const res = await fetch(VERIFY_PAYMENT_ENDPOINT, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ reference: resp.reference, uid: user.uid })
        });
        const j = await res.json();
        if (j && j.status === 'success') {
          showToast('Payment verified — access granted for today.');
          accessStatus.textContent = `Access active for ${dateISO()}`;
          controlsCard.style.display = 'block';
        } else {
          showToast('Payment verification failed.');
        }
      } catch(e){
        console.error(e); showToast('Verification server error');
      }
    },
    onClose: function(){ showToast('Payment closed'); }
  });
  handler.openIframe();
});

/* Mode switching */
modePassenger && modePassenger.addEventListener('click', ()=> { currentMode='passenger'; showToast('Passenger mode'); });
modeDriver && modeDriver.addEventListener('click', ()=> { currentMode='driver'; showToast('Driver mode'); });

/* save favorite */
saveFav && saveFav.addEventListener('click', async ()=> {
  const user = auth.currentUser; if (!user) return showToast('Sign in first');
  const name = destInput.value.trim(); if (!name) return showToast('Type a destination');
  await db.ref(`users/${user.uid}/favorites`).push({ name, ts: Date.now()});
  showToast('Saved favorite');
  loadFavorites();
});
async function loadFavorites() {
  const user = auth.currentUser; if (!user) return;
  const snap = await db.ref(`users/${user.uid}/favorites`).once('value'); const obj = snap.val() || {};
  favList.innerHTML = '';
  Object.keys(obj).forEach(k => {
    const li = document.createElement('li'); li.textContent = obj[k].name; li.addEventListener('click', ()=> { destInput.value=obj[k].name; showToast('Selected'); });
    favList.appendChild(li);
  });
}

/* Publish location (driver or passenger) */
goLiveBtn && goLiveBtn.addEventListener('click', async ()=> {
  const user = auth.currentUser; if (!user) return showToast('Sign in first');
  const snap = await db.ref(`users/${user.uid}`).once('value'); const u = snap.val() || {};
  if (u.paidDate !== dateISO()) return showToast('Please pay ₦100 today to publish.');
  // require geolocation
  if (!navigator.geolocation) return showToast('Geolocation not available');
  // get current position once first then start watch
  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    // confirm within Nigeria bounds (rough)
    if (lat < 3 || lat > 14 || lng < 2 || lng > 15) return showToast('Your location is outside Nigeria bounds.');
    // build payload
    const payload = {
      lat, lng,
      direction: destInput.value || '',
      seats: parseInt(seatsInput.value || '0', 10),
      mode: currentMode,
      ts: Date.now()
    };
    // write to DB path depending on mode
    const path = (currentMode === 'passenger') ? `passengersByUser/${user.uid}` : `driversByUser/${user.uid}`;
    try {
      await db.ref(path).set(payload);
      // start watch updates for live movement (map-logic dispatches map-geo-update)
      if (window.startGeoWatch) { window.startGeoWatch(); geoActive=true; }
      publishPath = path;
      showToast('Publishing location live');
    } catch(e) { console.error(e); showToast('Could not publish'); }
  }, err => { console.error(err); showToast('Location denied or unavailable'); }, { enableHighAccuracy:true, timeout:8000 });
});

/* Listen for geo events from map-logic and update DB for smooth moves */
window.addEventListener('map-geo-update', async ev => {
  if (!auth.currentUser) return;
  if (!publishPath) return;
  const d = ev.detail;
  try {
    await db.ref(publishPath).update({ lat: d.lat, lng: d.lng, ts: Date.now() });
  } catch(e){ console.error(e); }
});

/* stop publish */
async function clearPublish() {
  if (!auth.currentUser) return;
  try {
    await db.ref(`passengersByUser/${auth.currentUser.uid}`).remove();
    await db.ref(`driversByUser/${auth.currentUser.uid}`).remove();
  } catch(e){ console.warn(e); }
  if (window.stopGeoWatch) window.stopGeoWatch(true);
  publishPath = null;
}

/* Live listeners to show markers */
function startLiveListeners(){
  db.ref('passengersByUser').on('value', snap => {
    const obj = snap.val() || {};
    if (window.updateMarkersFromSnapshot) window.updateMarkersFromSnapshot('passengersByUser', obj, 'passenger');
    countsEl.textContent = `${Object.keys(obj).length} passengers · -- drivers`;
  });
  db.ref('driversByUser').on('value', snap => {
    const obj = snap.val() || {};
    if (window.updateMarkersFromSnapshot) window.updateMarkersFromSnapshot('driversByUser', obj, 'driver');
    db.ref('passengersByUser').once('value').then(s => {
      const p = s.val() || {};
      countsEl.textContent = `${Object.keys(p).length} passengers · ${Object.keys(obj).length} drivers`;
    });
  });
}

/* SOS */
panicBtn && panicBtn.addEventListener('click', ()=> {
  const user = auth.currentUser; if (!user) return showToast('Sign in first');
  if (!navigator.geolocation) return showToast('Geolocation not available');
  if (!confirm('Send SOS to admin with your current location?')) return;
  navigator.geolocation.getCurrentPosition(async pos => {
    await db.ref('adminAlerts').push({ uid: user.uid, email: user.email, lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now() });
    showToast('SOS sent to admin');
  }, ()=> showToast('Unable to get location'));
});

/* UI small controls */
togglePanelBtn && togglePanelBtn.addEventListener('click', ()=> {
  const cp = document.getElementById('control-panel');
  cp.style.display = (cp.style.display === 'none' || cp.style.display === '') ? 'block' : 'none';
});
locateBtn && locateBtn.addEventListener('click', ()=> { if (window.focusOnMe) window.focusOnMe(); });

/* cleanup on leave */
window.addEventListener('pagehide', ()=> { if (window.stopGeoWatch) window.stopGeoWatch(true); });
