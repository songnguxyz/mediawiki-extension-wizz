# Wizz

Wizz is a MediaWiki package gadget that edits the infobox of a page through a form. It reads
the current wikitext, shows one input per template parameter, validates the values against the
[Bucket](https://www.mediawiki.org/wiki/Extension:Bucket) schema and the rules of a form
definition, and saves with `action=edit` in the user's own session. Only the parameters the
user changed are rewritten; the rest of the wikitext stays byte for byte the same.

Open a form with `<Page>?wizz=1` (add `&wizzinstance=<n>` when a page calls the template more
than once) or with the "Edit infobox" tab. Using a form needs exactly the right to edit that
page.

## Requirements

- MediaWiki 1.43 LTS, 1.45 or 1.46. Wizz follows the
  [Version lifecycle](https://www.mediawiki.org/wiki/Version_lifecycle): a version is added when
  released and dropped at its end of life.
- Extensions: Gadgets, Bucket, Scribunto. ConfirmEdit and AbuseFilter are optional; when
  present, their prompts are handled during save.

## Install

Every release (GitHub Releases, tag `v<version>`) carries the same files from `dist/`:
`wizz.js`, `wizz-config.json`, `wizz-form.js`, `gadgets-definition.txt`, `deploy.json`,
`SHA256SUMS`. Use one of three routes. Installing needs the interface-admin right.

1. **By hand.** Add the lines of `gadgets-definition.txt` to `MediaWiki:Gadgets-definition`,
   then create the pages listed in `deploy.json`: `MediaWiki:Gadget-wizz.js`,
   `MediaWiki:Gadget-wizz-config.json` and `MediaWiki:Gadget-wizz-form.js`, each with the
   content of the matching file. Optionally add `MediaWiki:Gadget-wizz` with a description for
   Special:Preferences.
2. **Litmus `gadget-deploy`.** The release workflow asks Litmus for a dry run on every wiki that
   accepts this repository; a person approves the write on the Litmus dashboard. It reads
   `deploy.json` and the definition lines.
3. **jsDelivr mode.** Install only `wizz.js`, `wizz-config.json` and the `wizz` definition
   line (the `wizz-form` gadget is not needed) and set `"cdn": true` in the config. The entry
   then loads `wizz-form.js` of its own release from
   `https://cdn.jsdelivr.net/gh/songnguxyz/mediawiki-extension-wizz@v<version>/dist/wizz-form.js`.
   The wiki's CSP must allow `cdn.jsdelivr.net` in `script-src`.

The `wizz` gadget is declared `default`, so it is on for everyone. A release never overwrites
`MediaWiki:Gadget-wizz-config.json` (it is `createOnly` in `deploy.json`), so your settings
survive upgrades.

Optional: create the change tag `wizz` at Special:Tags. Wizz tags its edits with it when the
tag is active and the user has `applychangetags`; without the tag, edits save untagged.

### Configuration

`MediaWiki:Gadget-wizz-config.json`:

| Key | Default | Meaning |
|-----|---------|---------|
| `namespaces` | `[0]` | Namespaces where the form can open. |
| `editTab` | `true` | Show the "Edit infobox" tab on pages that use a template with a definition. |
| `tabLabel` | `{ "en": "Edit infobox", "vi": "Sửa infobox" }` | Tab label by language, `en` as fallback. |
| `cdn` | `false` | Load the form bundle from jsDelivr instead of the `wizz-form` gadget. |

A change to a gadget JSON page can be served stale by the ResourceLoader cache for a while
before it takes effect.

## Form definitions

A template gets a form when the page `Module:<Template>/wizz.json` exists, where `<Template>` is
the template name without the namespace (for `Template:Infobox person`, the page
`Module:Infobox person/wizz.json`). Scribunto gives `Module:*.json` pages the JSON content
model, so the wiki checks the syntax on save and Lua can read the same file.

**The page must be edit-protected at `sysop` level** (directly or by cascade). Wizz ignores a
definition that is not, and the form refuses to open. Viewing the definition page shows the
result of the check and a "Preview form" button (empty values, no save).

Top level: `bucket` (string, required: name of the page `Bucket:<name>`) and `fields` (list,
at least one; list order is display order). Field types (PAGE, TEXT, INTEGER, DOUBLE, BOOLEAN)
and whether a field is repeated come from the Bucket schema and cannot be redeclared.

Properties of a field entry:

| Property | Applies to | Meaning |
|----------|-----------|---------|
| `field` | all | Required. Bucket field name (`[a-z0-9_]`). |
| `param` | all | Template parameter name when it differs from `field` (may hold spaces and diacritics). |
| `label` | all | Label shown in the form; default is the parameter name. |
| `help` | all | Plain-text hint under the input. |
| `required` | all | Value must be non-empty. |
| `min`, `max` | numbers; TEXT | Value bounds for INTEGER/DOUBLE; length bounds for TEXT. |
| `pattern` | TEXT | ECMAScript regular expression (flag `u`, at most 500 characters). Runs under a 200 ms limit; hitting it fails the field. |
| `allowed` | TEXT, PAGE | List of accepted values (each value, if repeated). |
| `namespaces` | PAGE | Allowed namespaces, default `[0]`. |
| `mustExist` | PAGE | The target page must exist. |
| `category` | PAGE | Narrows title suggestions to a category (suggestion only, not validated). |
| `separator` | repeated | Separator between values, default `,`. |
| `booleanValues` | BOOLEAN | Text written for true and false, default `["yes", "no"]`. |

Example:

```json
{
	"bucket": "nhan_vat",
	"fields": [
		{ "field": "ten", "label": "Tên", "required": true, "max": 200 },
		{ "field": "chieu_cao", "param": "chiều cao", "label": "Chiều cao (cm)", "min": 0, "max": 300 },
		{ "field": "cung", "label": "Cung hoàng đạo", "allowed": [ "Bạch Dương", "Song Ngư" ] },
		{ "field": "ban_be", "param": "bạn bè", "label": "Bạn bè", "namespaces": [ 0 ], "mustExist": true, "category": "Nhân vật", "separator": ";" },
		{ "field": "con_song", "param": "còn sống", "label": "Còn sống", "booleanValues": [ "có", "không" ] }
	]
}
```

The full schema is `specs/001-initialization/contracts/form-definition.schema.json`. An
invalid definition (bad structure, missing bucket, a field not in the bucket) stops the form
and lists the errors. Existing values that break a rule are shown with a warning and are
checked only if the user edits that field.

## Scope limit

Wizz only guards edits made through Wizz. It cannot reject bad data typed into the wikitext
editor, and it runs in the browser, so it is not a security boundary. Rejecting bad data
entered by editing wikitext is the job of the wiki's own templates and Lua modules.

### Recommended: validate in Lua from the same definition

Let the template's Lua module read `Module:<Template>/wizz.json` with `mw.loadJsonData` so
the form and the template share one set of rules. A minimal pattern (`required`, `allowed`,
`min`/`max` on numbers; `pattern` is ECMAScript and has no Lua equivalent, so skip it or
translate it by hand):

```lua
local p = {}
local def = mw.loadJsonData( 'Module:Infobox person/wizz.json' )

function p.problems( args )
	local out = {}
	for _, f in ipairs( def.fields ) do
		local name = f.param or f.field
		local v = mw.text.trim( args[ name ] or '' )
		if v == '' then
			if f.required then
				table.insert( out, name .. ': required' )
			end
		else
			local n = tonumber( v )
			if n and f.min and n < f.min then
				table.insert( out, name .. ': below ' .. f.min )
			elseif n and f.max and n > f.max then
				table.insert( out, name .. ': above ' .. f.max )
			end
			if f.allowed then
				local ok = false
				for _, a in ipairs( f.allowed ) do
					ok = ok or a == v
				end
				if not ok then
					table.insert( out, name .. ': not an allowed value' )
				end
			end
		end
	end
	return out
end

function p.main( frame )
	local problems = p.problems( frame:getParent().args )
	if #problems > 0 then
		-- e.g. return a tracking category plus a visible error
		return '<span class="error">' .. table.concat( problems, '; ' ) .. '</span>'
	end
	-- ... build the infobox / write to Bucket
end

return p
```

## Development

```bash
npm ci
npm test          # eslint, stylelint, banana-checker (i18n), qunit
npm run build     # writes dist/ (Vite, ES2017)
```

`dev/test-wiki/` holds a Docker MediaWiki with Bucket, Scribunto and sample data
(`MW_VERSION=1.43`, `1.45` or `1.46`; see `dev/test-wiki/setup.sh` and `deploy.js`).

Releases are cut by running the `Release` workflow with a version; it tests, builds, tags
`v<version>` on a detached commit that contains `dist/` (so `main` never holds `dist/`),
creates the GitHub Release and asks Litmus for a dry-run deploy.

## License

MIT, see `LICENSE`. The form bundle includes icons from
[`@wikimedia/codex-icons`](https://www.npmjs.com/package/@wikimedia/codex-icons) (MIT).
