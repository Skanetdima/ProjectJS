  import { Game } from './game.js';

  export function initializeMenu() {
    const menuContainer = document.getElementById('menu-container');
    const canvas = document.getElementById('game-canvas');
    const joystickContainer = document.getElementById('joystick-container');
    const circles = document.querySelectorAll('.character-circle');

    circles.forEach((circle) => {
      circle.addEventListener('click', () => {
        const color = circle.dataset.color;
        menuContainer.style.display = 'none';
        canvas.style.display = 'block'; // Показываем канвас
        joystickContainer.style.display = 'block'; // Показываем джойстик
        new Game(color);
      });
    });
  }


  function changeImage() {
    var img = document.querySelector(".smallMenuButton img"); 
    if (img.src.includes("/images/soundOn4.png")) {
        img.src = "/images/mute2.png"; 
    } else {
        img.src = "/images/soundOn4.png"; 
    }
  }

  function choosePlayers(){
    var popup = document.querySelector(".choosePlayers")
    if(popup.style.display === "none"){
        popup.style.display = "block"
    }
    else{
        popup.style.display = "none"
    }
  }

  function arrowButton(){
    var arrow = document.querySelector(".choosePlayers")
    arrow.style.display  = "none"
  }