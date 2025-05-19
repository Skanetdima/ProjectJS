// Предположим, это src/main.js
import { Menu } from './UI/Menu.js';

import '../css/styles.css'; // Путь к CSS (если он у тебя есть)
// Пути к изображениям должны быть относительно main.js
import redStudentImg from '../assets/images/red.png'; // Проверь эти пути!
import blueStudentImg from '../assets/images/blue.png';
import yellowStudentImg from '../assets/images/yellow.png';
import greenStudentImg from '../assets/images/green.png';

document.addEventListener('DOMContentLoaded', () => {
  console.log('[main.js] DOMContentLoaded. Initializing Menu...');

  const characterImageSources = {
    red: redStudentImg,
    blue: blueStudentImg,
    yellow: yellowStudentImg,
    green: greenStudentImg,
  };

  new Menu(characterImageSources); // Menu теперь главный контроллер UI для меню
  console.log('[main.js] Menu instance created.');
});
