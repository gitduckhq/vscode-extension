//@ts-check
'use strict'

const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const childProcess = require('child_process')
const {promisify} = require('util')
const webpack = require('webpack')
const exec = promisify(childProcess.exec)

module.exports = async (env, options) => {
  const isProd = options.mode === 'production'

  await exec('rm -rf ./out')

  return {
    target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
    entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
    output: {
      // the bundle is stored in the 'out' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
      path: path.resolve(__dirname, 'out'),
      filename: 'extension.js',
      libraryTarget: 'commonjs2',
      devtoolModuleFilenameTemplate: '../[resource-path]'
    },
    devtool: isProd ? false : 'source-map',
    externals: {
      vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    },
    node: {
      __dirname: false,
    },
    resolve: {
      // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
      extensions: ['.ts', '.js']
    },
    plugins: [
      new CopyWebpackPlugin([
        {from: 'assets', to: 'assets'},
      ]),
      new webpack.EnvironmentPlugin({
        'process.env.NODE_ENV': isProd ? 'production' : 'development',
      }),
    ],
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'ts-loader'
            }
          ]
        }
      ]
    }
  }
}
