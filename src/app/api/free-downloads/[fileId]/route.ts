import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    if (!fileId) {
      return new NextResponse("Missing file ID", { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch file record and its associated product
    const { data: fileRecord, error: fileError } = await supabase
      .from("product_files")
      .select("*, product:products(is_active, product_type)")
      .eq("id", fileId)
      .single();

    if (fileError || !fileRecord || !fileRecord.product) {
      return new NextResponse("File not found", { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const product = fileRecord.product as any; // Bypass TS strict typing on nested joins temporarily

    // 2. Validate product rules for free downloads
    if (!product.is_active) {
      return new NextResponse("Product is no longer available", { status: 403 });
    }

    if (product.product_type !== "FREE") {
      return new NextResponse("Unauthorized. This file requires purchase.", { status: 403 });
    }

    // 3. Generate short-lived signed URL for the actual file in private storage
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from("product-files") // Must match STORAGE_BUCKETS.PRODUCT_FILES
      .createSignedUrl(fileRecord.storage_path, 60, {
        download: fileRecord.file_name,
      }); // 60 seconds

    if (signedUrlError || !signedUrlData) {
      console.error("[FreeDownload] Error generating signed URL:", signedUrlError);
      return new NextResponse("Error generating download link", { status: 500 });
    }

    // 4. Redirect user to the signed URL
    return NextResponse.redirect(signedUrlData.signedUrl);

  } catch (error) {
    console.error("[FreeDownload] Unhandled error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
