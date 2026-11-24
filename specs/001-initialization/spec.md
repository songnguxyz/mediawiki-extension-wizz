# Feature Specification: Wizz — Form sửa infobox gắn với Bucket

**Feature Branch**: `001-initialization`
**Created**: 2026-11-19
**Status**: Draft
**Input**: Mô tả của người dùng: "Viết một extension MediaWiki mới thay cho Page Forms, cho phép sửa infobox qua form có validate chặt, dữ liệu gắn với Bucket, chống regression; MVP chỉ sửa infobox trên trang đã có."

**Bối cảnh**: Page Forms có input OOUI/VEForAll hiển thị lỗi, không hỗ trợ Bucket (chỉ SMW và Cargo), hay regression giữa các phiên bản, và Miraheze đã ngừng cho bật Page Forms trên wiki mới. Wizz mượn ý tưởng của Page Forms nhưng không dùng lại code.

## Clarifications

### Session 2026-11-19

- Q: Khi trình duyệt tắt JavaScript, Special:EditInfobox có cần chạy được không? → A: Không; hiện thông báo cần JavaScript kèm liên kết sang sửa wikitext. *(2026-11-24: chuyển sang gadget, lối vào là `?wizz=1`.)*
- Q: Đo SC-005 thế nào? → A: 5 người thử, ít nhất 4/5 hoàn thành, mỗi lần dưới 3 phút.
- Q: Khi lời gọi template viết sai cú pháp, Wizz từ chối mở form hay mở kèm cảnh báo? → A: Từ chối mở form, báo vị trí lỗi và đưa liên kết sang sửa wikitext.
- Q: Khi schema bucket đổi sau khi định nghĩa form đã lưu, form xử lý thế nào? → A: Luôn dùng schema hiện hành; ô trỏ tới trường đã xóa thành chỉ đọc kèm cảnh báo; ô đổi kiểu validate theo kiểu mới; các ô khác dùng bình thường.
- Q: Ô TEXT chứa wikitext phức tạp (template lồng, `<ref>`, comment, `<nowiki>`) có sửa được trong form không? → A: Có; ô hiện nguyên wikitext gốc trong khung nhiều dòng, không sửa thì giữ nguyên từng byte, có sửa thì lưu đúng nội dung đã nhập.
- Q: Giá trị nhập vào ô nhiều giá trị chứa chính ký tự phân tách thì sao? → A: Tự tách thành nhiều giá trị, không cảnh báo.
- Q: Có giữ nút sửa ngay trên infobox (mở form dạng hộp thoại) không? → A: Không; bỏ khỏi phạm vi, chỉ giữ Special:EditInfobox và tab "Sửa infobox". *(2026-11-24: chuyển sang gadget, lối vào là `?wizz=1`.)*
- Q: Wizz có nhận ra template gọi qua trang đổi hướng hoặc tên viết khác không? → A: Có, nhận cả biến thể tên (chữ đầu, `_`/khoảng trắng, tiền tố namespace) và trang đổi hướng tới template; khi lưu giữ nguyên tên gọi gốc.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Biên tập viên sửa infobox qua form (Priority: P1)

Một biên tập viên mở form cho một trang đã có infobox, thấy các giá trị hiện tại trong từng ô, sửa vài ô và lưu. Chỉ những tham số đã sửa thay đổi trong wikitext; phần còn lại của trang giữ nguyên.

**Why this priority**: Đây là giá trị cốt lõi của Wizz: người đóng góp mới sửa được dữ liệu infobox mà không phải đọc wikitext. Không có câu chuyện này thì không có sản phẩm.

**Independent Test**: Trên wiki test có sẵn một định nghĩa form và một trang có infobox, mở `<Tên trang>?wizz=1`, sửa một ô, lưu, rồi so diff của sửa đổi.

**Acceptance Scenarios**:

1. **Given** một trang có infobox gắn với form, **When** biên tập viên mở form, **Then** mỗi ô hiện đúng giá trị hiện tại của tham số tương ứng.
2. **Given** form đang mở, **When** biên tập viên sửa một ô và lưu, **Then** diff của sửa đổi chỉ chứa thay đổi ở tham số đó.
3. **Given** form đang mở, **When** biên tập viên lưu mà không sửa gì, **Then** wikitext của trang giữ nguyên từng byte và không tạo sửa đổi rỗng.
4. **Given** infobox có tham số không được khai trong form, **When** biên tập viên lưu, **Then** các tham số đó giữ nguyên nội dung, vị trí và khoảng trắng.
5. **Given** sửa đổi đã lưu thành công, **When** xem lịch sử trang, **Then** tóm tắt sửa đổi tự động liệt kê các tham số đã đổi (ví dụ "Sửa infobox: chieu_cao, cung") và sửa đổi mang tag `wizz` (nếu tag đã bật).

---

### User Story 2 - Dữ liệu sai không vào được Bucket (Priority: P1)

Khi biên tập viên nhập giá trị sai kiểu hoặc sai luật, form chặn việc lưu, chỉ rõ ô nào sai và vì sao, và giữ nguyên những gì đã nhập.

**Why this priority**: Infobox ghi dữ liệu vào Bucket; dữ liệu sai làm hỏng mọi truy vấn dựa trên bucket. Validate chặt là lý do chính để làm Wizz thay vì sửa wikitext trực tiếp. Wizz chỉ bảo vệ các sửa đổi đi qua form; dữ liệu nhập bằng sửa wikitext do template/Lua của wiki kiểm tra.

**Independent Test**: Với một form khai đủ các loại luật, gửi lần lượt từng giá trị sai và kiểm tra rằng không có sửa đổi nào được lưu và đúng ô bị đánh dấu.

**Acceptance Scenarios**:

1. **Given** một ô kiểu INTEGER hoặc DOUBLE, **When** biên tập viên nhập chữ, wikitext hoặc giá trị như `~150`, **Then** form không lưu và báo lỗi tại ô đó.
2. **Given** một ô có luật bắt buộc, min/max, regex hoặc danh sách cho phép, **When** giá trị vi phạm luật, **Then** form không lưu và nêu luật bị vi phạm.
3. **Given** một ô kiểu PAGE có yêu cầu trang phải tồn tại, **When** biên tập viên nhập tên trang chưa có, **Then** form không lưu và báo trang không tồn tại.
4. **Given** một ô nhiều giá trị (repeated), **When** một trong các giá trị sai luật, **Then** form báo đúng giá trị sai đó.
5. **Given** còn ít nhất một ô sai, **When** biên tập viên bấm lưu, **Then** Wizz không gửi yêu cầu lưu nào tới wiki.
6. **Given** trang cũ có giá trị không hợp lệ ở một ô, **When** biên tập viên mở form, **Then** ô đó hiện giá trị cũ kèm cảnh báo; form vẫn lưu được nếu biên tập viên không sửa ô đó, và chỉ validate ô đó khi nó bị sửa.

---

### User Story 3 - Quản trị viên định nghĩa form cho một template (Priority: P1)

Quản trị viên tạo một trang định nghĩa form, gắn nó với một template infobox và một bucket, khai nhãn, thứ tự và luật cho từng ô. Định nghĩa được viết bằng JSON; MVP không có trình soạn định nghĩa dạng đồ họa.

**Why this priority**: Không có định nghĩa form thì biên tập viên không có form để dùng. Định nghĩa sai có thể ghi dữ liệu sai vào Bucket, nên phải được kiểm tra trước khi form dùng nó, và chỉ được tin khi trang đã khóa.

**Independent Test**: Tạo một định nghĩa hợp lệ (đã khóa) và một định nghĩa không hợp lệ; định nghĩa hợp lệ cho form hiện ra trên trang có template đó, định nghĩa không hợp lệ làm form không mở và liệt kê lỗi.

**Acceptance Scenarios**:

1. **Given** trang định nghĩa hợp lệ và đã khóa ở mức quản trị viên, **When** biên tập viên mở form trên một trang dùng template đó, **Then** form dùng định nghĩa đó ngay.
2. **Given** tên tham số template trùng tên trường trong bucket, **When** định nghĩa form không khai ánh xạ, **Then** tham số và trường được ghép theo tên.
3. **Given** tên tham số khác tên trường (ví dụ có dấu hoặc có khoảng trắng), **When** định nghĩa khai ánh xạ đè, **Then** form dùng ánh xạ đã khai.
4. **Given** định nghĩa sai cấu trúc, trỏ tới bucket không tồn tại hoặc khai trường không có trong bucket, **When** mở form, **Then** form không mở và thông báo nêu rõ từng lỗi.
5. **Given** trang định nghĩa chưa khóa ở mức quản trị viên, **When** mở form, **Then** form không mở và báo định nghĩa chưa được tin cậy.
6. **Given** quản trị viên vừa lưu trang định nghĩa, **When** xem trang đó, **Then** thấy ngay định nghĩa hợp lệ hay không kèm từng lỗi, và mở được bản xem thử form mà không cần tìm bài viết dùng template.

---

### User Story 4 - Xem trước, xem diff và xử lý xung đột trước khi lưu (Priority: P2)

Trước khi lưu, biên tập viên xem infobox sẽ hiển thị ra sao với giá trị mới và xem diff wikitext. Nếu trang đã bị người khác sửa trong lúc mở form, biên tập viên được báo và sửa tiếp trên bản mới mà không mất dữ liệu đã nhập.

**Why this priority**: Giúp người mới tự tin bấm lưu và tránh ghi đè sửa đổi của người khác. Cần có trước khi đưa lên wiki thật, nhưng có thể test sau câu chuyện 1 và 2.

**Independent Test**: Mở form ở hai phiên, lưu ở phiên thứ nhất, rồi lưu ở phiên thứ hai và kiểm tra thông báo xung đột; riêng phần xem trước và diff kiểm tra bằng một phiên.

**Acceptance Scenarios**:

1. **Given** form có giá trị hợp lệ, **When** biên tập viên chọn xem trước, **Then** infobox được hiển thị với giá trị mới và diff wikitext được hiển thị trước khi xác nhận lưu.
2. **Given** trang đã có phiên bản mới hơn từ lúc mở form, **When** biên tập viên lưu, **Then** form báo xung đột, nạp phiên bản mới và giữ các giá trị biên tập viên đã nhập.
3. **Given** trang bị khóa, AbuseFilter hoặc CAPTCHA áp dụng, **When** biên tập viên mở hoặc lưu qua form, **Then** các cơ chế đó áp dụng giống như khi sửa wikitext thông thường.

---

### User Story 5 - Chọn instance khi trang gọi template nhiều lần (Priority: P2)

Trên trang gọi cùng một template infobox nhiều lần, biên tập viên thấy danh sách các lần gọi và chọn đúng một lần để sửa.

**Why this priority**: Một số trang có nhiều infobox cùng loại; sửa nhầm instance là lỗi dữ liệu khó phát hiện.

**Independent Test**: Trên trang có hai lần gọi cùng template, chọn lần thứ hai, sửa một ô, lưu, và kiểm tra rằng chỉ lần gọi thứ hai thay đổi.

**Acceptance Scenarios**:

1. **Given** trang có nhiều lần gọi cùng template, **When** biên tập viên mở form, **Then** form liệt kê các lần gọi kèm thông tin đủ để phân biệt và yêu cầu chọn một.
2. **Given** biên tập viên đã chọn một instance, **When** lưu, **Then** chỉ instance đó thay đổi.
3. **Given** trang chỉ có một lần gọi, **When** mở form, **Then** form mở thẳng vào instance đó, không hỏi chọn.

---

### User Story 6 - Mở form từ nhiều lối vào, trên cả điện thoại (Priority: P3)

Biên tập viên mở form qua URL `?wizz=1`, hoặc từ tab "Sửa infobox" nếu wiki bật, và dùng form thoải mái trên điện thoại.

**Why this priority**: Tăng khả năng người mới tìm thấy form, nhưng URL `?wizz=1` đã đủ để dùng được sản phẩm.

**Independent Test**: Bật/tắt tab trong cấu hình wiki test và mở form từ URL `?wizz=1` và từ tab trên skin Minerva, Citizen và Vector 2022.

**Acceptance Scenarios**:

1. **Given** wiki đã cài gadget, **When** mở `<Tên trang>?wizz=1`, **Then** form mở được mà không cần cấu hình thêm.
2. **Given** wiki bật tab "Sửa infobox", **When** người dùng xem trang có infobox gắn form, **Then** tab hiện ra; khi tắt thì không hiện.
3. **Given** người dùng trên skin Minerva, **When** mở form, **Then** form hiển thị một cột, mọi ô dùng được và nút lưu luôn trong tầm với.
4. **Given** người dùng bật chế độ tối, **When** mở form, **Then** mọi chữ và ô nhập đều đọc được.

---

### Edge Cases

- Mở `?wizz=1` trên trang không có infobox gắn form: hiện thông báo kèm liên kết sang sửa wikitext.
- Lời gọi template viết sai cú pháp (thiếu `}}`, lồng lẫn lộn): form không mở; hệ thống báo vị trí lỗi và đưa liên kết sang sửa wikitext. Wizz không đoán ranh giới template.
- Giá trị tham số ô TEXT chứa template lồng nhau, `<ref>`, comment hoặc `<nowiki>`: ô hiện nguyên wikitext gốc trong khung nhiều dòng và sửa được; không sửa thì giữ nguyên từng byte, có sửa thì lưu đúng nội dung đã nhập.
- Schema bucket thay đổi sau khi định nghĩa form đã lưu: form luôn đọc schema hiện hành khi mở. Ô trỏ tới trường đã bị xóa hiện ở chế độ chỉ đọc kèm cảnh báo và giữ nguyên giá trị; ô bị đổi kiểu được validate theo kiểu mới; các ô khác dùng bình thường.
- Template được gọi qua trang đổi hướng hoặc tên viết khác (chữ hoa đầu, khoảng trắng/gạch dưới, tiền tố namespace): Wizz nhận ra là cùng template; khi lưu giữ nguyên tên gọi gốc trong wikitext.
- Giá trị nhập vào ô nhiều giá trị chứa chính ký tự phân tách: hệ thống tách thành nhiều giá trị, không cảnh báo; từng giá trị sau khi tách được validate riêng theo FR-013.
- Một mẫu regex quá chậm: Wizz dừng kiểm tra sau giới hạn thời gian và báo lỗi ở ô đó; trình duyệt không bị treo.
- Người không có quyền sửa trang (kể cả người chưa đăng nhập): theo đúng quyền sửa của wiki; được sửa wikitext thì được dùng form, không được thì form báo ngay khi mở rằng không có quyền sửa trang.
- Trình duyệt tắt JavaScript: gadget không chạy, trang hiện như bình thường; muốn sửa thì sửa wikitext.

## Requirements *(mandatory)*

### Functional Requirements

**Sửa và lưu**

- **FR-001**: Hệ thống MUST cho người dùng có quyền mở form sửa infobox của một trang đã có, với giá trị hiện tại điền sẵn trong từng ô.
- **FR-002**: Hệ thống MUST chỉ ghi lại các tham số người dùng đã sửa; mọi phần khác của wikitext (tham số không khai trong form, thứ tự, khoảng trắng, comment, nội dung ngoài lời gọi template) MUST giữ nguyên từng byte.
- **FR-003**: Hệ thống MUST NOT tạo sửa đổi khi người dùng lưu mà không thay đổi gì.
- **FR-004**: Hệ thống MUST cho người dùng chọn một instance khi trang gọi cùng template nhiều lần, và chỉ sửa instance đã chọn.
- **FR-005**: Hệ thống MUST hiển thị bản xem trước của infobox với giá trị mới và diff wikitext trước khi lưu.
- **FR-006**: Hệ thống MUST phát hiện xung đột sửa, báo người dùng, nạp phiên bản mới của trang và giữ các giá trị người dùng đã nhập.
- **FR-007**: Hệ thống MUST tự tạo tóm tắt sửa đổi liệt kê các tham số đã đổi, và gắn tag `wizz` nếu tag đã được tạo và đang bật ở Special:Tags; chưa có tag thì vẫn lưu, chỉ không gắn tag.
- **FR-008**: Hệ thống MUST lưu sửa đổi bằng quyền của chính người dùng, để khóa trang, AbuseFilter, CAPTCHA và các giới hạn khác áp dụng như sửa thông thường.

**Validate**

- **FR-009**: Hệ thống MUST kiểm tra mọi luật trước khi gửi yêu cầu lưu, dùng cùng một bộ luật cho cả lúc báo lỗi khi nhập và lúc lưu; nếu còn lỗi thì MUST NOT gửi yêu cầu lưu.
- **FR-010**: Hệ thống MUST lấy kiểu của mỗi ô (PAGE, TEXT, INTEGER, DOUBLE, BOOLEAN) và thuộc tính nhiều giá trị từ schema của bucket đã khai.
- **FR-011**: Ô INTEGER và DOUBLE MUST chỉ nhận số, không nhận wikitext; nguồn trích dẫn hoặc ghi chú cho ô số đặt ở một tham số TEXT riêng.
- **FR-012**: Hệ thống MUST hỗ trợ các luật khai trong định nghĩa form: bắt buộc; min/max (giá trị với ô số, độ dài với ô TEXT); regex (ô TEXT); danh sách cho phép (ô TEXT và PAGE); trang phải tồn tại, giới hạn theo namespace (ô PAGE).
- **FR-013**: Với ô nhiều giá trị, hệ thống MUST tách theo ký tự phân tách khai trong định nghĩa form và áp dụng luật cho từng giá trị.
- **FR-014**: Khi một luật bị vi phạm, hệ thống MUST không lưu, giữ nguyên mọi giá trị đã nhập và đánh dấu đúng ô lỗi kèm lý do.
- **FR-015**: Giá trị cũ không hợp lệ MUST được hiển thị kèm cảnh báo và chỉ bị validate khi người dùng sửa ô đó.
- **FR-016**: Hệ thống MUST giới hạn thời gian chạy của regex để một mẫu xấu không làm treo trình duyệt; quá giới hạn thì báo lỗi ở ô đó.

**Định nghĩa form**

- **FR-017**: Quản trị viên MUST định nghĩa được form trên trang con `Template:<Tên>/wizz.json` (JSON) của template đó, trỏ tới đúng một bucket; vị trí trang tự bảo đảm mỗi template chỉ có một form.
- **FR-018**: Hệ thống MUST ghép tham số template với trường bucket theo tên mặc định, và cho khai ánh xạ đè khi tên khác nhau.
- **FR-019**: Hệ thống MUST kiểm tra định nghĩa form khi nạp; nếu sai cấu trúc, trỏ tới bucket không tồn tại hoặc khai trường không có trong bucket thì form MUST NOT mở và MUST liệt kê lỗi cho mọi người dùng.
- **FR-020**: Định nghĩa form MUST cho khai nhãn hiển thị, thứ tự các ô và các luật ở FR-012.

**Gợi ý**

- **FR-021**: Ô PAGE MUST gợi ý tên trang bằng tìm kiếm tiêu đề, lọc theo namespace và tùy chọn theo thể loại khai trong định nghĩa form.

**Lối vào và giao diện**

- **FR-022**: Form MUST mở được qua URL `<Trang>?wizz=1` trên mọi wiki đã cài gadget, không cần cấu hình thêm.
- **FR-023**: Wiki MUST bật hoặc tắt được tab "Sửa infobox"; mặc định bật.
- **FR-024**: Form MUST dùng được trên các skin Minerva (điện thoại), Citizen và Vector 2022, ở cả chế độ sáng và tối.
- **FR-025**: Giao diện MUST dịch được qua các gói thông điệp trong repo, có sẵn tiếng Việt và tiếng Anh.
- **FR-026**: Wiki MUST giới hạn được namespace nào dùng form (mặc định chỉ namespace chính); cấu hình nằm ở `MediaWiki:Gadget-wizz-config.json` do quản trị viên giao diện sửa.

**Quyền**

- **FR-027**: Dùng form MUST cần đúng quyền sửa trang đó như khi sửa wikitext; Wizz không thêm quyền riêng.
- **FR-028**: Hệ thống MUST chỉ dùng định nghĩa form khi trang của nó bị khóa sửa ở mức quản trị viên (khóa trực tiếp hoặc khóa lan); nếu không, form MUST NOT mở và báo định nghĩa chưa được tin cậy.
- **FR-029**: Khi xem trang `Template:<Tên>/wizz.json`, hệ thống MUST chạy bước kiểm tra của FR-019 và FR-028 và hiện kết quả (hợp lệ hoặc danh sách lỗi), kèm nút xem thử form với giá trị trống; xem thử MUST NOT lưu gì.

### Key Entities

- **Định nghĩa form**: mô tả cách sửa một template infobox; gắn với một template và một bucket; chứa danh sách ô theo thứ tự.
- **Ô (field)**: một tham số template được sửa qua form; có tên trường bucket, tên tham số (mặc định trùng), nhãn, kiểu (lấy từ bucket), có nhiều giá trị hay không, và các luật validate.
- **Instance infobox**: một lần gọi template trên một trang; có vị trí trên trang và tập tham số hiện tại.
- **Schema bucket**: định nghĩa các trường và kiểu dữ liệu của một bucket; là nguồn sự thật về kiểu cho form.
- **Sửa đổi qua form**: một phiên bản trang tạo bởi Wizz; mang tóm tắt tự động và tag `wizz` (nếu tag đã bật).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các ca trong bộ mẫu round-trip giữ nguyên wikitext từng byte khi lưu không sửa, và chỉ thay đổi đúng tham số được sửa khi có sửa.
- **SC-002**: 0 giá trị vi phạm luật được Wizz gửi đi lưu trong toàn bộ bộ test validate.
- **SC-003**: Mọi loại ô hiển thị và lưu được trên Minerva, Citizen và Vector 2022, ở cả chế độ sáng và tối.
- **SC-004**: Mỗi lỗi được báo về làm hỏng wikitext có một ca round-trip tương ứng trong bộ test trước khi được sửa, và không tái diễn ở phiên bản sau.
- **SC-005**: Trong buổi thử với 5 người đóng góp mới chưa từng sửa wikitext, ít nhất 4/5 người hoàn thành một lần sửa infobox trên điện thoại mà không cần đọc hướng dẫn, mỗi lần dưới 3 phút.

## Assumptions

- **Người dùng mục tiêu**: biên tập viên của các wiki fan (bao gồm người mới ngại sửa wikitext) và quản trị viên wiki định nghĩa form.
- **Môi trường**: MediaWiki 1.45 trở lên, theo bản stable mới nhất mà các wiki farm chạy; Gadgets, Bucket và Scribunto đã cài. MVP bắt buộc có Bucket.
- **Đích triển khai**: Miraheze và WikiOasis; Wizz được quản trị viên giao diện cài như một gadget, không cần farm duyệt; không tải tài nguyên từ bên ngoài.
- **Môi trường test**: một wiki MediaWiki chạy bằng Docker (`dev/test-wiki/`), dùng dữ liệu tự tạo theo cấu trúc infobox thật, không chép nội dung wiki thật; wiki này cũng dùng để test gadget.
- **Phụ thuộc**: dữ liệu vào Bucket qua template và module Lua của wiki; Wizz chỉ sửa tham số template, không ghi trực tiếp vào Bucket. API Bucket cho bên thứ ba chưa ổn định nên MVP không phụ thuộc vào nó.
- **Ngoài phạm vi MVP**: tạo trang mới bằng form, form truy vấn kiểu RunQuery, sửa nhiều template khác nhau trong một form, sửa hàng loạt, nút sửa đặt ngay trên infobox, trình soạn định nghĩa form dạng đồ họa (GUI), chặn dữ liệu sai nhập bằng sửa wikitext hoặc gọi API trực tiếp (thuộc trách nhiệm của template/Lua), chế độ chạy không cần Bucket, gợi ý giá trị từ dữ liệu Bucket.
- **Giấy phép**: MIT.
- **Quan hệ với Page Forms**: Wizz là gadget mới, không dùng lại code Page Forms, và có thể cài song song mà không xung đột tên.
