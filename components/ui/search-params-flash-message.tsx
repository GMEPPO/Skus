"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function decodeFlashMessage(raw: string) {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw.replace(/\+/g, " ");
  }
}

export function SearchParamsFlashMessage({
  messageStyles,
}: {
  messageStyles: (status?: string) => string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [flash, setFlash] = useState<{ status?: string; message: string } | null>(null);

  useEffect(() => {
    const message = searchParams.get("message");
    if (!message) return;

    setFlash({
      status: searchParams.get("status") ?? undefined,
      message: decodeFlashMessage(message),
    });
    router.replace(pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  if (!flash?.message) return null;

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${messageStyles(flash.status)}`}>
      {flash.message}
    </div>
  );
}
