export default function PrintLayout({ children }: LayoutProps<"/">) {
  return <div className="min-h-dvh bg-surface-2 print:bg-white">{children}</div>;
}
