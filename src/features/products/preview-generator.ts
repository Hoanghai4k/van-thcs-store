import CloudConvert from "cloudconvert";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PDFDocument } from "pdf-lib";

export interface PreviewGenerationResult {
  success: boolean;
  message?: string;
  pageCount?: number;
}

export async function generateProductPreview(productId: string): Promise<PreviewGenerationResult> {
  const apiKey = process.env.CLOUDCONVERT_API_KEY;
  if (!apiKey) {
    return { success: false, message: "CloudConvert API Key is not configured." };
  }

  const cloudConvert = new CloudConvert(apiKey);

  const supabaseAdmin = getSupabaseAdmin();
  const { data: files, error: filesError } = await supabaseAdmin
    .from("product_files")
    .select("*")
    .eq("product_id", productId);

  if (filesError || !files || files.length === 0) {
    return { success: false, message: "Chưa có tệp phù hợp để tạo bản xem trước." };
  }

  // 2. Select best source file
  let sourceFile = files.find((f: { file_name: string }) => f.file_name.toLowerCase().endsWith(".docx"));
  if (!sourceFile) {
    sourceFile = files.find((f: { file_name: string }) => f.file_name.toLowerCase().endsWith(".pdf"));
  }

  if (!sourceFile) {
    return { success: false, message: "Chưa có tệp phù hợp để tạo bản xem trước. Cần tệp DOCX hoặc PDF." };
  }

  // 3. Generate signed URL for 1 hour
  const { data: signedUrlData, error: signError } = await supabaseAdmin.storage
    .from("product-files")
    .createSignedUrl(sourceFile.storage_path, 3600);

  if (signError || !signedUrlData) {
    return { success: false, message: "Lỗi bảo mật khi truy cập tệp nguồn." };
  }

  try {
    const isDocx = sourceFile.file_name.toLowerCase().endsWith(".docx");

    // 4. Create CloudConvert Job
    const job = await cloudConvert.jobs.create({
      tasks: {
        "import-my-file": {
          operation: "import/url",
          url: signedUrlData.signedUrl,
        },
        "convert-to-pdf": {
          operation: "convert",
          input: "import-my-file",
          input_format: isDocx ? "docx" : "pdf",
          output_format: "pdf",
        },
        "extract-pages": {
          operation: "convert",
          input: "convert-to-pdf",
          input_format: "pdf",
          output_format: "pdf",
          page_range: "1-10",
        },
        "export-my-file": {
          operation: "export/url",
          input: "extract-pages",
          inline: false,
          archive_multiple_files: false,
        },
      },
    });

    // 5. Wait for Job completion
    const completedJob = await cloudConvert.jobs.wait(job.id);
    if (completedJob.status !== "finished") {
      throw new Error(`CloudConvert job failed with status: ${completedJob.status}`);
    }

    // 6. Fetch exported file
    const exportTask = completedJob.tasks.find(
      (task) => task.operation === "export/url" && task.status === "finished"
    );

    if (!exportTask || !exportTask.result || !exportTask.result.files || exportTask.result.files.length === 0) {
      throw new Error("No exported file found in CloudConvert job.");
    }

    const file = exportTask.result.files[0];
    const downloadUrl = file.url;
    
    if (!downloadUrl) {
      throw new Error("No download URL returned from CloudConvert.");
    }

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download preview artifact: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);

    // 7. Verify page count safely (strictly <= 10)
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    let pageCount = pdfDoc.getPageCount();

    // Extra safety: If CloudConvert failed to slice, we slice it manually using pdf-lib.
    if (pageCount > 10) {
      console.warn(`[Preview Generator] Truncating PDF locally. CloudConvert returned ${pageCount} pages.`);
      const newPdf = await PDFDocument.create();
      const pages = await newPdf.copyPages(pdfDoc, Array.from({ length: 10 }, (_, i) => i));
      pages.forEach((page) => newPdf.addPage(page));
      const truncatedBytes = await newPdf.save();
      
      // Update our buffer reference
      pageCount = 10;
      // Copy bytes over
      const newBuffer = Buffer.from(truncatedBytes);
      
      const storagePath = `${productId}/${Date.now()}-preview.pdf`;
      const originalFilename = `preview_${sourceFile.file_name.replace(/\.[^/.]+$/, "")}.pdf`;
      
      const { error: uploadError } = await supabaseAdmin.storage
        .from("product-previews")
        .upload(storagePath, newBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { error: upsertError } = await supabaseAdmin
        .from("product_previews")
        .upsert({
          product_id: productId,
          storage_path: storagePath,
          original_filename: originalFilename,
          mime_type: "application/pdf",
          file_size: newBuffer.length,
          page_count: pageCount,
        });

      if (upsertError) throw upsertError;

      return { success: true, pageCount };
    } else {
      // It's <= 10 pages natively
      const storagePath = `${productId}/${Date.now()}-preview.pdf`;
      const originalFilename = `preview_${sourceFile.file_name.replace(/\.[^/.]+$/, "")}.pdf`;
      
      const buffer = Buffer.from(pdfBytes);
      const { error: uploadError } = await supabaseAdmin.storage
        .from("product-previews")
        .upload(storagePath, buffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { error: upsertError } = await supabaseAdmin
        .from("product_previews")
        .upsert({
          product_id: productId,
          storage_path: storagePath,
          original_filename: originalFilename,
          mime_type: "application/pdf",
          file_size: buffer.length,
          page_count: pageCount,
        });

      if (upsertError) throw upsertError;

      return { success: true, pageCount };
    }

  } catch (err: unknown) {
    console.error("[Preview Generator] Error generating preview:", err);
    return { success: false, message: `Lỗi khi tạo bản xem trước: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
}
