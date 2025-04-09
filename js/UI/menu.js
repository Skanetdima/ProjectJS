// src/UI/menu.js
import { Game } from '../Core/Game.js'; // Убедись, что путь верный

let currentGameInstance = null; // Храним ссылку на текущую игру

export function initializeMenu() {
  const menuContainer = document.getElementById('menu-container');
  const characterCircles = document.querySelectorAll('.character-circle'); // Селектор для кнопок выбора

  if (!menuContainer) {
    console.error("Menu container ('menu-container') not found.");
    return;
  }
  if (characterCircles.length === 0) {
    console.warn("No character selection elements ('.character-circle') found in menu.");
    // Можно запустить игру с цветом по умолчанию или показать ошибку
    // startGameWithColor('red'); // Пример
    return;
  }

  console.log('Initializing menu...');
  menuContainer.style.display = 'flex'; // Показываем меню (или block, grid...)

  characterCircles.forEach((circle) => {
    circle.addEventListener('click', () => {
      const color = circle.dataset.color; // Получаем цвет из data-атрибута
      if (!color) {
        console.warn("Character circle clicked, but 'data-color' attribute is missing.");
        return;
      }
      console.log(`Character selected: ${color}`);
      // Останавливаем предыдущую игру, если она была
      if (currentGameInstance) {
        console.log('Stopping previous game instance...');
        currentGameInstance.stopGame();
        currentGameInstance = null;
      }
      // Скрываем меню и запускаем игру
      menuContainer.style.display = 'none';
      startGameWithColor(color);
    });
  });
}

// Функция для запуска игры с выбранным цветом
function startGameWithColor(color) {
  try {
    // Создаём новый экземпляр Game
    currentGameInstance = new Game(color);
    console.log('New Game instance created with color:', color);
    // UI элементы (канвас, кнопки, счет) будут показаны в Game.startGame()
  } catch (error) {
    console.error(`Failed to initialize game with color ${color}:`, error);
    // Показываем меню обратно или сообщение об ошибке
    const menuContainer = document.getElementById('menu-container');
    if (menuContainer) menuContainer.style.display = 'flex';
    alert(`Error starting game: ${error.message}`);
  }
}
