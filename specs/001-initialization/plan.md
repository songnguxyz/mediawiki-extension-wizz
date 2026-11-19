# Implementation Plan: Wizz — Form sửa infobox gắn với Bucket

**Branch**: `001-initialization` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-initialization/spec.md`

## Summary

Wizz is a new MediaWiki extension that lets editors change the parameters of an existing
infobox template call through a validated form, without touching the rest of the page. A form
is defined on a JSON page `Wizz:<Template>` that binds the template to a Bucket; field types
come from the Bucket schema page. A small byte-offset tokenizer locates template calls and
rewrites only changed parameter values; all validation runs server-side; saving goes through
core's `action=edit` as the user so protection, AbuseFilter, CAPTCHA and edit-conflict
detection apply. A Vue 3 + Codex app on `Special:EditInfobox` (reachable also from an optional "Edit
infobox" tab) talks to three Action API modules backed by shared DI services.

## Technical Context

**Language/Version**: PHP (minimum required by MediaWiki 1.45), JavaScript ES2017+ (Vue 3 as
shipped by MediaWiki core), LESS.

**Primary Dependencies**: MediaWiki core ≥ 1.45 (Action API, `EditPage` via `action=edit`,
`ContentRenderer`, `SlotDiffRenderer`, `ChangeTagsStore`, `RevisionLookup`, Codex via
`CodexModule`); Bucket (schema pages only, no PHP API); Scribunto (indirect, used by wiki
templates). Dev: mediawiki-codesniffer, phan, parallel-lint, minus-x (Composer);
eslint-config-wikimedia, stylelint-config-wikimedia, banana-checker (npm).

**Storage**: No own tables. Wiki pages only: `Wizz:` namespace (JSON definitions), `Bucket:`
pages (read-only), article wikitext.

**Testing**: PHPUnit (unit + integration, extension.json auto-discovery), round-trip fixture
corpus in `tests/phpunit/data/roundtrip/`, QUnit for client validation/serialisation helpers;
manual cross-skin checks per [quickstart.md](quickstart.md). CI on GitHub Actions against MW
1.45 and 1.46 with MariaDB, Scribunto and Bucket.

**Target Platform**: MediaWiki 1.45+ on Miraheze and WikiOasis (both run 1.46 stable);
skins Minerva (mobile), Citizen, Vector 2022; light and dark mode; LTR and RTL.

**Project Type**: MediaWiki extension (server PHP + ResourceLoader front-end).

**Performance Goals**: `wizzload`/`wizzpreview`/`wizzsave` add < 300 ms server time on top of
core parse/save for pages up to 200 KB of wikitext; tokenizer linear in page size and handles
the 2 MB core page limit without exhausting default PHP memory.

**Constraints**: No DB tables, no external resources, no Bucket PHP API, no Page Forms code or
name collisions; regex work bounded (research R9); all writes CSRF-protected; JS required for
the form (no-JS notice only).

**Scale/Scope**: Fan wikis with up to ~100k pages; forms with up to 60 fields (Bucket max 64
incl. system fields); typical page has 1–5 infobox calls.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How the design complies | Status |
|-----------|-------------------------|--------|
| I. Wikitext preservation | Tokenizer with byte offsets; only changed value spans replaced; byte-identical result → `nochange`; malformed markup → refuse (R3, R11). | Pass |
| II. Regression-proof testing | Test-first tokenizer/serializer/validator; permanent round-trip corpus; integration test against `preprocessToDom`; CI blocks merge. | Pass |
| III. Server-side validation | `FieldValidator` in PHP runs on preview and save; types from Bucket page; regex bounded; only changed fields validated; definitions validated in `JsonValidateSave`. | Pass |
| IV. No privilege bypass | Internal `action=edit` as the user (R2); own rights `wizz-edit`, `wizz-editdefinition`; tab/button default off. | Pass |
| V. Wiki-farm compatibility | No tables, no external assets, Bucket read via core page APIs, `Wizz` namespace declared in ManageWiki, GPL-2.0-or-later, distinct names (`wizz-`, `Wizz`, `EditInfobox`). | Pass (namespace IDs to register) |
| VI. Newcomers, any device | Codex components + tokens; Minerva one-column; dark mode; RTL via CSSJanus; `en`/`vi`/`qqq`; labelled inputs, errors bound to fields. | Pass |
| VII. Simplicity | One app on one special page; three API modules over one service; no custom ContentHandler; no user preferences; no new wikitext syntax. | Pass |
| VIII. Extension best practices | DI services in `ServiceWiring.php`; API parity; `Wizz` log channel; standard layout; CSRF; banana-checker; translatewiki.net; mediawiki.org docs (deferred to release); GitHub exception per constitution. | Pass |

**Post-design re-check (after Phase 1)**: still Pass. Two items carry follow-ups, not
violations: namespace IDs 9620/9621 must be registered (R6), and the new rights must be
announced to target communities before release (Principle VIII).

## Project Structure

### Documentation (this feature)

```text
specs/001-initialization/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── action-api.md
│   ├── wiki-interface.md
│   └── form-definition.schema.json
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
extension.json
Wizz.alias.php
Wizz.namespaces.php
README.md
LICENSE
composer.json
package.json
.phan/config.php
src/
├── ServiceWiring.php
├── Wikitext/            # TemplateTokenizer, TemplateCall, TemplateParam,
│                        # TemplateParseError, TemplateEditor (serializer)
├── Bucket/              # BucketSchemaLookup, BucketSchema
├── Definition/          # FormDefinition, FieldDefinition, DefinitionParser,
│                        # DefinitionLookup
├── Validation/          # FieldValidator, ValidationError, SafeRegex
├── Edit/                # InfoboxEditor (load/preview/save), TemplateMatcher,
│                        # EditSaver (internal action=edit), SummaryBuilder
├── Api/                 # ApiWizzLoad, ApiWizzPreview, ApiWizzSave
├── Special/             # SpecialEditInfobox
└── Hooks/               # DefinitionValidationHooks, ChangeTagHooks, EntryPointHooks
modules/
└── ext.wizz.form/       # Vue 3 + Codex app, field components, client validation
i18n/
├── en.json  vi.json  qqq.json
└── api/  (en.json vi.json qqq.json)
tests/
├── phpunit/
│   ├── unit/            # tokenizer, editor, validator, definition parser
│   ├── integration/     # API modules, save path, preprocessToDom comparison
│   └── data/roundtrip/  # *.wikitext fixtures + expected edits
└── qunit/
```

**Structure Decision**: Standard MediaWiki extension layout (Constitution VIII) with PSR-4
`MediaWiki\Extension\Wizz\` → `src/`. Business logic lives in `Wikitext`, `Bucket`,
`Definition`, `Validation` and `Edit` services; `Api`, `Special` and `Hooks` are thin
bindings. The front-end is a single ResourceLoader module.

## Complexity Tracking

No constitution violations to justify.
