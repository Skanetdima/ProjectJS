// src/main.js
import { Menu } from './UI/menu.js'; // Путь к Menu.js
import '../css/styles.css'; // Ваши стили

document.addEventListener('DOMContentLoaded', () => {
  console.log('[main.js] DOMContentLoaded. Initializing Menu...');
  new Menu(); // Единственный вызов конструктора Menu
});
