/* map-logic.js — Leaflet init, Nigeria-only bounds, markers & helpers */
(function(){
  const southWest = [4.182, 2.676];
  const northEast = [13.865, 14.678];
  const bounds = L.latLngBounds(southWest, northEast);
  window.map = null; window._cluster = null; window.meMarker = null; window.driverMarkers = {}; window._geoWatchId = null;

  function addStyles() {
    if(document.getElementById('map-styles')) return;
    const s=document.createElement('style'); s.id='map-styles';
    s.innerHTML = `.pin{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;color:white;font-weight:800}.pin-driver{background:linear-gradient(90deg,#0AA83F,#6FFFB3);color:#02100a}.pin-pass{background:#04201a;color:#bfffd7}.pulse{width:18px;height:18px;border-radius:50%;background:rgba(10,168,63,0.14);animation:pulse 1.6s infinite;position:absolute;left:8px;top:8px}@keyframes pulse{0%{transform:scale(0.9);opacity:0.9}70%{transform:scale(2.2);opacity:0}100%{transform:scale(0.9);opacity:0}}`;
    document.head.appendChild(s);
  }

  window.setupMap = function(){
    if(window.map) return window.map;
    addStyles();
    window.map = L.map('map',{zoomControl:true,minZoom:6,maxZoom:17,maxBounds:bounds,maxBoundsViscosity:1.0}).setView([9.0820,8.6753],6.8);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap & CartoDB'}).addTo(window.map);
    window._cluster = L.markerClusterGroup({chunkedLoading:true});
    window.map.addLayer(window._cluster);
    return window.map;
  };

  function makeIcon(text, role){
    const cls = role==='driver' ? 'pin-driver' : 'pin-pass';
    const html = `<div style="position:relative;"><div class="pin ${cls}">${text}</div><div class="pulse" aria-hidden="true"></div></div>`;
    return L.divIcon({ html, className:'custom-div-icon', iconSize:[34,34], iconAnchor:[17,34] });
  }

  window.showDemoDrivers = function(list){
    // list = [{ name, pos:{lat,lng}, meta }]
    Object.keys(window.driverMarkers).forEach(k=>{ try{ window._cluster.removeLayer(window.driverMarkers[k]); }catch(e){} delete window.driverMarkers[k]; });
    list.forEach(item=>{
      const marker = L.marker([item.pos.lat, item.pos.lng], { icon: makeIcon(item.name.charAt(0).toUpperCase(), 'driver') });
      marker.bindPopup(`<strong>${item.name}</strong><br>${item.meta && item.meta.price ? '₦'+item.meta.price : ''}`);
      window.driverMarkers[item.name] = marker;
      window._cluster.addLayer(marker);
    });
  };

  window.updateDriverMarkers = function(list){
    list.forEach(item=>{
      const m = window.driverMarkers[item.name];
      if(m) m.setLatLng([item.pos.lat, item.pos.lng]);
    });
  };

  window.pushDriverMarker = function(driver){
    const name = driver.name || 'You';
    if(window.driverMarkers[name]){
      window.driverMarkers[name].setLatLng([driver.pos.lat, driver.pos.lng]);
    } else {
      const marker = L.marker([driver.pos.lat, driver.pos.lng], { icon: makeIcon((name||'Y').charAt(0).toUpperCase(), 'driver')});
      marker.bindPopup(`<strong>${name}</strong><br>${driver.seats ? 'Seats: '+driver.seats : ''}`);
      window.driverMarkers[name] = marker;
      window._cluster.addLayer(marker);
    }
  };

  window.startGeoWatch = function() {
    if (!navigator.geolocation) { console.warn('No geolocation'); return null; }
    if (window._geoWatchId) return window._geoWatchId;
    const id = navigator.geolocation.watchPosition(pos=>{
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      window.myPos = { lat, lng };
      if(!window.meMarker) {
        window.meMarker = L.circleMarker([lat,lng], { radius:8, color:'#fff', fillColor:'#0AA83F', fillOpacity:0.95 }).addTo(window.map).bindPopup('You');
      } else window.meMarker.setLatLng([lat,lng]);
      if(!window._centeredOnce) { window.map.setView([lat,lng], 13); window._centeredOnce = true; }
      const ev = new CustomEvent('map-geo-update', { detail: { lat, lng, accuracy: pos.coords.accuracy, ts: pos.timestamp }});
      window.dispatchEvent(ev);
    }, err=> {
      const ev = new CustomEvent('map-geo-error', { detail: err }); window.dispatchEvent(ev);
    }, { enableHighAccuracy:true, maximumAge:2500, timeout:8000 });
    window._geoWatchId = id; return id;
  };

  window.stopGeoWatch = function(remove){
    if(window._geoWatchId) { navigator.geolocation.clearWatch(window._geoWatchId); window._geoWatchId = null; }
    if(remove && window.meMarker){ try{ window.map.removeLayer(window.meMarker);}catch(e){} window.meMarker=null; window._centeredOnce=false; }
  };

  window.focusOnMe = function(){ if(window.meMarker && window.map) window.map.setView(window.meMarker.getLatLng(), 14); };
})();
