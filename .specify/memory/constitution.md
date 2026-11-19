# Wizz Constitution

> Vietnamese translation: [constitution.vi.md](constitution.vi.md). This English text is
> authoritative; the translation MUST be updated in the same change as any amendment.

## Core Principles

### I. Wikitext Preservation (NON-NEGOTIABLE)

- Reading and writing a template call MUST round-trip byte-for-byte: parsing a page and
  serializing it back without edits MUST yield the identical wikitext.
- An edit MUST change only the parameters the user actually modified. Unknown parameters,
  parameter order, whitespace, comments, `<ref>`, `<nowiki>`, nested templates and all text
  outside the edited template call MUST be preserved exactly.
- Saving with no changes MUST NOT create a revision (no null or empty edits).
- When Wizz cannot guarantee preservation (e.g. malformed or ambiguous markup), it MUST refuse
  or warn rather than guess.

Rationale: corrupting wikitext is the failure mode that made Page Forms untrustworthy; a form
that silently rewrites pages costs editors more than it saves.

### II. Regression-Proof Testing

- The template parser/serializer and validation logic MUST be developed test-first with
  PHPUnit; tests MUST fail before the implementation makes them pass.
- A round-trip fixture corpus (real-world infobox shapes, built from self-made data) is a
  permanent project asset; fixtures MAY be added but MUST NOT be removed to make tests pass.
- Every reported wikitext-corruption bug MUST get a failing round-trip fixture before the fix
  is merged.
- CI (lint + unit + integration tests) MUST pass before merge. Tests MUST NOT be skipped or
  disabled to get green.

Rationale: regressions between releases are the second main complaint about Page Forms.

### III. Server-Side Validation Is the Authority

- Every validation rule MUST be enforced on the server at save time. Client-side checks exist
  only for early feedback and MUST NOT be the only layer.
- Field types (PAGE, TEXT, INTEGER, DOUBLE, BOOLEAN) and repeated-ness MUST come from the
  Bucket schema; form definitions MUST NOT redeclare them.
- User-supplied regular expressions MUST run under a time/backtrack limit; a limit hit MUST
  fail validation with an error, never hang the request.
- Pre-existing invalid values MUST be shown with a warning and MUST NOT be altered or dropped
  unless the user edits that field.
- Form definitions MUST be validated when saved; invalid definitions MUST be rejected.

Rationale: data flows from templates into Bucket; one bad value breaks every query built on it.

### IV. No Privilege Bypass

- Edits MUST be saved through MediaWiki core's standard edit path, as the acting user, so page
  protection, AbuseFilter, CAPTCHA, rate limits, blocks and edit-conflict detection apply exactly
  as for a normal wikitext edit.
- Wizz MUST define its own user rights for using forms and for editing form definitions, with
  narrow defaults (logged-in users; administrators and interface administrators respectively).
- Optional entry points and behaviours (edit tab, in-infobox button, anonymous access) MUST be
  off by default and enabled per wiki by configuration.

Rationale: a form must never become a way around a wiki's anti-vandalism defences.

### V. Wiki-Farm Compatibility

- Wizz MUST be deployable on Miraheze and WikiOasis and pass their extension review.
- Target MediaWiki 1.45+ (current stable used by those farms). Use only stable, public core
  APIs and hooks; deprecated APIs MUST NOT be introduced.
- Wizz MUST NOT create its own database tables and MUST NOT load resources from external hosts.
- Wizz MUST NOT depend on Bucket's unstable third-party API; it edits template parameters and
  lets the wiki's templates/Lua modules write to Bucket.
- Wizz MUST NOT reuse Page Forms code and MUST be installable alongside Page Forms without name
  collisions (special pages, rights, hooks, message keys, ResourceLoader modules, config vars).
- License: GPL-2.0-or-later for all code; dependencies MUST be GPL-compatible.

Rationale: farm deployment is the reason Wizz exists; anything a farm reviewer rejects is a
blocker.

### VI. Usable by Newcomers on Any Device

- UI MUST be built with Codex (MediaWiki's design system) and designed mobile-first.
- Every form MUST work on Minerva, Citizen and Vector 2022, in both light and dark mode.
- All user-facing strings MUST go through MediaWiki i18n, shipping `en`, `vi` and `qqq`
  documentation; no hard-coded UI text.
- UI MUST meet basic accessibility: labelled inputs, keyboard operability, errors announced and
  tied to their field, sufficient contrast.

Rationale: the target users are newcomers who avoid wikitext, increasingly on phones.

### VII. Simplicity

- Build only what the current, approved spec requires. Out-of-scope items stay out until a spec
  brings them in.
- No abstraction, configuration option or extension point without a present requirement; any
  added complexity MUST be justified in the plan's Complexity Tracking.
- Prefer core/Codex facilities over custom code.

Rationale: a small codebase is easier to review, keep regression-free and get approved by farms.

## Technical Constraints

- Language and layout: PHP (version per MediaWiki 1.45 requirements) with `extension.json`,
  PSR-4 namespace `MediaWiki\Extension\Wizz`, services via the service container; frontend via
  ResourceLoader and Codex.
- Code style: `mediawiki/mediawiki-codesniffer` and `phan` for PHP; `eslint-config-wikimedia`
  and `stylelint-config-wikimedia` for JS/CSS/LESS. Lint errors block merge.
- Tests: PHPUnit (unit tests with no DB; integration tests where core services are needed).
  Browser-level tests are added only where a spec requires them.
- Dependencies: Bucket and Scribunto are required at runtime for the MVP. No new runtime
  Composer/npm dependency without plan-level justification.
- Test environment: a Wikimedia Cloud VPS wiki using self-made data modelled on real infobox
  structures; real wiki content MUST NOT be copied.

## Development Workflow

- Work follows Spec Kit: spec → (clarify) → plan → tasks → implement. Each plan MUST include a
  Constitution Check against Principles I–VII and record any justified exception.
- Changes land via pull request. Reviewers MUST verify: constitution compliance, tests added
  for new behaviour, round-trip fixtures for any parser/serializer change, i18n for new strings.
- Releases follow semantic versioning; user-visible changes are recorded in a changelog.

## Governance

- This constitution supersedes other project practices. Where a guide or plan conflicts with
  it, the constitution wins until amended.
- Amendments are made by pull request that states the reason, updates both the English and
  Vietnamese texts, and updates the version below.
- Versioning: MAJOR for removing or redefining a principle; MINOR for adding a principle or
  section or materially expanding guidance; PATCH for clarifications and wording.
- Compliance is checked at plan time (Constitution Check) and at review. Exceptions MUST be
  documented with rationale in the plan's Complexity Tracking.

**Version**: 1.0.0 | **Ratified**: 2026-11-19 | **Last Amended**: 2026-11-19
