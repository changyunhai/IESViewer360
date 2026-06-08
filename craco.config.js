const path = require(`path`);
const TerserPlugin = require('terser-webpack-plugin')

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src/'),
    },
    configure: (webpackConfig, { env, paths }) => {
      paths.appBuild = `build-${process.env.REACT_APP_NAME}`
      webpackConfig.devtool = env == 'production' ? false : 'source-map';
      webpackConfig.output.path = path.resolve(__dirname, `build-${process.env.REACT_APP_NAME}`)
      return webpackConfig;
    },
    plugins: process.env.NODE_ENV === "production" ? [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true
          }
        }
      })
    ] : []
  },
};