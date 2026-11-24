# Contract: wiki-facing interface (URLs, pages, configuration, messages)

## URLs

- `<Page>?wizz=1` opens the form (FR-022). Optional `&wizzinstance=<n>` selects an instance.
  Works only on a normal view of the latest revision in an allowed namespace.
- Page has no call of a template with a definition: message `wizz-noinfobox` plus a link to
  `action=edit`. Malformed call: `wizz-parseerror` with line number plus an edit link.
- Definition invalid: `wizz-definition-invalid` with the list of errors (FR-019). Not
  protected: `wizz-definition-untrusted` (FR-028).
- No right to edit the page (including logged-out users on wikis that forbid it): the form
  refuses at once with `wizz-noeditright` (FR-027, edge case).
- No JavaScript: the gadget does not run; the page shows normally.

## Tab

"Edit infobox" (label from `tabLabel`) in the page actions, only on pages that transclude a template with
an existing `Module:<Name>/wizz.json` page. On by default; `editTab: false` in the config hides it
(FR-023).

## Definition pages

`Module:<Name>/wizz.json` (Scribunto gives `Module:*.json` the `json` content model), schema [form-definition.schema.json](form-definition.schema.json).
Must be edit-protected at `sysop` level. Viewing it shows the check result and a "Preview
form" button that opens the form with empty values and no save button (FR-029).

## Gadget pages (installed by an interface admin)

| Page | Purpose |
|------|---------|
| `MediaWiki:Gadgets-definition` lines | `wizz` (default, entry) and `wizz-form` (hidden, loaded on demand; not needed in jsDelivr mode) |
| `MediaWiki:Gadget-wizz.js` | Entry |
| `MediaWiki:Gadget-wizz-config.json` | Config and the tab label (entry gadget); created once, never overwritten by a release |
| `MediaWiki:Gadget-wizz-form.js` | Form bundle: code, messages, styles, icons (not needed in jsDelivr mode) |
| `MediaWiki:Gadget-wizz` | Gadget description in Special:Preferences |

The exact definition lines are produced by `npm run build` in `dist/gadgets-definition.txt`
(research R12). Three ways to install: copy the `dist/` pages by hand; run Litmus
`gadget-deploy` on the GitHub Release; or install only the entry and the config with
`cdn: true`.

## Configuration (`MediaWiki:Gadget-wizz-config.json`)

| Key | Default | Meaning |
|-----|---------|---------|
| `namespaces` | `[0]` | Namespaces where the form can open (FR-026). |
| `editTab` | `true` | Show the "Edit infobox" tab (FR-023). |
| `tabLabel` | `{ "en": "Edit infobox", "vi": "Sửa infobox" }` | Tab label by language, `en` fallback; the only text the entry gadget needs. |
| `cdn` | `false` | Load the form bundle of the entry's own release from `https://cdn.jsdelivr.net/gh/songnguxyz/mediawiki-extension-wizz@v<version>/dist/wizz-form.js` instead of the `wizz-form` gadget. |

## Change tag

An admin creates the tag `wizz` at Special:Tags (optional). Wizz sends it only when it is active
and the user has `applychangetags` (FR-007).

## Global and names

Only global: `mw.libs.wizz` (exposes `version`). CSS classes and message keys start with
`wizz-`.

## Messages

Bundles `en`, `vi`, documentation `qqq` (repo only). Key families: `wizz-summary`,
`wizz-error-*`, `wizz-warning-*`, `wizz-ui-*`, `wizz-definition-*`.
