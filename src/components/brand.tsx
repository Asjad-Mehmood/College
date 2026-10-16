import { ShieldCheck } from "lucide-react";

export function BrandMark({ className = "size-9" }: { className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent shadow-card ${className}`}
    >
      <ShieldCheck className="size-[55%]" strokeWidth={2.2} aria-hidden />
    </div>
  );
}
