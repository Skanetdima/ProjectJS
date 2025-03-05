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

// muzyka gry
const backgroundMusic = new Audio("/muzyka/back1.mp3");
backgroundMusic.loop = true;
backgroundMusic.volume = 0.7;

// Пытаемся запустить фоновую музыку
// Если браузер блокирует автозапуск звука, ловим ошибку и выводим сообщение в консоль
function startGame() {
  backgroundMusic.play().catch(err => console.log("Автозапуск заблокирован:", err));
  document.removeEventListener("click", startGame); // Убираем обработчик после первого клика
}

document.addEventListener("click", startGame);

// изменение картинки звука в настройках звука
window.soundSettingsImageLoud = function (button) {
  var img = button.querySelector(".smallMenuButton img"); 
  var slider = document.getElementById("Effects-img");

  if (img.src.includes("/images/soundOn4.png")) {
      img.src = "/images/mute2.png"; 
      slider.value = 0;
  } 
  else {
      img.src = "/images/soundOn4.png"; 
      slider.value = 65;
  }
}

// изменение картинки музыки в настройках звука
  window.soundSettingsImageMusic = function (button) {
    var slider = document.getElementById("Music-img");
    var img = button.querySelector(".smallMenuButton img"); 
    if (img.src.includes("/images/music.png")) {
        img.src = "/images/noMusic.png"; 
        slider.value = 0;
    } else {
        img.src = "/images/music.png"; 
        slider.value = 65;
    }
  }


  window.sliderSoundEffects = function(input) {
    var button = input.closest(".soundSettings").querySelectorAll(".smallMenuButton")[0]; // Берём первую кнопку
    var img = button.querySelector("img"); // Находим изображение внутри кнопки

    if (input.value == "0") {
        img.src = "/images/mute2.png";
    } else {
        img.src = "/images/soundOn4.png";
    }
};

window.sliderSoundMusic = function(input) {
    var button = input.closest(".soundSettings").querySelectorAll(".smallMenuButton")[1]; // Берём вторую кнопку
    var img = button.querySelector("img"); // Находим изображение внутри кнопки

    if (input.value == "0") {
        img.src = "/images/noMusic.png";
    } else {
        img.src = "/images/music.png";
    }
};


  // window.ifSoundOn = function () {
  //   var img = document.querySelector(".smallMenuButton img"); 
  //   if (img.src.includes("/images/soundOn4.png")) {
  //       img.src = "/images/mute2.png"; 
  //   } else {
  //       img.src = "/images/soundOn4.png"; 
  //   }
  // }

   // window.ifSoundOn = function () {
  //   var img = document.querySelector(".smallMenuButton img"); 
  //   if (img.src.includes("/images/soundOn4.png")) {
  //       img.src = "/images/mute2.png"; 
  //   } else {
  //       img.src = "/images/soundOn4.png"; 
  //   }
  // }

window.choosePlayers = function(){
    var popup = document.querySelector(".choosePlayers")
    if(popup.style.display === "none"){
        popup.style.display = "block" 
    }
    else{
        popup.style.display = "none"
    }
  }

window.pickPlayersOne = function(){
  var popup = document.querySelector(".choosePlayers")
  var  howManyPlayers = document.querySelector("#onePlayer")
  var amountOfPlayers = document.querySelector("#amountOfPlayers")
  howManyPlayers.addEventListener("click",function(){
    amountOfPlayers.textContent = "1P"
    popup.style.display = "none"
  })
}

window.pickPlayersTwo = function(){
  var popup = document.querySelector(".choosePlayers")
  var  howManyPlayers = document.querySelector("#twoPlayers")
  var amountOfPlayers = document.querySelector("#amountOfPlayers")
  howManyPlayers.addEventListener("click",function(){
    amountOfPlayers.textContent = "2P"
    popup.style.display = "none"
  })
}


window.pickPlayersThree = function(){
  var popup = document.querySelector(".choosePlayers")
  var  howManyPlayers = document.querySelector("#threePlayers")
  var amountOfPlayers = document.querySelector("#amountOfPlayers")
  howManyPlayers.addEventListener("click",function(){
    amountOfPlayers.textContent = "3P"
    popup.style.display = "none"
  })
}

window.pickPlayersFour = function(){
  var popup = document.querySelector(".choosePlayers")
  var  howManyPlayers = document.querySelector("#fourPlayers")
  var amountOfPlayers = document.querySelector("#amountOfPlayers")
  howManyPlayers.addEventListener("click",function(){
    amountOfPlayers.textContent = "4P"
    popup.style.display = "none"
  })
}

// otwieranie ustalenia dzwieku
  window.soundSettings = function(){
    var popup = document.querySelector(".soundSettings")
    if(popup.style.display === "none"){
        popup.style.display = "block" 
    }
    else{
        popup.style.display = "none"
    }
  }

  window.arrowButtonSound = function(){
    var arrow = document.querySelector(".soundSettings")
    arrow.style.display  = "none"
}

window.arrowButton = function(){
    var arrow = document.querySelector(".choosePlayers")
    arrow.style.display  = "none"
}