# Quickstart: validating Wizz end-to-end

Run guide for proving the feature works. Calls are in
[contracts/api-calls.md](contracts/api-calls.md), pages and config in
[contracts/wiki-interface.md](contracts/wiki-interface.md), entities in
[data-model.md](data-model.md).

## Prerequisites

- Node.js LTS and `npm install` in the repo.
- A test wiki (Wikimedia Cloud VPS) on MediaWiki 1.45 (also run once on 1.46) with Gadgets,
  Scribunto and Bucket; an interface-admin account; optionally AbuseFilter and ConfirmEdit.

## Static checks and unit tests

```bash
npm test
```

Expected: eslint, stylelint, banana-checker clean; all QUnit tests pass, including every
fixture in `tests/fixtures/roundtrip/` (no-edit round trip is identical; tokenizer agrees with
the stored core parse tree).

## Install on the test wiki

```bash
npm run build
```

Copy the pages in `dist/` to the wiki as listed in
[wiki-interface.md](contracts/wiki-interface.md), and add the gadget definition lines printed
by the build.

## Test data (self-made)

1. Create `Bucket:nhan_vat` with fields `ten` (TEXT), `chieu_cao` (INTEGER), `cung` (TEXT),
   `ban_be` (PAGE, repeated), `con_song` (BOOLEAN).
2. Create `Template:Infobox nhân vật` and a Lua module that calls `bucket("nhan_vat").put{…}`;
   create the redirect `Template:Infobox_nv` to it.
3. Create `Template:Infobox nhân vật/wizz.json` with the example in
   [form-definition.schema.json](contracts/form-definition.schema.json); protect it
   (edit = sysop).
4. Create the tag `wizz` at Special:Tags.
5. Create article `Song Ngư (nhân vật)` with one infobox call containing an unknown parameter,
   a comment, a `<ref>` in `ten`, and `chiều cao = ~150`.

## Scenarios (map to spec user stories)

| # | Steps | Expected |
|---|-------|----------|
| 1 (US1) | Open `Song Ngư (nhân vật)?wizz=1`; save without changes | Values prefilled; "no change", no API edit call, no revision. |
| 2 (US1) | Change `cung`; save | Diff touches only the `cung` value; summary lists `cung`; tag `wizz`. |
| 3 (US2) | Set `chiều cao` to `abc`; press save | Field error; network panel shows no `action=edit` request. |
| 4 (US2) | Leave `~150` untouched, change `cung` | Warning on `chiều cao`; save succeeds. |
| 5 (US2) | Definition `pattern: "(a+)+$"`, value `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!` | Field fails with the timeout message within ~0.2 s; the tab stays responsive. |
| 6 (US3) | Unprotect the definition; open the form | Form refuses: definition not trusted. Re-protect. |
| 7 (US3) | Point the definition at a missing bucket / unknown field / break the JSON; view the definition page, then open the form | Definition page lists each error; form refuses with the same list. |
| 8 (US3) | View a valid definition page; press "Preview form" | Check says valid; empty form opens with no save button. |
| 9 (US4) | Preview | Rendered infobox and diff shown before save. |
| 10 (US4) | Open the form in two browsers, save in A, then save in B | B is told about the conflict; form reloads the new revision keeping B's typed values. |
| 11 (US4) | Protect the article / add an AbuseFilter rule / require CAPTCHA for edits | Same outcome as editing wikitext; CAPTCHA appears in the form. |
| 12 (US5) | Page with two calls; open form | Picker lists both; editing #2 changes only #2. |
| 13 (US6) | Check the tab with `editTab` true and false; Minerva, Citizen, Vector 2022; light/dark; `uselang=ar` | Tab only when enabled and the page has a form-backed infobox; one column on Minerva; readable in dark mode; mirrored in RTL. |
| 14 (Edge) | Malformed call (missing `}}`); page without infobox; call via `{{infobox_nv}}`; logged out on a wiki that forbids anonymous edits; delete tag `wizz` | Refuse with line number and edit link; "no infobox" message and edit link; redirect call recognised and its name kept on save; form refuses at once with the permission message; save works without the tag. |
