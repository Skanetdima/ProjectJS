const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development', // Используй 'production' для финальной сборки
  entry: './js/main.js', // Главный JS файл (точка входа)
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true, // Очищает папку dist перед сборкой
  },
  module: {
    rules: [
      {
        test: /\.css$/i, // Обработка CSS файлов
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/i, // Обработка изображений и SVG
        type: 'asset/resource',
        generator: {
          filename: 'images/[name][ext]', // Копирует изображения в dist/images
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'index.html', // HTML шаблон
    }),
  ],
  devServer: {
    static: './dist',
    open: true, // Автооткрытие в браузере
  },
};
