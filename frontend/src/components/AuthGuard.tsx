"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Redirects to /login if no access token is present. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("accessToken")) {
      router.replace("/login");
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen text-gray-400 text-sm">
        Loading…
      </div>
    );
  }
  return <>{children}</>;
}
