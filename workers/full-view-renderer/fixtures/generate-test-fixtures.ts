import { PDFDocument, rgb, StandardFonts, PageSizes } from "pdf-lib";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  await mkdir(__dirname, { recursive: true });

  // 1. Vietnamese Lesson Plan 3-page Fixture
  const doc1 = await PDFDocument.create();
  const font1 = await doc1.embedFont(StandardFonts.Helvetica);
  const boldFont1 = await doc1.embedFont(StandardFonts.HelveticaBold);

  for (let i = 1; i <= 3; i++) {
    const page = doc1.addPage(PageSizes.A4);
    const { width, height } = page.getSize();

    page.drawText(`GIAO AN NGU VAN THCS - BAI HOC SO ${i}`, {
      x: 50,
      y: height - 60,
      size: 16,
      font: boldFont1,
      color: rgb(0.1, 0.2, 0.4),
    });

    page.drawText(`Chu de: Van hoc trung dai & hien dai Viet Nam - Trang ${i}/3`, {
      x: 50,
      y: height - 90,
      size: 11,
      font: font1,
      color: rgb(0.2, 0.2, 0.2),
    });

    const sampleLines = [
      "I. MUC TIEU BAI HOC",
      "1. Ve kien thuc: Nam vung dac diem the loai van hoc va gia tri noi dung nghe thuat.",
      "2. Ve nang luc: Phat trien nang luc doc hieu van ban, cam thu van hoc va tu duy phan bien.",
      "3. Ve pham chat: Boi duong tinh yeu que huong dat nuoc, long tu hao dan toc.",
      "",
      "II. CHUAN BI CUA GIAO VIEN VA HOC SINH",
      "- Giao vien: Ke hoach bai day, phieu hoc tap so 1 va 2, may chieu.",
      "- Hoc sinh: Doc truoc van ban trong sach giao khoa, tra loi cau hoi chuan bi.",
      "",
      "III. TIEN TRINH DAY HOC",
      "Hoat dong 1: Khoi dong (5 phut) - Tao tam the hung thu cho hoc sinh.",
      "Hoat dong 2: Hinh thanh kien thuc moi (25 phut) - Huong dan doc va tim hieu chung.",
      "Hoat dong 3: Luyen tap va van dung (15 phut) - Thao luan nhom va thuyet trinh.",
    ];

    let yPos = height - 130;
    for (const line of sampleLines) {
      page.drawText(line, {
        x: 50,
        y: yPos,
        size: 10,
        font: font1,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPos -= 20;
    }
  }

  const pdf1Bytes = await doc1.save();
  await writeFile(join(__dirname, "standard-lesson-3p.pdf"), pdf1Bytes);
  console.log("Created standard-lesson-3p.pdf");

  // 2. Mixed Geometry Fixture (Page 1: Portrait A4, Page 2: Landscape A4, Page 3: Portrait A4)
  const doc2 = await PDFDocument.create();
  const font2 = await doc2.embedFont(StandardFonts.Helvetica);
  const boldFont2 = await doc2.embedFont(StandardFonts.HelveticaBold);

  // Page 1: Portrait (595.28 x 841.89)
  const p1 = doc2.addPage(PageSizes.A4);
  p1.drawText("Trang 1: Dinh dang Doc (Portrait A4)", {
    x: 50,
    y: p1.getHeight() - 60,
    size: 16,
    font: boldFont2,
    color: rgb(0.1, 0.3, 0.6),
  });

  // Page 2: Landscape (841.89 x 595.28)
  const p2 = doc2.addPage([PageSizes.A4[1], PageSizes.A4[0]]);
  p2.drawText("Trang 2: Dinh dang Ngang (Landscape A4 Table)", {
    x: 50,
    y: p2.getHeight() - 60,
    size: 16,
    font: boldFont2,
    color: rgb(0.6, 0.2, 0.1),
  });
  p2.drawRectangle({
    x: 50,
    y: 100,
    width: p2.getWidth() - 100,
    height: p2.getHeight() - 200,
    borderColor: rgb(0.2, 0.2, 0.2),
    borderWidth: 1,
  });

  // Page 3: Portrait
  const p3 = doc2.addPage(PageSizes.A4);
  p3.drawText("Trang 3: Dinh dang Doc (Portrait A4)", {
    x: 50,
    y: p3.getHeight() - 60,
    size: 16,
    font: boldFont2,
    color: rgb(0.1, 0.3, 0.6),
  });

  const pdf2Bytes = await doc2.save();
  await writeFile(join(__dirname, "mixed-geometry-3p.pdf"), pdf2Bytes);
  console.log("Created mixed-geometry-3p.pdf");

  // 3. Multi-page Synthetic Document (30 pages) for Large-Document Simulation
  const doc3 = await PDFDocument.create();
  const font3 = await doc3.embedFont(StandardFonts.Helvetica);
  const boldFont3 = await doc3.embedFont(StandardFonts.HelveticaBold);

  for (let i = 1; i <= 30; i++) {
    const page = doc3.addPage(PageSizes.A4);
    const { width, height } = page.getSize();

    page.drawText(`TAI LIEU ON THI VAO LOP 10 MON NGU VAN - TRANG ${i}/30`, {
      x: 50,
      y: height - 50,
      size: 14,
      font: boldFont3,
      color: rgb(0.15, 0.2, 0.35),
    });

    // Vary line count by page to create varying page payload sizes
    const lineCount = 10 + (i % 15);
    for (let r = 0; r < lineCount; r++) {
      page.drawText(
        `Muc ${r + 1}: Chuyen de on tap kien thuc trong tam so ${i}, bai tap doc hieu chuong ${r + 1}.`,
        {
          x: 50,
          y: height - 85 - r * 22,
          size: 10,
          font: font3,
          color: rgb(0.2, 0.2, 0.2),
        }
      );
    }
  }

  const pdf3Bytes = await doc3.save();
  await writeFile(join(__dirname, "synthetic-large-30p.pdf"), pdf3Bytes);
  console.log("Created synthetic-large-30p.pdf");

  // 4. Corrupt PDF fixture (invalid header & random junk bytes)
  const corruptBytes = Buffer.from("%PDF-1.7 Corrupted header ... THIS IS NOT A VALID PDF PAYLOAD @@@@@!!!");
  await writeFile(join(__dirname, "corrupt-file.pdf"), corruptBytes);
  console.log("Created corrupt-file.pdf");

  // 5. Empty PDF fixture (0 bytes)
  await writeFile(join(__dirname, "empty-file.pdf"), Buffer.alloc(0));
  console.log("Created empty-file.pdf");

  console.log("All test fixtures generated successfully.");
}

main().catch((err) => {
  console.error("Failed to generate fixtures:", err);
  process.exit(1);
});
