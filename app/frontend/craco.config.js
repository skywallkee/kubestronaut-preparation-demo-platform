module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      if (env === 'development') {
        // Disable expensive type checking for faster builds
        webpackConfig.plugins = webpackConfig.plugins.filter(
          plugin => plugin.constructor.name !== 'ForkTsCheckerWebpackPlugin'
        );
        
        // Reduce bundle splitting for faster development builds
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              default: false,
              vendors: false,
              // Create a single vendor chunk
              vendor: {
                name: 'vendor',
                chunks: 'all',
                test: /node_modules/,
                enforce: true,
              },
            },
          },
        };

        // Faster source map option
        webpackConfig.devtool = false; // Completely disable source maps
        
        // Optimize resolve for faster module resolution
        webpackConfig.resolve = {
          ...webpackConfig.resolve,
          symlinks: false,
          cacheWithContext: false,
        };

        // Reduce file system checks
        webpackConfig.snapshot = {
          managedPaths: [/^(.+?[\\/]node_modules[\\/])/],
        };
      }
      
      return webpackConfig;
    },
  },
  devServer: {
    open: false, // Don't auto-open browser
    compress: false, // Disable compression for faster serving
    hot: true,
    liveReload: false,
    client: {
      overlay: false, // Disable error overlay
    },
  },
};