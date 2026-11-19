# Quickstart: validating Wizz end-to-end

Run guide for proving the feature works. Details of payloads are in
[contracts/action-api.md](contracts/action-api.md) and
[contracts/wiki-interface.md](contracts/wiki-interface.md); entities in
[data-model.md](data-model.md).

## Prerequisites

- MediaWiki 1.45 (also run once on 1.46) with MariaDB, Scribunto and Bucket (REL1_45 branch).
- Wizz checked out in the extensions directory (or a custom path) and loaded with
  `wfLoadExtension( 'Wizz' );`.
- Composer and npm dev dependencies installed in the Wizz directory.

## Static checks and unit tests

```bash
composer test
```

```bash
npm test
```

Expected: phpcs, phan, parallel-lint, minus-x, eslint, stylelint and banana-checker report no
errors.

```bash
php tests/phpunit/phpunit.php extensions/Wizz/tests/phpunit/unit
```

Run from the MediaWiki root. Expected: all pass, including every file in
`tests/phpunit/data/roundtrip/` (parse → serialize unchanged is byte-identical).

```bash
php tests/phpunit/phpunit.php extensions/Wizz/tests/phpunit/integration
```

Expected: all pass, including the tokenizer-vs-`preprocessToDom` comparison and the API
save tests (AbuseFilter/ConfirmEdit tests are skipped if those extensions are absent).

QUnit: open `Special:JavaScriptTest/qunit?module=ext.wizz` on the dev wiki. Expected: green.

## Test wiki fixture (self-made data)

1. Create `Bucket:nhan_vat` with fields `ten` (TEXT), `chieu_cao` (INTEGER), `cung` (TEXT),
   `ban_be` (PAGE, repeated), `con_song` (BOOLEAN).
2. Create `Template:Infobox nhân vật` + a Lua module that calls `bucket("nhan_vat").put{…}`.
3. As a sysop, create `Wizz:Infobox nhân vật` with the example in
   [contracts/form-definition.schema.json](contracts/form-definition.schema.json).
4. Create article `Song Ngư (nhân vật)` with one infobox call containing an unknown parameter,
   a comment, a `<ref>` in `ten`, and `chiều cao = ~150`.

## Scenarios (map to spec user stories)

| # | Steps | Expected |
|---|-------|----------|
| 1 (US1) | Open `Special:EditInfobox/Song Ngư (nhân vật)`; save without changes | Values prefilled; `nochange`, no new revision. |
| 2 (US1) | Change `cung`; save | Diff touches only the `cung` line; summary `Sửa infobox: cung`; tag `wizz`. |
| 3 (US2) | Set `chiều cao` to `abc`, then call `action=wizzsave` directly via API sandbox with the same value | Form error on that field; API returns `invalid`; no revision. |
| 4 (US2) | Leave the invalid `~150` untouched, change `cung` | Warning shown on `chiều cao`; save succeeds. |
| 5 (US2) | Definition with pattern `(a+)+$`, value `aaaaaaaaaaaaaaaaaaaaaaaaaaaa!` | Fast `wizz-error-regex-limit`; request does not hang. |
| 6 (US3) | Save `Wizz:` page pointing to a missing bucket / unknown field / bad JSON; try as normal user | Each save rejected with a precise message; normal user gets permission error. |
| 7 (US4) | Preview | Rendered infobox + diff shown before save. |
| 8 (US4) | Open form in two browsers, save in A, then save in B | B gets `conflict`, form reloads new revision keeping B's typed values. |
| 9 (US4) | Protect page / add AbuseFilter rule / enable ConfirmEdit for edits | Same outcome as editing wikitext; CAPTCHA appears in form. |
| 10 (US5) | Page with two calls; open form | Picker lists both; editing #2 changes only #2. |
| 11 (US6) | Toggle `$wgWizzEditTab`; check Minerva, Citizen, Vector 2022, light/dark, `uselang=ar` | Tab appears only when enabled; form usable one-column on Minerva; readable in dark mode; mirrored layout in RTL. |
| 12 (Edge) | Malformed call (missing `}}`); no infobox page; JS disabled; template via redirect `{{infobox_nhân_vật}}` | Refuse with line number + edit link; "no infobox" notice; no-JS notice + edit link; redirect call is recognised and its name is preserved on save. |
