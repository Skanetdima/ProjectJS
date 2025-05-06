const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  mode: 'development', // Use 'production' for the build script
  entry: './js/main.js', // Your main JavaScript file
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'), // Output directory
    clean: true, // Cleans the dist folder before each build
    assetModuleFilename: 'assets/[name][hash][ext][query]', // How to name assets like images/fonts
  },
  devtool: 'inline-source-map', // Source maps for easier debugging in development
  devServer: {
    static: './docs', // Serve files from the dist directory
    hot: true, // Enable Hot Module Replacement (HMR)
  },
  module: {
    rules: [
      {
        test: /\.css$/i, // Process CSS files
        use: [
          MiniCssExtractPlugin.loader, // 2. Extract CSS into separate files
          'css-loader', // 1. Turn CSS into CommonJS
        ],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i, // Handle image assets
        type: 'asset/resource', // Copies assets to output dir
        generator: {
          filename: 'assets/images/[name][hash][ext]', // Specific path for images
        },
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i, // Handle font assets
        type: 'asset/resource',
        generator: {
          filename: 'assets/fonts/[name][hash][ext]', // Specific path for fonts
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html', // Use this HTML file as a template
      title: 'Ucieczka z Uniwersytetu', // You can set the title here or in the template
    }),
    new MiniCssExtractPlugin({
      filename: 'main.css', // Name of the output CSS file
    }),
  ],
  // Optimization might be needed for production builds (e.g., code splitting)
  // optimization: {
  //   splitChunks: {
  //     chunks: 'all',
  //   },
  // },
};
