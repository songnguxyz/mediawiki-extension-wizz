# Hiến pháp Wizz

> Bản dịch tiếng Việt của [constitution.md](constitution.md). Bản tiếng Anh là bản chính thức;
> mọi sửa đổi MUST cập nhật bản dịch này trong cùng một thay đổi.

## Nguyên tắc cốt lõi

### I. Bảo toàn wikitext (KHÔNG THƯƠNG LƯỢNG)

- Đọc và ghi một lời gọi template MUST round-trip đúng từng byte: phân tích một trang rồi ghi
  lại mà không sửa gì MUST cho ra wikitext y hệt.
- Một sửa đổi MUST chỉ thay đổi những tham số người dùng thực sự đã sửa. Tham số lạ, thứ tự
  tham số, khoảng trắng, comment, `<ref>`, `<nowiki>`, template lồng nhau và mọi nội dung ngoài
  lời gọi template đang sửa MUST được giữ nguyên.
- Lưu khi không có thay đổi MUST NOT tạo phiên bản mới (không có sửa đổi rỗng).
- Khi Wizz không bảo đảm được việc giữ nguyên (ví dụ markup sai cú pháp hoặc mơ hồ), nó MUST
  từ chối hoặc cảnh báo, không được đoán.

Lý do: làm hỏng wikitext là lỗi khiến Page Forms mất uy tín; một form âm thầm viết lại trang
gây hại cho biên tập viên nhiều hơn lợi ích nó mang lại.

### II. Chống hồi quy bằng test

- Parser/serializer template và logic validate MUST được phát triển theo hướng test trước với
  QUnit chạy trên Node (`npm test`); test MUST thất bại trước khi phần cài đặt làm nó chạy qua.
- Bộ mẫu round-trip (các dạng infobox thực tế, dựng từ dữ liệu tự tạo) là tài sản lâu dài của
  dự án; MAY thêm mẫu nhưng MUST NOT xóa mẫu để test chạy qua.
- Mỗi lỗi làm hỏng wikitext được báo về MUST có một mẫu round-trip tái hiện lỗi (đang thất bại)
  trước khi bản sửa được merge.
- CI (lint + test) MUST xanh trước khi merge. MUST NOT bỏ qua hay tắt test để có màu xanh.

Lý do: hồi quy giữa các phiên bản là phàn nàn lớn thứ hai về Page Forms.

### III. Validate trước khi lưu

- Mọi luật validate MUST chạy trước khi Wizz gọi `action=edit`, từ một module validate dùng
  chung; chỉ dựa vào thuộc tính của ô nhập HTML MUST NOT được coi là validate.
- Kiểu ô (PAGE, TEXT, INTEGER, DOUBLE, BOOLEAN) và thuộc tính nhiều giá trị MUST lấy từ schema
  Bucket; định nghĩa form MUST NOT khai lại.
- Regex do người dùng khai MUST chạy dưới giới hạn thời gian; quá giới hạn MUST báo lỗi ở ô đó
  thay vì làm treo trình duyệt của biên tập viên.
- Giá trị cũ không hợp lệ MUST được hiển thị kèm cảnh báo và MUST NOT bị đổi hay bỏ đi trừ khi
  người dùng sửa ô đó.
- Định nghĩa form MUST được kiểm tra khi nạp; định nghĩa không hợp lệ MUST chặn form mở ra và
  liệt kê lỗi.
- Giới hạn phạm vi: Wizz chỉ bảo vệ các sửa đổi đi qua Wizz. Chặn dữ liệu sai nhập bằng cách
  sửa wikitext là việc của template/module Lua của wiki, và tài liệu MUST nói rõ điều này.

Lý do: dữ liệu chảy từ template vào Bucket; một giá trị sai làm hỏng mọi truy vấn dựa trên nó.
Gadget không có phía máy chủ, nên cam kết được nói thẳng thay vì nói quá.

### IV. Không vượt quyền

- Sửa đổi MUST được lưu qua Action API (`action=edit`) trong phiên của chính người dùng, để khóa
  trang, AbuseFilter, CAPTCHA, giới hạn tốc độ, cấm sửa và phát hiện xung đột sửa áp dụng y như
  khi sửa wikitext thông thường.
- Dùng form chỉ cần đúng quyền sửa trang đó; Wizz không thêm quyền riêng nào.
- Một định nghĩa form MUST chỉ được dùng khi trang của nó bị khóa sửa ở mức quản trị viên (hoặc
  nằm trong namespace MediaWiki); Wizz MUST kiểm tra trạng thái khóa trước khi tin định nghĩa.
- Tab "Sửa infobox" mặc định bật; mỗi wiki MUST tắt được.

Lý do: form không bao giờ được trở thành đường vòng qua các lớp chống phá hoại của wiki, và một
trang định nghĩa không bị khóa sẽ cho bất kỳ ai đổi luật mà form áp dụng.

### V. Gadget di động

- Wizz là một gadget ResourceLoader: cài đặt MUST chỉ cần quyền quản trị viên giao diện trên
  wiki, không có code chạy phía máy chủ.
- Nhắm MediaWiki 1.45 trở lên có các extension Gadgets, Bucket và Scribunto. Chỉ dùng API
  front-end công khai, ổn định (`mw.Api`, `mw.util`, `mw.config`, `mw.messages`, module
  ResourceLoader, Codex); MUST NOT đưa vào API đã bị deprecate.
- Wizz MUST NOT tải tài nguyên từ máy chủ bên ngoài.
- Wizz MUST NOT phụ thuộc API bên thứ ba chưa ổn định của Bucket; Wizz đọc trang schema
  `Bucket:` và sửa tham số template, để template/module Lua của wiki ghi vào Bucket.
- Wizz MUST NOT dùng lại code Page Forms và MUST cùng tồn tại được với Page Forms: biến toàn cục
  duy nhất là `mw.libs.wizz`, class CSS và khóa thông điệp dùng tiền tố `wizz-`.
- Giấy phép: MIT cho toàn bộ code; các phụ thuộc MUST tương thích MIT.

Lý do: gadget đến được mọi wiki có đủ các extension cần thiết mà không phải chờ farm duyệt, và
đó là lý do Wizz ra đời.

### VI. Người mới dùng được trên mọi thiết bị

- Giao diện MUST dựng bằng Codex (hệ thống thiết kế của MediaWiki) và thiết kế cho điện thoại
  trước.
- Mọi form MUST dùng được trên Minerva, Citizen và Vector 2022, ở cả chế độ sáng và tối, và với
  ngôn ngữ viết từ phải sang trái.
- Mọi chuỗi hiển thị cho người dùng MUST lấy từ các gói thông điệp nạp vào `mw.messages`, có sẵn
  `en`, `vi` và tài liệu `qqq`; không viết cứng chữ trong giao diện.
- Giao diện MUST đạt mức trợ năng cơ bản: ô nhập có nhãn, thao tác được bằng bàn phím, lỗi được
  thông báo và gắn với đúng ô, độ tương phản đủ.

Lý do: người dùng mục tiêu là người mới ngại wikitext, và ngày càng dùng điện thoại.

### VII. Đơn giản

- Chỉ làm những gì spec hiện hành đã duyệt yêu cầu. Những mục ngoài phạm vi giữ ngoài phạm vi
  cho tới khi một spec đưa chúng vào.
- Không thêm abstraction, tùy chọn cấu hình hay điểm mở rộng khi chưa có yêu cầu thực tế; mọi
  độ phức tạp thêm vào MUST được giải trình ở mục Complexity Tracking của plan.
- Ưu tiên dùng sẵn của core/Codex thay vì code tự viết.

Lý do: codebase nhỏ dễ duyệt, dễ giữ không hồi quy và dễ được tin tưởng.

### VIII. Thông lệ tốt cho gadget

- Theo quy chuẩn JavaScript của MediaWiki, kiểm tra bằng `eslint-config-wikimedia` và
  `stylelint-config-wikimedia`.
- Phát hành dạng package gadget, khai đủ mọi dependency ResourceLoader (`vue`,
  `@wikimedia/codex`, `mediawiki.api`, …); không tải gì bằng URL lúc chạy.
- Không viết cứng wikitext hay giả định về template: mọi thứ riêng của từng wiki lấy từ định
  nghĩa form.
- Logic (bộ phân tích template, validate, sửa wikitext) MUST là các module thuần, không phụ
  thuộc Vue hay DOM, để test được trên Node; component Vue chỉ lo phần hiển thị.
- Bảo mật: thao tác ghi dùng `mw.Api` `postWithEditToken`; giá trị được hiển thị qua cơ chế
  escape của Vue/`mw.message`, không bao giờ chèn như HTML thô; chỉ đọc phiên bản mới nhất mà
  người dùng được xem.
- Nguồn chuẩn là repo git; wiki chỉ nhận các bản phát hành có tag, không bao giờ sửa trực tiếp
  trên wiki.
- Tài liệu: hướng dẫn cài (định nghĩa gadget, các trang cần tạo, extension bắt buộc), tài liệu
  tham chiếu định nghĩa form, và một mẫu validate bằng Lua khuyến nghị cho template.

Lý do: gadget được đánh giá bởi quản trị viên giao diện, người cài nó; code gọn, tự chứa, có tài
liệu là thứ giúp có được sự tin tưởng đó.

## Ràng buộc kỹ thuật

- Ngôn ngữ và cấu trúc: JavaScript (ES2017+), Vue 3 và Codex theo bản MediaWiki cung cấp, LESS
  với design token của Codex.
- Quy chuẩn code: `eslint-config-wikimedia` và `stylelint-config-wikimedia`; gói thông điệp
  được banana-checker kiểm tra. Lỗi lint chặn merge.
- Test: QUnit trên Node cho các module logic; test mức trình duyệt chỉ thêm khi spec yêu cầu.
- Phụ thuộc: Gadgets, Bucket và Scribunto trên wiki. Không có phụ thuộc npm lúc chạy; gói npm
  chỉ dùng khi phát triển không cần giải trình ngoài plan.
- Môi trường test: một wiki trên Wikimedia Cloud VPS dùng dữ liệu tự tạo theo cấu trúc infobox
  thật; MUST NOT chép nội dung wiki thật.

## Quy trình phát triển

- Công việc theo Spec Kit: spec → (clarify) → plan → tasks → implement. Mỗi plan MUST có mục
  Constitution Check đối chiếu Nguyên tắc I–VIII và ghi lại mọi ngoại lệ có giải trình.
- Thay đổi vào qua pull request trên GitHub. Người duyệt MUST kiểm tra: tuân thủ hiến pháp, có
  test cho hành vi mới, có mẫu round-trip cho mọi thay đổi parser/serializer, có thông điệp cho
  chuỗi mới.
- Phát hành theo semantic versioning; thay đổi người dùng thấy được ghi vào changelog.

## Quản trị

- Hiến pháp này đứng trên các thông lệ khác của dự án. Khi hướng dẫn hay plan mâu thuẫn với nó,
  hiến pháp thắng cho tới khi được sửa đổi.
- Sửa đổi qua pull request nêu lý do, cập nhật cả bản tiếng Anh và tiếng Việt, và cập nhật
  phiên bản bên dưới.
- Phiên bản: MAJOR khi bỏ hoặc định nghĩa lại một nguyên tắc; MINOR khi thêm nguyên tắc/mục
  hoặc mở rộng đáng kể hướng dẫn; PATCH khi làm rõ hoặc sửa câu chữ.
- Việc tuân thủ được kiểm tra khi lập plan (Constitution Check) và khi review. Ngoại lệ MUST
  được ghi lại kèm lý do ở mục Complexity Tracking của plan.

**Phiên bản**: 2.1.0 | **Thông qua**: 2026-11-19 | **Sửa đổi lần cuối**: 2026-11-24
