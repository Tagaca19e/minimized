const path = require('path');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = {
  entry: './main.js',
  output: {
    filename: 'minimized.js',
    path: path.resolve(__dirname, 'dist'),
  },
  mode: 'production',
  plugins: [
    new NodePolyfillPlugin(),
  ],
  target: 'node',
};
