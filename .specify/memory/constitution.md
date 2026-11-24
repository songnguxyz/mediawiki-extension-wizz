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

- The template parser/serializer and validation logic MUST be developed test-first with QUnit
  run under Node (`npm test`); tests MUST fail before the implementation makes them pass.
- A round-trip fixture corpus (real-world infobox shapes, built from self-made data) is a
  permanent project asset; fixtures MAY be added but MUST NOT be removed to make tests pass.
- Every reported wikitext-corruption bug MUST get a failing round-trip fixture before the fix
  is merged.
- CI (lint + tests) MUST pass before merge. Tests MUST NOT be skipped or disabled to get green.

Rationale: regressions between releases are the second main complaint about Page Forms.

### III. Validate Before Saving

- Every validation rule MUST run before Wizz calls `action=edit`, from one shared validation
  module; HTML input attributes alone MUST NOT count as validation.
- Field types (PAGE, TEXT, INTEGER, DOUBLE, BOOLEAN) and repeated-ness MUST come from the
  Bucket schema; form definitions MUST NOT redeclare them.
- User-supplied regular expressions MUST run under a time limit; a limit hit MUST fail that
  field with an error instead of freezing the editor's browser.
- Pre-existing invalid values MUST be shown with a warning and MUST NOT be altered or dropped
  unless the user edits that field.
- Form definitions MUST be validated when loaded; an invalid definition MUST stop the form from
  opening and list its errors.
- Scope limit: Wizz only guards edits made through Wizz. Rejecting bad data entered by editing
  wikitext is the job of the wiki's own templates/Lua modules, and documentation MUST say so.

Rationale: data flows from templates into Bucket; one bad value breaks every query built on it.
A gadget has no server side, so the guarantee is stated honestly instead of overstated.

### IV. No Privilege Bypass

- Edits MUST be saved through the Action API (`action=edit`) in the user's own session, so page
  protection, AbuseFilter, CAPTCHA, rate limits, blocks and edit-conflict detection apply exactly
  as for a normal wikitext edit.
- Using a form requires exactly the right to edit the page; Wizz adds no rights of its own.
- A form definition MUST be used only if its page is edit-protected at administrator level
  (directly or by cascade); Wizz MUST check the protection before trusting it.
- The "Edit infobox" tab is on by default; each wiki MUST be able to turn it off.

Rationale: a form must never become a way around a wiki's anti-vandalism defences, and an
unprotected definition page would let anyone change the rules the form enforces.

### V. Portable Gadget

- Wizz is a ResourceLoader gadget: installing it MUST need only interface-administrator rights
  on the wiki, with no server-side code.
- Target every MediaWiki version still maintained per the mediawiki.org Version lifecycle (now
  1.43 LTS, 1.45, 1.46), with the Gadgets, Bucket and Scribunto extensions. Support follows that
  schedule: a version is added when released and dropped at its end of life. Use only stable,
  public front-end APIs (`mw.Api`, `mw.util`, `mw.config`, `mw.messages`, ResourceLoader
  modules, Codex); deprecated APIs MUST NOT be introduced.
- Wizz MUST NOT load resources from external hosts, except the optional jsDelivr mode: the form
  bundle of the same tagged release from `cdn.jsdelivr.net`, exact version pinned, turned on per
  wiki by config. Ordinary page views MUST NOT contact any external host.
- Wizz MUST NOT depend on Bucket's unstable third-party API; it reads `Bucket:` schema pages and
  edits template parameters, letting the wiki's templates/Lua modules write to Bucket.
- Wizz MUST NOT reuse Page Forms code and MUST coexist with Page Forms: its only global is
  `mw.libs.wizz`, and its CSS classes and message keys use the `wizz-` prefix.
- License: MIT for all code; dependencies MUST be MIT-compatible.

Rationale: a gadget reaches every wiki that has the required extensions without waiting for a
farm review, which is the reason Wizz exists.

### VI. Usable by Newcomers on Any Device

- UI MUST be built with Codex (MediaWiki's design system) and designed mobile-first.
- Every form MUST work on Minerva, Citizen and Vector 2022, in both light and dark mode, and in
  right-to-left languages.
- All user-facing strings MUST come from message bundles loaded into `mw.messages`, shipping
  `en`, `vi` and `qqq` documentation; no hard-coded UI text.
- UI MUST meet basic accessibility: labelled inputs, keyboard operability, errors announced and
  tied to their field, sufficient contrast.

Rationale: the target users are newcomers who avoid wikitext, increasingly on phones.

### VII. Simplicity

- Build only what the current, approved spec requires. Out-of-scope items stay out until a spec
  brings them in.
- No abstraction, configuration option or extension point without a present requirement; any
  added complexity MUST be justified in the plan's Complexity Tracking.
- Prefer core/Codex facilities over custom code.

Rationale: a small codebase is easier to review, keep regression-free and trust.

### VIII. Gadget Best Practices

- Follow the MediaWiki JavaScript coding conventions and lint with `eslint-config-wikimedia`
  and `stylelint-config-wikimedia`.
- Ship as package gadgets that declare every ResourceLoader dependency (`vue`,
  `@wikimedia/codex`, `mediawiki.api`, …); the only runtime URL load is the jsDelivr mode of
  Principle V. Every release is deployable three ways from the same build: by hand, by Litmus
  `gadget-deploy`, or by jsDelivr.
- No hard-coded wikitext or template assumptions: everything wiki-specific comes from form
  definitions.
- Logic (tokenizer, validation, wikitext editing) MUST be plain modules independent of Vue and
  the DOM, so it can be tested under Node; Vue components only present it.
- Security: write actions use `mw.Api` `postWithEditToken`; values are rendered through Vue/
  `mw.message` escaping, never inserted as raw HTML; only the latest visible revision is read.
- Source of truth is the git repository; production wikis receive tagged releases only, never
  edits made directly on a wiki. The local test wiki may run untagged builds.
- Documentation: install steps (gadget definition, pages to create, required extensions),
  form-definition reference, and a recommended Lua validation pattern for templates.

Rationale: gadgets are judged by the interface administrators who install them; clean,
self-contained, documented code is what earns that trust.

## Technical Constraints

- Language and layout: JavaScript built with Vite to target ES2017
  (ResourceLoader's minifier rejects newer syntax such as object spread); Vue 3 and Codex as shipped by
  MediaWiki (never bundled); LESS compiled by Vite, using Codex design tokens through CSS custom
  properties with fallbacks.
- Code style: `eslint-config-wikimedia` and `stylelint-config-wikimedia`; message bundles
  checked by banana-checker. Lint errors block merge.
- Tests: QUnit under Node for logic modules; browser-level tests only where a spec requires
  them.
- Dependencies: Gadgets, Bucket and Scribunto on the wiki. npm code bundled into
  the build MUST be MIT-compatible and listed in the plan (now only `@wikimedia/codex-icons`);
  dev-only npm packages need no justification beyond the plan.
- Test environment: a local Docker MediaWiki wiki for each supported MediaWiki version, rebuilt
  from a script in the repo, using
  self-made data modelled on real infobox structures; real wiki content MUST NOT be copied.

## Development Workflow

- Work follows Spec Kit: spec → (clarify) → plan → tasks → implement. Each plan MUST include a
  Constitution Check against Principles I–VIII and record any justified exception.
- Changes land via GitHub pull request. Reviewers MUST verify: constitution compliance, tests
  added for new behaviour, round-trip fixtures for any parser/serializer change, messages for
  new strings.
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

**Version**: 2.2.1 | **Ratified**: 2026-11-19 | **Last Amended**: 2026-11-24
