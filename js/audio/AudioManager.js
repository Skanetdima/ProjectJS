// src/audio/AudioManager.js

import track1Src from '../../assets/audio/back1.mp3'; // Пример пути, настройте под вашу структуру
import track2Src from '../../assets/audio/back2.mp3';
import track3Src from '../../assets/audio/back3.mp3';

const DEFAULT_MUSIC_VOLUME = 0.5;

// Используем импортированные исходники
const MUSIC_SOURCES = {
  // Переименовано для ясности
  track1: track1Src,
  track2: track2Src,
  track3: track3Src,
};

// Порядок, в котором треки будут меняться (можно изменить на другую логику)
const TRACK_CYCLE_ORDER = ['track1', 'track2', 'track3'];

export class AudioManager {
  constructor() {
    this.musicVolume = DEFAULT_MUSIC_VOLUME;
    this.currentMusicElement = null;
    this.currentTrackKey = null;
    this.isMusicPlaying = false;

    const savedVolume = localStorage.getItem('musicVolume');
    if (savedVolume !== null) {
      this.musicVolume = parseFloat(savedVolume);
    }

    this.audioElements = {};
    this._preloadTracks();
  }

  _preloadTracks() {
    console.log('[AudioManager] Preloading tracks from imported sources...');
    for (const key in MUSIC_SOURCES) {
      if (MUSIC_SOURCES.hasOwnProperty(key)) {
        const audioPath = MUSIC_SOURCES[key]; // Используем импортированный путь
        const audio = new Audio(audioPath);
        audio.preload = 'auto';
        this.audioElements[key] = audio;
        console.log(`  Preloaded ${key} from ${audioPath}`);
      }
    }
  }

  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume)); // Ограничиваем от 0 до 1
    if (this.currentMusicElement) {
      this.currentMusicElement.volume = this.musicVolume;
    }
    localStorage.setItem('musicVolume', this.musicVolume.toString()); // Сохраняем громкость
    console.log(`[AudioManager] Music volume set to: ${this.musicVolume}`);
  }

  getMusicVolume() {
    return this.musicVolume;
  }

  playMusic(trackKey, loop = true) {
    if (!this.audioElements[trackKey]) {
      console.warn(`[AudioManager] Track "${trackKey}" not found or not preloaded.`);
      if (MUSIC_SOURCES[trackKey]) {
        // Проверяем наличие в MUSIC_SOURCES
        this.audioElements[trackKey] = new Audio(MUSIC_SOURCES[trackKey]); // Используем импортированный путь
      } else {
        console.error(
          `[AudioManager] Source for track "${trackKey}" not defined in MUSIC_SOURCES.`
        );
        return;
      }
    }

    if (this.isMusicPlaying && this.currentTrackKey === trackKey) {
      return;
    }
    this.stopMusic();

    this.currentMusicElement = this.audioElements[trackKey];
    this.currentMusicElement.volume = this.musicVolume;
    this.currentMusicElement.loop = loop;
    this.currentTrackKey = trackKey;

    this.currentMusicElement
      .play()
      .then(() => {
        this.isMusicPlaying = true;
        console.log(
          `[AudioManager] Playing music: ${trackKey} (Volume: ${this.currentMusicElement.volume})`
        );
      })
      .catch((error) => {
        console.error(`[AudioManager] Error playing "${trackKey}":`, error);
        // Добавьте больше деталей для отладки политики автовоспроизведения
        console.error(
          `  Playback failure details: userInteracted (check Menu.js), document.hasFocus(): ${document.hasFocus()}`
        );
        this.isMusicPlaying = false;
        this.currentMusicElement = null;
        this.currentTrackKey = null;
      });
  }

  stopMusic() {
    if (this.currentMusicElement) {
      this.currentMusicElement.pause();
      this.currentMusicElement.currentTime = 0; // Сброс на начало
      this.isMusicPlaying = false;
      console.log(`[AudioManager] Stopped music: ${this.currentTrackKey}`);
      // Не очищаем currentMusicElement и currentTrackKey здесь полностью,
      // чтобы можно было возобновить, если нужно, но для смены трека это ОК.
    }
  }

  // Вызывается при смене этажа
  changeTrackForFloor(floorNumber) {
    // Просто циклически меняем треки. Этажи обычно 1-индексированные.
    // floorNumber может быть любым, поэтому берем по модулю.
    // Используем (floorNumber - 1) если ваши этажи начинаются с 1, чтобы индекс был с 0.
    // Если этажи могут быть 0 или отрицательными, нужна другая логика.
    // Предположим, этажи > 0.
    const adjustedFloorIndex = Math.max(0, floorNumber - 1);
    const trackIndex = adjustedFloorIndex % TRACK_CYCLE_ORDER.length;
    const newTrackKey = TRACK_CYCLE_ORDER[trackIndex];

    if (newTrackKey) {
      console.log(`[AudioManager] Floor ${floorNumber} -> Music track: ${newTrackKey}`);
      this.playMusic(newTrackKey);
    } else {
      console.warn(`[AudioManager] No track found for floor index ${trackIndex}.`);
    }
  }

  // Метод для первоначального запуска музыки, например, при старте игры
  startInitialMusic(initialFloor = 1) {
    // Убедимся, что пользователь взаимодействовал со страницей,
    // прежде чем пытаться воспроизвести звук (браузеры блокируют автовоспроизведение).
    // Этот метод должен вызываться после клика "Play" в главном меню.
    console.log('[AudioManager] Attempting to start initial music...');
    this.changeTrackForFloor(initialFloor);
  }
}
