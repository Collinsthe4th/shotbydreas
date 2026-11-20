const nav = document.querySelector(".nav-bar .fa-bars");
const navContent = document.querySelector(".nav");

nav.addEventListener("click", () => {
   navContent.classList.toggle('show');
});

document.getElementById("year").textContent = new Date().getFullYear();


const photoBtn = document.querySelector('.gallery-bttn .photo-bttn.photos');
const videoBtn = document.querySelector('.gallery-bttn .photo-bttn.videos');
const photoShoot = document.getElementById('photoshoot');
const eventShoot = document.getElementById('videos');

photoBtn.addEventListener('click', () => {
   photoBtn.classList.add('active-bttn');
   videoBtn.classList.remove('active-bttn');

   photoShoot.classList.add('active');
   eventShoot.classList.remove('active');
});

videoBtn.addEventListener('click', () => {
   photoShoot.classList.remove('active');
   eventShoot.classList.add('active');

   photoBtn.classList.remove('active-bttn');
   videoBtn.classList.add('active-bttn');
});
