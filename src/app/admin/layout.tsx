/**
 * Admin root layout.
 * This is the parent layout for all /admin/* routes.
 * The (dashboard) route group handles auth protection separately.
 * The /admin/login page is NOT protected.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
