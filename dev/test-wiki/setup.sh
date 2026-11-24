#!/usr/bin/env bash
# Idempotent: builds the Wizz test wiki and its self-made data. MW_VERSION=1.45 (default), 1.43 or 1.46.
set -euo pipefail
cd "$(dirname "$0")"
export MW_VERSION=${MW_VERSION:-1.45}
ADMIN_PASS=${WIZZ_ADMIN_PASS:-WizzAdmin-test-2024}
EDITOR_PASS=${WIZZ_EDITOR_PASS:-WizzEditor-test-2024}
BOT_PASS=${WIZZ_BOT_PASS:-botpasswordtest0123456789abcdefg} # must match [0-9a-w]{32}
BUCKET_DIR=ext/Bucket-$MW_VERSION
[ -d "$BUCKET_DIR" ] || git clone -q --depth 1 -b "REL${MW_VERSION//./_}" \
  https://github.com/weirdgloop/mediawiki-extensions-Bucket "$BUCKET_DIR"

# Citizen skin (US6 dark mode), pinned; Minerva and Vector ship with the image. Use with ?useskin=citizen.
[ -d ext/Citizen ] || git clone -q --depth 1 -b v3.25.1 \
  https://github.com/StarCitizenTools/mediawiki-skins-Citizen ext/Citizen

dc() { docker compose "$@"; }
mw() { dc exec -T web php maintenance/run.php "$@"; }
dc up -d --wait

if ! dc exec -T web test -f /conf/LocalSettings.php; then
  mw install --server http://localhost:8080 --scriptpath "" --dbtype mysql --dbserver db \
    --dbname wiki --dbuser root --dbpass root --confpath /conf --pass "$ADMIN_PASS" \
    "Wizz test wiki" Admin
fi
if ! dc exec -T web grep -q WIZZ-SETTINGS /conf/LocalSettings.php; then
  dc exec -T web sh -c 'cat >> /conf/LocalSettings.php' <<'EOF'
# WIZZ-SETTINGS
wfLoadExtensions( [ 'Gadgets', 'Scribunto', 'AbuseFilter', 'ConfirmEdit', 'ConfirmEdit/QuestyCaptcha', 'Cite', 'Bucket' ] );
$wgScribuntoDefaultEngine = 'luastandalone';
$wgBucketDBuser = 'bucket';
$wgBucketDBpassword = 'bucket-test-pass';
$wgCaptchaClass = 'QuestyCaptcha';
$wgCaptchaQuestions = [ 'What is 2 + 2?' => '4' ];
// CAPTCHA is off by default; set to true to test it (log in as Editor, sysops skip it).
$wgCaptchaTriggers['edit'] = false;
$wgCaptchaTriggers['create'] = false;
$wgGroupPermissions['*']['edit'] = true;
$wgCapitalLinkOverrides[ 9592 ] = false; // Bucket names are lower-case
$wgShowExceptionDetails = true;
EOF
fi
if ! dc exec -T web grep -q WIZZ-SKINS /conf/LocalSettings.php; then
  dc exec -T web sh -c 'cat >> /conf/LocalSettings.php' <<'EOF'
# WIZZ-SKINS
wfLoadSkin( 'Citizen' );
$wgVectorNightMode = [ 'logged_in' => true, 'logged_out' => true ]; // dark mode for anonymous users too
EOF
fi

# Bucket REL1_43 re-creates its existing index on every update and fails; it is loaded last so the other
# extensions' tables are made first, and that one error is tolerated.
out=$( mw update --quick 2>&1 ) || {
	[[ $MW_VERSION == 1.43 && $out == *"Duplicate key name 'bucket_name'"* ]] || { echo "$out"; exit 1; }
}
dc exec -T db mariadb -uroot -proot -e \
  "CREATE USER IF NOT EXISTS 'bucket'@'%' IDENTIFIED BY 'bucket-test-pass'"
mw Bucket:SetupDBPermission >/dev/null

mw createAndPromote --force --sysop --bureaucrat --interface-admin Admin "$ADMIN_PASS" >/dev/null
mw createAndPromote --force Editor "$EDITOR_PASS" >/dev/null
GRANTS=basic,highvolume,editpage,editprotected,editinterface,editsiteconfig,createeditmovepage,protect
dc exec -T db mariadb -uroot -proot wiki -e "DELETE FROM bot_passwords WHERE bp_app_id='wizz'"
mw createBotPassword --appid wizz --grants "$GRANTS" Admin "$BOT_PASS" >/dev/null

put() { mw edit -u Admin -s "Wizz test data" "$1" >/dev/null; echo "  $1"; }

put 'Bucket:nhan_vat' <<'EOF'
{
	"ten": { "type": "TEXT" },
	"chieu_cao": { "type": "INTEGER" },
	"cung": { "type": "TEXT" },
	"ban_be": { "type": "PAGE", "repeated": true },
	"con_song": { "type": "BOOLEAN" }
}
EOF
put 'Module:Infobox nhân vật' <<'EOF'
local p = {}
function p.main( frame )
	local a = frame:getParent().args
	local data = { ten = a.ten, chieu_cao = tonumber( a['chiều cao'] ), cung = a.cung,
		con_song = a['còn sống'] and a['còn sống'] == 'có' or nil }
	if a['bạn bè'] then
		data.ban_be = {}
		for f in mw.text.gsplit( a['bạn bè'], '%s*;%s*' ) do table.insert( data.ban_be, f ) end
	end
	bucket( 'nhan_vat' ).put( data )
	local t = mw.html.create( 'table' ):addClass( 'infobox wizz-test-infobox' )
	t:tag( 'caption' ):wikitext( a.ten or '' )
	for _, k in ipairs{ 'chiều cao', 'cung', 'bạn bè', 'còn sống' } do
		if a[k] then t:tag( 'tr' ):tag( 'th' ):wikitext( k ):done():tag( 'td' ):wikitext( a[k] ) end
	end
	return tostring( t )
end
return p
EOF
put 'Template:Infobox nhân vật' <<'EOF'
<includeonly>{{#invoke:Infobox nhân vật|main}}</includeonly><noinclude>Self-made test infobox. See [[Module:Infobox nhân vật/wizz.json]].</noinclude>
EOF
put 'Template:Infobox_nv' <<'EOF'
#REDIRECT [[Template:Infobox nhân vật]]
EOF
put 'Module:Infobox nhân vật/wizz.json' <<'EOF'
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
EOF
mw protect -u Admin -r "Wizz test data" 'Module:Infobox nhân vật/wizz.json' >/dev/null
echo 'MediaWiki\MediaWikiServices::getInstance()->getChangeTagsStore()->defineTag( "wizz" );' | mw eval >/dev/null
put 'Song Ngư (nhân vật)' <<'EOF'
{{Infobox nhân vật
<!-- ghi chú tự soạn -->
|ten = Song Ngư<ref>Nguồn tự soạn.</ref>
|chiều cao = ~150
|cung = Song Ngư
|bạn bè = Bạch Dương; Kim Ngưu
|còn sống = có
|màu yêu thích = xanh
}}
'''Song Ngư''' là nhân vật dùng để thử Wizz.

== Chú thích ==
<references />
EOF
mw runJobs >/dev/null

cat <<EOF

Test wiki ready: http://localhost:8080  (MediaWiki $MW_VERSION)
Admin (sysop, bureaucrat, interface-admin): Admin / $ADMIN_PASS
Plain editor (no skipcaptcha):               Editor / $EDITOR_PASS
Bot password:
  export WIZZ_TEST_API=http://localhost:8080/api.php
  export WIZZ_TEST_USER='Admin@wizz'
  export WIZZ_TEST_PASS='$BOT_PASS'
EOF
