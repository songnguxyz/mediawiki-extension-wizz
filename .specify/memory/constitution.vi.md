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
  PHPUnit; test MUST thất bại trước khi phần cài đặt làm nó chạy qua.
- Bộ mẫu round-trip (các dạng infobox thực tế, dựng từ dữ liệu tự tạo) là tài sản lâu dài của
  dự án; MAY thêm mẫu nhưng MUST NOT xóa mẫu để test chạy qua.
- Mỗi lỗi làm hỏng wikitext được báo về MUST có một mẫu round-trip tái hiện lỗi (đang thất bại)
  trước khi bản sửa được merge.
- CI (lint + unit test + integration test) MUST xanh trước khi merge. MUST NOT bỏ qua hay tắt
  test để có màu xanh.

Lý do: hồi quy giữa các phiên bản là phàn nàn lớn thứ hai về Page Forms.

### III. Validate phía máy chủ là thẩm quyền cuối

- Mọi luật validate MUST được áp dụng phía máy chủ khi lưu. Kiểm tra phía trình duyệt chỉ để
  báo lỗi sớm và MUST NOT là lớp duy nhất.
- Kiểu ô (PAGE, TEXT, INTEGER, DOUBLE, BOOLEAN) và thuộc tính nhiều giá trị MUST lấy từ schema
  Bucket; định nghĩa form MUST NOT khai lại.
- Regex do người dùng khai MUST chạy dưới giới hạn thời gian/backtrack; khi chạm giới hạn MUST
  báo lỗi validate, không bao giờ làm treo request.
- Giá trị cũ không hợp lệ MUST được hiển thị kèm cảnh báo và MUST NOT bị đổi hay bỏ đi trừ khi
  người dùng sửa ô đó.
- Định nghĩa form MUST được kiểm tra khi lưu; định nghĩa không hợp lệ MUST bị từ chối.

Lý do: dữ liệu chảy từ template vào Bucket; một giá trị sai làm hỏng mọi truy vấn dựa trên nó.

### IV. Không vượt quyền

- Sửa đổi MUST được lưu qua đường sửa chuẩn của MediaWiki core, dưới danh nghĩa người dùng đang
  thao tác, để khóa trang, AbuseFilter, CAPTCHA, giới hạn tốc độ, cấm sửa và phát hiện xung đột
  sửa áp dụng y như khi sửa wikitext thông thường.
- Wizz MUST khai quyền riêng cho việc dùng form và việc sửa định nghĩa form, với mặc định hẹp
  (lần lượt: người dùng đã đăng nhập; quản trị viên và quản trị viên giao diện).
- Các lối vào và hành vi tùy chọn (tab sửa, nút trên infobox, cho người không đăng nhập dùng)
  MUST mặc định tắt và được bật theo từng wiki qua cấu hình.

Lý do: form không bao giờ được trở thành đường vòng qua các lớp chống phá hoại của wiki.

### V. Tương thích wiki farm

- Wizz MUST triển khai được trên Miraheze và WikiOasis và qua được quy trình duyệt extension
  của họ.
- Nhắm MediaWiki 1.45 trở lên (bản stable các farm đang dùng). Chỉ dùng API và hook công khai,
  ổn định của core; MUST NOT đưa vào API đã bị deprecate.
- Wizz MUST NOT tạo bảng cơ sở dữ liệu riêng và MUST NOT tải tài nguyên từ máy chủ bên ngoài.
- Wizz MUST NOT phụ thuộc API bên thứ ba chưa ổn định của Bucket; Wizz sửa tham số template và
  để template/module Lua của wiki ghi vào Bucket.
- Wizz MUST NOT dùng lại code Page Forms và MUST cài được song song với Page Forms mà không xung
  đột tên (trang đặc biệt, quyền, hook, khóa thông điệp, module ResourceLoader, biến cấu hình).
- Giấy phép: GPL-2.0-or-later cho toàn bộ code; các phụ thuộc MUST tương thích GPL.

Lý do: triển khai trên farm là lý do Wizz ra đời; mọi thứ người duyệt của farm từ chối đều là
vật cản.

### VI. Người mới dùng được trên mọi thiết bị

- Giao diện MUST dựng bằng Codex (hệ thống thiết kế của MediaWiki) và thiết kế cho điện thoại
  trước.
- Mọi form MUST dùng được trên Minerva, Citizen và Vector 2022, ở cả chế độ sáng và tối.
- Mọi chuỗi hiển thị cho người dùng MUST đi qua hệ thống i18n của MediaWiki, có sẵn `en`, `vi`
  và tài liệu `qqq`; không viết cứng chữ trong giao diện.
- Giao diện MUST đạt mức trợ năng cơ bản: ô nhập có nhãn, thao tác được bằng bàn phím, lỗi được
  thông báo và gắn với đúng ô, độ tương phản đủ.

Lý do: người dùng mục tiêu là người mới ngại wikitext, và ngày càng dùng điện thoại.

### VII. Đơn giản

- Chỉ làm những gì spec hiện hành đã duyệt yêu cầu. Những mục ngoài phạm vi giữ ngoài phạm vi
  cho tới khi một spec đưa chúng vào.
- Không thêm abstraction, tùy chọn cấu hình hay điểm mở rộng khi chưa có yêu cầu thực tế; mọi
  độ phức tạp thêm vào MUST được giải trình ở mục Complexity Tracking của plan.
- Ưu tiên dùng sẵn của core/Codex thay vì code tự viết.

Lý do: codebase nhỏ dễ duyệt, dễ giữ không hồi quy và dễ được farm chấp thuận.

## Ràng buộc kỹ thuật

- Ngôn ngữ và cấu trúc: PHP (phiên bản theo yêu cầu của MediaWiki 1.45) với `extension.json`,
  namespace PSR-4 `MediaWiki\Extension\Wizz`, service qua service container; frontend qua
  ResourceLoader và Codex.
- Quy chuẩn code: `mediawiki/mediawiki-codesniffer` và `phan` cho PHP; `eslint-config-wikimedia`
  và `stylelint-config-wikimedia` cho JS/CSS/LESS. Lỗi lint chặn merge.
- Test: PHPUnit (unit test không dùng DB; integration test khi cần service của core). Test mức
  trình duyệt chỉ thêm khi spec yêu cầu.
- Phụ thuộc: Bucket và Scribunto là bắt buộc lúc chạy cho MVP. Không thêm phụ thuộc
  Composer/npm lúc chạy nếu không có giải trình ở mức plan.
- Môi trường test: một wiki trên Wikimedia Cloud VPS dùng dữ liệu tự tạo theo cấu trúc infobox
  thật; MUST NOT chép nội dung wiki thật.

## Quy trình phát triển

- Công việc theo Spec Kit: spec → (clarify) → plan → tasks → implement. Mỗi plan MUST có mục
  Constitution Check đối chiếu Nguyên tắc I–VII và ghi lại mọi ngoại lệ có giải trình.
- Thay đổi vào qua pull request. Người duyệt MUST kiểm tra: tuân thủ hiến pháp, có test cho
  hành vi mới, có mẫu round-trip cho mọi thay đổi parser/serializer, có i18n cho chuỗi mới.
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

**Phiên bản**: 1.0.0 | **Thông qua**: 2026-11-19 | **Sửa đổi lần cuối**: 2026-11-19
