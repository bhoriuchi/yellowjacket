import babel from 'rollup-plugin-babel';

export default {
  entry: 'src/app/install.js',
  format: 'cjs',
  plugins: [ babel() ],
  dest: 'install.js'
}