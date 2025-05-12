// src/UI/AudioManager.js
export class AudioManager {
  constructor() {
    this.musicVolume = 0.5;
    this.sfxVolume = 0.7;
    this.currentMusic = null;
    this.sounds = new Map();
    this.isMusicEnabled = true; // Можно установить в false для полного отключения
    this.isSfxEnabled = true; // Можно установить в false для полного отключения
    this.audioContextStarted = false; // Флаг для отслеживания инициализации AudioContext
  }

  // Попытка разблокировать AudioContext при первом взаимодействии пользователя
  // Вызывайте этот метод при первом клике пользователя в приложении (например, в Menu.js)
  async tryUnlockAudioContext() {
    if (this.audioContextStarted) return;
    try {
      // Создание AudioContext при взаимодействии пользователя обычно разрешено
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const tempAudioContext = new AudioContext();
        await tempAudioContext.resume(); // Попытка активировать контекст
        await tempAudioContext.close(); // Закрываем временный контекст
        this.audioContextStarted = true;
        console.log('[AudioManager] AudioContext potentially unlocked by user interaction.');
        // Попытаться воспроизвести музыку, если она должна была играть
        if (this.isMusicEnabled && this.currentMusic && this.currentMusic.paused) {
          console.log(
            '[AudioManager] Attempting to play previously paused music after unlocking context.'
          );
          this.currentMusic
            .play()
            .catch((error) =>
              console.warn('Error playing music after unlock:', error.name, error.message)
            );
        }
      }
    } catch (e) {
      console.warn('[AudioManager] Could not unlock AudioContext:', e.name, e.message);
    }
  }

  // Инициализация аудио
  initialize() {
    console.log('[AudioManager] Initializing...');
    // Загрузка всех звуков
    // Для отладки путей, можно пока не загружать их здесь, а в Menu.js
    // this.loadSound('menu_click', 'assets/audio/menu_click.mp3');
    // this.loadSound('character_select', 'assets/audio/character_select.mp3');
    // this.loadSound('game_start', 'assets/audio/game_start.mp3');
    // this.loadSound('background_music', 'assets/audio/background_music.mp3', true);
    console.log(
      '[AudioManager] Initialization complete (sounds will be loaded on demand or by Menu).'
    );
  }

  // Загрузка звука
  loadSound(name, path, isMusic = false) {
    // Проверка, был ли звук уже загружен
    if (this.sounds.has(name)) {
      // console.log(`[AudioManager] Sound "${name}" already loaded.`);
      return this.sounds.get(name);
    }

    console.log(`[AudioManager] Loading sound: ${name} from ${path}`);
    const audio = new Audio(); // Создаем элемент Audio
    audio.src = path; // Устанавливаем путь

    audio.volume = isMusic ? this.musicVolume : this.sfxVolume;
    if (isMusic) {
      audio.loop = true;
    }

    // Обработчики для отладки загрузки
    audio.oncanplaythrough = () => {
      // console.log(`[AudioManager] Sound "${name}" can play through.`);
    };
    audio.onerror = (e) => {
      console.error(
        `[AudioManager] Error loading sound "${name}" from "${path}":`,
        e.target.error?.message || 'Unknown error'
      );
      // Удаляем нерабочий звук из карты, чтобы не пытаться его использовать
      this.sounds.delete(name);
    };
    audio.onstalled = () => {
      // console.warn(`[AudioManager] Loading of sound "${name}" stalled.`);
    };
    audio.onsuspend = () => {
      // console.warn(`[AudioManager] Loading of sound "${name}" suspended.`);
    };

    this.sounds.set(name, audio);
    return audio;
  }

  // Воспроизведение звука
  playSound(name) {
    if (!this.isSfxEnabled) return;

    const sound = this.sounds.get(name);
    if (sound) {
      // Проверяем, готов ли звук к воспроизведению
      if (sound.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        sound.currentTime = 0;
        sound
          .play()
          .catch((error) =>
            console.warn(`[AudioManager] Error playing sound "${name}":`, error.name, error.message)
          );
      } else {
        console.warn(
          `[AudioManager] Sound "${name}" not ready to play (readyState: ${sound.readyState}). Waiting for 'canplaythrough'.`
        );
        // Можно добавить слушатель 'canplaythrough' для отложенного воспроизведения,
        // но для простоты пока просто предупреждаем.
        // sound.addEventListener('canplaythrough', () => {
        //     console.log(`[AudioManager] "${name}" now ready, attempting play.`);
        //     sound.currentTime = 0;
        //     sound.play().catch(error => console.warn('Error playing sound (deferred):', error.name, error.message));
        // }, { once: true });
      }
    } else {
      // console.warn(`[AudioManager] Sound "${name}" not found or failed to load.`);
    }
  }

  // Воспроизведение музыки
  playMusic(name) {
    if (!this.isMusicEnabled) return;

    if (this.currentMusic && this.currentMusic.src === this.sounds.get(name)?.src) {
      // Если это та же музыка и она уже играет (или должна играть), ничего не делаем
      if (!this.currentMusic.paused) return;
    } else if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic.currentTime = 0;
    }

    const music = this.sounds.get(name);
    if (music) {
      // Проверяем, готова ли музыка к воспроизведению
      if (music.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        this.currentMusic = music;
        this.currentMusic.play().catch((error) => {
          console.warn(`[AudioManager] Error playing music "${name}":`, error.name, error.message);
          if (error.name === 'NotAllowedError') {
            console.info(
              '[AudioManager] Autoplay for music was prevented. Music will attempt to play after user interaction.'
            );
            // Музыка не будет играть до взаимодействия пользователя. tryUnlockAudioContext() попытается ее запустить.
          }
        });
      } else {
        console.warn(
          `[AudioManager] Music "${name}" not ready to play (readyState: ${music.readyState}). Waiting for 'canplaythrough'.`
        );
        // Можно добавить слушатель 'canplaythrough'
      }
    } else {
      // console.warn(`[AudioManager] Music "${name}" not found or failed to load.`);
    }
  }

  stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic.currentTime = 0;
    }
  }

  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.currentMusic) {
      this.currentMusic.volume = this.musicVolume;
    }
    // Обновляем громкость для всех музыкальных треков, которые могут быть не активны сейчас
    this.sounds.forEach((sound, name) => {
      // Предположим, что музыкальные треки имеют "music" в имени или специальный флаг
      if (sound.loop) {
        // Простой способ отличить музыку (обычно она зациклена)
        sound.volume = this.musicVolume;
      }
    });
  }

  setSfxVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach((sound, name) => {
      if (!sound.loop) {
        // Простой способ отличить SFX
        sound.volume = this.sfxVolume;
      }
    });
  }

  toggleMusic() {
    this.isMusicEnabled = !this.isMusicEnabled;
    if (!this.isMusicEnabled) {
      this.stopMusic();
    } else if (this.currentMusic) {
      // Если есть текущий трек
      // Попытка воспроизвести основной музыкальный трек (например, 'menu-music' или 'background_music')
      const mainMusicTrackName = Array.from(this.sounds.keys()).find((key) =>
        key.includes('music')
      ); // Найдем первый трек с "music"
      if (mainMusicTrackName) {
        this.playMusic(mainMusicTrackName);
      }
    }
    console.log(`[AudioManager] Music enabled: ${this.isMusicEnabled}`);
  }

  toggleSfx() {
    this.isSfxEnabled = !this.isSfxEnabled;
    console.log(`[AudioManager] SFX enabled: ${this.isSfxEnabled}`);
  }
}
