'use strict';

const { defineConfig } = require( 'vite' );
const vue = require( '@vitejs/plugin-vue' );

// The bundle is one CommonJS body wrapped in `mw.libs.wizz.form = function ( require ) {…}`:
// `vue` and `@wikimedia/codex` stay external and are `require()`d from the argument, which is
// the `require` resolved by `mw.loader.using` (research R2). The file only assigns that
// function, so it works as a package-gadget page and with `mw.loader.getScript`.
module.exports = defineConfig( {
	plugins: [ vue() ],
	build: {
		target: 'es2018',
		minify: false, // readable for interface admins reviewing the code
		lib: { entry: 'src/wizz-form.js', formats: [ 'cjs' ], fileName: () => 'wizz-form.js' },
		rollupOptions: {
			external: [ 'vue', '@wikimedia/codex' ],
			output: {
				banner: 'mw.libs.wizz.form = function ( require ) {',
				footer: '};'
			}
		}
	}
} );
