const PROXY_USER_AGENT = 'Lokapharm/1.0.0 (cm.Lokapharm.app; contact@Lokapharm.cm)';

function withOsmHeaders(proxyReq) {
  proxyReq.setHeader('User-Agent', PROXY_USER_AGENT);
  proxyReq.setHeader('Accept-Language', 'fr');
}

module.exports = {
  '/api/overpass': {
    target: 'https://overpass-api.de',
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      '^/api/overpass': '/api/interpreter',
    },
    onProxyReq: withOsmHeaders,
  },
  '/api/nominatim': {
    target: 'https://nominatim.openstreetmap.org',
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      '^/api/nominatim': '',
    },
    onProxyReq: withOsmHeaders,
  },
};
