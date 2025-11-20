/* map-logic.js
 * Responsible for all map behavior: initialization, marker handling,
 * clustering, pulsing icons, user location watch, and utility helpers.
 *
 * Exposes functions (on window) used by app.js:
 *  - setupMap()
 *  - startGeoWatch()
 *  - stopPublishing()
 *  - clearMarkers()
 *  - focusOnMe()
 *  - updateMarkersFromSnapshot(node, data, role)
 *
 * This file intentionally does NOT interact with Firebase directly.
 */

/* Globals used by app.js */
window.map = null;
window.clusterGroup = null;
window.meMarker = null;
window.passengerMarkers = {};
window.driverMarkers = {};
window._geoWatchId = null;

(function () {
  // Default Nigeria center (lat, lng)
  const NIGERIA_CENTER = [9.0820, 8.6753];
  const DEFAULT_ZOOM = 7;

  // small helper to create CSS for pulsing
  function injectStyles() {
    if (document.getElementById('map-logic-styles')) return;
    const s = document.createElement('style');
    s.id = 'map-logic-styles';
    s.innerHTML = `
      .pin { display:flex; align-items:center; justify-content:center; width:34px; height:34px;
             border-radius:8px; color:white; font-weight:700; box-shadow:0 6px 18px rgba(0,0,0,0.12);}
      .pin-pass { background: #0b63ff; border-radius:8px; }
      .pin-driver { background: #24c27a; border-radius:8px; }
      .pulse { width:12px; height:12px; border-radius:50%; background:rgba(11,99,255,0.2);
               box-shadow:0 0 0 rgba(11,99,255,0.2); animation: pulse 1.8s infinite; position: absolute; left:11px; top:11px; }
      @keyframes pulse { 0% { transform: scale(0.8); opacity: 0.9 } 70% { transform: scale(2.6); opacity: 0 } 100% { transform: scale(0.8); opacity:0 } }
    `;
    document.head.appendChild(s);
  }

  // Create a simple divIcon used for P/D markers
  function makeDivIcon(label, role) {
    const cls = role === 'driver' ? 'pin-driver' : 'pin-pass';
    // html contains a wrapper and a small pulse circle
    const html = `<div style="position:relative;">
                    <div class="pin ${cls}">${label}</div>
                    <div class="pulse" aria-hidden="true"></div>
                  </div>`;
    return L.divIcon({
      html,
      className: 'custom-div-icon',
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -34]
    });
  }

  // Initialize the leaflet map and cluster group
  function setupMap() {
    if (window.map) return window.map;
    injectStyles();

    // create map
    window.map = L.map('map', { preferCanvas: true }).setView(NIGERIA_CENTER, DEFAULT_ZOOM);

    // tile layer (OSM)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(window.map);

    // clustering for performance
    window.clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      removeOutsideVisibleBounds: true,
      spiderfyOnMaxZoom: true
    });
    window.map.addLayer(window.clusterGroup);

    // small map controls
    L.control.scale({ imperial: false }).addTo(window.map);

    // return map
    return window.map;
  }

  // Remove all passenger/driver markers and clear maps
  function clearMarkers() {
    // clear cluster group completely
    if (window.clusterGroup) {
      window.clusterGroup.clearLayers();
    }
    // clear harmonic maps
    Object.keys(window.passengerMarkers).forEach(k => {
      try { window.map.removeLayer(window.passengerMarkers[k]); } catch (e) {}
    });
    Object.keys(window.driverMarkers).forEach(k => {
      try { window.map.removeLayer(window.driverMarkers[k]); } catch (e) {}
    });
    window.passengerMarkers = {};
    window.driverMarkers = {};
  }

  // Called by app.js when DB snapshot arrives
  // nodeName (string) helps but the function expects the object already parsed
  function updateMarkersFromSnapshot(nodeName, obj, role) {
    // role = 'passenger' or 'driver'
    const container = role === 'passenger' ? window.passengerMarkers : window.driverMarkers;

    // Remove markers that no longer exist
    Object.keys(container).forEach(key => {
      if (!obj || !obj[key]) {
        try { window.map.removeLayer(container[key]); } catch (e) {}
        delete container[key];
      }
    });

    // Add or update markers
    if (!obj) return;
    Object.keys(obj).forEach(key => {
      const data = obj[key];
      if (!data || typeof data.lat !== 'number' || typeof data.lng !== 'number') return;
      const latlng = [data.lat, data.lng];

      if (container[key]) {
        // smooth move: setLatLng will move; for smoothness we can tween later if needed
        container[key].setLatLng(latlng);
      } else {
        const label = role === 'passenger' ? 'P' : 'D';
        const icon = makeDivIcon(label, role);
        const marker = L.marker(latlng, { icon, title: data.direction || '', riseOnHover: true });
        marker.bindPopup(`<strong>${role === 'passenger' ? 'Passenger' : 'Driver'}</strong><br>${data.direction || ''}`);
        container[key] = marker;
        // add to cluster for performance
        window.clusterGroup.addLayer(marker);
      }
    });
  }

  // Start watching device location and (optionally) return the id
  // This does not write to Firebase — app.js handles DB writes.
  function startGeoWatch() {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported in this browser.');
      return null;
    }
    if (window._geoWatchId) return window._geoWatchId;

    const id = navigator.geolocation.watchPosition(pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      // place or update meMarker
      if (!window.meMarker) {
        window.meMarker = L.circleMarker([lat, lng], {
          radius: 8,
          weight: 2,
          color: '#ffffff',
          fillColor: '#0b63ff',
          fillOpacity: 0.95
        }).addTo(window.map).bindPopup('You');
      } else {
        window.meMarker.setLatLng([lat, lng]);
      }

      // auto-pan to user once on first fix
      if (window.map && window.map._lastCenterSet !== true) {
        window.map.setView([lat, lng], 14);
        window.map._lastCenterSet = true;
      }

      // return position to caller by dispatching a custom event
      const ev = new CustomEvent('map-geo-update', { detail: { lat, lng, accuracy: pos.coords.accuracy, ts: pos.timestamp }});
      window.dispatchEvent(ev);

    }, err => {
      console.warn('watchPosition error', err);
      const ev = new CustomEvent('map-geo-error', { detail: err });
      window.dispatchEvent(ev);
    }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 });

    window._geoWatchId = id;
    return id;
  }

  // Stop geolocation watch and remove meMarker (if requested)
  function stopGeoWatch(removeMarker = false) {
    if (window._geoWatchId) {
      navigator.geolocation.clearWatch(window._geoWatchId);
      window._geoWatchId = null;
    }
    if (removeMarker && window.meMarker) {
      try { window.map.removeLayer(window.meMarker); } catch (e) {}
      window.meMarker = null;
    }
  }

  // Center map on current user marker if available
  function focusOnMe() {
    if (window.meMarker && window.map) {
      window.map.setView(window.meMarker.getLatLng(), 15);
    }
  }

  // Expose functions to global scope so app.js can call them
  window.setupMap = setupMap;
  window.clearMarkers = clearMarkers;
  window.updateMarkersFromSnapshot = updateMarkersFromSnapshot;
  window.startGeoWatch = startGeoWatch;
  window.stopGeoWatch = stopGeoWatch;
  window.focusOnMe = focusOnMe;

})();
