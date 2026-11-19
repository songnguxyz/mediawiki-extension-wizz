# Contract: Wizz Action API modules

Three modules share one backend service (`InfoboxEditor`); `Special:EditInfobox` and the Vue
app are thin clients of these modules (Constitution VIII: same functionality via API and UI).
All require the rights `edit` and `wizz-edit` on the target page; all errors use standard
`ApiUsageException` codes with `wizz-` message keys.

## `action=wizzload` (GET)

| Param | Type | Notes |
|-------|------|-------|
| `page` | title | Required. Must be in `$wgWizzNamespaces`. |
| `instance` | int | Optional. Required when the page has > 1 call of the template. |

Response `wizzload`:

```json
{
  "page": "Song Ngư (nhân vật)",
  "template": "Template:Infobox nhân vật",
  "revid": 1234, "timestamp": "2026-11-19T01:00:00Z",
  "instances": [ { "index": 0, "summary": "Song Ngư · 172" }, { "index": 1, "summary": "…" } ],
  "instance": 0,
  "fields": [
    { "field": "chieu_cao", "param": "chiều cao", "label": "Chiều cao (cm)",
      "type": "INTEGER", "repeated": false, "state": "ok",
      "rules": { "min": 0, "max": 300 },
      "value": "~150", "warnings": [ "wizz-warning-invalid-existing" ] }
  ]
}
```

When `instances` has > 1 entry and `instance` was not given, `fields` is omitted and the
client shows the picker (US5). Error codes: `wizz-noinfobox` (no call of a template with a
form; includes `editurl`), `wizz-parseerror` (malformed call; includes `offset`, `line`,
`editurl`), `wizz-badinstance`, `wizz-namespace-disabled`, `permissiondenied`.

## `action=wizzpreview` (POST)

| Param | Type | Notes |
|-------|------|-------|
| `page`, `instance`, `baserevid` | | As above. |
| `values` | JSON object | param → new value, changed fields only. |

Response: `{ "status": "ok", "html": "<rendered infobox>", "diff": "<table rows>",
"changed": ["chiều cao"] }` or `{ "status": "invalid", "errors": { "chiều cao":
[ { "key": "wizz-error-max", "params": [300] } ] } }` or `{ "status": "nochange" }`.
Validation is identical to save. Preview never writes data (no secondary updates, so no Bucket
writes).

## `action=wizzsave` (POST, `token=csrf`)

Params of `wizzpreview` plus optional `captchaid`, `captchaword`.

| `status` | Meaning | Extra fields |
|----------|---------|--------------|
| `success` | Saved | `newrevid`, `summary` |
| `nochange` | Byte-identical text, no revision created (FR-003) | — |
| `invalid` | Validation failed, nothing saved (FR-014) | `errors` |
| `conflict` | `baserevid` is not the latest revision (FR-006) | fresh `wizzload` payload |
| `captcha` | ConfirmEdit asks for a CAPTCHA | `captcha` object from `action=edit` |
| `error` | Blocked, protected, AbuseFilter, rate limit, read-only… | `code`, `html` message from core |

Save path: internal `action=edit` (`text`, `baserevid`, `basetimestamp`, `starttimestamp`,
`summary`, `nocreate=1`, captcha params) executed as the requesting user; afterwards the `wizz`
tag is added when `$wgWizzChangeTag` is true. Summary: message `wizz-summary` in the wiki's
content language, e.g. `Sửa infobox: chiều cao, cung` (FR-007).
