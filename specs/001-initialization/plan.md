# Implementation Plan: Wizz — Form sửa infobox gắn với Bucket

**Branch**: `001-initialization` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-initialization/spec.md`

## Summary

Wizz is a gadget that lets editors change the parameters of an existing infobox template call
through a validated form, without touching the rest of the page. A form is defined on a
sysop-protected JSON subpage `Template:<Name>/wizz.json` that binds the template to a Bucket;
field types come from the `Bucket:` schema page. A small tokenizer locates template calls and
rewrites only changed parameter values. All rules run in the browser before saving; the edit is
saved with `action=edit` in the user's session, so protection, AbuseFilter, CAPTCHA and
edit-conflict detection apply. The form is a Vue 3 + Codex app opened by `?wizz=1` or by the
"Edit infobox" tab.

## Technical Context

**Language/Version**: JavaScript ES2017+ (CommonJS modules as ResourceLoader package files),
Vue 3 and Codex as shipped by MediaWiki, LESS.

**Primary Dependencies**: on the wiki: MediaWiki ≥ 1.45, Gadgets, Bucket (schema pages only),
Scribunto (used by the wiki's templates). ResourceLoader modules: `vue`, `@wikimedia/codex`,
`mediawiki.api`, `mediawiki.util`, `mediawiki.jqueryMsg`. Dev only (npm): `qunit`,
`eslint-config-wikimedia`, `stylelint-config-wikimedia`, `banana-checker`.

**Storage**: none of its own. Wiki pages only: `Template:<Name>/wizz.json` (definitions),
`Bucket:` pages (read-only), article wikitext, `MediaWiki:Gadget-wizz-config.json`.

**Testing**: QUnit under Node (`npm test`) for the pure modules (tokenizer, editor, validator,
definition checker, summary). Round-trip fixture corpus in `tests/fixtures/roundtrip/` with
stored core parse trees (research R3). Manual cross-skin checks per
[quickstart.md](quickstart.md). CI on GitHub Actions: lint + tests.

**Target Platform**: browsers supported by MediaWiki 1.45+ on Miraheze and WikiOasis (both run
1.46); skins Minerva, Citizen, Vector 2022; light and dark; LTR and RTL.

**Project Type**: MediaWiki package gadget (front-end only).

**Performance Goals**: page views without `?wizz=1` load only the entry gadget (entry file,
config and the `wizz-tab` message; < 3 KB before gzip) plus one batched API request when the
tab is enabled; the form opens in ≤ 3 requests (research R5); tokenizer linear in page size,
< 50 ms for 200 KB of wikitext in the Node test run.

**Constraints**: no server code, no external resources, no Bucket API, no Page Forms code or
name collisions (`mw.libs.wizz`, `wizz-`), regex under a 200 ms time limit (R6), writes via
`postWithEditToken`, JS required (no-JS users simply see the page).

**Scale/Scope**: fan wikis up to ~100k pages; forms up to 60 fields; typically 1–5 infobox
calls per page.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How the design complies | Status |
|-----------|-------------------------|--------|
| I. Wikitext preservation | Tokenizer with offsets; only changed value spans replaced (R4); identical text → no API call; malformed markup → refuse (R3). | Pass |
| II. Regression-proof testing | Test-first pure modules under QUnit/Node; permanent round-trip corpus; comparison with core parse trees; CI blocks merge. | Pass |
| III. Validate before saving | One `wizz-validate.js` for typing and saving; types from `Bucket:` page; regex in a Worker with 200 ms limit; invalid existing values warned; definition checked on load and on view (FR-029); scope limit documented. | Pass (CSP for `blob:` workers to verify, fallback defined) |
| IV. No privilege bypass | `action=edit` in the user's session (R8); no own rights; definition used only if sysop-protected (R5); tab on by default, configurable off. | Pass |
| V. Portable gadget | Interface-admin install; MW 1.45+ with Gadgets/Bucket/Scribunto; stable front-end APIs; no external hosts; schema read as a page; `mw.libs.wizz`, `wizz-` prefix; MIT. | Pass |
| VI. Newcomers, any device | Codex components and tokens; full-screen dialog on Minerva; dark mode via skin tokens; logical CSS for RTL; `en`/`vi`/`qqq` bundles; labelled inputs and field-bound errors. | Pass |
| VII. Simplicity | Two config keys; no bundler; lazy second gadget is the only added structure (justified below). | Pass |
| VIII. Gadget best practices | eslint/stylelint wikimedia configs; package gadget with declared dependencies; pure logic modules; `postWithEditToken`; no raw HTML from user values; git tags as releases; docs listed in R12. | Pass |

**Post-design re-check (after Phase 1)**: still Pass. Follow-ups, not violations: verify CSP
for `blob:` workers, the ConfirmEdit captcha payload and Citizen's dark-mode tokens on the
farms (research marks **verify**).

## Project Structure

### Documentation (this feature)

```text
specs/001-initialization/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── api-calls.md
│   ├── wiki-interface.md
│   └── form-definition.schema.json
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
package.json
LICENSE
README.md                 # install, definition reference, Lua validation pattern
src/
├── wizz.js               # entry (gadget "wizz"): URL/tab/definition-page detection
├── wizz-tokenizer.js     # pure: find template calls with offsets
├── wizz-editor.js        # pure: apply changed values, summary text
├── wizz-definition.js    # pure: parse + check definition against schema
├── wizz-validate.js      # pure: field rules
├── wizz-regex-worker.js  # worker source (run via Blob URL)
├── wizz-load.js          # API: page, definition, schema (R5)
├── wizz-save.js          # API: preview, diff, save (R7, R8)
├── wizz-App.vue          # form shell, instance picker, preview/diff, save flow
├── wizz-Field.vue        # one field by type
├── wizz.less
├── wizz-config.json
└── i18n/  en.json  vi.json  qqq.json
build/
└── build.js              # src → dist with on-wiki names + gadget definitions (R12)
tests/
├── *.test.js             # QUnit under Node
└── fixtures/roundtrip/   # *.wikitext, *.edits.json, *.parsetree.xml
```

**Structure Decision**: flat `src/` because on-wiki gadget pages are flat; the file prefix is
the page name. Logic modules export plain functions and have no `mw`, Vue or DOM use, so
Node can require them directly; `wizz-load.js`/`wizz-save.js` take an `mw.Api` instance as a
parameter for testing with a fake.

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|----------|------------|--------------------------------------|
| Second hidden gadget `wizz-form` loaded on demand | Keeps Vue/Codex and the form code off normal page views | A single default gadget would load Vue on every page for every reader |
| Regex Web Worker from a Blob URL | Only way to stop a runaway regex in a browser (Constitution III) | Main-thread regex cannot be interrupted |
