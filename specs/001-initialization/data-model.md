# Data Model: Wizz — infobox form editing

Wizz has no storage of its own. All entities are either wiki pages (definitions, schemas,
articles) or in-memory objects built in the browser when the form opens.

## FormDefinition

Stored as the JSON subpage `Template:<Name>/wizz.json` (content model `json`, set automatically by
the `.json` suffix). The parent page is the template the form edits, so one template has at most
one form. Trusted only if edit-protected at `sysop` level, directly or by cascade (FR-028).

| Attribute | Type | Rules |
|-----------|------|-------|
| `template` | Title (parent of the subpage) | Derived, not written in the JSON. |
| `bucket` | string | Required. A page `Bucket:<bucket>` must exist and hold a valid schema when the form loads. |
| `fields` | list of FieldDefinition | Required, ≥ 1. Order in the list is display order. No two entries may share `field` or `param`. |

Checked when the form loads and when the definition page is viewed (FR-019, FR-029); any error
stops the form. Errors name the JSON path, e.g.
`fields[2].field: "chieu_cao" is not a field of bucket "nhan_vat"`. Contract:
[contracts/form-definition.schema.json](contracts/form-definition.schema.json).

## FieldDefinition

| Attribute | Type | Default | Rules |
|-----------|------|---------|-------|
| `field` | string | — | Required. Must exist in the bucket schema (lowercase `[a-z0-9_]`). |
| `param` | string | = `field` | Template parameter name (FR-018 override, may contain spaces/diacritics). Compared after trimming, as MediaWiki does. |
| `label` | string | = `param` | Display label (wiki content language). |
| `help` | string | none | Plain-text hint under the input. |
| `required` | bool | false | Value must be non-empty after trimming. |
| `min` / `max` | number | none | INTEGER/DOUBLE: value bounds. TEXT: length bounds (characters). Not allowed for PAGE/BOOLEAN. |
| `pattern` | string | none | TEXT only. ECMAScript regular expression body without delimiters; compiled with flag `u`; ≤ 500 chars; must compile when the definition is checked. Runs in a Worker with a 200 ms limit. |
| `allowed` | list of string | none | TEXT/PAGE only. Value (each item if repeated) must be in the list. |
| `namespaces` | list of int | `[0]` | PAGE only. Allowed namespaces. |
| `mustExist` | bool | false | PAGE only. Target page must exist. |
| `category` | string | none | PAGE only. Suggestion filter (UX only, not validated). |
| `separator` | string | `,` | Repeated fields only. Non-empty, not whitespace-only. |
| `booleanValues` | [string, string] | `["yes", "no"]` | BOOLEAN only. Text written for true/false. Reading accepts these plus Bucket-castable values (`1/0`, `true/false`, `on/off`, `yes/no`). |

Derived at load time from the bucket schema (never stored in the definition, Constitution III):

| Attribute | Source |
|-----------|--------|
| `type` | Bucket schema `type` |
| `repeated` | Bucket schema `repeated` |
| `state` | `ok`, or `removed` if the field no longer exists in the schema (read-only, warning). |

A definition rule that no longer fits the current type (e.g. `pattern` after TEXT→INTEGER) is
ignored for that field and reported as a warning to the editor.

## BucketSchema

Read-only view of `Bucket:<name>` (see research R1).

| Attribute | Type |
|-----------|------|
| `name` | string |
| `fields` | map field → { `type`: TEXT\|PAGE\|INTEGER\|DOUBLE\|BOOLEAN, `repeated`: bool } |

## TemplateCall (InfoboxInstance)

Produced by `wizz-tokenizer.js` from the latest revision's wikitext.

| Attribute | Type | Notes |
|-----------|------|-------|
| `index` | int | 0-based position among calls of the *same* template on the page. Identifies the instance in the URL (`wizzinstance=`). |
| `start`, `end` | int | String offsets of `{{` … `}}`. |
| `nameText` | string | Name exactly as written (preserved on save). |
| `params` | ordered list of TemplateParam | Includes positional params (kept, never mapped). |
| `summary` | string | First values of the first two mapped fields, for the instance picker (US5). |

Template recognition: `nameText` is normalised to a title in namespace Template (first-letter
case, `_`/space, optional `Template:` prefix or localised alias) and compared with the template
and the redirects to it (research R5). Calls whose name starts with
`#`, `subst:`, `safesubst:` or `:` are never matched.

## TemplateParam

| Attribute | Type |
|-----------|------|
| `name` | string (trimmed) or positional index |
| `nameSpan`, `valueSpan` | [start, end) string offsets |
| `rawValue` | string, exact bytes of the value span |
| `value` | `rawValue` trimmed (what the form shows) |

Duplicate named params: the last one wins (MediaWiki semantics); the form edits the last one
and leaves earlier ones untouched.

## FormState (in memory)

| Attribute | Notes |
|-----------|-------|
| `page`, `revid`, `basetimestamp`, `starttimestamp` | Revision the form was built from (base for conflict detection). |
| `instances` | List of `{index, summary}` when more than one call exists. |
| `instance` | Selected index. |
| `fields` | List of `{field, param, label, help, type, repeated, rules, value, state, warnings, dirty}`. Existing values are shown even if invalid, with a warning (FR-015). |
| `canTag` | Tag `wizz` is active and the user has `applychangetags`. |

## Save flow

Order: validate dirty fields only → if any error, stop (nothing sent, FR-009/FR-014) → apply
edits to wikitext → if text identical, stop with "no change" (FR-003) → check must-exist PAGE
values → `action=edit` (contract [api-calls.md](contracts/api-calls.md)) → handle result.

**Result**: `success | nochange | invalid | conflict | captcha | warning | error`.

## State transitions of a form session

```text
load ──► editing ──► preview ──► saving ──► success
  │         ▲           │           ├──► conflict ─► editing (rebased on new revid, typed values kept)
  │         └───────────┘           ├──► captcha ──► saving
  │                                 ├──► warning (AbuseFilter) ─► saving (confirm) | editing
  │                                 └──► error (blocked/protected/disallowed) ─► editing
  └──► refused (no infobox | parse error | definition invalid | definition not trusted)
```
