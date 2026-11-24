# Contract: wiki-facing interface (URLs, pages, configuration, messages)

## URLs

- `<Page>?wizz=1` opens the form (FR-022). Optional `&wizzinstance=<n>` selects an instance.
  Works only on a normal view of the latest revision in an allowed namespace.
- Page has no call of a template with a definition: message `wizz-noinfobox` plus a link to
  `action=edit`. Malformed call: `wizz-parseerror` with line number plus an edit link.
- Definition invalid: `wizz-definition-invalid` with the list of errors (FR-019). Not
  protected: `wizz-definition-untrusted` (FR-028).
- No edit right: the save fails with core's permission error, shown in the form; the form
  itself opens for anyone (FR-027, edge case for logged-out users).
- No JavaScript: the gadget does not run; the page shows normally.

## Tab

"Edit infobox" (`wizz-tab`) in the page actions, only on pages that transclude a template with
an existing `/wizz.json` subpage. On by default; `editTab: false` in the config hides it
(FR-023).

## Definition pages

`Template:<Name>/wizz.json`, schema [form-definition.schema.json](form-definition.schema.json).
Must be edit-protected at `sysop` level. Viewing it shows the check result and a "Preview
form" button that opens the form with empty values and no save button (FR-029).

## Gadget pages (installed by an interface admin)

| Page | Purpose |
|------|---------|
| `MediaWiki:Gadgets-definition` lines or `Gadget definition:wizz.json` / `wizz-form.json` | `wizz` (default, entry) and `wizz-form` (hidden, loaded on demand) |
| `MediaWiki:Gadget-wizz.js` | Entry |
| `MediaWiki:Gadget-wizz-*.js`, `-*.vue`, `wizz.less` | Form code |
| `MediaWiki:Gadget-wizz-config.json` | Config |
| `MediaWiki:Gadget-wizz-i18n-en.json`, `-vi.json` | Messages |
| `MediaWiki:Gadget-wizz` | Gadget description in Special:Preferences |

The exact definition lines are produced by `npm run build` (research R12).

## Configuration (`MediaWiki:Gadget-wizz-config.json`)

| Key | Default | Meaning |
|-----|---------|---------|
| `namespaces` | `[0]` | Namespaces where the form can open (FR-026). |
| `editTab` | `true` | Show the "Edit infobox" tab (FR-023). |

## Change tag

An admin creates the tag `wizz` at Special:Tags (optional). Wizz sends it only when it is active
and the user has `applychangetags` (FR-007).

## Global and names

Only global: `mw.libs.wizz` (exposes `version`). CSS classes and message keys start with
`wizz-`.

## Messages

Bundles `en`, `vi`, documentation `qqq` (repo only). Key families: `wizz-summary`,
`wizz-error-*`, `wizz-warning-*`, `wizz-ui-*`, `wizz-tab`, `wizz-definition-*`.
