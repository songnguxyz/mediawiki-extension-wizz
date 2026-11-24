# Handoff: Wizz 001-initialization

Cập nhật: 2026-11-24. Nhánh làm việc: `cl/youthful-volta-j246hf` (commit mới nhất trước handoff: `45d660c`).

## Trạng thái

Đã xong spec → clarify → plan → tasks → analyze. **Chưa viết dòng code nào** (`/speckit-implement`
đang dừng ở bước kiểm tra checklist, xem "Việc chờ quyết").

Hướng đi: Wizz là **gadget** (không phải extension), Vue 3 + Codex, giấy phép MIT.

| File | Ghi chú |
|---|---|
| `.specify/memory/constitution.md` (+ `.vi.md`) | v2.1.1. Bản EN là bản chính, sửa thì sửa cả hai. |
| `specs/001-initialization/spec.md` | Tiếng Việt, 29 FR, 5 SC, 6 user story |
| `plan.md`, `research.md` (R1–R13), `data-model.md` | Thiết kế gadget |
| `contracts/api-calls.md`, `contracts/wiki-interface.md`, `contracts/form-definition.schema.json` | Lời gọi API core, URL/trang/cấu hình, schema định nghĩa form |
| `quickstart.md` | 14 kịch bản kiểm thử tay |
| `tasks.md` | 58 task, chưa task nào xong |

## Quyết định chính (đã được Song Ngư duyệt)

- Định nghĩa form: `Template:<Tên>/wizz.json`, chỉ tin khi khóa sửa mức `sysop` (trực tiếp hoặc
  khóa lan); kiểm tra khi nạp và khi xem trang định nghĩa (FR-029, có nút xem thử form). Không có
  GUI soạn định nghĩa ở MVP.
- Lối vào: `<Trang>?wizz=1` và tab "Sửa infobox" (mặc định bật, tắt bằng `editTab: false`).
- Không có quyền riêng; kiểm tra quyền sửa ngay khi mở form (`intestactions=edit`).
- Validate hoàn toàn ở trình duyệt trước `action=edit`; regex chạy trong Web Worker, giới hạn
  200 ms. Dữ liệu nhập bằng sửa wikitext là việc của template/Lua (ghi trong hiến pháp III).
- Tag `wizz` chỉ gắn khi tag đã bật và người dùng có `applychangetags`.
- Hai gadget: `wizz` (mặc định, nhỏ) và `wizz-form` (ẩn, nạp khi cần).
- Cấu hình `MediaWiki:Gadget-wizz-config.json`: `namespaces`, `editTab`, `tabLabel`.

## Việc chờ quyết

Đã giải quyết 2026-11-24 (Song Ngư duyệt):

1. Checklist `requirements.md`: đã đánh dấu "testable and unambiguous", sửa Notes.
2. Wiki test: thay Cloud VPS bằng wiki Docker cục bộ (`dev/test-wiki/`, T007). Hiến pháp lên
   2.1.2.
3. `/speckit-analyze` lần 4: sửa cả 10 mục (hiến pháp 2.1.3: chỉ wiki thật mới bắt buộc bản có
   tag; thêm `deploy.js` và chạy 1.46 vào T007/T055; T058 là bản phát hành đầu tiên). Test parse tree chạy với wiki Docker, không cần bỏ qua.

## Việc tiếp theo

1. Giải quyết hai mục trên.
2. Dựng wiki test (T007) càng sớm càng tốt.
3. `/speckit-implement`.
4. Các mục **verify** trong research: CSP cho Worker `blob:` (R6), dạng phản hồi CAPTCHA của
   ConfirmEdit (R8), token Codex ở chế độ tối của Citizen (R10), tên portlet trên Minerva (T051).

## Quy ước làm việc

- Trả lời Song Ngư bằng tiếng Việt, ngắn gọn; điều gì chưa chắc phải hỏi.
- **Mọi thay đổi phải đưa Song Ngư duyệt trước** (bảng "cũ → mới"), rồi mới ghi vào file.
- Commit và push lên nhánh làm việc sau mỗi thay đổi đã duyệt. Không tạo PR nếu chưa được yêu cầu.
- Không có `.specify/extensions.yml`, nên không có hook Spec Kit nào.

## Lưu ý môi trường

- mediawiki.org, Gerrit và meta.miraheze.org không truy cập được từ môi trường trước; mirror
  GitHub thì được. Các bản clone Page Forms, Gadgets REL1_45, Bucket nằm ở scratchpad cũ và sẽ
  mất; cần thì clone lại từ GitHub.
- Spec Kit 1.4.3, cài bằng `specify init --integration claude --non-interactive --here --force`.
  `.specify/feature.json` bị gitignore, nên môi trường mới phải tạo lại với nội dung
  `{"feature_directory": "specs/001-initialization"}` (hoặc đặt biến `SPECIFY_FEATURE`) trước khi
  chạy các lệnh `/speckit-*`.
- Docker có sẵn nhưng daemon không tự chạy: bật `dockerd` (chạy nền) trước. Image
  `mediawiki:1.45` kéo được; wiki chạy ở `http://localhost:8080` (MCP mediawiki đã cấu hình sẵn
  key `localhost:8080`).
- Miraheze/WikiOasis (`meta.miraheze.org`, `*.wikioasis.org`) chỉ vào được với User-Agent
  `$MIRAHEZE_UA`; Song Ngư đã cho phép gửi UA này. `wikioasis.org` gốc không phải wiki.
- Wikimedia (test.wikipedia, mediawiki.org) trả 429 do giới hạn tốc độ: tôn trọng `Retry-After`,
  tối đa 3 request đồng thời, dùng UA có liên hệ (xem mediawiki.org/wiki/Wikimedia_APIs/Rate_limits).
