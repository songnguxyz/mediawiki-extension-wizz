# Phase 0 Research: Wizz — infobox form editing

All findings come from source code of the public repositories (GitHub mirrors of Wikimedia
Gerrit, `weirdgloop/mediawiki-extensions-Bucket`, `miraheze/mw-config`, `WikiOasis/mw-config`)
read on 2026-11-19. mediawiki.org, gerrit.wikimedia.org and meta.miraheze.org were unreachable
from the research environment; items that depend on their documentation are marked
**verify**.

## R1. Reading the Bucket schema

- **Decision**: Read the `Bucket:<Name>` page (namespace 9592, content model `json`) through
  core `RevisionLookup` and parse the JSON ourselves, applying Bucket's defaults
  (`index: true`, `repeated: false`). Wrap this in one Wizz service (`BucketSchemaLookup`).
- **Rationale**: Bucket has no public service or hook for its schema. Its PHP classes
  (`BucketSchema`, `BucketSchemaField`) are built internally from static `BucketDatabase`
  and the README states "the API and schema are unstable and may change at any time"; an
  upstream refactor (`srd/split-classes`) is in progress. The page JSON is the user-facing
  contract and only needs core APIs (Constitution V).
- **Facts used by the design**:
  - Schema format: `{"<field>": {"type": "TEXT|PAGE|INTEGER|DOUBLE|BOOLEAN", "index": bool,
    "repeated": bool}}`; field names are lowercased, `[a-z0-9_]`, no leading `_`, no `__`.
  - Bucket stores data in `onLinksUpdateComplete` from Lua `bucket.put`; wrong types are
    *cast*, not rejected, and logged to `bucket_issues` — so Wizz's validation is the only
    guard against bad values.
  - A schema page edit is applied to the DB in a deferred callback; the page is the source of
    truth Wizz reads, so it sees the new schema immediately (matches the "always use current
    schema" clarification).
  - Changing a field's type or `repeated` drops that column's data; removing a field drops its
    column.
- **Alternatives rejected**: Bucket PHP classes (unstable, static, need `$wgBucketDBuser`);
  `bucket_schemas.schema_json` table (DB coupling, lags behind the page).

## R2. Saving edits as the user

- **Decision**: Save through an internal Action API call to `action=edit`
  (`new ApiMain( new DerivativeRequest( … ), true )`) with `baserevid`, `basetimestamp`,
  `starttimestamp`, `summary`, `token` handling done by the outer Wizz API module, and
  ConfirmEdit's CAPTCHA parameters passed through. Return the `edit.captcha` payload to the
  client so it can show the CAPTCHA and resubmit.
- **Rationale**: This runs `EditPage::attemptSave`, i.e. all edit constraints (permissions,
  blocks, protection, rate limits, edit conflict) and `EditFilterMergedContent` (AbuseFilter,
  ConfirmEdit, SpamBlacklist) — exactly as a normal edit (FR-008, Constitution IV). Same
  pattern as VisualEditor (`ApiVisualEditorEdit`), DiscussionTools and ContentTranslation.
- **Alternatives rejected**: `PageUpdater`/`WikiPage::doUserEditContent` — skips
  `EditFilterMergedContent`, so CAPTCHA and AbuseFilter would not run. Direct `EditPage` use —
  works (Page Forms does it) but re-implements what `ApiEditPage` already wraps. Core
  `PageEdit` — `@internal`, 1.47+.

## R3. Byte-exact template call parsing

- **Decision**: Own small tokenizer (`TemplateTokenizer`) that returns template calls with
  byte offsets for the whole call, the name, and each parameter's name/`=`/value spans.
  It follows `Preprocessor_Hash` rules: HTML comments, `<nowiki>`, `<pre>`, extension tags
  (`<ref>`, …), nested `{{ }}`, `{{{ }}}`, `[[ ]]`. Edits replace only the value spans of
  changed parameters.
- **Rationale**: Core `PPNode_Hash_Tree` keeps no source offsets; Parsoid dsr offsets are
  heavy and not guaranteed byte offsets. Page Forms also uses its own scanner. A focused
  tokenizer is small and fully testable (Constitution I, II).
- **Safety net**: an integration test compares the tokenizer's view of every round-trip
  fixture with core's `Parser::preprocessToDom()` tree; any disagreement fails CI.
- **Malformed markup** (clarification): unbalanced braces or tags inside/around a call of the
  target template → `TemplateParseError` with byte offset; the form refuses to open.
- **Alternatives rejected**: core preprocessor offsets (not exposed); Parsoid (heavy, not
  byte-exact everywhere); regex-only scanning (cannot handle nesting).

## R4. Preview and diff

- **Decision**: Build the new wikitext server-side, then:
  - preview: render only the edited template call in the page's context via core
    `ContentRenderer` (parser options in preview mode; no secondary data updates, so no Bucket
    writes);
  - diff: `ContentHandler::getSlotDiffRenderer()` on the old and new full-page text.
- **Rationale**: Uses core services through DI (Constitution VIII) inside the Wizz preview API
  module; equivalent to what `action=parse` / `action=compare` do for VisualEditor.
- **Alternatives rejected**: client calling `action=parse`/`action=compare` itself — would let
  the client build the wikitext, breaking server authority (Constitution III).

## R5. Change tag `wizz`

- **Decision**: Register the tag via `ListDefinedTags` and `ChangeTagsListActive` (active only
  when `$wgWizzChangeTag` is true, default true). Apply it after a successful save with
  `ChangeTagsStore::addTags()` on the new revision (ContentTranslation pattern).
- **Rationale**: Passing `tags=` to `action=edit` requires the user to hold `applychangetags`;
  anonymous users (if a wiki enables them) do not. Adding the tag server-side after save works
  for every user. **verify**: confirm no `ChangeTagsAllowedAdd` interaction is needed.

## R6. Storing form definitions

- **Decision**: A dedicated namespace `Wizz` (+ `Wizz_talk`) with default content model `json`,
  protected by the right `wizz-editdefinition` through `namespaceProtection`. The page title is
  the template name (`Wizz:Infobox nhân vật` ↔ `Template:Infobox nhân vật`), which enforces
  "one form per template". Content is validated on save in the core `JsonValidateSave` hook;
  invalid definitions are rejected (FR-019).
- **Rationale**:
  - FR-028 needs sysops *and* interface admins to edit definitions. Pages in `MediaWiki:` with
    JSON content require `editsitejson` (interface admins only) — a custom right cannot relax
    that, so the MediaWiki-namespace option fails the requirement.
  - Both farms support extension namespaces through ManageWiki `install.namespaces` (Bucket and
    Page Forms do this), so a namespace is farm-safe.
  - `JsonValidateSave` is core API (used by CommunityConfiguration), no custom ContentHandler
    needed (Constitution VII).
- **Open item**: namespace IDs. Provisional **9620 / 9621** (not used by any entry in
  Miraheze/WikiOasis ManageWiki config; Bucket uses 9592/9593, Page Forms 106). MUST be
  registered on mediawiki.org "Extension default namespaces" before release (**verify**
  availability there).
- **Alternatives rejected**: `MediaWiki:Wizz/<Template>.json` (rights problem above); page
  props via a parser tag like TemplateData (would add wikitext syntax, Constitution VIII
  "think twice"); JsonConfig (extra dependency, master needs MW 1.48).

## R7. Codex UI, mobile, dark mode, RTL

- **Decision**: One Vue 3 + Codex app module (`ext.wizz.form`) declared in `extension.json`
  with `"class": "MediaWiki\\ResourceLoader\\CodexModule"` and the needed `codexComponents`
  (CdxField, CdxTextInput, CdxTextArea, CdxCheckbox, CdxSelect, CdxLookup, CdxMessage,
  CdxButton, CdxRadio). Styles only via Codex design tokens from
  `mediawiki.skin.variables.less`, so night mode works on skins that support it; RTL is
  handled by ResourceLoader's CSSJanus flipping. The app mounts only on `Special:EditInfobox`.
- **Entry points**: special page (always) and an optional "Edit infobox" tab. An in-infobox
  button was considered (template marker, CSS class guessing, `{{#formlink}}`-style link) and
  dropped from the MVP: Page Forms has no per-instance button either, and mapping a rendered
  infobox to its call index is unreliable.
- **Rationale**: Constitution VI; CommunityConfiguration is a working example of
  `CodexModule`. **verify**: Minerva/MobileFrontend loading of the module on special pages and
  Citizen's night-mode token support.

## R8. Title suggestions for PAGE fields

- **Decision**: `CdxLookup` backed by `generator=prefixsearch` with `gpsnamespace` from the
  field's allowed namespaces; when a category filter is set, add `prop=categories&clcategories=`
  and drop results without the category.
- **Rationale**: Works with the default database search backend (no CirrusSearch required).
  Category filtering is advisory UX only; server validation enforces namespace/existence
  (Constitution III).

## R9. Regex safety (FR-016)

- **Decision**: PHP `preg_*` has no time limit, so bound the work instead:
  1. validate every pattern when the definition is saved (must compile with `/…/u`, ≤ 500
     chars);
  2. cap value length (TEXT ≤ 2,000 chars by default, configurable via field `max` length);
  3. run user patterns with a locally lowered `pcre.backtrack_limit` (100,000) and JIT
     disabled, restoring settings afterwards;
  4. if `preg_last_error()` ≠ `PREG_NO_ERROR`, fail the field with `wizz-error-regex-limit`
     and log a warning on the `Wizz` channel.
- **Rationale**: Same approach family as AbuseFilter/SpamBlacklist; backtrack limit turns a
  catastrophic pattern into a fast, reported failure instead of a hang.

## R10. Hosting and platform

- Miraheze: stable MW 1.46 (beta/alpha 1.47); WikiOasis: stable 1.46. Wizz targets **1.45+**
  (as the spec says) and is tested on 1.45 and 1.46.
- Scribunto is global on both farms; Bucket is an optional ManageWiki extension on both.
- Page Forms on Miraheze: "Not being enabled on new wikis due to performance issues"
  (restricted); on WikiOasis it is still self-service.
- New extensions on Miraheze are requested through their issue tracker (Phorge) and added to
  `mediawiki-repos.yaml` + `ManageWikiExtensions.php`; any git URL (GitHub) works. Written
  review criteria could not be read — **verify** before submission.
- Bucket is only fully tested on MySQL/MariaDB-like setups; Wizz's integration CI uses MariaDB.

## R11. Tokenizer → parameter edit semantics (design defaults)

- Changed parameter: replace only the value span; keep the original leading/trailing
  whitespace around the value (e.g. `| a = old\n` → `| a = new\n`).
- Parameter absent in the instance and newly filled: append `|param=value` before `}}`,
  copying the layout of the last existing parameter (inline vs one-per-line, spacing around
  `=`).
- Field cleared: keep the parameter with an empty value (`|a=`), minimal diff; do not delete.
- Repeated field: split stored value on the definition's separator and trim each item; join
  with the separator followed by one space when the original value used that style, otherwise
  the bare separator.
- Positional (unnamed) parameters are preserved but never mapped to fields.
