# Contract: core Action API calls made by Wizz

Wizz adds no API modules. It calls only core modules through `mw.Api`, always with
`formatversion: 2`. Fixtures for tests are recorded responses of these calls.

## 1. Load page (form open; also tab check)

```text
action=query & titles=<Page> & prop=revisions|info|templates & intestactions=edit
  & rvprop=ids|timestamp|content & rvslots=main & tllimit=max & tlnamespace=10 & curtimestamp=1
  & meta=userinfo & uiprop=rights & list=tags & tgprop=active & tglimit=max
```

Used: `revid`, `timestamp` (→ `basetimestamp`), `curtimestamp` (→ `starttimestamp`), wikitext,
transcluded `templates`, `actions.edit` (may the user edit this page; false → form refuses),
user rights (`applychangetags`), whether tag `wizz` is active.
The tab check (FR-023) sends only `prop=templates` and request 2's existence part.

## 2. Load definitions

```text
action=query & titles=Module:<T1>/wizz.json|Module:<T2>/wizz.json|…
  & prop=revisions|info|redirects & rvprop=content & rvslots=main & inprop=protection
  & rdlimit=max & rdnamespace=10
```

`<Tn>` is a transcluded template's name without its namespace prefix. Plus, in the same
request when possible, `prop=redirects` for `Template:<T1>|Template:<T2>|…` (names of
redirects to each template). Titles go in chunks of 25 templates (50 titles, the limit
without `apihighlimits`), so a page transcluding more than 25 templates needs more than one
request. Only existing definitions are kept. Trust rule: a `protection`
entry `{type: "edit", level: "sysop"}`, direct or with `source` (cascade) (FR-028).

## 3. Load bucket schema

```text
action=query & titles=Bucket:<bucket> & prop=revisions & rvprop=content & rvslots=main
```

Missing page or invalid JSON → definition error (FR-019).

## 4. Title suggestions and must-exist check (PAGE fields)

```text
action=query & list=prefixsearch & pssearch=<input> & psnamespace=<ns…> & pslimit=10
  [& generator variant + prop=categories & clcategories=Category:<c>]
action=query & titles=<v1>|<v2>|…           # must-exist, batched, missing → error
```

## 5. Preview and diff (sent in parallel)

```text
action=parse & title=<Page> & text=<edited template call> & pst=1 & prop=text
  & disablelimitreport=1 & contentmodel=wikitext
action=compare & fromrev=<base revid> & toslots=main & totext-main=<new full text>
  & tocontentmodel-main=wikitext & prop=diff
```

Both are POST (texts can be long). Neither writes data.

## 6. Save

```text
postWithEditToken: action=edit & title=<Page> & text=<new full text>
  & baserevid=<revid> & basetimestamp=<ts> & starttimestamp=<ts> & nocreate=1
  & assert=user|anon (as loaded in request 1, `userinfo.anon`)
  & summary=<wizz-summary> [& tags=wizz] [& captchaid & captchaword]
  & errorformat=plaintext (AbuseFilter warnings and protection errors as plain text, not wikitext)
```

| Response | Wizz result |
|----------|-------------|
| `edit.result = "Success"` with `newrevid` | `success`: close form, reload page view |
| `edit.nochange` | `nochange` (should not happen; text compared before sending) |
| `edit.captcha` | `captcha`: show question/image, resend with `captchaid`, `captchaword` |
| error `editconflict` | `conflict`: re-run request 1, rebuild form, keep dirty values |
| error `abusefilter-warning` | `warning`: show message, allow resend once |
| other errors (`protectedpage`, `blocked`, `abusefilter-disallowed`, `ratelimited`, `spamblacklist`, …) | `error`: show the API message, keep values |

`text` (full page) is sent instead of a section edit so the conflict check covers the whole
page; the server sees the same edit a wikitext editor would make.
