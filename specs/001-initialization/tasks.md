---

description: "Task list for Wizz — infobox form editing gadget (001-initialization)"
---

# Tasks: Wizz — Form sửa infobox gắn với Bucket

**Input**: Design documents from `/specs/001-initialization/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md.
T056 also needs an account with interface-admin rights on a Miraheze and a WikiOasis test wiki
(requests use the User-Agent in `$MIRAHEZE_UA`).

**Tests**: Included. Constitution Principle II requires test-first QUnit tests under Node for
the tokenizer, editor and validation; SC-001/SC-002 are measured by these suites. Within each
phase write the test tasks first and confirm they fail before implementing.

**Organization**: Tasks are grouped by user story. US1–US3 (all P1) form the MVP; US4–US6 are
later increments.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story from spec.md (US1–US6)
- Paths are relative to the repository root (flat gadget layout, see plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repository tooling and CI for a package gadget

- [X] T001 Create `package.json` (license `MIT`, private, dev dependencies `qunit`, `eslint-config-wikimedia`, `stylelint-config-wikimedia`, `grunt-banana-checker` (its `banana-checker` CLI, no Grunt); scripts `test` = lint + banana + `qunit tests/`, `build` = `node build/build.js`, `fixtures:parsetree` = `node build/fetch-parsetree.js`)
- [X] T002 [P] Create `.eslintrc.json` (root, `wikimedia/client`, `wikimedia/vue3/es6`, `wikimedia/mediawiki`; override `tests/` and `build/` for `wikimedia/server` Node env) and `.eslintignore` for `dist/`
- [X] T003 [P] Create `.stylelintrc.json` extending `stylelint-config-wikimedia` and `.gitignore` (`node_modules/`, `dist/`)
- [X] T004 [P] Create `src/i18n/en.json`, `src/i18n/vi.json`, `src/i18n/qqq.json` with `@metadata` and the key families of contracts/wiki-interface.md (Messages), starting with `wizz-summary`, `wizz-noinfobox`, `wizz-parseerror`, `wizz-noeditright`
- [X] T005 [P] Create `.github/workflows/ci.yml` running `npm ci` and `npm test` on Node LTS for pushes and pull requests
- [X] T006 [P] Create `src/wizz-config.json` with `{ "namespaces": [0], "editTab": true, "tabLabel": { "en": "Edit infobox", "vi": "Sửa infobox" } }` (contracts/wiki-interface.md Configuration; research R2 entry message)
- [X] T007 Create `dev/test-wiki/` (`docker-compose.yml` + `setup.sh`) that builds a local MediaWiki at `http://localhost:8080` (version from env `MW_VERSION`, default 1.45; 1.46 also supported) with Gadgets, Scribunto, Bucket, AbuseFilter and ConfirmEdit; an interface-admin bot password for `WIZZ_TEST_API`; create the test data of quickstart.md "Test data (self-made)" steps 1 to 5; and `dev/test-wiki/deploy.js` that writes the `dist/` pages and gadget definitions from T017 to the test wiki through `WIZZ_TEST_API` (untagged builds allowed on the test wiki only, Constitution VIII)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tokenizer, wikitext editor and API loader that every story uses

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 Create round-trip fixture corpus in `tests/fixtures/roundtrip/` (≥ 20 self-made `*.wikitext` files covering: one-per-line and inline params, comments, `<ref>`, `<nowiki>`, `<pre>`, nested templates, `{{{ }}}`, `[[ ]]` with `|`, duplicate params, positional params, redirect/variant names, two calls of one template, malformed calls) each with a `*.edits.json` describing an edit and its exact expected output (research R3, R4)
- [X] T009 [P] Create `build/fetch-parsetree.js`: for each fixture, POST `action=parse&prop=parsetree&contentmodel=wikitext` to a wiki URL given by env `WIZZ_TEST_API`, write `*.parsetree.xml` beside it; commit the generated files
- [X] T010 [P] Write `tests/tokenizer.test.js`: offsets of call/name/param spans per fixture; agreement with `*.parsetree.xml` (template names, param names, values); malformed fixtures produce a parse error with line number; calls named `#…`, `subst:`, `safesubst:`, `:` are not template calls (data-model.md TemplateCall, TemplateParam); a timing case asserts parsing a generated 200 KB page takes < 50 ms
- [X] T011 [P] Write `tests/editor.test.js`: unchanged edit returns identical string for every fixture; each `*.edits.json` gives byte-identical expected output; rules of research R4 (whitespace kept, append in last param's layout, cleared field keeps `|a=`, last duplicate edited, positional untouched)
- [X] T012 Implement `src/wizz-tokenizer.js` (pure CommonJS, no `mw`/DOM): `parse( text ) → { calls: TemplateCall[] }` or throws `{ code: 'wizz-parseerror', line }` per data-model.md TemplateCall (`index`, `start`, `end`, `nameText`, `params`) and TemplateParam (`name`, `nameSpan`, `valueSpan`, `rawValue`, `value`) until T010 passes
- [X] T013 Implement `src/wizz-editor.js` (pure): `applyEdits( text, call, changes ) → newText` and `matchesTemplate( nameText, templateTitle, redirects, nsIds )` (data-model.md TemplateCall normalisation rules) until T011 passes
- [X] T014 Implement `src/wizz-load.js`: `loadPage( api, title )` (contracts/api-calls.md request 1, incl. `intestactions=edit`), `loadDefinitions( api, templates )` (request 2 incl. protection and redirects; each result carries data-model.md FormDefinition.template, `Template:<Name>` for `Module:<Name>/wizz.json`), `loadSchema( api, bucket )` (request 3) returning plain objects; Bucket defaults `index: true`, `repeated: false` (research R1); the schema result follows data-model.md BucketSchema.fields
- [X] T015 [P] Write `tests/load.test.js` with a fake `api` object returning recorded responses: user cannot edit → `wizz-noeditright`; protection `sysop` direct and cascading → trusted; `autoconfirmed` or none → `wizz-definition-untrusted` (research R5, FR-028); opening a form makes ≤ 3 API requests (plan Performance Goals, research R5)
- [X] T016 Create `src/wizz.js` (entry gadget): exit unless `wgAction === 'view'`, latest revision and namespace in `wizz-config.json` `namespaces` (the namespace check does not apply to `Module:*/wizz.json`, see T038); on `?wizz=1` call `mw.loader.using` on `ext.gadget.wizz-form` plus its dependencies and call `mw.libs.wizz.form( require )` with the resolved `require`; when config `cdn` is `true`, `mw.loader.using` only the dependencies, then `mw.loader.getScript` the jsDelivr URL of the entry's own version (contracts/wiki-interface.md Configuration) before the same call (until T025 exists the entry only logs that the form is missing); expose `mw.libs.wizz = { version }`, the version injected by the build (research R2, R9, R12)
- [X] T017 Add pinned devDependencies `vite`, `@vitejs/plugin-vue`, `less`, `vue` (the version MediaWiki 1.43 ships) and `@wikimedia/codex-icons`; create `vite.config.js` (entry `src/wizz-form.js`, output `dist/wizz-form.js`, `target: 'es2017'`, `vue` and `@wikimedia/codex` external through the passed-in `require`, LESS imported with `?inline`) and `build/build.js` (`npm run build`): run Vite, copy `wizz.js` with the version from `package.json` injected and `wizz-config.json`, write `dist/gadgets-definition.txt` (gadgets `wizz`: default, `ResourceLoader`, `package`, `dependencies=mediawiki.api,mediawiki.util`, pages `wizz.js`, `wizz-config.json`; `wizz-form`: hidden, `package`, `dependencies=vue,@wikimedia/codex,mediawiki.api,mediawiki.util,mediawiki.jqueryMsg`, page `wizz-form.js`), `dist/deploy.json` (Litmus format, `wizz-config.json` `createOnly`) and `dist/SHA256SUMS`; fail the build if the entry (`wizz.js` + `wizz-config.json`) exceeds 3 KB (research R2, R12)
- [X] T059 Update `dev/test-wiki/`: support `MW_VERSION=1.43` (Bucket `REL1_43`); remove the `ContentHandlerDefaultModelFor` hook from `setup.sh`; move the test definition to `Module:Infobox nhân vật/wizz.json` (protected, `json` model from Scribunto); make `deploy.js` read `dist/deploy.json` (titles and `createOnly`) and `dist/gadgets-definition.txt`; verify on 1.43, 1.45 and 1.46 (research R13, R14)

**Checkpoint**: tokenizer and editor proven on the corpus (SC-001 suite green); data can be loaded

---

## Phase 3: User Story 1 - Biên tập viên sửa infobox qua form (Priority: P1) 🎯 MVP

**Goal**: open a form with current values, edit, save only the changed parameters

**Independent Test**: on the test wiki open `<Page>?wizz=1`, change one field, save, check the diff (quickstart scenarios 1–2)

### Tests for User Story 1

- [X] T018 [P] [US1] Write `tests/summary.test.js`: summary lists changed params in order; no change → no summary
- [X] T019 [P] [US1] Write `tests/save.test.js` with a fake `api`: identical text → `nochange` with no `postWithEditToken` call (FR-003); `tags=wizz` sent only when tag active and user has `applychangetags` (data-model.md FormState.canTag); success returns `newrevid`

### Implementation for User Story 1

- [X] T020 [P] [US1] Add `buildSummary( changedParams, msg )` to `src/wizz-editor.js` using message `wizz-summary` (FR-007)
- [X] T021 [US1] Implement `src/wizz-save.js` `save( api, state, newText, summary )` per contracts/api-calls.md request 6 (`baserevid`, `basetimestamp`, `starttimestamp`, `nocreate`, `assert`, optional `tags`), mapping `Success` → `success` until T019 passes
- [X] T022 [US1] Implement form state building in `src/wizz-state.js` (pure, used by `src/wizz-form.js`): from loaded page, definition and schema produce data-model.md FormState (`page`, `revid`, `basetimestamp`, `starttimestamp`, `instance`, `fields[].value`, `fields[].dirty`, `canTag`); refuse with `wizz-noinfobox` (and `action=edit` link) when no call matches; refuse with `wizz-parseerror` and line on malformed call
- [X] T023 [US1] Create `src/wizz-Field.vue`: Codex input per type (TEXT → `CdxTextArea` when the raw value contains markup, else `CdxTextInput`; INTEGER/DOUBLE → `CdxTextInput` `inputmode="decimal"`; BOOLEAN → `CdxCheckbox` writing data-model.md FieldDefinition.booleanValues; PAGE → `CdxTextInput` for now) inside `CdxField` with label/help from FieldDefinition.label and FieldDefinition.help; marks `dirty` on input
- [X] T024 [US1] Create `src/wizz-App.vue`: `CdxDialog` (full screen on Minerva) rendering fields in definition order, save and cancel buttons, refusal messages; on save build text with `applyEdits` and call `save`; on success reload the page view without `wizz`
- [X] T025 [US1] Add `start()` to `src/wizz-form.js` that loads data (T014), builds state (T022), loads the bundled `src/i18n/<lang>.json` for `wgUserLanguage` into `mw.messages` with `en` fallback (research R11), adds the inlined LESS with `mw.util.addCSS`, runs as the bundle's top-level code (the build wraps the bundle in `mw.libs.wizz.form = function ( require ) {…}`, so the module exports nothing) and mounts `wizz-App.vue` with `Vue.createMwApp`
- [X] T026 [P] [US1] Create `src/wizz.less` using only Codex CSS custom properties and logical properties (`margin-inline-start`, …) for dark mode and RTL (research R10)
- [X] T027 [US1] Add US1 messages (`wizz-ui-save`, `wizz-ui-cancel`, `wizz-ui-title`, `wizz-ui-editsource`, `wizz-ui-nochange`, `wizz-summary`, `wizz-unsafevalue`, `wizz-error-save`) to `src/i18n/en.json`, `vi.json`, `qqq.json`

**Checkpoint**: US1 works end to end on the test wiki

---

## Phase 4: User Story 2 - Dữ liệu sai không vào được Bucket (Priority: P1)

**Goal**: every rule checked before saving; invalid fields block the save and are marked

**Independent Test**: with a definition using every rule, enter each invalid value and confirm no `action=edit` request is sent and the right field is marked (quickstart scenarios 3–5)

### Tests for User Story 2

- [X] T028 [P] [US2] Write `tests/validate.test.js`: types INTEGER/DOUBLE reject text, wikitext and `~150` (FR-011); data-model.md FieldDefinition.required, FieldDefinition.min / FieldDefinition.max (value for numbers, length for TEXT), FieldDefinition.allowed, FieldDefinition.namespaces; repeated values split on FieldDefinition.separator and checked per item with the failing item reported (FR-013); untouched invalid existing value → warning only (FR-015)
- [X] T029 [P] [US2] Write `tests/regex.test.js` (passes a Node `worker_threads` `createWorker` to `testPattern`): FieldDefinition.pattern applied with flag `u`; `(a+)+$` on a long `a…!` value fails with `wizz-error-regex-timeout` within ~200 ms (FR-016, research R6)

### Implementation for User Story 2

- [X] T030 [US2] Implement `src/wizz-validate.js` (pure): `validateField( field, value, opts ) → { errors, warnings }` for data-model.md FieldDefinition.required, FieldDefinition.min, FieldDefinition.max, FieldDefinition.allowed, FieldDefinition.namespaces and FieldDefinition.separator, with type and repeated-ness from data-model.md BucketSchema.fields only (Constitution III), until T028 passes
- [X] T031 [US2] Implement `src/wizz-regex-worker.js` (worker source) and a `testPattern( pattern, value, { source, createWorker? } )` runner in `src/wizz-validate.js` that starts the Worker from a Blob URL, terminates and recreates it after 200 ms, and uses the fallback of research R6 when `Worker` cannot start; `testPattern` takes a `createWorker( source )` function so tests can pass a Node `worker_threads` version, the browser default uses a Blob URL; until T029 passes
- [X] T032 [US2] Add FieldDefinition.mustExist check to `src/wizz-save.js`: one batched `action=query&titles=` before save (contracts/api-calls.md request 4), missing titles become field errors
- [X] T033 [US2] Wire validation in `src/wizz-App.vue` and `src/wizz-Field.vue`: validate dirty fields on input and blur, show `CdxField` status `error`/`warning` with message tied to the field, block save and send nothing while any error remains (FR-009, FR-014); keep typed values
- [X] T034 [US2] Add messages `wizz-error-*` and `wizz-warning-invalid-existing` to `src/i18n/en.json`, `vi.json`, `qqq.json`

**Checkpoint**: SC-002 suite green; US1 and US2 work together

---

## Phase 5: User Story 3 - Quản trị viên định nghĩa form cho một template (Priority: P1)

**Goal**: JSON definition on a protected `Module:<Name>/wizz.json` page, checked on load and on view, with field mapping and a preview

**Independent Test**: one valid protected definition opens the form; an invalid one lists errors; an unprotected one is refused; viewing the definition page shows the check and a preview button (quickstart scenarios 6–8)

### Tests for User Story 3

- [X] T035 [P] [US3] Write `tests/definition.test.js`: structure per contracts/form-definition.schema.json; data-model.md FormDefinition.bucket missing schema → error; FormDefinition.fields empty or duplicate `field`/`param` → error; FieldDefinition.field not in schema → error with JSON path; FieldDefinition.param defaults to `field` and override mapping works (FR-018); FieldDefinition.label defaults to `param`; FieldDefinition.pattern must compile with `u` and be ≤ 500 chars; rules not fitting the type (e.g. `pattern` on INTEGER, FieldDefinition.category / FieldDefinition.mustExist on non-PAGE, FieldDefinition.booleanValues on non-BOOLEAN) → warning and ignored; field removed from schema → `state: removed`, read-only

### Implementation for User Story 3

- [X] T036 [US3] Implement `src/wizz-definition.js` (pure): `checkDefinition( json, schema ) → { definition, errors, warnings }` checking data-model.md FormDefinition.bucket and FormDefinition.fields, and FieldDefinition.field, FieldDefinition.param, FieldDefinition.label, FieldDefinition.pattern, FieldDefinition.separator and the type fit of every other FieldDefinition rule, with the defaults given there, until T035 passes
- [X] T037 [US3] Use `checkDefinition` in `src/wizz-form.js`: any error → refuse with `wizz-definition-invalid` and the full list for every user (FR-019); untrusted → `wizz-definition-untrusted` (FR-028); fields whose derived data-model.md FieldDefinition `state` is `removed` rendered read-only with warning in `src/wizz-Field.vue`; derived `type` and `repeated` come from the schema, never from the definition
- [X] T038 [US3] Add definition-page mode to `src/wizz.js`: on view of `Module:*/wizz.json` load the `wizz-form` gadget and show the check result plus a "Preview form" button that opens the form with empty values and no save button (FR-029)
- [X] T039 [US3] Add messages `wizz-definition-*` and `wizz-ui-preview-form` to `src/i18n/en.json`, `vi.json`, `qqq.json`

**Checkpoint**: MVP (US1–US3) complete

---

## Phase 6: User Story 4 - Xem trước, xem diff và xử lý xung đột (Priority: P2)

**Goal**: preview and diff before saving; conflicts, CAPTCHA and AbuseFilter handled like a normal edit

**Independent Test**: preview shows infobox and diff; two sessions produce a conflict that keeps typed values; protection/AbuseFilter/CAPTCHA behave as for wikitext (quickstart scenarios 9–11)

### Tests for User Story 4

- [X] T040 [P] [US4] Extend `tests/save.test.js`: `editconflict` → `conflict`; `edit.captcha` → `captcha` then resend with `captchaid`/`captchaword`; `abusefilter-warning` → `warning` then resend; other errors → `error` with API message (contracts/api-calls.md request 6 table)

### Implementation for User Story 4

- [X] T041 [US4] Add `preview( api, state, callText, newText )` to `src/wizz-save.js`: parallel `action=parse` (edited call only) and `action=compare` (contracts/api-calls.md request 5)
- [X] T042 [US4] Implement result handling of T040 in `src/wizz-save.js`
- [X] T043 [US4] Add preview step to `src/wizz-App.vue`: show parsed infobox and diff (core HTML via `v-html`, the only allowed use) before confirming save
- [X] T044 [US4] Handle `conflict` in `src/wizz-form.js`: reload page, rebuild state on the new revision, re-apply dirty values, tell the user (FR-006)
- [X] T045 [US4] Add CAPTCHA (`CdxTextInput` plus image or question) and AbuseFilter warning confirmation to `src/wizz-App.vue`; add messages to `src/i18n/*.json`

**Checkpoint**: safe for real wikis

---

## Phase 7: User Story 5 - Chọn instance (Priority: P2)

**Goal**: pick one of several calls of the same template

**Independent Test**: on a page with two calls, choose the second, edit, save; only the second changes (quickstart scenario 12)

- [X] T046 [P] [US5] Add tests to `tests/editor.test.js` and `tests/tokenizer.test.js`: per-template `index`, instance summary from the first two mapped field values (data-model.md TemplateCall.summary), editing instance 1 leaves instance 0 untouched
- [X] T047 [US5] Add data-model.md FormState.instances (each with TemplateCall.summary) and FormState.instance to the state in `src/wizz-form.js`; recount TemplateCall.index after `matchesTemplate` so calls through redirects share one counter; honour the `wizzinstance=<n>` URL parameter; with only one call, open it directly
- [X] T048 [US5] Add instance picker (`CdxRadio` list) to `src/wizz-App.vue`; add messages to `src/i18n/*.json`

---

## Phase 8: User Story 6 - Lối vào và điện thoại (Priority: P3)

**Goal**: tab entry point, PAGE suggestions, good on Minerva and in dark mode

**Independent Test**: tab appears only when enabled and the page has a form-backed infobox; form usable on Minerva, Citizen, Vector 2022, dark, RTL (quickstart scenario 13)

- [X] T049 [US6] Add the tab to `src/wizz.js`: when `editTab` is true, request `prop=templates` plus the existence part of contracts/api-calls.md request 2, then `mw.util.addPortletLink` (`p-views`; Minerva `page-actions-overflow`) with `tabLabel` from `wizz-config.json`, linking to `?wizz=1` (FR-023)
- [X] T050 [US6] Replace the PAGE input in `src/wizz-Field.vue` with `CdxLookup` backed by `list=prefixsearch` limited by FieldDefinition.namespaces and filtered by FieldDefinition.category (data-model.md; contracts/api-calls.md request 4; FR-021)
- [X] T051 [US6] Mobile and theme pass on `src/wizz.less` and `src/wizz-App.vue`: one column, sticky save bar on Minerva, check dark mode on Citizen and Vector 2022, `uselang=ar` (FR-024, SC-003)

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T052 [P] Write `README.md`: supported MediaWiki versions (research R13), install steps (enable Gadgets, Bucket, Scribunto; then one of the three routes of research R12: copy a release's `dist/` pages, Litmus `gadget-deploy`, or jsDelivr mode with `cdn: true`; set the gadget default; create tag `wizz`), definition reference (`Module:<Name>/wizz.json`, contracts/form-definition.schema.json with examples), scope limit of Constitution III and a recommended Lua validation pattern for templates that reads the same definition with `mw.loadJsonData`
- [ ] T053 [P] Add `CHANGELOG.md` with the first release entry
- [ ] T054 Accessibility review of `src/wizz-App.vue` and `src/wizz-Field.vue`: labels, keyboard order, errors announced (`aria-live` via `CdxField`), contrast
- [ ] T055 Run quickstart.md scenarios 1–14 on the Docker test wiki (T007, deployed with `deploy.js`) with `MW_VERSION=1.43`, `1.45` and `1.46`, also once in jsDelivr mode (`cdn: true`) against a pushed tag, and record results in `specs/001-initialization/checklists/quickstart-run.md`
- [ ] T056 Verify the **verify** items of research.md (CSP `blob:` workers and `cdn.jsdelivr.net`, ConfirmEdit payload, Citizen tokens; jsDelivr mode loads the form) on Miraheze and WikiOasis test wikis; update research.md R6/R8/R10 and code if needed
- [ ] T057 Run the SC-005 user test (5 newcomers on phones) and record the outcome in `specs/001-initialization/checklists/sc-005.md`
- [ ] T060 Create `.github/workflows/release.yml` (`workflow_dispatch` with input `version`, minimal `permissions`, no third-party actions beyond checkout/setup-node): `npm ci`, `npm test`, `npm run build`, commit `dist/` (forced past `.gitignore`) on a detached commit on top of `main`, tag `v<version>`, push the tag, create the GitHub Release with every `dist/` file, then call Litmus `POST /c2c/api/gadget-releases` as in Litmus `docs/examples/gadget-release.yml` (`curl` + `jq`, secrets `LITMUS_CLIENT_ID`/`LITMUS_CLIENT_SECRET` via env, tag via env) (research R12)
- [ ] T058 Release `v0.1.0` with the CHANGELOG entry by running the T060 workflow (Constitution VIII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: after Setup; blocks all stories; T009 (`fetch-parsetree`) needs the test wiki from T007; T059 before T017's deploy is tried on the wiki
- **US1 (Phase 3)**: after Foundational
- **US2 (Phase 4)**: after Foundational; T033 edits `wizz-App.vue`/`wizz-Field.vue` from US1
- **US3 (Phase 5)**: after Foundational; T037 edits `wizz-form.js` from US1
- **US4 (Phase 6)**: after US1
- **US5 (Phase 7)**: after US1
- **US6 (Phase 8)**: T049 after Foundational; T050–T051 after US1 UI exists
- **Polish (Phase 9)**: after the desired stories

### Within Each Story

Tests first (must fail) → pure modules → API calls → Vue components → messages.

### Parallel Opportunities

- Setup: T002–T006 in parallel after T001
- Foundational: T009, T010, T011, T015 in parallel; T012 and T013 can proceed in parallel once their tests exist
- US1: T018, T019, T020, T026 in parallel
- US2: T028, T029 in parallel
- After US1: US2, US3, US4, US5 can proceed in parallel, coordinating on `wizz-App.vue` and `wizz-form.js`

---

## Parallel Example: Phase 2

```bash
Task: "Write tests/tokenizer.test.js"
Task: "Write tests/editor.test.js"
Task: "Write tests/load.test.js"
Task: "Create build/fetch-parsetree.js"
```

## Parallel Example: User Story 2

```bash
Task: "Write tests/validate.test.js"
Task: "Write tests/regex.test.js"
```

---

## Implementation Strategy

### MVP (US1 + US2 + US3, all P1)

1. Phase 1 → Phase 2 (tokenizer and editor proven on the corpus)
2. US1 → quickstart scenarios 1–2
3. US2 → scenarios 3–5 (SC-002)
4. US3 → scenarios 6–8
5. **STOP and VALIDATE** on the Docker test wiki; not on farm wikis before US4 (conflicts and
   CAPTCHA are needed for real use, spec US4 rationale)

### Incremental Delivery

US4 → US5 → US6 → Polish → first tagged release `v0.1.0` (T058). Real wikis get only tagged
releases; later changes ship as tagged versions (Constitution VIII). Before T058, builds run
only on the local test wiki.
