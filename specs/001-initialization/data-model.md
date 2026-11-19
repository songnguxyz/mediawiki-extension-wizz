# Data Model: Wizz — infobox form editing

Wizz creates no database tables. All entities are either wiki pages (definitions, schemas,
articles) or in-memory value objects built per request.

## FormDefinition

Stored as a JSON page `Wizz:<Template name>` (namespace `Wizz`, content model `json`). The page
title, normalised as a `Template:` title, is the template the form edits, so one template has
at most one form.

| Attribute | Type | Rules |
|-----------|------|-------|
| `template` | Title (derived from page title) | Must be a valid title in namespace Template. |
| `bucket` | string | Required. A page `Bucket:<bucket>` must exist and hold a valid schema at save time. |
| `fields` | list of FieldDefinition | Required, ≥ 1. Order in the list is display order. No two entries may share `field` or `param`. |

Validated on save in `JsonValidateSave` (FR-019). Errors name the JSON path, e.g.
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
| `pattern` | string | none | TEXT only. PCRE body without delimiters; compiled with `u`; ≤ 500 chars; must compile at save. |
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
ignored for that field and reported as a warning to the editor and as a log warning.

## BucketSchema

Read-only view of `Bucket:<name>` (see research R1).

| Attribute | Type |
|-----------|------|
| `name` | string |
| `fields` | map field → { `type`: TEXT\|PAGE\|INTEGER\|DOUBLE\|BOOLEAN, `repeated`: bool } |

## TemplateCall (InfoboxInstance)

Produced by `TemplateTokenizer` from the current revision's wikitext.

| Attribute | Type | Notes |
|-----------|------|-------|
| `index` | int | 0-based position among calls of the *same* template on the page. Identifies the instance in URLs/API (`instance=`). |
| `start`, `end` | int | Byte offsets of `{{` … `}}`. |
| `nameText` | string | Name exactly as written (preserved on save). |
| `params` | ordered list of TemplateParam | Includes positional params (kept, never mapped). |
| `summary` | string | First values of the first two mapped fields, for the instance picker (US5). |

Template recognition: `nameText` is normalised to a title in namespace Template (first-letter
case, `_`/space, optional `Template:` prefix or localised alias) and redirects are resolved
before comparing to the form's template (clarification Q5). Calls whose name starts with
`#`, `subst:`, `safesubst:` or `:` are never matched.

## TemplateParam

| Attribute | Type |
|-----------|------|
| `name` | string (trimmed) or positional index |
| `nameSpan`, `valueSpan` | [start, end) byte offsets |
| `rawValue` | string, exact bytes of the value span |
| `value` | `rawValue` trimmed (what the form shows) |

Duplicate named params: the last one wins (MediaWiki semantics); the form edits the last one
and leaves earlier ones untouched.

## FormState (API payload, not stored)

| Attribute | Notes |
|-----------|-------|
| `page`, `revid`, `timestamp` | Revision the form was built from (base for conflict detection). |
| `instances` | List of `{index, summary}` when more than one call exists. |
| `instance` | Selected index. |
| `fields` | List of `{field, param, label, help, type, repeated, rules, value, state, warnings}`. Existing values are shown even if invalid, with a `warnings` entry (FR-015). |

## EditRequest / EditResult

- **EditRequest**: `page`, `instance`, `baserevid`, `values` (map param → submitted value;
  only fields the client marks as changed), optional `captchaid`/`captchaword`.
- **Processing order**: reload latest revision → if `latest ≠ baserevid` return `conflict`
  with fresh FormState (client keeps the user's changed values) → validate changed fields only
  → if any error return `invalid` with per-field errors → apply edits to wikitext → if the
  text is byte-identical return `nochange` (FR-003) → save via internal `action=edit` → tag →
  return `success` with new `revid`.
- **EditResult.status**: `success | nochange | invalid | conflict | captcha | error`.

## State transitions of a form session

```text
load ──► editing ──► preview ──► saving ──► success
            ▲           │           ├──► invalid ──► editing
            └───────────┘           ├──► conflict ─► editing (rebased on new revid)
                                    ├──► captcha ──► saving
                                    └──► error (blocked/protected/abusefilter) ─► editing
```
