/* map.js — Beautiful Nigeria-Focused Live Map (Frontend Only) */

/* Leaflet map centered on Nigeria */
let map, myMarker, driverMarkers = {};
window.myPos = {lat: 4.85, lng: 7.02}; // default PH, Nigeria

/* SETUP MAP */
window.setupMap = function () {
  map = L.map('map', {
    zoomControl: false,
    minZoom: 6,
    maxZoom: 18,
    maxBounds: [
      [13.9, 2.6],   // north-west boundary of Nigeria
      [3.8, 14.7]    // south-east boundary
    ]
  }).setView([9.05, 8.67], 6.7); // center of Nigeria

  /* Beautiful futuristic tile style */
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
  }).addTo(map);

  /* My glowing location marker */
  const userIcon = L.divIcon({
    className: 'user-marker',
    html: `
      <div class="pulse-dot"></div>
      <div class="pulse-ring"></div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  myMarker = L.marker([window.myPos.lat, window.myPos.lng], {icon: userIcon}).addTo(map);

  /* Track location */
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(pos => {
      window.myPos = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
      myMarker.setLatLng(window.myPos);
    });
  }

  /* Allow focusing on user */
  window.focusOnMe = function () {
    map.setView([window.myPos.lat, window.myPos.lng], 15, {animate: true});
  };
};

/* ⛽ Add demo drivers to map */
window.showDemoDrivers = function (drivers) {
  drivers.forEach(d => {
    const icon = L.divIcon({
      className: "driver-marker",
      html: `
        <div class="driver-dot"></div>
        <div class="driver-arrow"></div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    const marker = L.marker([d.pos.lat, d.pos.lng], {icon}).addTo(map);
    driverMarkers[d.name] = marker;
  });
};

/* 🔄 Update driver markers as they move */
window.updateDriverMarkers = function (drivers) {
  drivers.forEach(d => {
    if (driverMarkers[d.name]) {
      driverMarkers[d.name].setLatLng([d.pos.lat, d.pos.lng]);
    }
  });
};

/* 🧲 Follow a driver live on the map */
window.followDriver = function (driver) {
  const followInterval = setInterval(() => {
    if (!driverMarkers[driver.name]) return clearInterval(followInterval);

    const pos = driverMarkers[driver.name].getLatLng();
    map.setView(pos, 15, {animate: true});
  }, 1200);
};

/* 🚐 Driver publishes their own marker */
window.pushDriverMarker = function (driver) {
  const icon = L.divIcon({
    className: "my-driver-marker",
    html: `
      <div class="my-car"></div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  if (driverMarkers["You"]) {
    driverMarkers["You"].setLatLng([driver.pos.lat, driver.pos.lng]);
  } else {
    driverMarkers["You"] =
      L.marker([driver.pos.lat, driver.pos.lng], {icon}).addTo(map);
  }
};
