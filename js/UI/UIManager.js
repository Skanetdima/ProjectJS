// src/UI/UIManager.js
export class UIManager {
  // Статические свойства для хранения ссылок на DOM-элементы
  static scoreElement = null;
  static controlsContainer = null;
  // --- Новые элементы для UI вопросов ---
  static questionOverlay = null;
  static questionTextElement = null;
  static answerButtonsContainer = null;
  static currentAnswerCallback = null; // Храним колбэк для вызова при ответе

  // Создает кнопки управления и элемент для счета
  static createControls(inputManager) {
    // --- Создаем контейнер для кнопок ---
    // Проверяем, не был ли контейнер уже создан
    if (document.getElementById('controls-container')) {
      this.controlsContainer = document.getElementById('controls-container');
      console.warn('Controls container already exists. Reusing.');
    } else {
      this.controlsContainer = document.createElement('div');
      this.controlsContainer.id = 'controls-container'; // Используем id для CSS
      // Базовые стили контейнера (можно вынести в CSS)
      Object.assign(this.controlsContainer.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'grid', // Удобно для расположения кнопок
        gridTemplateAreas: `
              '. up .'
              'left . right'
              '. down .'
            `,
        gap: '5px',
        zIndex: '100',
      });
      document.body.appendChild(this.controlsContainer);
    }
    this.controlsContainer.innerHTML = ''; // Очищаем на случай переиспользования

    // --- Определяем кнопки ---
    const arrows = [
      { direction: 'up', icon: '↑', gridArea: 'up' },
      { direction: 'left', icon: '←', gridArea: 'left' },
      { direction: 'right', icon: '→', gridArea: 'right' },
      { direction: 'down', icon: '↓', gridArea: 'down' },
    ];

    // --- Создаем и настраиваем каждую кнопку ---
    arrows.forEach((arrow) => {
      const btn = document.createElement('button');
      btn.className = `control-btn ${arrow.direction}`; // Классы для CSS
      btn.textContent = arrow.icon;
      btn.style.gridArea = arrow.gridArea; // Расположение в сетке
      // Стили кнопок (лучше вынести в CSS)
      Object.assign(btn.style, {
        width: '50px',
        height: '50px',
        fontSize: '24px',
        touchAction: 'manipulation', // Улучшает отзывчивость на тач-устройствах
        userSelect: 'none', // Предотвратить выделение текста кнопки
        webkitUserSelect: 'none',
        msUserSelect: 'none',
        cursor: 'pointer',
        backgroundColor: '#555',
        color: 'white',
        border: '1px solid #888',
        borderRadius: '8px',
        fontWeight: 'bold',
      });

      // --- Обработчики событий ---
      const startPress = (e) => {
        e.preventDefault();
        inputManager.setKey(arrow.direction, true);
        btn.style.backgroundColor = '#aaa'; // Визуальный отклик
      };
      const endPress = (e) => {
        e.preventDefault();
        // Проверяем, все ли еще нажата кнопка (для touchend/mouseleave)
        if (inputManager.keys[arrow.direction]) {
          inputManager.setKey(arrow.direction, false);
        }
        btn.style.backgroundColor = '#555'; // Убрать отклик
      };

      // Тачскрин
      btn.addEventListener('touchstart', startPress, { passive: false });
      btn.addEventListener('touchend', endPress, { passive: false });
      btn.addEventListener('touchcancel', endPress, { passive: false }); // На случай отмены касания

      // Мышь
      btn.addEventListener('mousedown', startPress);
      btn.addEventListener('mouseup', endPress);
      btn.addEventListener('mouseleave', endPress); // Отпускаем, если мышь ушла

      this.controlsContainer.appendChild(btn);
    });

    this.controlsContainer.style.display = 'none'; // Скрываем по умолчанию

    // --- Создание элемента для счета ---
    // Проверяем, не был ли элемент счета уже создан
    if (document.getElementById('score-display')) {
      this.scoreElement = document.getElementById('score-display');
      console.warn('Score display element already exists. Reusing.');
    } else {
      this.scoreElement = document.createElement('div');
      this.scoreElement.id = 'score-display'; // ID для CSS
      // Стили элемента счета (можно вынести в CSS)
      Object.assign(this.scoreElement.style, {
        position: 'absolute',
        top: '10px',
        left: '10px',
        color: 'white',
        fontSize: '24px',
        fontFamily: 'Arial, sans-serif',
        textShadow: '1px 1px 3px black', // Тень для читаемости
        zIndex: '100',
      });
      document.body.appendChild(this.scoreElement); // Добавляем на страницу
    }
    this.scoreElement.textContent = 'Книги: 0 / ?'; // Начальный текст
    this.scoreElement.style.display = 'none'; // Скрываем по умолчанию
  }

  // --- Создание UI для вопросов (вызывается один раз при инициализации Game) ---
  static createQuestionUI() {
    // Проверяем, не был ли UI уже создан
    if (document.getElementById('question-overlay')) {
      this.questionOverlay = document.getElementById('question-overlay');
      this.questionTextElement = document.getElementById('question-text');
      this.answerButtonsContainer = document.getElementById('answer-buttons');
      console.warn('Question UI already exists. Reusing.');
      return;
    }

    // 1. Оверлей (фон)
    this.questionOverlay = document.createElement('div');
    this.questionOverlay.id = 'question-overlay';
    Object.assign(this.questionOverlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.8)', // Полупрозрачный черный
      display: 'none', // Скрыт по умолчанию
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: '200',
      fontFamily: 'Arial, sans-serif', // Шрифт для всего окна вопроса
    });

    // 2. Контейнер для вопроса и ответов
    const questionBox = document.createElement('div');
    questionBox.id = 'question-box';
    Object.assign(questionBox.style, {
      backgroundColor: '#f0f0f0',
      color: '#333',
      padding: '30px 40px',
      borderRadius: '10px',
      textAlign: 'center',
      width: 'clamp(300px, 80%, 600px)', // Адаптивная ширина
      boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
    });

    // 3. Текст вопроса
    this.questionTextElement = document.createElement('p');
    this.questionTextElement.id = 'question-text';
    Object.assign(this.questionTextElement.style, {
      fontSize: 'clamp(18px, 4vw, 24px)', // Адаптивный размер шрифта
      marginBottom: '25px',
      lineHeight: '1.4',
    });

    // 4. Контейнер для кнопок ответов
    this.answerButtonsContainer = document.createElement('div');
    this.answerButtonsContainer.id = 'answer-buttons';
    Object.assign(this.answerButtonsContainer.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      alignItems: 'stretch', // Растягиваем кнопки
    });

    // Собираем структуру
    questionBox.appendChild(this.questionTextElement);
    questionBox.appendChild(this.answerButtonsContainer);
    this.questionOverlay.appendChild(questionBox);
    document.body.appendChild(this.questionOverlay);

    console.log('Question UI created.');
  }

  // --- Отображение вопроса ---
  static showQuestion(questionData, answerCallback) {
    if (
      !this.questionOverlay ||
      !this.questionTextElement ||
      !this.answerButtonsContainer ||
      !questionData
    ) {
      console.error('UIManager: Cannot show question - UI elements or question data missing.');
      return;
    }

    console.log('UIManager: Showing question UI for:', questionData.question);
    this.questionTextElement.textContent = questionData.question;
    this.answerButtonsContainer.innerHTML = ''; // Очищаем старые кнопки
    this.currentAnswerCallback = answerCallback; // Сохраняем колбэк

    // Создаем кнопки для каждого варианта ответа
    questionData.options.forEach((optionText, index) => {
      const button = document.createElement('button');
      button.textContent = optionText;
      button.dataset.index = index; // Сохраняем индекс ответа для обработчика
      Object.assign(button.style, {
        // Базовые стили кнопок ответов
        padding: '12px 15px',
        fontSize: 'clamp(16px, 3vw, 18px)', // Адаптивный шрифт
        cursor: 'pointer',
        border: '1px solid #ccc',
        borderRadius: '5px',
        backgroundColor: '#fff',
        color: '#333',
        textAlign: 'left', // Выравнивание текста в кнопке
        transition: 'background-color 0.2s ease', // Плавный ховер
      });
      // Эффект при наведении
      button.onmouseover = () => (button.style.backgroundColor = '#e0e0e0');
      button.onmouseout = () => (button.style.backgroundColor = '#fff');

      // Обработчик клика на кнопку ответа
      button.addEventListener('click', (e) => {
        // Предотвращаем возможное двойное срабатывание
        if (!this.currentAnswerCallback) return;

        const selectedIndex = parseInt(e.target.dataset.index, 10);
        console.log(`UIManager: Answer button clicked, index: ${selectedIndex}`);

        // Вызываем колбэк из Game.js и сразу сбрасываем его, чтобы избежать повторных вызовов
        const callback = this.currentAnswerCallback;
        this.currentAnswerCallback = null; // Сброс колбэка ПЕРЕД вызовом
        callback(selectedIndex);
      });
      this.answerButtonsContainer.appendChild(button);
    });

    this.questionOverlay.style.display = 'flex'; // Показываем оверлей
  }

  // --- Скрытие UI вопроса ---
  static hideQuestion() {
    if (this.questionOverlay) {
      console.log('UIManager: Hiding question UI');
      this.questionOverlay.style.display = 'none';
      // Дополнительно очищаем текст и кнопки на случай, если hide вызовут без show
      if (this.questionTextElement) this.questionTextElement.textContent = '';
      if (this.answerButtonsContainer) this.answerButtonsContainer.innerHTML = '';
    }
    this.currentAnswerCallback = null; // Сбрасываем колбэк при скрытии
  }

  // --- Обновление счета (показывает текущий прогресс / цель) ---
  static updateScore(score, target) {
    if (!this.scoreElement) {
      this.scoreElement = document.getElementById('score-display');
      if (!this.scoreElement) {
        console.warn('Score display element not found.');
        return;
      }
    }
    this.scoreElement.textContent = `Книги: ${score} / ${target}`;
  }

  // --- Показывает игровые элементы UI ---
  static showGameUI() {
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.display = 'block';
    if (this.controlsContainer) this.controlsContainer.style.display = 'grid'; // Используем grid
    if (this.scoreElement) this.scoreElement.style.display = 'block';
    // Скрываем меню, если оно есть
    const menuContainer = document.getElementById('menu-container');
    if (menuContainer) menuContainer.style.display = 'none';
    this.hideQuestion(); // Убедимся, что UI вопроса скрыт при старте/возобновлении
    console.log('UIManager: Game UI shown.');
  }

  // --- Скрывает игровые элементы UI ---
  static hideGameUI() {
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.display = 'none';
    if (this.controlsContainer) this.controlsContainer.style.display = 'none';
    if (this.scoreElement) this.scoreElement.style.display = 'none';
    this.hideQuestion(); // Скрыть и UI вопроса при скрытии основного UI
    console.log('UIManager: Game UI hidden.');
  }
}
