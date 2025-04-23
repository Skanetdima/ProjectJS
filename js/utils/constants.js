// src/utils/constants.js

// Definicje typów kafelków mapy
export const TILE_WALL = 0; // Ściana
export const TILE_CORRIDOR = 1; // Korytarz
export const TILE_ROOM_FLOOR = 2; // Podłoga pokoju
export const TILE_LIFT = 3; // Winda
// Można dodać więcej typów, np. TILE_DOOR, TILE_WINDOW itp.

// Stany gry
export const GameState = {
  LOADING: 'LOADING', // Ładowanie zasobów, generowanie poziomu
  MENU: 'MENU', // Menu główne (wybór postaci)
  PLAYING: 'PLAYING', // Główna rozgrywka
  ASKING_QUESTION: 'ASKING_QUESTION', // Wyświetlanie pytania
  SELECTING_FLOOR: 'SELECTING_FLOOR', // Wyświetlanie UI wyboru piętra
  TRANSITIONING: 'TRANSITIONING', // Animacja/oczekiwanie na przejście windy
  GAME_OVER: 'GAME_OVER', // Koniec gry (wygrana lub przegrana)
};

// Parametry rozgrywki
export const TARGET_BOOKS_TO_WIN = 5; // Liczba książek do zebrania, aby wygrać (globalnie)
export const LIFT_COOLDOWN_MS = 2000; // Czas odnowienia windy w milisekundach (2 sekundy)
export const LIFT_INTERACTION_RADIUS_MULTIPLIER = 0.7; // Mnożnik promienia interakcji z windą (względem tileSize)

// Szansa na pojawienie się siłowni na pierwszym piętrze (0.0 do 1.0)
export const GYM_CHANCE_ON_FIRST_FLOOR = 0.6; // 60% szansy

// Pytania i odpowiedzi
export const questions = [
  {
    question:
      'Który język programowania jest znany ze swojej wszechstronności i używany zarówno w backendzie (Node.js), jak i frontendzie?',
    options: ['Python', 'Java', 'JavaScript', 'C#'],
    correctAnswer: 2, // Indeks poprawnej odpowiedzi (JavaScript)
  },
  {
    question: 'Co oznacza skrót HTML?',
    options: [
      'HyperText Markup Language',
      'High Transfer Machine Language',
      'Hyperlink and Text Management Language',
      'Home Tool Markup Language',
    ],
    correctAnswer: 0,
  },
  {
    question: 'Która struktura danych działa na zasadzie LIFO (Last-In, First-Out)?',
    options: ['Kolejka (Queue)', 'Stos (Stack)', 'Lista (List)', 'Drzewo (Tree)'],
    correctAnswer: 1,
  },
  {
    question: 'Jak nazywa się proces znajdowania i naprawiania błędów w kodzie?',
    options: ['Kompilacja', 'Testowanie', 'Debugowanie', 'Refaktoryzacja'],
    correctAnswer: 2,
  },
  {
    question:
      "Który paradygmat programowania opiera się na koncepcji 'obiektów', które mogą zawierać dane i kod?",
    options: [
      'Programowanie funkcyjne',
      'Programowanie proceduralne',
      'Programowanie obiektowe',
      'Programowanie logiczne',
    ],
    correctAnswer: 2,
  },
  {
    question: 'Co oznacza CSS?',
    options: [
      'Cascading Style Sheets',
      'Computer Style Syntax',
      'Creative Styling System',
      'Colorful Style Scripts',
    ],
    correctAnswer: 0,
  },
  {
    question: 'Który operator w JavaScript służy do ścisłego porównania (wartość i typ)?',
    options: ['==', '=', '===', '!='],
    correctAnswer: 2,
  },
  {
    question: 'Jak nazywa się popularny system kontroli wersji używany przez programistów?',
    options: ['Subversion (SVN)', 'Git', 'Mercurial', 'CVS'],
    correctAnswer: 1,
  },
  {
    question:
      'Który typ pętli w większości języków programowania jest najbardziej odpowiedni do iteracji po elementach tablicy, gdy nie znamy ich liczby?',
    options: ['for', 'while', 'do...while', 'foreach (lub for...of)'],
    correctAnswer: 3,
  },
  {
    question: 'Co to jest API?',
    options: [
      'Advanced Programming Interface',
      'Application Programming Interface',
      'Automated Program Interaction',
      'Algorithmic Processing Input',
    ],
    correctAnswer: 1,
  },
  // Dodaj więcej pytań tutaj
];
