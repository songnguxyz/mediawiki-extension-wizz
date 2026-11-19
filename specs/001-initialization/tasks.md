---

description: "Task list for Wizz — infobox form editing (001-initialization)"
---

# Tasks: Wizz — Form sửa infobox gắn với Bucket

**Input**: Design documents from `/specs/001-initialization/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. Constitution Principle II requires test-first for the tokenizer/serializer
and validation, and SC-001/SC-002 are measured by test suites. Within each phase, write the
test tasks first and confirm they fail before implementing.

**Organization**: Tasks are grouped by user story. US1–US3 are all P1 and together form the
MVP; US4–US6 are later increments.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story from spec.md (US1–US6)
- Paths are relative to the repository root (standard MediaWiki extension layout, see plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extension skeleton, tooling and CI

- [ ] T001 Create `extension.json`: name `Wizz`, license `GPL-2.0-or-later`, `requires` MediaWiki `>= 1.45.0` and extensions `Bucket`, `Scribunto`; `AutoloadNamespaces` `MediaWiki\\Extension\\Wizz\\` → `src/`; `ServiceWiringFiles` `src/ServiceWiring.php`; `MessagesDirs` (`i18n`, `i18n/api`); `ExtensionMessagesFiles` for `Wizz.alias.php` and `Wizz.namespaces.php`; `namespaces` `Wizz` (9620, `defaultcontentmodel` `json`, `protection` `wizz-editdefinition`) and `Wizz_talk` (9621); `AvailableRights` and `GroupPermissions` for `wizz-edit` (`user`) and `wizz-editdefinition` (`sysop`, `interface-admin`); `config` `WizzNamespaces` `[0]`, `WizzEditTab` `false`, `WizzChangeTag` `true` (per contracts/wiki-interface.md)
- [ ] T002 [P] Create `composer.json` with dev dependencies `mediawiki/mediawiki-codesniffer`, `mediawiki/mediawiki-phan-config`, `php-parallel-lint/php-parallel-lint`, `mediawiki/minus-x` and scripts `test` (parallel-lint, phpcs, minus-x) and `fix`; add `.phpcs.xml`
- [ ] T003 [P] Create `package.json`, `Gruntfile.js`, `.eslintrc.json`, `.stylelintrc.json` using `eslint-config-wikimedia`, `stylelint-config-wikimedia`, `grunt-banana-checker`; `npm test` runs all three
- [ ] T004 [P] Create `.phan/config.php` from `mediawiki-phan-config` with Bucket/Scribunto not required for analysis
- [ ] T005 [P] Create `i18n/en.json`, `i18n/vi.json`, `i18n/qqq.json`, `i18n/api/en.json`, `i18n/api/vi.json`, `i18n/api/qqq.json` with `@metadata` and the `right-wizz-*`, `action-wizz-*` rights messages and the `editinfobox` special page title
- [ ] T006 [P] Create `Wizz.alias.php` (`EditInfobox` en, `SửaInfobox` vi) and `Wizz.namespaces.php` (`Wizz`, `Wizz_talk`, with vi aliases)
- [ ] T007 [P] Create `.github/workflows/ci.yml`: job 1 `composer test` + `npm test`; job 2 installs MediaWiki 1.45 and 1.46 with MariaDB, Scribunto and Bucket (REL1_45), loads Wizz and runs `tests/phpunit/unit` and `tests/phpunit/integration`
- [ ] T008 [P] Replace `README.md` with summary, requirements (MW ≥ 1.45, Bucket, Scribunto), install steps (`wfLoadExtension`), configuration table and link to the spec

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tokenizer, Bucket schema reading, definition loading and template matching — used
by every story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests (write first, must fail)

- [ ] T009 [P] Create round-trip fixture corpus `tests/phpunit/data/roundtrip/*.wikitext` (≥ 20 files, self-made data): inline and one-per-line calls, comments, `<ref>`/`<nowiki>`/`<pre>`, nested templates, `{{{param}}}`, piped links, positional params, duplicate params, CRLF, trailing spaces, Unicode names, two calls of the same template, plus `malformed/*.wikitext` (missing `}}`, unclosed tag)
- [ ] T010 [P] Write `tests/phpunit/unit/Wikitext/TemplateTokenizerTest.php`: for every fixture, offsets of each call and each `TemplateParam.nameSpan`/`valueSpan` reproduce the source exactly (data-model.md `TemplateCall.start`, `TemplateCall.end`, `TemplateParam.nameSpan`, `TemplateParam.valueSpan`, `TemplateParam.rawValue`); `TemplateParam.value` is trimmed; duplicate params keep last-wins semantics (data-model.md `TemplateParam.name`); malformed fixtures throw `TemplateParseError` with offset
- [ ] T011 [P] Write `tests/phpunit/unit/Bucket/BucketSchemaLookupTest.php`: parses Bucket page JSON with defaults `index=true`, `repeated=false`; returns null for missing page or invalid JSON (data-model.md `BucketSchema.fields`)
- [ ] T012 [P] Write `tests/phpunit/unit/Definition/DefinitionParserTest.php`: structural parsing against contracts/form-definition.schema.json, defaults for `FieldDefinition.param`, `FieldDefinition.label`, `FieldDefinition.namespaces`, `FieldDefinition.separator`, `FieldDefinition.booleanValues`; rejects duplicate `FieldDefinition.field`/`FieldDefinition.param` and missing `FormDefinition.bucket`/empty `FormDefinition.fields` (data-model.md)
- [ ] T013 [P] Write `tests/phpunit/integration/Edit/TemplateMatcherTest.php`: matches first-letter case, `_`/space, `Template:` prefix and localised alias, redirects to the template; never matches `#`, `subst:`, `safesubst:`, `:` names (data-model.md `TemplateCall.nameText`)
- [ ] T014 [P] Write `tests/phpunit/integration/Wikitext/PreprocessorParityTest.php`: for every round-trip fixture, the calls and parameter boundaries found by `TemplateTokenizer` equal those in core `Parser::preprocessToDom()` (research.md R3)

### Implementation

- [ ] T015 [P] Create value objects `src/Wikitext/TemplateParam.php`, `src/Wikitext/TemplateCall.php`, `src/Wikitext/TemplateParseError.php` (data-model.md `TemplateCall.*`, `TemplateParam.*`)
- [ ] T016 Implement `src/Wikitext/TemplateTokenizer.php` (comments, nowiki/pre/extension tags, nested `{{ }}`, `{{{ }}}`, `[[ ]]`, byte offsets, linear time) until T010 and T014 pass
- [ ] T017 [P] Implement `src/Bucket/BucketSchema.php` and `src/Bucket/BucketSchemaLookup.php` reading `Bucket:<name>` via `RevisionLookup` (research.md R1) until T011 passes
- [ ] T018 [P] Implement `src/Definition/FieldDefinition.php`, `src/Definition/FormDefinition.php`, `src/Definition/DefinitionParser.php` with defaults from data-model.md `FieldDefinition.*` until T012 passes
- [ ] T019 Implement `src/Definition/DefinitionLookup.php`: load and parse `Wizz:<Template>` for a template title; derive `FieldDefinition.type`/`FieldDefinition.repeated`/`FieldDefinition.state` from `BucketSchemaLookup` (data-model.md)
- [ ] T020 Implement `src/Edit/TemplateMatcher.php` (title normalisation + `RedirectLookup`) until T013 passes
- [ ] T021 Register all services and a `Wizz` PSR-3 logger in `src/ServiceWiring.php`

**Checkpoint**: Tokenizer proven on the corpus; definitions and schemas load

---

## Phase 3: User Story 1 - Biên tập viên sửa infobox qua form (Priority: P1) 🎯 MVP

**Goal**: Open a form for a page with one infobox, see current values, change some, save; only
changed parameters change; no-op saves create no revision; summary + `wizz` tag

**Independent Test**: With a definition and a page, open `Special:EditInfobox/<Page>`, change
one field, save, inspect the diff (quickstart.md scenarios 1–2)

### Tests (write first, must fail)

- [ ] T022 [P] [US1] Write `tests/phpunit/unit/Wikitext/TemplateEditorTest.php` against `tests/phpunit/data/roundtrip/` expected-edit files: no changes → byte-identical; one change → only that value span differs, surrounding whitespace kept; new param appended in the last param's layout; cleared field keeps `|a=`; unmapped and positional params untouched (research.md R11)
- [ ] T023 [P] [US1] Write `tests/phpunit/integration/Api/ApiWizzLoadTest.php`: returns `FormState` fields with current values (data-model.md `FormState.fields`), `revid`, `timestamp`; errors `wizz-noinfobox`, `wizz-parseerror` (with `offset`/`line`), `wizz-namespace-disabled`, permission denied without `wizz-edit`
- [ ] T024 [P] [US1] Write `tests/phpunit/integration/Api/ApiWizzSaveTest.php`: `success` diff touches only changed params; `nochange` creates no revision; summary lists changed params; tag `wizz` applied when `$wgWizzChangeTag` true and absent when false; requires CSRF token

### Implementation

- [ ] T025 [US1] Implement `src/Wikitext/TemplateEditor.php` (apply changed values to a `TemplateCall`, repeated values joined with `FieldDefinition.separator` per research.md R11, BOOLEAN written with `FieldDefinition.booleanValues`) until T022 passes
- [ ] T026 [P] [US1] Implement `src/Edit/SummaryBuilder.php` using message `wizz-summary` in content language (contracts/action-api.md)
- [ ] T027 [P] [US1] Implement `src/Edit/EditSaver.php`: internal `ApiMain` + `DerivativeRequest` `action=edit` as the user with `text`, `baserevid`, `basetimestamp`, `starttimestamp`, `summary`, `nocreate=1`; map result to `EditResult.status` (data-model.md `EditResult.status`)
- [ ] T028 [P] [US1] Implement `src/Hooks/ChangeTagHooks.php` (`ListDefinedTags`, `ChangeTagsListActive` gated by `WizzChangeTag`) and add tag after save via `ChangeTagsStore::addTags()` in `EditSaver` (research.md R5); register hooks in `extension.json`; add `tag-wizz` and `tag-wizz-description` messages
- [ ] T029 [US1] Implement `src/Edit/InfoboxEditor.php` `load()` (namespace check against `WizzNamespaces`, tokenizer + matcher, first matching call, `FormState`) and `save()` (reload latest, apply `TemplateEditor`, byte-compare for `nochange`, `EditSaver`) per data-model.md `EditRequest` processing order (conflict and validation branches added in US4/US2)
- [ ] T030 [US1] Implement `src/Api/ApiWizzLoad.php` and `src/Api/ApiWizzSave.php` (`mustBePosted`, `needsToken` `csrf`, rights `edit` + `wizz-edit`) per contracts/action-api.md; register in `extension.json` `APIModules`; add `i18n/api/*` help messages until T023–T024 pass
- [ ] T031 [US1] Implement `src/Special/SpecialEditInfobox.php`: requires `wizz-edit`; renders `<noscript>`/no-JS notice `wizz-nojs` with edit link, server-side notices for `wizz-noinfobox`/`wizz-parseerror` with edit link, and a mount point + module `ext.wizz.form`; register `SpecialPages` in `extension.json`
- [ ] T032 [US1] Create Vue 3 + Codex app `modules/ext.wizz.form/init.js`, `modules/ext.wizz.form/App.vue`, `modules/ext.wizz.form/api.js` (wizzload/wizzsave via `mw.Api`), `modules/ext.wizz.form/FieldInput.vue` (TEXT → CdxTextInput/CdxTextArea for multi-line or wikitext values, INTEGER/DOUBLE → CdxTextInput `inputmode`, BOOLEAN → CdxCheckbox, PAGE → CdxTextInput, repeated → list of inputs); send only changed fields; register `ResourceModules` `ext.wizz.form` with `class` `MediaWiki\\ResourceLoader\\CodexModule` and `codexComponents` in `extension.json`
- [ ] T033 [US1] Add all US1 UI/notice messages (`wizz-ui-*`, `wizz-nojs`, `wizz-noinfobox`, `wizz-parseerror`, `wizz-summary`) to `i18n/en.json`, `i18n/vi.json`, `i18n/qqq.json`

**Checkpoint**: Editing and saving through the form works end-to-end for single-instance pages

---

## Phase 4: User Story 2 - Dữ liệu sai không vào được Bucket (Priority: P1)

**Goal**: Server-side validation of every rule; client-side early feedback; invalid existing
values shown with warning and only validated when edited

**Independent Test**: Submit each invalid value via the form and directly via the API; no
revision is created and the right field is flagged (quickstart.md scenarios 3–5)

### Tests (write first, must fail)

- [ ] T034 [P] [US2] Write `tests/phpunit/unit/Validation/FieldValidatorTest.php` covering data-model.md `FieldDefinition.required`, `FieldDefinition.min`, `FieldDefinition.max`, `FieldDefinition.pattern`, `FieldDefinition.allowed`, `FieldDefinition.namespaces`, `FieldDefinition.mustExist`, `FieldDefinition.separator`, `FieldDefinition.booleanValues` and `BucketSchema.fields` types (INTEGER/DOUBLE reject text, wikitext and `~150`); repeated values validated per item with the failing item identified
- [ ] T035 [P] [US2] Write `tests/phpunit/unit/Validation/SafeRegexTest.php`: catastrophic pattern `(a+)+$` on a long input fails fast with `wizz-error-regex-limit`; settings restored afterwards (research.md R9)
- [ ] T036 [P] [US2] Extend `tests/phpunit/integration/Api/ApiWizzSaveTest.php`: invalid values via raw API → `invalid` with per-field errors and no revision; unchanged invalid existing value does not block saving another field (data-model.md `FormState.fields` warnings)
- [ ] T037 [P] [US2] Write `tests/qunit/ext.wizz.form/validation.test.js` for client rules mirroring T034 (except `mustExist`)

### Implementation

- [ ] T038 [P] [US2] Implement `src/Validation/ValidationError.php` and `src/Validation/SafeRegex.php` (`/…/u`, lowered `pcre.backtrack_limit`, JIT off, `preg_last_error()` check, `Wizz` log warning) until T035 passes
- [ ] T039 [US2] Implement `src/Validation/FieldValidator.php` for all rules in data-model.md `FieldDefinition.*` by type, PAGE checks via `TitleParser` + `PageStore` until T034 passes
- [ ] T040 [US2] Wire validation into `src/Edit/InfoboxEditor.php`: validate only fields whose submitted value differs from the current one; return `invalid`; add `warnings` for invalid existing values in `load()` until T036 passes
- [ ] T041 [US2] Implement `modules/ext.wizz.form/validation.js` and show errors/warnings with CdxField `status`/messages bound to each input in `modules/ext.wizz.form/FieldInput.vue` until T037 passes; register QUnit module in `extension.json` `QUnitTestModule`
- [ ] T042 [US2] Implement PAGE suggestions (FR-021) in `modules/ext.wizz.form/PageLookup.vue` with CdxLookup over `generator=prefixsearch` + `gpsnamespace` from `FieldDefinition.namespaces` and optional `FieldDefinition.category` filter via `prop=categories` (research.md R8)
- [ ] T043 [US2] Add `wizz-error-*` and `wizz-warning-*` messages to `i18n/en.json`, `i18n/vi.json`, `i18n/qqq.json`

**Checkpoint**: SC-002 suite passes; no invalid value can be saved through Wizz

---

## Phase 5: User Story 3 - Quản trị viên định nghĩa form cho một template (Priority: P1)

**Goal**: Admins create `Wizz:<Template>` pages; invalid definitions are rejected on save; only
authorised users can edit them; schema drift handled at load time

**Independent Test**: Save a valid and several invalid definitions, and try as a normal user
(quickstart.md scenario 6)

### Tests (write first, must fail)

- [ ] T044 [P] [US3] Write `tests/phpunit/integration/Hooks/DefinitionValidationHooksTest.php`: valid definition saves; rejected with precise JSON-path message for bad JSON structure, missing bucket (data-model.md `FormDefinition.bucket`), unknown field (data-model.md `FieldDefinition.field`), rule not allowed for the field's type (data-model.md `FieldDefinition.min`, `FieldDefinition.max`, `FieldDefinition.pattern`, `FieldDefinition.allowed`, `FieldDefinition.namespaces`, `FieldDefinition.mustExist`, `FieldDefinition.category`, `FieldDefinition.booleanValues`), non-compiling or > 500-char `FieldDefinition.pattern`, `FieldDefinition.separator` on a non-repeated field; non-`Wizz` JSON pages unaffected
- [ ] T045 [P] [US3] Write `tests/phpunit/integration/Definition/DefinitionPermissionTest.php`: user without `wizz-editdefinition` cannot edit `Wizz:` pages; sysop and interface-admin can
- [ ] T046 [P] [US3] Write `tests/phpunit/integration/Definition/SchemaDriftTest.php`: field removed from bucket → `FieldDefinition.state` `removed`, read-only, value preserved on save; type changed → validated by new type, incompatible rules ignored with warning (data-model.md `FieldDefinition.state`)

### Implementation

- [ ] T047 [US3] Implement `src/Definition/DefinitionValidator.php` (cross-checks with `BucketSchemaLookup`, regex compile check via `SafeRegex`) until T044 passes
- [ ] T048 [US3] Implement `src/Hooks/DefinitionValidationHooks.php` on `JsonValidateSave` for namespace `Wizz` only; register in `extension.json`
- [ ] T049 [US3] Verify namespace protection and rights config in `extension.json` until T045 passes
- [ ] T050 [US3] Implement schema-drift handling in `src/Definition/DefinitionLookup.php` and read-only rendering of `removed` fields in `modules/ext.wizz.form/FieldInput.vue` until T046 passes
- [ ] T051 [US3] Add definition error messages (`wizz-def-error-*`) to `i18n/en.json`, `i18n/vi.json`, `i18n/qqq.json`

**Checkpoint**: MVP complete (US1 + US2 + US3)

---

## Phase 6: User Story 4 - Xem trước, xem diff và xử lý xung đột (Priority: P2)

**Goal**: Preview rendered infobox and wikitext diff; detect edit conflicts and rebase keeping
typed values; CAPTCHA/AbuseFilter/protection behave like normal edits

**Independent Test**: Preview in one session; save from two sessions to trigger a conflict;
enable ConfirmEdit/AbuseFilter/protection (quickstart.md scenarios 7–9)

### Tests (write first, must fail)

- [ ] T052 [P] [US4] Write `tests/phpunit/integration/Api/ApiWizzPreviewTest.php`: returns `html` and `diff` for valid changes, `invalid` for bad values, `nochange` when identical; creates no revision and no Bucket rows
- [ ] T053 [P] [US4] Extend `tests/phpunit/integration/Api/ApiWizzSaveTest.php`: stale `baserevid` → `conflict` with fresh payload; protected page / blocked user → `error`; ConfirmEdit and AbuseFilter cases (marked skipped when those extensions are not loaded) → `captcha` / `error`

### Implementation

- [ ] T054 [US4] Add `preview()` to `src/Edit/InfoboxEditor.php`: render only the edited call with `ContentRenderer` in preview mode and full-page diff via `SlotDiffRenderer` (research.md R4)
- [ ] T055 [US4] Implement `src/Api/ApiWizzPreview.php` (POST) per contracts/action-api.md; register in `extension.json` until T052 passes
- [ ] T056 [US4] Add conflict branch (latest ≠ `EditRequest.baserevid` → `conflict` with fresh `FormState`) to `src/Edit/InfoboxEditor.php` and CAPTCHA/error mapping (`captchaid`, `captchaword`, `edit.captcha`) to `src/Edit/EditSaver.php` until T053 passes (data-model.md `EditRequest`, `EditResult.status`)
- [ ] T057 [US4] Add preview panel and diff view (`modules/ext.wizz.form/PreviewPanel.vue`), conflict rebase keeping user-changed values, CAPTCHA prompt and core error display to `modules/ext.wizz.form/App.vue`
- [ ] T058 [US4] Add preview/conflict/captcha messages to `i18n/en.json`, `i18n/vi.json`, `i18n/qqq.json`

**Checkpoint**: Safe save flow complete

---

## Phase 7: User Story 5 - Chọn instance khi trang gọi template nhiều lần (Priority: P2)

**Goal**: Pages with several calls of the form's template show a picker; only the chosen call
changes

**Independent Test**: Page with two calls; edit the second; only it changes (quickstart.md
scenario 10)

### Tests (write first, must fail)

- [ ] T059 [P] [US5] Extend `tests/phpunit/integration/Api/ApiWizzLoadTest.php` and `tests/phpunit/integration/Api/ApiWizzSaveTest.php`: multiple calls → `instances` with `TemplateCall.summary` and no `fields` until `instance` given; `wizz-badinstance` for out-of-range; saving instance 1 leaves instance 0 byte-identical; single call opens directly (data-model.md `TemplateCall.index`, `TemplateCall.summary`)

### Implementation

- [ ] T060 [US5] Add instance listing/selection (`TemplateCall.index`, `TemplateCall.summary` from the first two mapped fields) to `src/Edit/InfoboxEditor.php` and `instance` param handling to `src/Api/ApiWizzLoad.php`, `src/Api/ApiWizzPreview.php`, `src/Api/ApiWizzSave.php` until T059 passes
- [ ] T061 [US5] Add instance picker (`modules/ext.wizz.form/InstancePicker.vue`, CdxRadio list) and `?instance=` support in `src/Special/SpecialEditInfobox.php`
- [ ] T062 [US5] Add picker messages to `i18n/en.json`, `i18n/vi.json`, `i18n/qqq.json`

**Checkpoint**: Multi-instance pages are safe to edit

---

## Phase 8: User Story 6 - Mở form từ nhiều lối vào, trên cả điện thoại (Priority: P3)

**Goal**: Optional "Sửa infobox" tab; form comfortable on Minerva, Citizen, Vector 2022, light
and dark, LTR and RTL

**Independent Test**: Toggle `$wgWizzEditTab`; check every skin/mode (quickstart.md scenario 11)

### Tests (write first, must fail)

- [ ] T063 [P] [US6] Write `tests/phpunit/integration/Hooks/EntryPointHooksTest.php`: tab shown only when `WizzEditTab` is true, the page is in `WizzNamespaces`, uses a template that has a `Wizz:` definition (via templatelinks, incl. redirects) and the user can edit; hidden otherwise

### Implementation

- [ ] T064 [US6] Implement `src/Hooks/EntryPointHooks.php` on `SkinTemplateNavigation::Universal` (list of templates with definitions cached in WANObjectCache, purged on `Wizz:` page save) and register in `extension.json` until T063 passes
- [ ] T065 [US6] Create `modules/ext.wizz.form/styles.less` using only Codex tokens from `mediawiki.skin.variables.less`: one column under the mobile breakpoint, sticky save bar, logical properties for RTL
- [ ] T066 [US6] Manually verify quickstart.md scenario 11 on Minerva, Citizen, Vector 2022 in light/dark and with `uselang=ar`; record results and screenshots in `specs/001-initialization/checklists/ui-verification.md`

**Checkpoint**: All user stories complete

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T067 [P] Write `tests/phpunit/integration/PerformanceTest.php`: tokenizer + load on a 2 MB page stays within default memory; `wizzload` on a 200 KB page adds < 300 ms (plan.md Performance Goals)
- [ ] T068 [P] Security review against Constitution VIII: CSRF on `wizzpreview`/`wizzsave`, message escaping at output, no HTML modification after sanitising, only the latest visible revision is read (deleted/suppressed content never exposed) — record findings in `specs/001-initialization/checklists/security.md`
- [ ] T069 [P] Run `banana-checker` and ensure every `i18n/en.json` key has `i18n/qqq.json` documentation; complete `i18n/vi.json`
- [ ] T070 [P] Draft mediawiki.org pages `docs/mediawiki.org/Extension-Wizz.wiki` and `docs/mediawiki.org/Help-Extension-Wizz.wiki` (dependencies, configuration from most-used, compatibility policy, rights, comparison with Page Forms, uninstall notes)
- [ ] T071 Run full quickstart.md validation (scenarios 1–12) on MW 1.45 and 1.46 and fix regressions, adding a round-trip fixture for any wikitext bug found (SC-004)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: after Setup — blocks all stories
- **US1 (Phase 3)**: after Foundational
- **US2 (Phase 4)**: after Foundational; its wiring task T040 edits `InfoboxEditor` from US1 (T029)
- **US3 (Phase 5)**: after Foundational; T050 touches `FieldInput.vue` from US1 (T032)
- **US4 (Phase 6)**: after US1 (extends `InfoboxEditor`, `EditSaver`, `App.vue`)
- **US5 (Phase 7)**: after US1; benefits from US4's preview module (T055) for the `instance` param
- **US6 (Phase 8)**: T063–T064 after Foundational; T065–T066 after US1 UI exists
- **Polish (Phase 9)**: after all desired stories

### Within Each Story

Tests first (must fail) → value objects/services → API/special page → UI → messages.

### Parallel Opportunities

- Setup: T002–T008 in parallel after T001
- Foundational tests T009–T014 in parallel; then T015, T017, T018 in parallel
- US1: T022–T024 in parallel; T026–T028 in parallel
- US2: T034–T037 in parallel; US3 tests T044–T046 in parallel
- After US1: US2, US3, US4, US5 and US6 (T063–T064) can proceed in parallel by different people, coordinating on `InfoboxEditor.php` and `App.vue`

---

## Parallel Example: Phase 2

```bash
Task: "Create round-trip fixture corpus in tests/phpunit/data/roundtrip/"
Task: "Write tests/phpunit/unit/Bucket/BucketSchemaLookupTest.php"
Task: "Write tests/phpunit/unit/Definition/DefinitionParserTest.php"
Task: "Write tests/phpunit/integration/Edit/TemplateMatcherTest.php"
```

## Parallel Example: User Story 1

```bash
Task: "Implement src/Edit/SummaryBuilder.php"
Task: "Implement src/Edit/EditSaver.php"
Task: "Implement src/Hooks/ChangeTagHooks.php"
```

---

## Implementation Strategy

### MVP (US1 + US2 + US3, all P1)

1. Phase 1 Setup → Phase 2 Foundational (tokenizer proven on the corpus)
2. US1 → validate scenarios 1–2 on the test wiki
3. US2 → validate scenarios 3–5 (SC-002)
4. US3 → validate scenario 6
5. **STOP and VALIDATE**: MVP may go to the Cloud VPS test wiki; not to farms before US4
   (conflict handling and CAPTCHA are required before real-wiki use, spec US4 rationale)

### Incremental Delivery

US4 (safe save) → US5 (multi-instance) → US6 (tab, mobile polish) → Polish → farm submission.

---

## Notes

- Out-of-repo follow-ups (not tasks here): register namespace IDs 9620/9621 on mediawiki.org,
  create the Phabricator project, register with translatewiki.net, announce new rights to target
  communities (Constitution VIII).
- Commit after each task or logical group; never remove a round-trip fixture to make tests pass.
