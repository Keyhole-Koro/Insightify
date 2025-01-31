const path = require('path');

module.exports = {
  webpack: {
    alias: {
      '@managers': path.resolve(__dirname, 'src/components/managers'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@llitems': path.resolve(__dirname, 'src/components/item/low-level'),
      '@base': path.resolve(__dirname, 'src/components/item/base/'),
      '@SvgCanvas': path.resolve(__dirname, 'src/components/SvgCanvas/'),
      '@itemCreateMenu': path.resolve(__dirname, 'src/components/ItemCreateMenu/'),
      '@item': path.resolve(__dirname, 'src/components/item/'),
      '@utils': path.resolve(__dirname, 'src/components/utils'),
    },
  },
};
