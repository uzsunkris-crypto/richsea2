const continents = document.querySelectorAll(".continent");
const newsContainer = document.getElementById("news-container");
const postBubble = document.getElementById("post-bubble");
const postForm = document.getElementById("post-form");
const submitPost = document.getElementById("submit-post");
const closePost = document.getElementById("close-post");
const vpnWarning = document.getElementById("vpn-warning");

let currentRegion = "Africa"; // default region
let newsData = {
  Africa: [],
  Europe: [],
  Asia: [],
  America: [],
  Oceania: []
};

// Switch continent
continents.forEach(c => {
  c.addEventListener("click", () => {
    currentRegion = c.dataset.region;
    renderNews();
  });
});

// Render news bubbles
function renderNews() {
  newsContainer.innerHTML = "";
  const regionNews = newsData[currentRegion];
  regionNews.forEach((post, idx) => {
    const bubble = document.createElement("div");
    bubble.classList.add("bubble");
    if(post.isMajor) bubble.classList.add("major");
    if(post.image){
      const img = document.createElement("img");
      img.src = post.image;
      bubble.appendChild(img);
    }
    const text = document.createElement("div");
    text.textContent = post.text;
    bubble.appendChild(text);
    newsContainer.appendChild(bubble);
  });
}

// Open post form
postBubble.addEventListener("click", () => {
  postForm.style.display = "block";
});

// Close post form
closePost.addEventListener("click", () => {
  postForm.style.display = "none";
  vpnWarning.style.display = "none";
});

// Submit new post
submitPost.addEventListener("click", () => {
  const vpnDetected = false; // placeholder
  if(vpnDetected){
    vpnWarning.style.display = "block";
    return;
  }

  const text = document.getElementById("post-text").value;
  const imageInput = document.getElementById("post-image");
  let imageUrl = "";
  if(imageInput.files && imageInput.files[0]){
    imageUrl = URL.createObjectURL(imageInput.files[0]);
  }
  if(!text) return;

  // Major post detection
  const isMajor = text.toLowerCase().includes("gossip") || text.toLowerCase().includes("juicy");

  // Add post
  newsData[currentRegion].push({ text, image: imageUrl, isMajor });
  renderNews();

  // Clear form
  document.getElementById("post-text").value = "";
  imageInput.value = "";
  postForm.style.display = "none";
  vpnWarning.style.display = "none";
});

// Initial render
renderNews();
