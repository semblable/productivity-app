const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Remove previous '/game' proxy; the game assets are now served directly from the CRA dev server (public/game). If you need another proxy, define it here.
  // Example for API proxy:
  // app.use(
  //   '/api',
  //   createProxyMiddleware({
  //     target: 'http://localhost:5000',
  //     changeOrigin: true,
  //   })
  // );
};
