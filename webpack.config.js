const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  mode: 'development', // Используйте 'production' для скрипта сборки
  entry: './js/main.js', // Ваш главный JavaScript файл
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'docs'), // Папка для вывода
    clean: true, // Очищать папку docs перед каждой сборкой
    // Общий шаблон для именования ассетов, если не переопределено в generator
    // assetModuleFilename: 'assets/[name][hash][ext][query]', // Можно оставить или удалить, если все ассеты имеют свои generator
  },
  devtool: 'inline-source-map', // Карта кода для облегчения отладки в разработке
  devServer: {
    static: './docs', // Обслуживать файлы из папки docs
    hot: true, // Включить Hot Module Replacement (HMR)
  },
  module: {
    rules: [
      {
        test: /\.css$/i, // Обработка CSS файлов
        use: [
          MiniCssExtractPlugin.loader, // 2. Извлекает CSS в отдельные файлы
          'css-loader', // 1. Превращает CSS в CommonJS
        ],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i, // Обработка изображений
        type: 'asset/resource', // Копирует ассеты в папку вывода
        generator: {
          filename: 'assets/images/[name][hash][ext]', // Конкретный путь для изображений
        },
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i, // Обработка шрифтов
        type: 'asset/resource',
        generator: {
          filename: 'assets/fonts/[name][hash][ext]', // Конкретный путь для шрифтов
        },
      },
      {
        // --- НОВОЕ ПРАВИЛО ДЛЯ АУДИО ---
        test: /\.(mp3|wav|ogg|aac)$/i, // Распространенные аудио форматы
        type: 'asset/resource',
        generator: {
          // Убедитесь, что этот путь соответствует тому, что ожидает ваш AudioManager
          // AudioManager ожидает 'assets/audio/filename.mp3'
          filename: 'assets/audio/[name][hash][ext]',
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html', // Использовать этот HTML файл как шаблон
      title: 'Ucieczka z Uniwersytetu', // Можно установить заголовок здесь или в шаблоне
    }),
    new MiniCssExtractPlugin({
      filename: 'main.css', // Имя выходного CSS файла
    }),
  ],
  // Оптимизация может понадобиться для production сборок (например, разделение кода)
  // optimization: {
  //   splitChunks: {
  //     chunks: 'all',
  //   },
  // },
};
