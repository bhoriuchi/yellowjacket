import babel from 'rollup-plugin-babel';

export default {
  entry: 'src/index.js',
  format: 'cjs',
  plugins: [ babel() ],
  external: [
    'lodash',
    'path',
    'graphql-factory',
    'graphql-factory-backend',
    'graphql-factory-types',
    'graphql-obj2arg',
    'fs',
    'events',
    'jsonwebtoken',
    'chalk',
    'socketio-jwt',
    'socket.io',
    'socket.io-client',
    'os',
    'hat',
    'nested-opts',
    'http'
  ],
  dest: 'index.js'
}