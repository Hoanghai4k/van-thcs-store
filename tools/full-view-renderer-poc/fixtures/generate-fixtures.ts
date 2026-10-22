import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createSyntheticLessonPdf(isModifiedVersion: boolean = false): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  // Load Windows Arial font for high fidelity Vietnamese typography
  const arialBytes = readFileSync("C:/Windows/Fonts/arial.ttf");
  const font = await doc.embedFont(arialBytes);

  const primaryColor = rgb(0.1, 0.2, 0.45);
  const textColor = rgb(0.15, 0.15, 0.15);
  const accentColor = rgb(0.8, 0.2, 0.1);
  const borderColor = rgb(0.7, 0.75, 0.8);
  const headerBgColor = rgb(0.92, 0.95, 0.98);

  const versionTag = isModifiedVersion ? "TÁI BẢN BỔ SUNG NĂM HỌC 2026-2027" : "LƯU HÀNH NỘI BỘ NĂM HỌC 2025-2026";
  const dateTag = isModifiedVersion ? "Cập nhật: 22/10/2026 (Phiên bản 2.0)" : "Biên soạn: 15/08/2025 (Phiên bản 1.0)";

  // ══════════════════════════════════════════════════════════════
  // TRANG 1: THÔNG TIN CHUNG VÀ MỤC TIÊU BÀI HỌC
  // ══════════════════════════════════════════════════════════════
  const page1 = doc.addPage([595, 842]); // A4
  
  // Header
  page1.drawText("BỘ GIÁO DỤC VÀ ĐÀO TẠO — PHÒNG GD&ĐT QUẬN 1", {
    x: 50,
    y: 790,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  page1.drawText(`TRƯỜNG THCS NGUYỄN DU — ${versionTag}`, {
    x: 50,
    y: 775,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  page1.drawLine({
    start: { x: 50, y: 765 },
    end: { x: 545, y: 765 },
    thickness: 1,
    color: borderColor,
  });

  // Tiêu đề bài học
  page1.drawText("KẾ HOẠCH BÀI DẠY (GIÁO ÁN ĐIỆN TỬ)", {
    x: 50,
    y: 730,
    size: 13,
    font,
    color: accentColor,
  });

  page1.drawText("BÀI 8: TỔNG KẾT VĂN HỌC TRUNG ĐẠI VIỆT NAM", {
    x: 50,
    y: 705,
    size: 16,
    font,
    color: primaryColor,
  });

  page1.drawText(`Môn: Ngữ văn 9 (Bộ sách Kết nối tri thức) — ${dateTag}`, {
    x: 50,
    y: 685,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Khung tóm tắt mục tiêu
  page1.drawRectangle({
    x: 50,
    y: 470,
    width: 495,
    height: 190,
    borderColor: borderColor,
    borderWidth: 1,
    color: headerBgColor,
  });

  page1.drawText("I. MỤC TIÊU BÀI HỌC CẦN ĐẠT", {
    x: 65,
    y: 635,
    size: 12,
    font,
    color: primaryColor,
  });

  const objectives = [
    "1. Kiến thức: Nắm vững hệ thống thể loại, tư tưởng yêu nước và nhân đạo trong văn học trung đại.",
    "2. Năng lực đặc thù: Phân tích được nét đặc sắc về ngôn ngữ, hình ảnh ước lệ tượng trưng.",
    "3. Năng lực chung: Tự chủ và tự học, hợp tác nhóm giải quyết vấn đề sáng tạo.",
    "4. Phẩm chất: Bồi dưỡng lòng yêu nước, niềm tự hào về truyền thống văn hiến của dân tộc Việt Nam.",
    "5. Ứng dụng thực tế: Viết đoạn văn nghị luận xã hội liên hệ từ các tác phẩm trung đại.",
  ];

  let objY = 605;
  for (const line of objectives) {
    page1.drawText(line, { x: 65, y: objY, size: 9.5, font, color: textColor });
    objY -= 24;
  }

  // Đoạn văn mẫu
  page1.drawText("II. ĐẶC ĐIỂM THỂ LOẠI VÀ THI PHÁP TRUNG ĐẠI", {
    x: 50,
    y: 430,
    size: 12,
    font,
    color: primaryColor,
  });

  const bodyParagraphs = [
    "Văn học trung đại Việt Nam phát triển từ thế kỷ X đến hết thế kỷ XIX trong bối cảnh lịch sử",
    "đặc biệt của chế độ phong kiến. Nền văn học mang đậm tính quy phạm, sùng cổ, biểu hiện qua",
    "hệ thống thi pháp chặt chẽ: ước lệ tượng trưng, đối ngẫu nghiêm ngặt, sử dụng điển tích điển cố.",
    "Tuy nhiên, các tác gia kiệt xuất như Nguyễn Trãi, Nguyễn Du, Hồ Xuân Hương đã khéo léo phá vỡ",
    "tính quy phạm, đưa hơi thở đời sống bình dị và tâm hồn người Việt vào từng trang thơ tuyệt tác.",
  ];

  let bodyY = 405;
  for (const p of bodyParagraphs) {
    page1.drawText(p, { x: 50, y: bodyY, size: 10, font, color: textColor });
    bodyY -= 18;
  }

  // Chân trang 1
  page1.drawText("Trang 1 / 3 — Tài Liệu Hằng Cao (https://tailieuhangcao.vn)", {
    x: 180,
    y: 35,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // ══════════════════════════════════════════════════════════════
  // TRANG 2: BẢNG PHÂN PHỐI HOẠT ĐỘNG DẠY HỌC
  // ══════════════════════════════════════════════════════════════
  const page2 = doc.addPage([595, 842]);

  page2.drawText("BÀI 8: TỔNG KẾT VĂN HỌC TRUNG ĐẠI (TIẾP THEO)", {
    x: 50,
    y: 790,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  page2.drawText("III. TIẾN TRÌNH TỔ CHỨC HOẠT ĐỘNG DẠY HỌC CHI TIẾT", {
    x: 50,
    y: 755,
    size: 13,
    font,
    color: primaryColor,
  });

  // Vẽ bảng hoạt động
  const tableTop = 730;
  const colX = [50, 150, 310, 420, 545]; // 4 cột

  // Nền header bảng
  page2.drawRectangle({
    x: colX[0],
    y: tableTop - 30,
    width: colX[4] - colX[0],
    height: 30,
    color: headerBgColor,
    borderColor: borderColor,
    borderWidth: 1,
  });

  // Tiêu đề cột
  page2.drawText("Hoạt động", { x: colX[0] + 15, y: tableTop - 20, size: 10, font, color: primaryColor });
  page2.drawText("Mục tiêu cần đạt", { x: colX[1] + 30, y: tableTop - 20, size: 10, font, color: primaryColor });
  page2.drawText("Thời lượng", { x: colX[2] + 25, y: tableTop - 20, size: 10, font, color: primaryColor });
  page2.drawText("Phương pháp", { x: colX[3] + 25, y: tableTop - 20, size: 10, font, color: primaryColor });

  // Dữ liệu bảng
  const tableRows = [
    {
      act: "1. Khởi động",
      goal: "Tạo hứng thú, kết nối kiến thức ca dao - tục ngữ.",
      time: "5 phút",
      method: "Trò chơi ô chữ",
    },
    {
      act: "2. Khảo sát tư liệu",
      goal: "Lập bảng niên biểu các tác phẩm tiêu biểu (TK X - XIX).",
      time: "20 phút",
      method: "Thảo luận nhóm 4",
    },
    {
      act: "3. Thảo luận chuyên sâu",
      goal: "Phân tích giá trị nhân đạo trong Truyện Kiều và Chinh phụ ngâm.",
      time: "30 phút",
      method: "Khăn trải bàn",
    },
    {
      act: "4. Luyện tập",
      goal: "Viết đoạn văn so sánh hình tượng người phụ nữ.",
      time: "25 phút",
      method: "Thực hành cá nhân",
    },
    {
      act: "5. Vận dụng mở rộng",
      goal: "Sưu tầm câu đối, hoành phi chữ Hán Nôm tại địa phương.",
      time: "10 phút",
      method: "Dự án học tập",
    },
  ];

  let currentY = tableTop - 30;
  for (const r of tableRows) {
    const rowHeight = 45;
    page2.drawRectangle({
      x: colX[0],
      y: currentY - rowHeight,
      width: colX[4] - colX[0],
      height: rowHeight,
      borderColor: borderColor,
      borderWidth: 1,
    });

    page2.drawText(r.act, { x: colX[0] + 8, y: currentY - 26, size: 9, font, color: textColor });
    page2.drawText(r.goal, { x: colX[1] + 8, y: currentY - 26, size: 8.5, font, color: textColor });
    page2.drawText(r.time, { x: colX[2] + 25, y: currentY - 26, size: 9, font, color: textColor });
    page2.drawText(r.method, { x: colX[3] + 12, y: currentY - 26, size: 9, font, color: textColor });

    currentY -= rowHeight;
  }

  // Vẽ các đường kẻ dọc cột
  for (const x of colX) {
    page2.drawLine({
      start: { x, y: tableTop },
      end: { x, y: currentY },
      thickness: 1,
      color: borderColor,
    });
  }

  // Chân trang 2
  page2.drawText("Trang 2 / 3 — Tài Liệu Hằng Cao (https://tailieuhangcao.vn)", {
    x: 180,
    y: 35,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // ══════════════════════════════════════════════════════════════
  // TRANG 3: CÂU HỎI ĐÁNH GIÁ VÀ HƯỚNG DẪN ÔN TẬP
  // ══════════════════════════════════════════════════════════════
  const page3 = doc.addPage([595, 842]);

  page3.drawText("IV. HỆ THỐNG CÂU HỎI ĐÁNH GIÁ ĐỊNH KỲ", {
    x: 50,
    y: 770,
    size: 13,
    font,
    color: primaryColor,
  });

  const questions = [
    "Câu 1: Phân tích cảm hứng yêu nước qua bài thơ 'Nam quốc sơn hà' và 'Hịch tướng sĩ'.",
    "Câu 2: Vẻ đẹp bi kịch và khát vọng tự do của nàng Kiều trong đoạn trích 'Kiều ở lầu Ngưng Bích'.",
    "Câu 3: Đánh giá nghệ thuật miêu tả nội tâm nhân vật độc đáo bậc thầy của Nguyễn Du.",
    "Câu 4: Trình bày cảm nghĩ về tinh thần tự hào dân tộc thể hiện trong 'Bình Ngô đại cáo'.",
  ];

  let qY = 735;
  for (const q of questions) {
    page3.drawText(q, { x: 50, y: qY, size: 10, font, color: textColor });
    qY -= 28;
  }

  // Khung ghi chú bảo mật
  page3.drawRectangle({
    x: 50,
    y: 490,
    width: 495,
    height: 110,
    borderColor: rgb(0.9, 0.6, 0.2),
    borderWidth: 1,
    color: rgb(0.99, 0.98, 0.94),
  });

  page3.drawText("LƯU Ý VỀ BẢN QUYỀN VÀ BẢO MẬT NỘI DUNG", {
    x: 65,
    y: 575,
    size: 11,
    font,
    color: rgb(0.8, 0.4, 0.0),
  });

  page3.drawText("1. Tài liệu này được tạo độc quyền cho giáo viên thành viên của hệ thống Tài Liệu Hằng Cao.", {
    x: 65,
    y: 550,
    size: 9,
    font,
    color: textColor,
  });
  page3.drawText("2. Mọi hành vi sao chép, phát tán trái phép mà không có sự đồng ý bằng văn bản đều vi phạm bản quyền.", {
    x: 65,
    y: 532,
    size: 9,
    font,
    color: textColor,
  });
  page3.drawText("3. Hệ thống áp dụng công nghệ bảo vệ hiển thị phân trang bảo mật cao — không phát tán tệp gốc.", {
    x: 65,
    y: 514,
    size: 9,
    font,
    color: textColor,
  });

  // Chân trang 3
  page3.drawText("Trang 3 / 3 — Tài Liệu Hằng Cao (https://tailieuhangcao.vn)", {
    x: 180,
    y: 35,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  return doc.save();
}

async function main() {
  const fixturesDir = resolve(__dirname);
  mkdirSync(fixturesDir, { recursive: true });

  // 1. Generate base fixture
  const baseBytes = await createSyntheticLessonPdf(false);
  const basePath = resolve(fixturesDir, "sample-vietnamese-lesson.pdf");
  writeFileSync(basePath, baseBytes);
  console.log(`[Fixture] Generated: ${basePath} (${baseBytes.length} bytes)`);

  // 2. Generate modified fixture (different bytes for source invalidation test)
  const modifiedBytes = await createSyntheticLessonPdf(true);
  const modifiedPath = resolve(fixturesDir, "sample-vietnamese-modified.pdf");
  writeFileSync(modifiedPath, modifiedBytes);
  console.log(`[Fixture] Generated: ${modifiedPath} (${modifiedBytes.length} bytes)`);
}

main().catch((err) => {
  console.error("Failed to generate fixtures:", err);
  process.exit(1);
});
