/* map-logic.js */
(function(){
  // Nigeria bounding box (tight)
  const southWest = [4.182, 2.676];
  const northEast = [13.865, 14.678];
  const bounds = L.latLngBounds(southWest, northEast);

  window.map = null;
  window._cluster = null;
  window.meMarker = null;
  window.demoDriverMarkers = {};
  window._geoWatchId = null;

  function addMapStyles(){
    if (document.getElementById('map-glow')) return;
    const s = document.createElement('style'); s.id='map-glow';
    s.innerHTML = `
      .pin { display:flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:8px; color:white; font-weight:800; box-shadow:0 6px 20px rgba(10,168,63,0.12); }
      .pin-driver { background: linear-gradient(90deg,#0AA83F,#6FFFB3); color:#02100a; }
      .pin-pass { background: #04201a; color: #bfffd7; }
      .pulse { width:18px; height:18px; border-radius:50%; background: rgba(10,168,63,0.14); animation: pulse 1.6s infinite; position:absolute; left:8px; top:8px; }
      @keyframes pulse { 0%{ transform:scale(0.9); opacity:0.9 } 70%{ transform:scale(2.2); opacity:0 } 100%{ transform:scale(0.9); opacity:0 } }
    `;
    document.head.appendChild(s);
  }

  function setupMap() {
    if (window.map) return window.map;
    addMapStyles();

    window.map = L.map('map', {
      center: [9.0820, 8.6753],
      zoom: 6.8,
      minZoom: 6,
      maxZoom: 17,
      maxBounds: bounds,
      maxBoundsViscosity: 1.0
    });

    // dark basemap (CartoDB Dark)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors & CartoDB'
    }).addTo(window.map);

    window._cluster = L.markerClusterGroup({ chunkedLoading:true });
    window.map.addLayer(window._cluster);

    return window.map;
  }

  function makeIcon(text, role) {
    const cls = role === 'driver' ? 'pin-driver' : 'pin-pass';
    const html = `<div style="position:relative;"><div class="pin ${cls}">${text}</div><div class="pulse" aria-hidden="true"></div></div>`;
    return L.divIcon({ html, className: 'custom-div-icon', iconSize:[34,34], iconAnchor:[17,34] });
  }

  function updateDemoMarkers(list, role) {
    const container = role === 'driver' ? window.demoDriverMarkers : window.demoDriverMarkers;
    // remove missing
    Object.keys(container).forEach(k => { if (!list[k]) { try{ window._cluster.removeLayer(container[k]) }catch(e){} delete container[k]; } });
    Object.keys(list).forEach(k => {
      const d = list[k];
      if (!d || typeof d.lat !== 'number') return;
      const latlng = [d.lat, d.lng];
      if (container[k]) {
        container[k].setLatLng(latlng);
      } else {
        const icon = makeIcon(d.initial || (role==='driver'?'D':'P'), role);
        const marker = L.marker(latlng, { icon, title: d.name || '' });
        marker.bindPopup(`<strong>${role==='driver'?'Driver':'Passenger'}</strong><br>${d.name || ''}<br>${d.info || ''}`);
        container[k] = marker;
        window._cluster.addLayer(marker);
      }
    });
  }

  function startGeoWatch() {
    if (!navigator.geolocation) { console.warn('No geolocation'); return null; }
    if (window._geoWatchId) return window._geoWatchId;
    const id = navigator.geolocation.watchPosition(pos => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      if (!window.meMarker) {
        window.meMarker = L.circleMarker([lat,lng], { radius:8, color:'#fff', fillColor:'#0AA83F', fillOpacity:0.95 }).addTo(window.map).bindPopup('You');
      } else window.meMarker.setLatLng([lat,lng]);
      if (!window._centeredOnce) { window.map.setView([lat,lng], 13); window._centeredOnce = true; }
      const ev = new CustomEvent('map-geo-update', { detail: { lat, lng, accuracy: pos.coords.accuracy, ts: pos.timestamp }});
      window.dispatchEvent(ev);
    }, err => {
      const ev = new CustomEvent('map-geo-error', { detail: err }); window.dispatchEvent(ev);
    }, { enableHighAccuracy:true, maximumAge:2000, timeout:8000 });
    window._geoWatchId = id; return id;
  }

  function stopGeoWatch(removeMarker=false) {
    if (window._geoWatchId) { navigator.geolocation.clearWatch(window._geoWatchId); window._geoWatchId=null; }
    if (removeMarker && window.meMarker) { try{ window.map.removeLayer(window.meMarker);}catch(e){} window.meMarker=null; window._centeredOnce=false; }
  }

  window.setupMap = setupMap;
  window.updateDemoMarkers = updateDemoMarkers;
  window.startGeoWatch = startGeoWatch;
  window.stopGeoWatch = stopGeoWatch;
})();
