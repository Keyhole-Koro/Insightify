const path = require('path');

module.exports = {
  webpack: {
    alias: {
      '@components': path.resolve(__dirname, 'src/components'),
      '@materials': path.resolve(__dirname, 'src/materials'),
      '@contexts': path.resolve(__dirname, 'src/contexts'),
    }
  }
};
