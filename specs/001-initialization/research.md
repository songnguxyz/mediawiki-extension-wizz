# Phase 0 Research: Wizz — infobox form editing (gadget)

Rewritten on 2026-11-24 after the switch from an extension to a gadget (constitution v2.1.0).
Sources: Gadgets REL1_45 source, Bucket source (`weirdgloop/mediawiki-extensions-Bucket`),
Page Forms source, Miraheze/WikiOasis ManageWiki config, all read from GitHub mirrors.
mediawiki.org, Gerrit and meta.miraheze.org were unreachable; items that depend on them are
marked **verify**.

## R1. Reading the Bucket schema

- **Decision**: Read the `Bucket:<name>` page (namespace 9592, content model `json`) with
  `action=query&prop=revisions&rvslots=main&rvprop=content`, parse the JSON in the browser and
  apply Bucket's defaults (`index: true`, `repeated: false`).
- **Rationale**: Bucket's PHP and Lua APIs are marked unstable; the schema page is the
  user-facing contract and needs only the core Action API (Constitution V).
- **Facts used by the design**:
  - Format `{"<field>": {"type": "TEXT|PAGE|INTEGER|DOUBLE|BOOLEAN", "index": bool,
    "repeated": bool}}`; field names `[a-z0-9_]`, no leading `_`, no `__`.
  - Bucket writes data in `onLinksUpdateComplete` from Lua `bucket.put`; wrong types are cast,
    not rejected. Wizz guards only edits made through the form (Constitution III scope limit).
  - The page is read on every form load, so the current schema is always used (clarification).
- **Alternatives rejected**: Bucket Lua/PHP API (unstable, not reachable from a gadget
  anyway); `bucket_schemas` table (not reachable).

## R2. Gadget packaging

- **Decision**: One package gadget `wizz`, loaded on every page view (`default`), with
  `ResourceLoader`, `package`, `dependencies=mediawiki.api,mediawiki.util`. Its pages:
  `MediaWiki:Gadget-wizz.js` (entry, tiny) and `wizz-config.json` (config plus the tab label
  `tabLabel` in `en`/`vi`, the only message the entry needs). The entry checks the URL and page, then
  loads the form lazily with `mw.loader.using` on a second, hidden package gadget `wizz-form`
  (`dependencies=vue,@wikimedia/codex,mediawiki.api,mediawiki.util,mediawiki.jqueryMsg`,
  `codexIcons=…`): logic modules `wizz-*.js`, components `wizz-*.vue`, message bundles
  `wizz-i18n-<lang>.json`, style `wizz.less`. Normal page views pay only for the entry gadget.
- **Facts (Gadgets REL1_45 source)**:
  - `.vue` pages are accepted only in package gadgets (`Gadget::getVues`,
    `GadgetResourceLoaderModule` type `script-vue`).
  - `.json` pages in a package gadget become `data` files readable with `require()`.
  - `codexIcons` puts an `icons.json` file into the module.
  - `require()` keys are page names without the `MediaWiki:Gadget-` prefix
    (`titleWithoutPrefix`).
  - Both definition formats parse every option above (`MediaWiki:Gadgets-definition` legacy
    lines and `Gadget definition:` JSON pages).
  - `requiresES6` is ignored for default gadgets; not needed, since MediaWiki 1.45 itself
    requires ES2017 browsers.
- **Rationale**: Install needs only interface-admin rights (Constitution V); the lazy second
  gadget keeps page-view cost close to zero.
- **Alternatives rejected**: one big default gadget (loads Vue on every page); a user-script
  install (cannot be default for all users).

## R3. Byte-exact template call parsing

- **Decision**: Own tokenizer in plain JS (`wizz-tokenizer.js`) returning template calls with
  offsets of the call, the name and each parameter's name/`=`/value spans. Rules follow the
  core preprocessor: HTML comments, `<nowiki>`, `<pre>`, extension tags (`<ref>`, …), nested
  `{{ }}`, `{{{ }}}`, `[[ ]]`. Offsets are UTF-16 string indices (JS strings); byte-exactness
  is about the output text, which is untouched outside replaced spans.
- **Safety net**: a dev script (`npm run fixtures:parsetree`) asks a test wiki for
  `action=parse&prop=parsetree` of every round-trip fixture and stores the XML next to it; a
  QUnit test compares the tokenizer's view with that tree. Any disagreement fails CI.
- **Malformed markup** (clarification): unbalanced braces or tags in or around a call of the
  target template → parse error with line number; the form refuses to open.
- **Alternatives rejected**: Parsoid/VisualEditor data (heavy, not byte-exact); regex
  scanning (cannot handle nesting; this is how Page Forms breaks pages).

## R4. Edit semantics (unchanged from the extension design)

- Changed parameter: replace only the value span, keeping the leading/trailing whitespace
  around the value (`| a = old\n` → `| a = new\n`).
- Parameter absent and newly filled: append `|param=value` before `}}`, copying the layout of
  the last existing parameter (inline or one per line, spacing around `=`).
- Field cleared: keep the parameter with an empty value (`|a=`).
- Repeated field: split on the definition's separator and trim each item; join with separator
  plus one space if the original used that style, otherwise the bare separator.
- Positional parameters are preserved, never mapped to fields.
- Duplicate named parameters: the last one wins (MediaWiki semantics) and is the one edited.

## R5. Finding the template and its definition

- **Decision**: Three requests when the form opens:
  1. Page: `prop=revisions|info|templates` with `intestactions=edit` (latest wikitext, `revid`,
     `starttimestamp` via `curtimestamp`, whether the user may edit this page),
     `meta=userinfo&uiprop=rights`, `list=tags&tgprop=active`. If the user may not edit, the
     form refuses at once with a permission message (edge case).
  2. Candidate definitions: for each transcluded template `T`, the title `T/wizz.json` with
     `prop=revisions|info&inprop=protection`, plus `prop=redirects` on the templates (names of
     redirects to each template). Only titles that exist go further.
  3. Bucket schema page named in the definition.
- **Template recognition** (clarification): a call matches when its name, normalised
  (first-letter case, `_`/space, optional `Template:` prefix or localised namespace alias from
  `mw.config.get('wgNamespaceIds')`), equals the template or one of its redirects. Names
  starting with `#`, `subst:`, `safesubst:` or `:` never match.
- **Trust check** (FR-028): use the definition only if its `protection` list has an `edit`
  entry with level `sysop`, either direct or cascading (`source` present). Anything else →
  form refuses with "definition not trusted".
- **Rationale**: batched queries, no extra API modules; the protection state comes from core.

## R6. Validation and regex safety (FR-009, FR-016)

- **Decision**: One pure module `wizz-validate.js` used both while typing and before save.
  Rules: required, min/max (value for numbers, length for TEXT), pattern, allowed list,
  namespaces and must-exist for PAGE, per item for repeated fields. Must-exist is checked with
  one batched `action=query&titles=` just before save (and on blur, debounced).
- **Regex**: patterns are ECMAScript regular expressions with the `u` flag. They run in a Web
  Worker created from a Blob URL of the worker's source (no external URL). Each test has a
  **200 ms** limit; on timeout the worker is terminated and recreated and the field fails with
  `wizz-error-regex-timeout`.
- **verify**: that the farms' Content-Security-Policy allows `blob:` workers. Fallback if the
  Worker cannot start: run the pattern on the main thread only when the value is ≤ 200
  characters and the pattern has no nested quantifier, otherwise fail the field with
  `wizz-error-regex-unavailable`. `shortcut: heuristic, replace if CSP check passes`.
- **Alternatives rejected**: main-thread regex with length caps only (a bad pattern can still
  freeze the tab); a regex engine library (runtime dependency, Constitution technical
  constraints).

## R7. Preview and diff (FR-005)

- **Decision**: Build the new wikitext in the browser, then in parallel:
  - preview: `action=parse` with `text` = the edited template call only, `title` = the page,
    `pst=1`, `disablelimitreport=1`, `prop=text`. `action=parse` does not run LinksUpdate, so
    Bucket is not written;
  - diff: `action=compare` with `fromrev=<base revid>`, `toslots=main`,
    `totext-main=<new full text>`, `tocontentmodel-main=wikitext`, `prop=diff`.
- **Rationale**: core APIs, same as VisualEditor. The HTML returned by core is inserted with
  `v-html` only for these two core-sanitised outputs; user values never go through `v-html`
  (Constitution VIII).

## R8. Saving (FR-006, FR-007, FR-008)

- **Decision**: `new mw.Api().postWithEditToken({ action: 'edit', title, text, baserevid,
  basetimestamp, starttimestamp, summary, tags?, nocreate: 1, assert: 'user' or 'anon' as
  loaded, formatversion: 2 })`.
  - No change: if the new text equals the loaded text, do not call the API (FR-003).
  - Conflict: error code `editconflict` → reload the page, rebuild the form on the new
    revision and keep the user's changed values (FR-006).
  - CAPTCHA: a response with `edit.captcha` (ConfirmEdit) → show the question/image and resend
    with `captchaid` and `captchaword`. **verify** the exact payload for each captcha type on
    the farms.
  - AbuseFilter warnings (`abusefilter-warning`) → show the message and let the user save
    again; disallow → show the message.
  - Tag: send `tags=wizz` only if the tag is active (step 1 of R5) and the user has the
    `applychangetags` right; otherwise save without the tag.
  - Summary: `wizz-summary` message with the changed parameter names, in the wiki's content
    language.
- **Rationale**: the edit goes through the normal `EditPage` path in the user's session, so
  protection, blocks, rate limits, AbuseFilter, CAPTCHA and conflicts apply (Constitution IV).

## R9. Entry points (FR-022, FR-023, FR-026)

- **Decision**:
  - URL `?wizz=1` on a page view (`wgAction === 'view'`, latest revision, namespace allowed by
    config): the form opens over the page content. Closing removes the parameter with
    `history.replaceState`.
  - Tab "Edit infobox" via `mw.util.addPortletLink` in `p-views` (Minerva: `page-actions`
    overflow), shown only on pages that transclude a template with an existing
    `/wizz.json` subpage. Visible by default; `wizz-config.json` `editTab: false` hides it.
  - Definition pages: on view of `Template:*/wizz.json`, show the check result and a
    "preview form" button (FR-029).
- **Config** `MediaWiki:Gadget-wizz-config.json`: `{ "namespaces": [0], "editTab": true, "tabLabel": {…} }`.
  Only these three keys (Constitution VII).

## R10. UI (Codex, mobile, dark mode, RTL)

- **Decision**: Vue 3 components with Codex `CdxField`, `CdxTextInput`, `CdxTextArea`,
  `CdxCheckbox`, `CdxSelect`, `CdxLookup`, `CdxMessage`, `CdxButton`, `CdxRadio`,
  `CdxDialog` (Minerva: full screen). Styles only from Codex CSS custom properties, so night
  mode follows the skin; layout with logical CSS properties so RTL works without flipping.
- **Title suggestions** (FR-021): `CdxLookup` backed by `list=prefixsearch` with `psnamespace`;
  a category filter adds `prop=categories&clcategories=` and drops non-members.
- **verify**: Citizen's dark mode exposes Codex tokens as CSS custom properties.

## R11. i18n (FR-025)

- **Decision**: message bundles `wizz-i18n-en.json`, `wizz-i18n-vi.json` and `qqq.json` (repo
  only) checked by banana-checker, shipped in `wizz-form`; the entry carries only `tabLabel` from the config.
  When the form starts it loads the bundle for `wgUserLanguage` with
  fallback to `en` into `mw.messages` with `mw.messages.set`. On-wiki message overrides are
  not supported in the MVP.
- **Note**: translatewiki.net does not take gadgets; translation happens by pull request.

## R12. Build and release

- **Decision**: `npm run build` copies `src/` to `dist/` with the on-wiki page names and
  writes the gadget definition lines for both definition formats. Releases are git tags; an
  interface admin copies `dist/` pages to the wiki (an optional dev script can upload them with
  a bot password). Nothing is bundled or minified beyond what ResourceLoader does.
- **Rationale**: Constitution VIII (git is source of truth), VII (no bundler).

## R13. Hosting

- Miraheze and WikiOasis run MediaWiki 1.46 stable; Wizz targets 1.45+. Gadgets, Scribunto and
  Bucket are available through ManageWiki on both farms. A gadget needs no farm review.
- Test wiki: local Docker MediaWiki (`dev/test-wiki/`) with self-made data (Constitution, Technical Constraints).
