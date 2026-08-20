-- Seed Data for Văn THCS Store
-- Demo categories and products for development
-- Does NOT create admin users — admin bootstrap is manual.

-- ─── Categories ────────────────────────────────────────────────────

INSERT INTO categories (id, name, slug, description) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Ngữ văn 6', 'ngu-van-6', 'Tài liệu Ngữ văn lớp 6 — SGK mới 2018'),
  ('a1000000-0000-0000-0000-000000000002', 'Ngữ văn 7', 'ngu-van-7', 'Tài liệu Ngữ văn lớp 7 — SGK mới 2018'),
  ('a1000000-0000-0000-0000-000000000003', 'Ngữ văn 8', 'ngu-van-8', 'Tài liệu Ngữ văn lớp 8 — SGK mới 2018'),
  ('a1000000-0000-0000-0000-000000000004', 'Ngữ văn 9', 'ngu-van-9', 'Tài liệu Ngữ văn lớp 9 — SGK mới 2018'),
  ('a1000000-0000-0000-0000-000000000005', 'Đọc hiểu', 'doc-hieu', 'Bộ đề đọc hiểu có đáp án'),
  ('a1000000-0000-0000-0000-000000000006', 'Nghị luận xã hội', 'nghi-luan-xa-hoi', 'Tài liệu và bài văn mẫu nghị luận xã hội'),
  ('a1000000-0000-0000-0000-000000000007', 'Nghị luận văn học', 'nghi-luan-van-hoc', 'Phân tích tác phẩm và bài nghị luận văn học'),
  ('a1000000-0000-0000-0000-000000000008', 'Đề kiểm tra', 'de-kiem-tra', 'Bộ đề kiểm tra giữa kỳ, cuối kỳ'),
  ('a1000000-0000-0000-0000-000000000009', 'Đề thi', 'de-thi', 'Đề thi tuyển sinh, đề thi HSG'),
  ('a1000000-0000-0000-0000-000000000010', 'Combo', 'combo', 'Combo tài liệu ưu đãi — tiết kiệm hơn mua lẻ');

-- ─── Products ──────────────────────────────────────────────────────

INSERT INTO products (name, slug, short_description, description, price, original_price, category_id, file_count, page_count, file_format, features, suitable_for) VALUES
(
  'Bộ đề đọc hiểu Ngữ văn 9 — 50 đề có đáp án',
  'bo-de-doc-hieu-ngu-van-9',
  '50 đề đọc hiểu có đáp án chi tiết, bám sát chương trình SGK mới',
  'Bộ tài liệu gồm 50 đề đọc hiểu Ngữ văn 9, có đáp án chi tiết và hướng dẫn chấm. Phù hợp cho ôn luyện hàng ngày và chuẩn bị thi.',
  99000, 149000,
  'a1000000-0000-0000-0000-000000000005',
  1, 85, 'docx',
  ARRAY['50 đề đọc hiểu có đáp án chi tiết', 'Hướng dẫn chấm bài rõ ràng', 'Bám sát chương trình SGK mới', 'File Word chỉnh sửa được'],
  ARRAY['Học sinh lớp 9', 'Giáo viên Ngữ văn THCS', 'Phụ huynh kèm con ôn thi']
),
(
  'Tuyển tập nghị luận xã hội — 30 bài mẫu',
  'tuyen-tap-nghi-luan-xa-hoi-30-bai',
  '30 bài nghị luận xã hội mẫu, phân loại theo chủ đề, có gợi ý dàn bài',
  '30 bài nghị luận xã hội mẫu chọn lọc, phân loại theo chủ đề nóng, kèm gợi ý dàn bài chi tiết.',
  79000, NULL,
  'a1000000-0000-0000-0000-000000000006',
  1, 62, 'docx',
  ARRAY['30 bài NLXH mẫu chọn lọc', 'Phân loại theo chủ đề', 'Gợi ý dàn bài chi tiết', 'File Word chỉnh sửa được'],
  ARRAY['Học sinh lớp 8–9', 'Người ôn luyện thi vào 10', 'Giáo viên cần bài mẫu tham khảo']
),
(
  'Đề thi vào 10 môn Văn — Tổng hợp 63 tỉnh (2024)',
  'de-thi-vao-10-mon-van-2024',
  'Tổng hợp đề thi tuyển sinh vào lớp 10 môn Ngữ văn của 63 tỉnh thành năm 2024',
  'File Word tổng hợp đề thi tuyển sinh vào lớp 10 môn Ngữ văn của 63 tỉnh/thành phố năm 2024, kèm đáp án và thang điểm chi tiết.',
  149000, 199000,
  'a1000000-0000-0000-0000-000000000009',
  1, 210, 'docx',
  ARRAY['Đề thi 63 tỉnh/thành phố năm 2024', 'Đáp án và thang điểm chi tiết', 'Tổng hợp trong 1 file dễ tra cứu', 'File Word chỉnh sửa được'],
  ARRAY['Học sinh lớp 9 ôn thi vào 10', 'Giáo viên ra đề tham khảo', 'Phụ huynh kèm con ôn thi']
),
(
  'Giáo án Ngữ văn 6 — Cả năm (SGK mới)',
  'giao-an-ngu-van-6-ca-nam',
  'Giáo án Ngữ văn 6 đầy đủ cả năm theo chương trình SGK mới 2018',
  'Giáo án Ngữ văn 6 soạn theo chương trình GDPT 2018, đầy đủ cả năm, trình bày đẹp, có thể chỉnh sửa trên Word.',
  199000, 299000,
  'a1000000-0000-0000-0000-000000000001',
  2, 320, 'docx',
  ARRAY['Giáo án đầy đủ cả năm học', 'Theo chương trình GDPT 2018', 'Trình bày đẹp, chuyên nghiệp', 'File Word chỉnh sửa tự do'],
  ARRAY['Giáo viên Ngữ văn lớp 6', 'Sinh viên sư phạm thực tập']
),
(
  'Phân tích tác phẩm văn học lớp 9 — 25 tác phẩm',
  'phan-tich-tac-pham-van-hoc-lop-9',
  'Phân tích 25 tác phẩm trọng tâm lớp 9, có dàn bài + bài viết mẫu',
  'Tài liệu phân tích chi tiết 25 tác phẩm văn học trọng tâm lớp 9.',
  119000, NULL,
  'a1000000-0000-0000-0000-000000000007',
  1, 145, 'docx',
  ARRAY['25 tác phẩm trọng tâm lớp 9', 'Dàn bài chi tiết từng tác phẩm', 'Bài văn mẫu hoàn chỉnh', 'File Word chỉnh sửa được'],
  ARRAY['Học sinh lớp 9', 'Người ôn luyện thi vào 10', 'Giáo viên tham khảo']
),
(
  'Bộ đề kiểm tra Ngữ văn 8 — Cả năm',
  'bo-de-kiem-tra-ngu-van-8',
  '20 đề kiểm tra giữa kỳ + cuối kỳ Ngữ văn 8, có ma trận và đáp án',
  '20 đề kiểm tra Ngữ văn 8 (giữa kỳ + cuối kỳ), bám sát chương trình, có ma trận đề, đáp án và thang điểm chi tiết.',
  89000, 129000,
  'a1000000-0000-0000-0000-000000000008',
  1, 75, 'docx',
  ARRAY['20 đề kiểm tra giữa kỳ + cuối kỳ', 'Ma trận đề đầy đủ', 'Đáp án và thang điểm chi tiết', 'File Word chỉnh sửa được'],
  ARRAY['Giáo viên Ngữ văn lớp 8', 'Học sinh lớp 8 ôn luyện']
),
(
  'Combo Ngữ văn 9 — Trọn bộ ôn thi vào 10',
  'combo-ngu-van-9-on-thi-vao-10',
  'Trọn bộ tài liệu ôn thi vào 10: đọc hiểu + nghị luận + đề thi',
  'Combo tài liệu ôn thi vào 10 gồm: 50 đề đọc hiểu, 30 bài nghị luận mẫu, và bộ đề thi 63 tỉnh. Tiết kiệm hơn mua lẻ.',
  249000, 377000,
  'a1000000-0000-0000-0000-000000000010',
  3, 357, 'docx',
  ARRAY['Trọn bộ 3 tài liệu ôn thi', '50 đề đọc hiểu + 30 bài NLXH + đề 63 tỉnh', 'Tiết kiệm hơn mua lẻ', 'File Word chỉnh sửa được'],
  ARRAY['Học sinh lớp 9 ôn thi vào 10', 'Phụ huynh mua trọn bộ cho con', 'Giáo viên luyện thi']
),
(
  'Giáo án Ngữ văn 7 — Học kỳ 1 (SGK mới)',
  'giao-an-ngu-van-7-hk1',
  'Giáo án Ngữ văn 7 học kỳ 1 theo chương trình SGK mới 2018',
  'Giáo án Ngữ văn 7 soạn theo chương trình GDPT 2018, trình bày rõ ràng, đầy đủ học kỳ 1.',
  129000, NULL,
  'a1000000-0000-0000-0000-000000000002',
  1, 165, 'docx',
  ARRAY['Giáo án đầy đủ học kỳ 1', 'Theo chương trình GDPT 2018', 'Trình bày rõ ràng, dễ chỉnh sửa', 'File Word mở bằng MS Office, Google Docs'],
  ARRAY['Giáo viên Ngữ văn lớp 7', 'Sinh viên sư phạm thực tập']
);
