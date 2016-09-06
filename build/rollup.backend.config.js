import babel from 'rollup-plugin-babel';

export default {
  entry: 'src/backend/index.js',
  format: 'cjs',
  plugins: [ babel() ],
  dest: 'backend.js'
}