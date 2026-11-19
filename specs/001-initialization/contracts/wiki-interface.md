# Contract: wiki-facing interface (URLs, rights, configuration, messages)

## Special page

- `Special:EditInfobox/<Page>` — always available (FR-022). Optional `?instance=<n>`.
- Alias file `Wizz.alias.php` provides `EditInfobox` (en) and `SửaInfobox` (vi).
- Without JavaScript: notice `wizz-nojs` plus a link to `action=edit` of the page
  (clarification Q1).
- No form for the page: notice `wizz-noinfobox` plus an edit link. Malformed call: notice
  `wizz-parseerror` with line number plus an edit link.
- No permission: core permission error page (`wizz-edit` / `edit` missing); anonymous users get
  the standard login prompt.

## Namespace

| ID | Name | Content model | Protection |
|----|------|---------------|------------|
| 9620 (provisional) | `Wizz` | `json` | `wizz-editdefinition` |
| 9621 (provisional) | `Wizz_talk` | wikitext | — |

IDs MUST be registered on mediawiki.org before release and declared in the farms' ManageWiki
`install.namespaces` entry.

## Rights

| Right | Default groups | Purpose |
|-------|----------------|---------|
| `wizz-edit` | `user` | Use forms (FR-027). Wikis may grant `*` (not recommended). |
| `wizz-editdefinition` | `sysop`, `interface-admin` | Edit `Wizz:` pages (FR-028). |

## Configuration (`extension.json` `config`, most-used first)

| Variable | Default | Meaning |
|----------|---------|---------|
| `$wgWizzNamespaces` | `[0]` | Namespaces whose pages may be edited by forms (FR-026). |
| `$wgWizzEditTab` | `false` | Show an "Edit infobox" tab on pages with a form-backed infobox (FR-023). |
| `$wgWizzInfoboxButton` | `false` | Add an edit button on rendered infoboxes, opening the form in a dialog (FR-023). |
| `$wgWizzInfoboxSelector` | `".infobox"` | CSS selector for rendered infoboxes; the n-th match maps to instance n. |
| `$wgWizzChangeTag` | `true` | Tag edits with `wizz` (FR-007). |

## Hooks used (no new hooks provided in MVP)

`JsonValidateSave` (definition validation), `ListDefinedTags`, `ChangeTagsListActive`,
`SkinTemplateNavigation::Universal` (tab), `BeforePageDisplay` (button module),
`getUserPermissionsErrors` is not needed (namespace protection covers definitions).

## Logging

PSR-3 channel `Wizz`: `warning` for regex limit hits, schema/definition mismatches;
`info` for refused saves due to parse errors; `error` for unexpected internal API failures.

## Messages

Prefix `wizz-`; `i18n/en.json`, `i18n/vi.json`, `i18n/qqq.json`; API messages in
`i18n/api/`. Key families: `wizz-summary`, `wizz-error-*`, `wizz-warning-*`, `wizz-ui-*`,
`right-wizz-*`, `action-wizz-*`, `tag-wizz*`, `editinfobox` (special page title).
