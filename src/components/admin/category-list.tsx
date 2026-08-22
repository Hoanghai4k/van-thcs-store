"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Eye, EyeOff, Loader2, FolderOpen } from "lucide-react";
import type { DbCategory } from "@/types/database";
import {
  createCategory,
  updateCategory,
  toggleCategoryActive,
} from "@/features/categories/actions";

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

interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
}

const emptyForm: CategoryFormData = {
  name: "",
  slug: "",
  description: "",
  is_active: true,
};

export function AdminCategoryList({
  initialCategories,
}: {
  initialCategories: DbCategory[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormData>(emptyForm);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setSlugManuallyEdited(false);
    setShowForm(true);
    setFeedback(null);
  }

  function openEdit(cat: DbCategory) {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? "",
      is_active: cat.is_active,
    });
    setSlugManuallyEdited(true);
    setShowForm(true);
    setFeedback(null);
  }

  function handleNameChange(name: string) {
    setForm((prev) => ({
      ...prev,
      name,
      slug: slugManuallyEdited ? prev.slug : generateSlug(name),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    const formData = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || null,
      is_active: form.is_active,
    };

    startTransition(async () => {
      const result = editingId
        ? await updateCategory(editingId, formData)
        : await createCategory(formData);

      if (result.success) {
        setFeedback({
          type: "success",
          message: editingId
            ? "Đã cập nhật danh mục."
            : "Đã tạo danh mục mới.",
        });
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm);
        router.refresh();
      } else {
        setFeedback({ type: "error", message: result.error ?? "Có lỗi xảy ra." });
      }
    });
  }

  function handleToggle(cat: DbCategory) {
    startTransition(async () => {
      const result = await toggleCategoryActive(cat.id, !cat.is_active);
      if (result.success) {
        setFeedback({
          type: "success",
          message: cat.is_active ? "Đã ẩn danh mục." : "Đã hiện danh mục.",
        });
        router.refresh();
      } else {
        setFeedback({ type: "error", message: result.error ?? "Có lỗi xảy ra." });
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Quản lý danh mục</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Thêm danh mục
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            feedback.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-xl p-5 mb-6 space-y-4 shadow-sm"
        >
          <h2 className="font-semibold text-text-primary">
            {editingId ? "Chỉnh sửa danh mục" : "Tạo danh mục mới"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Tên danh mục <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full border border-border bg-transparent text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Slug <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => {
                  setSlugManuallyEdited(true);
                  setForm((prev) => ({ ...prev, slug: e.target.value }));
                }}
                className="w-full border border-border bg-transparent text-text-primary rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-text-muted mt-1">
                URL: /categories/{form.slug || "..."}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Mô tả
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={2}
              className="w-full border border-border bg-transparent text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="cat-active"
              checked={form.is_active}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, is_active: e.target.checked }))
              }
              className="rounded border-border bg-transparent"
            />
            <label htmlFor="cat-active" className="text-sm text-text-secondary">
              Hiển thị trên storefront
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? "Cập nhật" : "Tạo mới"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      {/* Category Table */}
      {initialCategories.length === 0 ? (
        <div className="text-center py-16 bg-surface rounded-xl border border-border shadow-sm">
          <FolderOpen className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <h3 className="text-lg font-medium text-text-primary mb-1">Chưa có danh mục</h3>
          <p className="text-text-secondary mb-4">Nhấn &quot;Thêm danh mục&quot; để bắt đầu phân loại sản phẩm.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-surface-alt border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">
                  Tên
                </th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">
                  Slug
                </th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">
                  Trạng thái
                </th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {initialCategories.map((cat) => (
                <tr key={cat.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {cat.name}
                  </td>
                  <td className="px-4 py-3 text-text-secondary font-mono text-xs whitespace-nowrap">
                    {cat.slug}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        cat.is_active
                          ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/50"
                          : "bg-surface-alt text-text-secondary border border-border"
                      }`}
                    >
                      {cat.is_active ? (
                        <>
                          <Eye className="w-3 h-3" /> Hiện
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" /> Ẩn
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openEdit(cat)}
                        className="p-1.5 text-text-muted hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                        title="Chỉnh sửa"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggle(cat)}
                        disabled={isPending}
                        className="p-1.5 text-text-muted hover:text-orange-600 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
                        title={cat.is_active ? "Ẩn danh mục" : "Hiện danh mục"}
                      >
                        {cat.is_active ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
