# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - Unreleased

First release.

### Added

- Edit a page's infobox through a form, with current values filled in. Only changed parameters
  are written; everything else in the wikitext is preserved byte for byte. Saving without a
  change creates no edit.
- Automatic edit summary listing the changed parameters; optional change tag `wizz`.
- Saves with the user's own session: page protection, AbuseFilter, CAPTCHA, blocks and rate
  limits apply as for a normal edit. Edit conflicts are detected and typed values are kept.
- Validation before saving, from the Bucket schema (PAGE, TEXT, INTEGER, DOUBLE, BOOLEAN and
  repeated fields) and from the rules of the form definition: required, min/max, pattern (with
  a time limit), allowed values, page must exist and namespace. Existing invalid values are
  shown with a warning and checked only when edited.
- Form definitions at `Module:<Template>/wizz.json`, checked when loaded and when the page is
  viewed (with a "Preview form" button). Used only when edit-protected at sysop level.
- Preview of the infobox and wikitext diff before saving.
- Instance picker when a page calls the template more than once (`wizzinstance=`).
- Entry points: `?wizz=1` URL and an "Edit infobox" tab (`editTab`); works on Minerva (phones),
  Citizen and Vector 2022, light and dark. English and Vietnamese interface.
- Gadget configuration: `namespaces`, `editTab`, `tabLabel`, `cdn`.
- Releases deployable by hand, with Litmus `gadget-deploy`, or in jsDelivr mode.

[Unreleased]: https://github.com/songnguxyz/mediawiki-extension-wizz/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/songnguxyz/mediawiki-extension-wizz/releases/tag/v0.1.0
