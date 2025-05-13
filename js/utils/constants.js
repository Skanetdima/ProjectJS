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
export const TARGET_BOOKS_TO_WIN = 15; // Liczba książek do zebrania, aby wygrać (globalnie)
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
  {
    question: 'Co to jest PLC i do czego najczęściej służy w automatyce?',
    options: [
      'Programowalny Logic Controller, do sterowania procesami przemysłowymi',
      'Personal Learning Computer, do nauki programowania',
      'Power Line Communication, do przesyłu danych przez sieć elektryczną',
      'Project Lifecycle Cost, do zarządzania kosztami projektu',
    ],
    correctAnswer: 0,
  },
  {
    question: 'Za co odpowiada przysłona (apertura) w aparacie fotograficznym?',
    options: [
      'Kontrolę czasu naświetlania',
      'Regulację głębi ostrości i ilości wpadającego światła',
      'Ustawienie balansu bieli',
      'Stabilizację obrazu',
    ],
    correctAnswer: 1,
  },
  {
    question:
      'Który element komputera jest odpowiedzialny za tymczasowe przechowywanie danych używanych przez procesor?',
    options: ['Dysk twardy (HDD/SSD)', 'Karta graficzna (GPU)', 'Pamięć RAM', 'Płyta główna'],
    correctAnswer: 2,
  },
  {
    question:
      'W jakim języku programowania najczęściej pisane są skrypty po stronie serwera (backend)?',
    options: ['HTML', 'CSS', 'SQL', 'PHP, Python lub Node.js (JavaScript)'],
    correctAnswer: 3,
  },
  {
    question:
      'Jaki typ sygnału charakteryzuje się płynną zmianą wartości w czasie, w przeciwieństwie do sygnału cyfrowego?',
    options: ['Binarny', 'Analogowy', 'Zero-jedynkowy', 'Impulsowy'],
    correctAnswer: 1,
  },
  {
    question:
      'Który parametr ustawia czułość matrycy aparatu na światło i wpływa na poziom szumów na zdjęciu?',
    options: ['Czas naświetlania', 'Przysłona', 'ISO', 'Ogniskowa'],
    correctAnswer: 2,
  },
  {
    question: 'Co to jest adres IP w sieci komputerowej?',
    options: [
      'Unikalny identyfikator urządzenia w sieci',
      'Nazwa użytkownika do logowania',
      'Adres strony internetowej',
      'Typ kabla sieciowego',
    ],
    correctAnswer: 0,
  },
  {
    question: 'Czym różni się instrukcja warunkowa `if` od pętli `while` w programowaniu?',
    options: [
      '`if` powtarza blok kodu, `while` sprawdza warunek jednokrotnie',
      '`if` sprawdza warunek jednokrotnie, `while` powtarza blok kodu dopóki warunek jest prawdziwy',
      'Nie ma między nimi różnicy',
      '`if` służy tylko do deklarowania zmiennych, `while` do operacji matematycznych',
    ],
    correctAnswer: 1,
  },
  {
    question: 'Do czego najczęściej służy czujnik ciśnienia w systemie automatyki?',
    options: ['Pomiaru temperatury', 'Pomiaru odległości', 'Pomiaru siły', 'Pomiaru ciśnienia'],
    correctAnswer: 3,
  },
  {
    question: 'Co oznacza zasada trójpodziału w kompozycji fotograficznej?',
    options: [
      'Dzielenie obrazu na 3 równe części pionowo i poziomo i umieszczanie kluczowych elementów na liniach lub ich przecięciach',
      'Używanie tylko 3 głównych kolorów w kadrze',
      'Robienie zawsze 3 zdjęć tej samej sceny',
      'Balansowanie 3 głównych obiektów w kadrze',
    ],
    correctAnswer: 0,
  },
  {
    question: 'Jaka jest podstawowa rola systemu operacyjnego?',
    options: [
      'Tworzenie grafiki komputerowej',
      'Zarządzanie zasobami sprzętowymi i programowymi komputera',
      'Pisanie kodu programów',
      'Przeglądanie Internetu',
    ],
    correctAnswer: 1,
  },
  {
    question:
      'Jakiego typu danych najczęściej użyjesz do przechowywania wieku osoby (liczba całkowita)?',
    options: [
      'String (ciąg znaków)',
      'Boolean (wartość logiczna)',
      'Float (liczba zmiennoprzecinkowa)',
      'Integer (liczba całkowita)',
    ],
    correctAnswer: 3,
  },
  {
    question: 'Element wykonawczy (aktuator) w systemie automatyki to urządzenie, które...',
    options: [
      'Odczytuje dane z czujników',
      'Wykonuje komendy ze sterownika, aby wykonać fizyczne działanie (np. ruch)',
      'Przechowuje dane historyczne',
      'Służy do komunikacji z operatorem',
    ],
    correctAnswer: 1,
  },
  {
    question:
      'Który format pliku graficznego jest bezstratny i często używany w profesjonalnej edycji, zachowując maksymalną jakość kosztem rozmiaru?',
    options: ['JPEG', 'GIF', 'PNG', 'RAW'],
    correctAnswer: 3,
  },
  {
    question: 'Co chroni sieć komputerową przed nieautoryzowanym dostępem z zewnątrz?',
    options: ['Router', 'Switch', 'Modem', 'Firewall (zapora sieciowa)'],
    correctAnswer: 3,
  },
  {
    question: 'Co to jest IDE (Integrated Development Environment) w kontekście programowania?',
    options: [
      'System operacyjny',
      'Narzędzie do zarządzania bazą danych',
      'Zintegrowane środowisko programistyczne (edytor kodu, kompilator, debugger w jednym)',
      'Protokół sieciowy',
    ],
    correctAnswer: 2,
  },
  {
    question:
      'Przykładem czujnika zbliżeniowego, wykrywającego obecność obiektu bez fizycznego kontaktu, może być:',
    options: ['Termometr', 'Fotokomórka', 'Manometr (czujnik ciśnienia)', 'Akcelerometr'],
    correctAnswer: 1,
  },
  {
    question: 'Do czego służy balans bieli (white balance) w aparacie fotograficznym?',
    options: [
      'Do regulacji ostrości',
      'Do korekcji kolorów, aby biały wyglądał na biały niezależnie od źródła światła',
      'Do ustawiania czasu naświetlania',
      'Do dodawania efektów specjalnych',
    ],
    correctAnswer: 1,
  },
  {
    question:
      'Który protokół jest używany do bezpiecznego (szyfrowanego) przesyłania stron internetowych?',
    options: ['HTTP', 'FTP', 'SMTP', 'HTTPS'],
    correctAnswer: 3,
  },
  {
    question: 'Co to jest zmienna w programowaniu?',
    options: [
      'Funkcja wykonująca określone zadanie',
      'Typ pętli',
      'Nazwane miejsce w pamięci komputera służące do przechowywania danych',
      'Polecenie wyświetlające tekst na ekranie',
    ],
    correctAnswer: 2,
  },
  // Dodaj więcej pytań tutaj
];
