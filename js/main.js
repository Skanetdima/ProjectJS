// ПРЕДПОЛАГАЕМОЕ РАСПОЛОЖЕНИЕ: js/main.js (если entry в webpack.config.js './js/main.js')
// ИЛИ src/main.js (если entry './src/main.js')

// Если этот файл находится в /js, а папка /src на том же уровне:
import { Menu } from './UI/Menu.js';
import '../css/styles.css';
import redStudentImg from '../assets/images/red.png';
import blueStudentImg from '../assets/images/blue.png';
import yellowStudentImg from '../assets/images/yellow.png';
import greenStudentImg from '../assets/images/green.png';

// Если этот файл находится в /src (и webpack entry был изменен):
/*
import { Menu } from './UI/Menu.js';
import '../css/styles.css'; // Возможно, путь к CSS тоже нужно будет изменить, например, './css/styles.css' если CSS в src/css
import redStudentImg from './assets/images/character_red.png';
import blueStudentImg from './assets/images/character_blue.png';
import yellowStudentImg from './assets/images/character_yellow.png';
import greenStudentImg from './assets/images/character_green.png';
*/

document.addEventListener('DOMContentLoaded', () => {
  console.log('[main.js] DOMContentLoaded. Initializing Menu...');

  const characterImageSources = {
    red: redStudentImg,
    blue: blueStudentImg,
    yellow: yellowStudentImg,
    green: greenStudentImg,
  };

  new Menu(characterImageSources);
});
