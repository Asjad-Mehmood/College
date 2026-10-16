import { BrandMark } from "@/components/brand";
import { APP_NAME, APP_TAGLINE } from "@/lib/app";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <BrandMark className="size-12" />
        <div>
          <p className="text-lg font-semibold tracking-tight">{APP_NAME}</p>
          <p className="text-[13px] text-muted">{APP_TAGLINE}</p>
        </div>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
