const path = require('path');
const { VueLoaderPlugin } = require('vue-loader');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const { EnvironmentPlugin } = require('webpack');

function modifyManifest(buffer) {
  let manifest = JSON.parse(buffer.toString());

  if (process.env.VERSION) {
    manifest.version = process.env.VERSION;
  }

  return JSON.stringify(manifest, null, 2);
}

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  devtool: 'cheap-module-source-map',
  entry: {
    service_worker: './src/service_worker.js',
    background: './src/background.js',
    content_script: './src/content_script.js',
    priceChart: './src/priceChart.js',
    start: './src/start.js',
    popup: './src/popup.js'
  },
  output: {
    filename: 'static/[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    globalObject: 'self'
  },
  resolve: {
    alias: {
      'vue$': 'vue/dist/vue.runtime.esm.js'
    },
    extensions: ['.js', '.vue', '.json']
  },
  module: {
    rules: [
      {
        test: /\.(png|jpg|gif)$/i,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 8192
          }
        },
        generator: {
          filename: 'images/[name][ext][query]'
        }
      },
      {
        test: /\.svg$/,
        use: [
          'svg-url-loader'
        ]
      },
      {
        test: /\.less$/,
        use: [
          'vue-style-loader',
          'css-loader',
          'less-loader'
        ]
      },
      {
        test: /\.css$/i,
        use: ['vue-style-loader', 'style-loader', 'css-loader'],
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['@babel/plugin-transform-runtime']
          }
        }
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "public/manifest.json",
          to: "manifest.json",
          transform(content) {
            return modifyManifest(content)
          }
        },
        { from: 'public', to: '.', globOptions: { ignore: ['**/manifest.json'] } },
        {
          from: 'static/audio',
          to: 'static/audio'
        },
        {
          from: 'static/image/icon',
          to: 'static/image/icon'
        },
        {
          from: 'src/mobile_script.js',
          to: 'static/mobile_script.js'
        },
        {
          from: 'node_modules/@sunoj/touchemulator/touch-emulator.js',
          to: 'static/touch-emulator.js'
        },
        {
          from: 'node_modules/jquery/dist/jquery.min.js',
          to: 'static/jquery.min.js'
        }
      ]
    }),
    new CleanWebpackPlugin(),
    new VueLoaderPlugin(),
    new EnvironmentPlugin({
      NODE_ENV: 'development',
      BROWSER: 'chrome',
      VERSION: '0.1.1',
      BUILDID: 0
    })
  ]
};