const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = {
    entry: './index.tsx',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: "/node_modules/",
                loader: "ts-loader"
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: "babel-loader",
                options: {
                    'plugins': [
                        '@babel/plugin-proposal-class-properties',
                        '@babel/plugin-syntax-dynamic-import'
                    ]
                }
            },
        ]
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.css', '.wasm']
    },
    output: {
        filename: '[name].[hash].js',
        path: path.resolve(__dirname, 'dist/'),
        publicPath: "./"
    },
    plugins: [
        new Dotenv({
            systemvars: true
        }),
        new CopyPlugin([
            path.resolve(__dirname, "public")
        ]),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'public', 'index.html'),
        })
    ]
}
