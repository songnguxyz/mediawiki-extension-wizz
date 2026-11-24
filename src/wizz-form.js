// Stub to prove the build (T017); T025 replaces this body. The build wraps the whole bundle
// in `mw.libs.wizz.form = function ( require ) { … }`, so static imports from `vue` and
// `@wikimedia/codex` resolve through the `require` passed in by the entry.
import * as Vue from 'vue';
import * as Codex from '@wikimedia/codex';

mw.log( 'wizz-form stub ran', Object.keys( Vue ).length, Object.keys( Codex ).length );
