// src/main.js
import { Menu } from './UI/Menu.js'; // Importowanie klasy Menu z jej modułu.

import '../css/styles.css'; // Importowanie pliku stylów CSS.
// Ścieżki do obrazów muszą być względne w stosunku do main.js
import redStudentImg from '../assets/images/red.png'; // Importowanie obrazu czerwonego studenta.
import blueStudentImg from '../assets/images/blue.png'; // Importowanie obrazu niebieskiego studenta.
import yellowStudentImg from '../assets/images/yellow.png'; // Importowanie obrazu żółtego studenta.
import greenStudentImg from '../assets/images/green.png'; // Importowanie obrazu zielonego studenta.
import kopernikImg from '../assets/images/kopernik.png'; // Nowy import dla obrazu Kopernika.

document.addEventListener('DOMContentLoaded', () => {
  // Uruchomienie kodu po pełnym załadowaniu struktury DOM.
  console.log('[main.js] DOMContentLoaded. Inicjalizowanie Menu...');

  const characterImageSources = {
    // Obiekt mapujący klucze postaci do ich ścieżek obrazów.
    red: redStudentImg,
    blue: blueStudentImg,
    yellow: yellowStudentImg,
    green: greenStudentImg,
  };

  // Tworzenie nowej instancji Menu, przekazując obrazy postaci i obraz Kopernika.
  new Menu(characterImageSources, kopernikImg);
  console.log('[main.js] Instancja Menu została utworzona.');
});
