/* map-logic.js */
(function(){
  const southWest = [4.270, 2.700];
  const northEast = [13.890, 14.680];
  const bounds = L.latLngBounds(southWest, northEast);

  window.map = null;
  window.clusterGroup = null;
  window.meMarker = null;
  window.passengerMarkers = {};
  window.driverMarkers = {};
  window._geoWatchId = null;

  function injectStyles() {
    if (document.getElementById('map-logic-styles')) return;
    const s = document.createElement('style'); s.id = 'map-logic-styles';
    s.innerHTML = `
      .pin { display:flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:10px; color:white; font-weight:700; }
      .pin-pass { background: #0AA83F; }
      .pin-driver { background: #111111; }
      .pulse { width:14px; height:14px; border-radius:50%; background: rgba(10,168,63,0.16); animation: pulse 1.6s infinite; position:absolute; left:10px; top:10px; }
      @keyframes pulse { 0% { transform:scale(0.9); opacity:0.9 } 70% { transform:scale(2.3); opacity:0 } 100% { transform:scale(0.9); opacity:0 } }
    `;
    document.head.appendChild(s);
  }

  function setupMap() {
    if (window.map) return window.map;
    injectStyles();
    window.map = L.map('map', { preferCanvas:true, zoomControl:true }).setView([9.082, 8.6753], 6.8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 17, minZoom: 6, attribution: '&copy; OpenStreetMap contributors' }).addTo(window.map);
    window.map.setMaxBounds(bounds);
    window.map.on('drag', () => { if (!bounds.contains(window.map.getCenter())) window.map.panInsideBounds(bounds, { animate: true }); });
    window.clusterGroup = L.markerClusterGroup({ chunkedLoading: true });
    window.map.addLayer(window.clusterGroup);
    return window.map;
  }

  function makeDivIcon(label, role) {
    const cls = role === 'driver' ? 'pin-driver' : 'pin-pass';
    const html = `<div style="position:relative;"><div class="pin ${cls}">${label}</div><div class="pulse" aria-hidden="true"></div></div>`;
    return L.divIcon({ html, className: 'custom-div-icon', iconSize:[34,34], iconAnchor:[17,34] });
  }

  function updateMarkersFromSnapshot(nodeName, obj, role) {
    const container = role === 'passenger' ? window.passengerMarkers : window.driverMarkers;
    Object.keys(container).forEach(k => { if (!obj || !obj[k]) { try { window.clusterGroup.removeLayer(container[k]); } catch(e){} delete container[k]; } });
    if (!obj) return;
    Object.keys(obj).forEach(k => {
      const d = obj[k];
      if (!d || typeof d.lat !== 'number') return;
      const latlng = [d.lat, d.lng];
      if (container[k]) {
        container[k].setLatLng(latlng);
      } else {
        const icon = makeDivIcon(role === 'passenger' ? 'P' : 'D', role);
        const marker = L.marker(latlng, { icon, title: d.direction || '' });
        marker.bindPopup(`<strong>${role==='passenger'?'Passenger':'Driver'}</strong><br>${d.direction || ''}`);
        container[k]=marker;
        window.clusterGroup.addLayer(marker);
      }
    });
  }

  function startGeoWatch() {
    if (!navigator.geolocation) { console.warn('No geolocation'); return null; }
    if (window._geoWatchId) return window._geoWatchId;
    const id = navigator.geolocation.watchPosition(pos => {
      const lat = pos.coords.latitude; const lng = pos.coords.longitude;
      if (!window.meMarker) {
        window.meMarker = L.circleMarker([lat,lng], { radius:8, color:'#fff', fillColor:'#0AA83F', fillOpacity:0.95 }).addTo(window.map).bindPopup('You');
      } else { window.meMarker.setLatLng([lat,lng]); }
      if (!window._centeredOnce) { window.map.setView([lat,lng], 14); window._centeredOnce=true; }
      const ev = new CustomEvent('map-geo-update', { detail: { lat, lng, accuracy: pos.coords.accuracy, ts: pos.timestamp }});
      window.dispatchEvent(ev);
    }, err => {
      console.warn('geo err', err);
      const ev = new CustomEvent('map-geo-error', { detail: err });
      window.dispatchEvent(ev);
    }, { enableHighAccuracy:true, maximumAge:3000, timeout:8000 });
    window._geoWatchId = id; return id;
  }

  function stopGeoWatch(removeMarker=false) {
    if (window._geoWatchId) { navigator.geolocation.clearWatch(window._geoWatchId); window._geoWatchId=null; }
    if (removeMarker && window.meMarker) { try{ window.map.removeLayer(window.meMarker);}catch(e){} window.meMarker=null; window._centeredOnce=false; }
  }

  function focusOnMe() { if (window.meMarker && window.map) window.map.setView(window.meMarker.getLatLng(), 14); }

  window.setupMap = setupMap;
  window.updateMarkersFromSnapshot = updateMarkersFromSnapshot;
  window.startGeoWatch = startGeoWatch;
  window.stopGeoWatch = stopGeoWatch;
  window.focusOnMe = focusOnMe;
})();
