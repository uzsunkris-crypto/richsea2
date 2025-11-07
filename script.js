// --- Scene setup ---
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
const ambient = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambient);
const point = new THREE.PointLight(0xffffff, 1);
point.position.set(5, 3, 5);
scene.add(point);

// Globe
const textureLoader = new THREE.TextureLoader();
const earthTexture = textureLoader.load(
  "https://cdn.jsdelivr.net/gh/pmndrs/drei-assets@master/earth-night.jpg"
);
const geometry = new THREE.SphereGeometry(1, 64, 64);
const material = new THREE.MeshPhongMaterial({
  map: earthTexture,
  emissive: 0x112244,
  emissiveIntensity: 0.4,
});
const globe = new THREE.Mesh(geometry, material);
scene.add(globe);

// Atmosphere glow
const atmosphereMaterial = new THREE.MeshBasicMaterial({
  color: 0x3399ff,
  transparent: true,
  opacity: 0.2,
  side: THREE.BackSide,
});
const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(1.05, 64, 64),
  atmosphereMaterial
);
scene.add(atmosphere);

// Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableZoom = true;
controls.enablePan = false;
controls.rotateSpeed = 0.5;

// Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- News Bubble Logic ---
let newsCount = 0;
const newsContainer = document.getElementById("news-bubbles");

// Helper to add a news bubble
function addNewsBubble(text, isMajor=false) {
  const bubble = document.createElement("div");
  bubble.classList.add("bubble");
  bubble.textContent = text;

  if(isMajor) {
    bubble.style.transform = "scale(2)";
    bubble.style.background = "rgba(0,255,255,0.3)";
  }

  // Random placement on screen for demo purposes
  bubble.style.top = Math.random() * 80 + "%";
  bubble.style.left = Math.random() * 80 + "%";

  newsContainer.appendChild(bubble);
  newsCount++;
}

// Add some demo bubbles
for(let i=0;i<15;i++){
  addNewsBubble(`Demo Story #${i+1}`);
}

// --- Floating Post Bubble ---
const postBubble = document.getElementById("post-bubble");
const postForm = document.getElementById("post-form");
const submitPost = document.getElementById("submit-post");
const closePost = document.getElementById("close-post");
const vpnWarning = document.getElementById("vpn-warning");

postBubble.addEventListener("click", ()=>{
  postForm.style.display = "block";
});

// Close form
closePost.addEventListener("click", ()=>{
  postForm.style.display = "none";
  vpnWarning.style.display = "none";
});

// Submit Post
submitPost.addEventListener("click", ()=>{
  // --- Simulated VPN check ---
  const vpnDetected = false; // Replace with actual logic later
  if(vpnDetected){
    vpnWarning.style.display = "block";
    return;
  }

  const text = document.getElementById("post-text").value;
  if(!text) return;

  // Placeholder: detect if cinematic/juicy
  const isMajor = text.toLowerCase().includes("gossip") || text.toLowerCase().includes("juicy");

  addNewsBubble(text, isMajor);

  // Clear form
  document.getElementById("post-text").value = "";
  document.getElementById("post-image").value = "";
  postForm.style.display = "none";
  vpnWarning.style.display = "none";
});

// --- Animation loop ---
function animate() {
  requestAnimationFrame(animate);
  globe.rotation.y += 0.0008;
  atmosphere.rotation.y += 0.0008;
  renderer.render(scene, camera);
}
animate();
