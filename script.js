// --- Three.js scene setup ---
const container = document.getElementById("scene-container");
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 3);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambient);

const point = new THREE.PointLight(0xffffff, 1);
point.position.set(5, 3, 5);
scene.add(point);

// Globe
const loader = new THREE.TextureLoader();
loader.crossOrigin = '';
const globeTexture = loader.load(
  "https://threejsfundamentals.org/threejs/resources/images/earth-day.jpg",
  () => { renderer.render(scene, camera); }
);
const globeMaterial = new THREE.MeshPhongMaterial({ map: globeTexture });
const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), globeMaterial);
scene.add(globe);

// Atmosphere glow
const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(1.05, 64, 64),
  new THREE.MeshBasicMaterial({ color: 0x3399ff, transparent: true, opacity: 0.2, side: THREE.BackSide })
);
scene.add(atmosphere);

// Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableZoom = true;
controls.enablePan = false;
controls.rotateSpeed = 0.5;

// Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- News bubble system ---
let newsCount = 0;
const newsContainer = document.getElementById("news-bubbles");

function addNewsBubble(text, isMajor=false){
  const bubble = document.createElement("div");
  bubble.classList.add("bubble");
  bubble.textContent = text;
  if(isMajor){
    bubble.style.transform = "scale(2)";
    bubble.style.background = "rgba(0,255,255,0.3)";
  }
  bubble.style.top = Math.random() * 80 + "%";
  bubble.style.left = Math.random() * 80 + "%";
  newsContainer.appendChild(bubble);
  newsCount++;
}

// --- Demo posts ---
const demoPosts = [
  "New tech hub rises in Africa",
  "Climate summit begins in Europe",
  "AI breakthrough in Asia",
  "Gossip: Celebrity spotted in NYC",
  "Juicy: Secret concert in Paris",
  "Space mission launched",
  "Global market updates",
  "Juicy: Influencer scandal",
  "New environmental project",
  "Science award announced"
];

demoPosts.forEach(post => addNewsBubble(post));

// --- Post form logic ---
const postBubble = document.getElementById("post-bubble");
const postForm = document.getElementById("post-form");
const submitPost = document.getElementById("submit-post");
const closePost = document.getElementById("close-post");
const vpnWarning = document.getElementById("vpn-warning");

postBubble.addEventListener("click", ()=>{
  postForm.style.display = "block";
});

closePost.addEventListener("click", ()=>{
  postForm.style.display = "none";
  vpnWarning.style.display = "none";
});

submitPost.addEventListener("click", ()=>{
  // --- VPN placeholder ---
  const vpnDetected = false; // set to true to simulate VPN block
  if(vpnDetected){
    vpnWarning.style.display = "block";
    return;
  }

  const text = document.getElementById("post-text").value;
  if(!text) return;

  // Major post detection placeholder
  const isMajor = text.toLowerCase().includes("gossip") || text.toLowerCase().includes("juicy");

  addNewsBubble(text, isMajor);

  // Clear form
  document.getElementById("post-text").value = "";
  document.getElementById("post-image").value = "";
  postForm.style.display = "none";
  vpnWarning.style.display = "none";
});

// --- Animation ---
function animate(){
  requestAnimationFrame(animate);
  globe.rotation.y += 0.0008;
  atmosphere.rotation.y += 0.0008;
  renderer.render(scene, camera);
}
animate();
