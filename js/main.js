// src/main.js (или твой файл точки входа)
import { Game } from './Core/Game.js'; // Уточни путь
import { UIManager } from './UI/UIManager.js'; // Убедись, что путь и регистр верны

// --- Глобальные переменные ---
const menuContainer = document.getElementById('menu-container');
const gameCanvas = document.getElementById('game-canvas');
const characterSelectorWrapper = document.getElementById('character-selector-wrapper'); // Обертка кружков
const startButton = document.getElementById('start-button');

let currentGameInstance = null;
let selectedCharacterColor = null; // Храним выбранный цвет

// --- Функция старта игры ---
function startGame() {
  if (currentGameInstance) {
    console.warn('Trying to start game when instance already exists.');
    return;
  }
  if (!selectedCharacterColor) {
    alert('Пожалуйста, выберите персонажа!'); // Сообщение, если цвет не выбран
    return;
  }

  // Скрываем меню, показываем канвас
  if (menuContainer) menuContainer.style.display = 'none';
  if (gameCanvas) gameCanvas.style.display = 'block';
  else {
    console.error('Game canvas not found! Cannot start game.');
    if (menuContainer) menuContainer.style.display = 'flex'; // Показать меню обратно
    return;
  }

  console.log(`Starting game with character: ${selectedCharacterColor}`);
  try {
    currentGameInstance = new Game(selectedCharacterColor);
    // window.game = currentGameInstance; // Для дебага
  } catch (error) {
    console.error('Failed to initialize game:', error);
    const errorMsg = `Критическая ошибка запуска: ${error.message}`;
    if (UIManager.flashMessageContainer) {
      UIManager.flashMessage(errorMsg, 'error', 10000);
    } else {
      alert(errorMsg);
    }
    if (menuContainer) menuContainer.style.display = 'flex';
    if (gameCanvas) gameCanvas.style.display = 'none';
    currentGameInstance = null;
  }
}

// --- Инициализация при загрузке страницы ---
document.addEventListener('DOMContentLoaded', () => {
  // Настройка выбора персонажа
  if (characterSelectorWrapper) {
    const circles = characterSelectorWrapper.querySelectorAll('.character-circle');
    circles.forEach((circle) => {
      circle.addEventListener('click', (event) => {
        // Снимаем выделение со всех кружков
        circles.forEach((c) => c.classList.remove('selected'));
        // Выделяем нажатый
        event.target.classList.add('selected');
        // Сохраняем выбранный цвет из data-атрибута
        selectedCharacterColor = event.target.dataset.color;
        console.log(`Selected character color: ${selectedCharacterColor}`);
        // Активируем кнопку старта
        if (startButton) {
          startButton.disabled = false;
        }
      });
    });
  } else {
    console.warn('Character selector wrapper not found. Using default color.');
    selectedCharacterColor = 'red'; // Цвет по умолчанию, если селектора нет
    // Можно сразу активировать кнопку старта или запустить игру
    if (startButton) startButton.disabled = false;
    // Или если кнопки старта тоже нет, запускать сразу:
    // initializeGame(); // Функция для немедленного старта (см. предыдущий ответ)
  }

  // Настройка кнопки старта
  if (startButton) {
    startButton.addEventListener('click', startGame);
    console.log('Start button listener added.');
  } else {
    console.warn('Start button not found. Game cannot be started via button.');
    // Если кнопки нет, но есть выбор персонажа, игра не начнется сама
    // Если нет ни того, ни другого, нужна логика автостарта (см. initializeGame выше)
  }
});

// Опционально: обработка закрытия вкладки/окна
window.addEventListener('beforeunload', () => {
  currentGameInstance?.stopGame();
});
