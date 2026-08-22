"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Upload,
  X,
  FileText,
  ImageIcon,
  File,
  AlertCircle,
} from "lucide-react";
import Image from "next/image";
import type { ProductWithCategory } from "@/features/products/types";
import type { DbCategory, DbProductFile } from "@/types/database";
import { createProduct, updateProduct, toggleProductActive } from "@/features/products/actions";
import { addProductFileRecord, removeProductFileRecord } from "@/features/products/file-actions";
import {
  uploadProductAsset,
  uploadProductFile,
  deleteProductAsset,
  deleteProductFileFromStorage,
} from "@/features/products/storage";
import { getProductAssetUrl } from "@/lib/storage/storage";
import { formatCurrency } from "@/lib/utils";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

interface ProductFormProps {
  product?: ProductWithCategory | null;
  productFiles?: DbProductFile[];
  categories: DbCategory[];
  allProducts?: { id: string; name: string; product_type: string; is_active: boolean }[];
  initialPreviewOfIds?: string[];
  initialRelatedIds?: string[];
  mode: "create" | "edit";
}

export function ProductForm({
  product,
  productFiles = [],
  categories,
  allProducts = [],
  initialPreviewOfIds = [],
  initialRelatedIds = [],
  mode,
}: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [slugManual, setSlugManual] = useState(mode === "edit");

  // Form state
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [productType, setProductType] = useState<"PAID" | "FREE">(
    product?.product_type ?? "PAID"
  );
  const [shortDesc, setShortDesc] = useState(product?.short_description ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product?.price?.toString() ?? "");
  const [originalPrice, setOriginalPrice] = useState(
    product?.original_price?.toString() ?? "",
  );
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [pageCount, setPageCount] = useState(
    product?.page_count?.toString() ?? "",
  );
  const [fileFormat] = useState(product?.file_format ?? "docx");
  const [featuresText, setFeaturesText] = useState(
    product?.features?.join("\n") ?? "Có đáp án chi tiết\nTải xuống ngay lập tức"
  );
  const [suitableForText, setSuitableForText] = useState(
    product?.suitable_for?.join("\n") ?? "Học sinh lớp 9\nGiáo viên Ngữ văn"
  );
  const [previewOfIds, setPreviewOfIds] = useState<string[]>(initialPreviewOfIds);
  const [relatedIds, setRelatedIds] = useState<string[]>(initialRelatedIds);

  // Image state
  const [thumbnailPath, setThumbnailPath] = useState(
    product?.thumbnail_path ?? null,
  );
  const [previewImages, setPreviewImages] = useState<string[]>(
    product?.preview_images ?? [],
  );

  // File state
  const [files, setFiles] = useState<DbProductFile[]>(productFiles);

  // Upload state
  const [uploading, setUploading] = useState<string | null>(null);

  // Feedback
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Created product ID (for new products after initial save)
  const [savedProductId, setSavedProductId] = useState<string | null>(
    product?.id ?? null,
  );

  function handleNameChange(value: string) {
    setName(value);
    if (!slugManual) {
      setSlug(generateSlug(value));
    }
  }

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFeedback(null);

      const features = featuresText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const suitableFor = suitableForText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const formData = {
        name: name.trim(),
        slug: slug.trim(),
        shortDescription: shortDesc.trim() || null,
        description: description.trim() || null,
        productType,
        price: productType === "FREE" ? 0 : parseInt(price, 10) || 0,
        originalPrice: originalPrice ? parseInt(originalPrice, 10) : null,
        categoryId: categoryId || null,
        thumbnailPath,
        previewImages: previewImages.length > 0 ? previewImages : null,
        pageCount: pageCount ? parseInt(pageCount, 10) : null,
        fileFormat,
        features: features.length > 0 ? features : null,
        suitableFor: suitableFor.length > 0 ? suitableFor : null,
        previewOfIds,
        relatedIds,
      };

      startTransition(async () => {
        if (mode === "create" && !savedProductId) {
          // First save — create draft
          const result = await createProduct(formData);
          if (result.success && result.data) {
            setSavedProductId(result.data.id);
            setFeedback({
              type: "success",
              message:
                "Đã tạo sản phẩm nháp. Bây giờ bạn có thể tải ảnh và tệp tài liệu.",
            });
            // Redirect to edit page
            router.replace(`/admin/products/${result.data.id}`);
          } else {
            setFeedback({
              type: "error",
              message: result.error ?? "Không thể tạo sản phẩm.",
            });
          }
        } else if (savedProductId) {
          // Update existing
          const result = await updateProduct(savedProductId, formData);
          if (result.success) {
            setFeedback({ type: "success", message: "Đã lưu thay đổi." });
            router.refresh();
          } else {
            setFeedback({
              type: "error",
              message: result.error ?? "Không thể cập nhật sản phẩm.",
            });
          }
        }
      });
    },
    [
      name, slug, shortDesc, description, price, originalPrice, categoryId,
      thumbnailPath, previewImages, pageCount, fileFormat, featuresText,
      suitableForText, mode, savedProductId, router, productType, previewOfIds, relatedIds,
    ],
  );

  // ─── Thumbnail Upload ───────────────────────────────────────────
  async function handleThumbnailUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !savedProductId) return;

    setUploading("thumbnail");
    setFeedback(null);

    const result = await uploadProductAsset(savedProductId, file);
    if (result.success && result.path) {
      // Delete old thumbnail if exists
      if (thumbnailPath) {
        await deleteProductAsset(thumbnailPath);
      }
      setThumbnailPath(result.path);
      // Save to DB immediately
      await updateProduct(savedProductId, { thumbnailPath: result.path });
      setFeedback({ type: "success", message: "Đã tải ảnh đại diện." });
      router.refresh();
    } else {
      setFeedback({ type: "error", message: result.error ?? "Lỗi tải ảnh." });
    }
    setUploading(null);
    e.target.value = "";
  }

  // ─── Preview Image Upload ──────────────────────────────────────
  async function handlePreviewUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !savedProductId) return;

    setUploading("preview");
    setFeedback(null);

    const result = await uploadProductAsset(savedProductId, file);
    if (result.success && result.path) {
      const updated = [...previewImages, result.path];
      setPreviewImages(updated);
      await updateProduct(savedProductId, { previewImages: updated });
      setFeedback({ type: "success", message: "Đã thêm ảnh xem trước." });
      router.refresh();
    } else {
      setFeedback({ type: "error", message: result.error ?? "Lỗi tải ảnh." });
    }
    setUploading(null);
    e.target.value = "";
  }

  async function handleRemovePreview(path: string) {
    if (!savedProductId) return;
    const updated = previewImages.filter((p) => p !== path);
    setPreviewImages(updated);
    await updateProduct(savedProductId, {
      previewImages: updated.length > 0 ? updated : null,
    });
    await deleteProductAsset(path);
    router.refresh();
  }

  // ─── Product File Upload ──────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !savedProductId) return;

    setUploading("file");
    setFeedback(null);

    const result = await uploadProductFile(savedProductId, file);
    if (result.success && result.path) {
      // Register in DB
      const dbResult = await addProductFileRecord(
        savedProductId,
        file.name,
        result.path,
        file.size,
        file.type,
      );
      if (dbResult.success && dbResult.data) {
        setFiles((prev) => [...prev, dbResult.data!]);
        setFeedback({ type: "success", message: `Đã tải file "${file.name}".` });
        router.refresh();
      } else {
        // Cleanup orphan storage file
        await deleteProductFileFromStorage(result.path);
        setFeedback({
          type: "error",
          message: dbResult.error ?? "Không thể lưu thông tin file.",
        });
      }
    } else {
      setFeedback({
        type: "error",
        message: result.error ?? "Lỗi tải file.",
      });
    }
    setUploading(null);
    e.target.value = "";
  }

  async function handleRemoveFile(fileRecord: DbProductFile) {
    if (!savedProductId) return;
    setFeedback(null);

    startTransition(async () => {
      const result = await removeProductFileRecord(fileRecord.id, savedProductId!);
      if (result.success && result.data) {
        await deleteProductFileFromStorage(result.data.storagePath);
        setFiles((prev) => prev.filter((f) => f.id !== fileRecord.id));
        setFeedback({ type: "success", message: "Đã xóa file." });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: result.error ?? "Không thể xóa file.",
        });
      }
    });
  }

  // ─── Toggle Active ─────────────────────────────────────────────
  async function handleToggleActive() {
    if (!savedProductId || !product) return;
    
    if (!product.is_active && files.length === 0) {
      setFeedback({
        type: "error",
        message: "Sản phẩm cần ít nhất một tệp DOCX hoặc ZIP trước khi kích hoạt.",
      });
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      const result = await toggleProductActive(
        savedProductId!,
        !product.is_active,
      );
      if (result.success) {
        setFeedback({
          type: "success",
          message: product.is_active
            ? "Đã ẩn sản phẩm."
            : "Đã kích hoạt sản phẩm.",
        });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: result.error ?? "Không thể thay đổi trạng thái.",
        });
      }
    });
  }

  const canUpload = !!savedProductId;
  const thumbUrl = getProductAssetUrl(thumbnailPath);

  return (
    <div className="max-w-4xl">
      {/* Feedback */}
      {feedback && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-start gap-2 ${
            feedback.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {feedback.type === "error" && (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          {feedback.message}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* ─── Basic Info ─── */}
        <section className="bg-surface rounded-xl border border-border p-5 space-y-4 shadow-sm">
          <h2 className="font-semibold text-text-primary">Thông tin cơ bản</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Tên sản phẩm <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full border border-border bg-transparent text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Slug <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlugManual(true);
                  setSlug(e.target.value);
                }}
                className="w-full border border-border bg-transparent text-text-primary rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Danh mục
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full border border-border bg-transparent text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">— Chọn danh mục —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Mô tả ngắn
            </label>
            <input
              type="text"
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              maxLength={500}
              className="w-full border border-border bg-transparent text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Mô tả chi tiết
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full border border-border bg-transparent text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </section>

        {/* ─── Product Type & Pricing ─── */}
        <section className="bg-surface rounded-xl border border-border p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-text-primary">Phân loại & Giá</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-text-primary mb-1">
                Loại sản phẩm <span className="text-red-500">*</span>
              </label>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value as "PAID" | "FREE")}
                className="w-full border border-border bg-transparent text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="PAID">Sản phẩm trả phí</option>
                <option value="FREE">Tài liệu miễn phí</option>
              </select>
            </div>
            
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-text-primary mb-1">
                Giá bán (VND) {productType !== "FREE" && <span className="text-red-500">*</span>}
              </label>
              <input
                type="number"
                value={productType === "FREE" ? 0 : price}
                onChange={(e) => setPrice(e.target.value)}
                min={0}
                className="w-full border border-border bg-transparent text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-surface-alt disabled:text-text-muted disabled:border-border"
                required={productType === "PAID"}
                disabled={productType === "FREE"}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-text-primary mb-1">
                Giá gốc (VND)
              </label>
              <input
                type="number"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                min={0}
                placeholder="Để trống nếu không giảm giá"
                className="w-full border border-border bg-transparent text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-surface-alt disabled:text-text-muted placeholder:text-text-muted disabled:border-border"
                disabled={productType === "FREE"}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-text-primary mb-1">
                Số trang
              </label>
              <input
                type="number"
                value={pageCount}
                onChange={(e) => setPageCount(e.target.value)}
                min={1}
                className="w-full border border-border bg-transparent text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          {price && productType !== "FREE" && (
            <p className="text-sm text-text-secondary">
              Hiển thị: {formatCurrency(parseInt(price, 10) || 0)}
              {originalPrice &&
                parseInt(originalPrice, 10) > parseInt(price, 10) &&
                ` (gốc: ${formatCurrency(parseInt(originalPrice, 10))})`}
            </p>
          )}
          {productType === "FREE" && (
            <p className="text-sm text-green-700 dark:text-green-300 font-medium bg-green-50 dark:bg-green-900/30 px-3 py-2 rounded-lg border border-green-100 dark:border-green-800/50">
              Sản phẩm này sẽ được hiển thị miễn phí và khách hàng có thể tải xuống trực tiếp mà không cần qua thanh toán.
            </p>
          )}
        </section>

        {/* ─── Enrichment ─── */}
        <section className="bg-surface rounded-xl border border-border p-5 space-y-4 shadow-sm">
          <h2 className="font-semibold text-text-primary">Nội dung hiển thị</h2>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Tính năng nổi bật{" "}
              <span className="text-xs text-text-muted">(mỗi dòng 1 mục)</span>
            </label>
            <textarea
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              rows={4}
              placeholder={"50 đề đọc hiểu có đáp án\nHướng dẫn chấm bài rõ ràng\nFile tài liệu dễ sử dụng"}
              className="w-full border border-border bg-transparent text-text-primary placeholder:text-text-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Phù hợp với{" "}
              <span className="text-xs text-text-muted">(mỗi dòng 1 mục)</span>
            </label>
            <textarea
              value={suitableForText}
              onChange={(e) => setSuitableForText(e.target.value)}
              rows={3}
              placeholder={"Học sinh lớp 9\nGiáo viên Ngữ văn THCS"}
              className="w-full border border-border bg-transparent text-text-primary placeholder:text-text-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </section>

        {/* ─── Relations ─── */}
        <section className="bg-surface rounded-xl border border-border p-5 space-y-4 shadow-sm">
          <h2 className="font-semibold text-text-primary">Sản phẩm liên kết</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {productType === "FREE" && (
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Bản đầy đủ (PREVIEW_OF)
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded-lg p-3 bg-surface-alt">
                  {allProducts
                    .filter((p) => p.product_type === "PAID" && p.is_active && p.id !== savedProductId)
                    .map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={previewOfIds.includes(p.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPreviewOfIds([...previewOfIds, p.id]);
                            } else {
                              setPreviewOfIds(previewOfIds.filter((id) => id !== p.id));
                            }
                          }}
                          className="rounded border-border text-primary-600 focus:ring-primary-500 bg-transparent"
                        />
                        {p.name}
                      </label>
                    ))}
                  {allProducts.filter((p) => p.product_type === "PAID" && p.is_active && p.id !== savedProductId).length === 0 && (
                    <span className="text-xs text-text-muted">Không có sản phẩm PAID nào.</span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-2">
                  Sản phẩm trả phí tương ứng với tài liệu xem trước này.
                </p>
              </div>
            )}
            
            <div className={productType !== "FREE" ? "md:col-span-2" : ""}>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Tài liệu liên quan (RELATED)
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded-lg p-3 bg-surface-alt">
                {allProducts
                  .filter((p) => p.is_active && p.id !== savedProductId)
                  .map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={relatedIds.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRelatedIds([...relatedIds, p.id]);
                          } else {
                            setRelatedIds(relatedIds.filter((id) => id !== p.id));
                          }
                        }}
                        className="rounded border-border text-primary-600 focus:ring-primary-500 bg-transparent"
                      />
                      {p.name} <span className="text-xs text-text-muted">({p.product_type})</span>
                    </label>
                  ))}
                {allProducts.filter((p) => p.is_active && p.id !== savedProductId).length === 0 && (
                  <span className="text-xs text-text-muted">Không có sản phẩm nào.</span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-2">
                Sản phẩm sẽ hiển thị ở mục &quot;Tài liệu liên quan&quot; cuối trang.
              </p>
            </div>
          </div>
        </section>

        {/* ─── File Uploads (only after product is saved) ─── */}
        {canUpload && (
          <div className="space-y-6">
            {/* Hình ảnh */}
            <section className="bg-surface rounded-xl border border-border p-5 space-y-4 shadow-sm">
              <h2 className="font-semibold text-text-primary">Hình ảnh</h2>
              
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-text-secondary">Ảnh đại diện (Thumbnail)</h3>
                {thumbUrl && (
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border">
                    <Image
                      src={thumbUrl}
                      alt="Thumbnail"
                      fill
                      sizes="128px"
                      className="object-cover"
                    />
                  </div>
                )}
                <label className="flex items-center gap-2 w-fit px-4 py-2 border border-border bg-surface-alt rounded-lg text-sm text-text-secondary hover:bg-surface-hover cursor-pointer transition-colors">
                  {uploading === "thumbnail" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {thumbnailPath ? "Thay ảnh" : "Tải ảnh lên"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleThumbnailUpload}
                    disabled={!!uploading}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-text-muted">
                  JPEG, PNG, WebP — tối đa 10 MB
                </p>
              </div>

              <div className="space-y-3 pt-4 border-t border-border">
                <h3 className="text-sm font-medium text-text-secondary">Ảnh xem trước</h3>
                {previewImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {previewImages.map((path) => {
                      const url = getProductAssetUrl(path);
                      return (
                        <div
                          key={path}
                          className="relative w-24 h-24 rounded-lg overflow-hidden border border-border group"
                        >
                          {url && (
                            <Image
                              src={url}
                              alt="Preview"
                              fill
                              sizes="96px"
                              className="object-cover"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemovePreview(path)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Xóa"
                            aria-label="Xóa ảnh xem trước"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <label className="flex items-center gap-2 w-fit px-4 py-2 border border-border bg-surface-alt rounded-lg text-sm text-text-secondary hover:bg-surface-hover cursor-pointer transition-colors">
                  {uploading === "preview" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                  Thêm ảnh xem trước
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePreviewUpload}
                    disabled={!!uploading}
                    className="hidden"
                  />
                </label>
              </div>
            </section>

            {/* Tệp tài liệu */}
            <section className="bg-surface rounded-xl border border-border p-5 space-y-3 shadow-sm">
              <h2 className="font-semibold text-text-primary">
                Tệp tài liệu{" "}
                <span className="text-sm font-normal text-text-muted">
                  ({files.length} file)
                </span>
              </h2>
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between p-3 bg-surface-alt rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded bg-surface border border-border flex items-center justify-center flex-shrink-0">
                          <File className="w-5 h-5 text-primary-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {f.file_name}
                          </p>
                          <p className="text-xs text-text-muted mt-0.5 flex items-center gap-2">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-surface text-text-secondary border border-border font-medium text-[10px] uppercase">
                              {f.file_name.split(".").pop()}
                            </span>
                            {(f.file_size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(f)}
                        disabled={isPending}
                        className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Xóa file"
                        aria-label="Xóa file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 w-fit px-4 py-2 border border-border bg-surface-alt rounded-lg text-sm text-text-secondary hover:bg-surface-hover cursor-pointer transition-colors">
                {uploading === "file" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Tải tệp
                <input
                  type="file"
                  accept=".docx,.zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,application/x-zip-compressed"
                  onChange={handleFileUpload}
                  disabled={!!uploading}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-text-muted">
                Hỗ trợ DOCX và ZIP — tối đa 50 MB
              </p>
            </section>
          </div>
        )}

        {!canUpload && mode === "create" && (
          <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-700">
            <p>
              Hãy <strong>tạo sản phẩm nháp</strong> trước để có thể tải ảnh và
              tệp tài liệu.
            </p>
          </div>
        )}

        {/* ─── Save Button / Status ─── */}
        <section className="bg-surface-alt rounded-xl border border-border p-5 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-text-primary mb-1">Trạng thái</h2>
            <p className="text-sm text-text-secondary">
              {product?.is_active ? "Sản phẩm đang được hiển thị trên cửa hàng." : "Sản phẩm đang ở trạng thái nháp."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {product && savedProductId && (
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={isPending}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  product.is_active
                    ? "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 border border-orange-200 dark:border-orange-800/50"
                    : "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-200 dark:border-green-800/50"
                }`}
              >
                {product.is_active ? "Chuyển thành bản nháp" : "Kích hoạt sản phẩm"}
              </button>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? "Đang lưu..." : (mode === "create" && !savedProductId ? "Tạo sản phẩm nháp" : "Lưu thay đổi")}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
