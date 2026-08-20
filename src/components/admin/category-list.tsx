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
        <h1 className="text-2xl font-bold text-slate-900">Quản lý danh mục</h1>
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
          className="bg-white border border-slate-200 rounded-xl p-5 mb-6 space-y-4"
        >
          <h2 className="font-semibold text-slate-900">
            {editingId ? "Chỉnh sửa danh mục" : "Tạo danh mục mới"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tên danh mục <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Slug <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => {
                  setSlugManuallyEdited(true);
                  setForm((prev) => ({ ...prev, slug: e.target.value }));
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-slate-400 mt-1">
                URL: /categories/{form.slug || "..."}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Mô tả
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
              className="rounded border-slate-300"
            />
            <label htmlFor="cat-active" className="text-sm text-slate-700">
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
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      {/* Category Table */}
      {initialCategories.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Chưa có danh mục nào.</p>
          <p className="text-sm text-slate-400">
            Nhấn &quot;Thêm danh mục&quot; để bắt đầu.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Tên
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Slug
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Trạng thái
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {initialCategories.map((cat) => (
                <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {cat.name}
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                    {cat.slug}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        cat.is_active
                          ? "bg-green-50 text-green-700"
                          : "bg-slate-100 text-slate-500"
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
                        className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                        title="Chỉnh sửa"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggle(cat)}
                        disabled={isPending}
                        className="p-1.5 text-slate-400 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
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
