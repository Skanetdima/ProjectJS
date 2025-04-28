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
      canvas.style.display = 'block'; // Pokaż kanvas
      joystickContainer.style.display = 'block'; // Pokaż joystick
      new Game(color);
    });
  });
}

const clickSound = new Audio('/muzyka/soundButton.mp3');
clickSound.volume = 0.5;

// laczenie muzyki gry
const backgroundMusic = new Audio('/muzyka/back1.mp3');
backgroundMusic.loop = true;
backgroundMusic.volume = 0.7;

// Próba uruchomienia muzyki w tle
// Jeśli przeglądarka blokuje dźwięk odtwarzany automatycznie, wychwytujemy błąd i wyświetlamy komunikat na konsoli
function startGame() {
  backgroundMusic.play().catch((err) => console.log('Автозапуск заблокирован:', err));
  document.removeEventListener('click', startGame); // Usuń handler po pierwszym kliknięciu
}

document.addEventListener('click', startGame);

// zmień obraz dźwiękowy w ustawieniach dźwięku
window.soundSettingsImageLoud = function (button) {
  const effectsSlider = document.getElementById('Effects-img');
  
  if (button.style.backgroundImage.includes('SoundOn/Default.png')) {
    button.style.backgroundImage = "url('/asset/png/Buttons/Square-Medium/SoundOff/Default.png')";
    effectsSlider.value = 0;
    clickSound.volume = 0; // Эффекты выключены
    playClickSound(); 
  } else {
    button.style.backgroundImage = "url('/asset/png/Buttons/Square-Medium/SoundOn/Default.png')";
    effectsSlider.value = 65;
    clickSound.volume = 0.65; // Средняя громкость
    playClickSound(); 
  }
};


// zmień obraz muzyczny w ustawieniach dźwięku
window.soundSettingsImageMusic = function (button) {
  if (button.style.backgroundImage.includes('/asset/png/Buttons/musicDefault.png')) {
    button.style.backgroundImage = "url('/asset/png/Buttons/NomusicDefault.png')";
    document.getElementById('Music-img').value = 0;
    backgroundMusic.volume = 0;
    playClickSound(); 
  } else {
    button.style.backgroundImage = "url('/asset/png/Buttons/musicDefault.png')";
    document.getElementById('Music-img').value = 65;
    backgroundMusic.volume = 0.7;
    playClickSound(); 
  }
};

window.sliderSoundEffects = function (input) {
  var button = input.closest('.soundSettings').querySelector('.effectsLoud');
  const effectsVolume = input.value / 100;

  clickSound.volume = effectsVolume; 

  if (effectsVolume === 0) {
    button.style.backgroundImage = "url('/asset/png/Buttons/Square-Medium/SoundOff/Default.png')";
    playClickSound(); 
  } else {
    button.style.backgroundImage = "url('/asset/png/Buttons/Square-Medium/SoundOn/Default.png')";
    playClickSound(); 
  }
};


window.sliderSoundMusic = function (input) {
  var button = input.closest('.soundSettings').querySelector('.musicLoud'); 
  const volumeValue = input.value / 100; // Значение от 0 до 1
  backgroundMusic.volume = volumeValue;
  
  if (volumeValue === 0) {
    button.style.backgroundImage = "url('/asset/png/Buttons/NomusicDefault.png')";
    playClickSound(); 
  } else {
    button.style.backgroundImage = "url('/asset/png/Buttons/musicDefault.png')";
    playClickSound(); 
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

window.choosePlayers = function () {
  var popup = document.querySelector('.choosePlayers');
  if (popup.style.display === 'none') {
    popup.style.display = 'block';
    playClickSound(); 
  } else {
    popup.style.display = 'none';
    playClickSound(); 
  }
};

window.pickPlayersOne = function () {
  var popup = document.querySelector('.choosePlayers');
  var howManyPlayers = document.querySelector('#onePlayer');
  var amountOfPlayers = document.querySelector('.playerTextMenu');
  howManyPlayers.addEventListener('click', function () {
    amountOfPlayers.textContent = '1P';
    popup.style.display = 'none';
    playClickSound(); 
  });
};

window.pickPlayersTwo = function () {
  var popup = document.querySelector('.choosePlayers');
  var howManyPlayers = document.querySelector('#twoPlayers');
  var amountOfPlayers = document.querySelector('.playerTextMenu');
  howManyPlayers.addEventListener('click', function () {
    amountOfPlayers.textContent = '2P';
    popup.style.display = 'none';
    playClickSound(); 
  });
};

// window.pickPlayersThree = function () {
//   var popup = document.querySelector('.choosePlayers');
//   var howManyPlayers = document.querySelector('#threePlayers');
//   var amountOfPlayers = document.querySelector('.playerTextMenu');
//   howManyPlayers.addEventListener('click', function () {
//     amountOfPlayers.textContent = '3P';
//     popup.style.display = 'none';
//   });
// };

// window.pickPlayersFour = function () {
//   var popup = document.querySelector('.choosePlayers');
//   var howManyPlayers = document.querySelector('#fourPlayers');
//   var amountOfPlayers = document.querySelector('.playerTextMenu');
//   howManyPlayers.addEventListener('click', function () {
//     amountOfPlayers.textContent = '4P';
//     popup.style.display = 'none';
//   });
// };

// otwieranie ustalenia dzwieku
window.soundSettings = function () {
  var popup = document.querySelector('.soundSettings');
  if (popup.style.display === 'none') {
    popup.style.display = 'block';
    playClickSound(); 
  } else {
    popup.style.display = 'none';
    playClickSound(); 
  }
};

window.arrowButtonSound = function () {
  var arrow = document.querySelector('.soundSettings');
  arrow.style.display = 'none';
  playClickSound(); 
};


function playClickSound() {
  clickSound.currentTime = 0;
  clickSound.play();
}

window.arrowButton = function () {
  var arrow = document.querySelector('.choosePlayers');
  arrow.style.display = 'none';
  playClickSound(); 
};