/**
 * Navigation configuration.
 * Defines all navigation menus used across the site.
 */

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

export const mainNavigation: NavItem[] = [
  { label: "Trang chủ", href: "/" },
  { label: "Sản phẩm", href: "/products" },
  {
    label: "Danh mục",
    href: "/categories",
    children: [
      { label: "Ngữ văn 6", href: "/categories/ngu-van-6" },
      { label: "Ngữ văn 7", href: "/categories/ngu-van-7" },
      { label: "Ngữ văn 8", href: "/categories/ngu-van-8" },
      { label: "Ngữ văn 9", href: "/categories/ngu-van-9" },
      { label: "Đọc hiểu", href: "/categories/doc-hieu" },
      { label: "Nghị luận xã hội", href: "/categories/nghi-luan-xa-hoi" },
      { label: "Nghị luận văn học", href: "/categories/nghi-luan-van-hoc" },
      { label: "Đề kiểm tra", href: "/categories/de-kiem-tra" },
      { label: "Đề thi", href: "/categories/de-thi" },
      { label: "Combo", href: "/categories/combo" },
    ],
  },
  { label: "Liên hệ", href: "/contact" },
  { label: "Đơn hàng của tôi", href: "/orders" },
];

export const footerNavigation = {
  products: [
    { label: "Ngữ văn 6", href: "/categories/ngu-van-6" },
    { label: "Ngữ văn 7", href: "/categories/ngu-van-7" },
    { label: "Ngữ văn 8", href: "/categories/ngu-van-8" },
    { label: "Ngữ văn 9", href: "/categories/ngu-van-9" },
    { label: "Đề kiểm tra", href: "/categories/de-kiem-tra" },
    { label: "Đề thi", href: "/categories/de-thi" },
  ],
  support: [
    { label: "Liên hệ", href: "/contact" },
    { label: "Đơn hàng của tôi", href: "/orders" },
  ],
  legal: [
    { label: "Chính sách bảo mật", href: "/privacy" },
    { label: "Điều khoản sử dụng", href: "/terms" },
    { label: "Chính sách hoàn tiền", href: "/refund-policy" },
  ],
};

export const adminNavigation: NavItem[] = [
  { label: "Tổng quan", href: "/admin" },
  { label: "Sản phẩm", href: "/admin/products" },
  { label: "Danh mục", href: "/admin/categories" },
  { label: "Đơn hàng", href: "/admin/orders" },
  { label: "Khách hàng", href: "/admin/customers" },
];
