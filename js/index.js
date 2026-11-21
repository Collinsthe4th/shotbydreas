const nav = document.querySelector(".nav-bar .fa-bars");
const navContent = document.querySelector(".nav");

if (nav && navContent) {
   nav.addEventListener("click", () => {
      navContent.classList.toggle('show');
   });
}

const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();


// Gallery tabs (only on the gallery page)
const photoBtn = document.querySelector('.gallery-bttn .photo-bttn.photos');
const videoBtn = document.querySelector('.gallery-bttn .photo-bttn.videos');
const photoShoot = document.getElementById('photoshoot');
const eventShoot = document.getElementById('videos');

if (photoBtn && videoBtn && photoShoot && eventShoot) {
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
}
