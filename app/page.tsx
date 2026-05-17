"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { replace } = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("exam_token:v1");
    if (token) {
      replace("/dashboard");
    } else {
      replace("/login");
    }
  }, [replace]);

  return (
    <div className="page-center">
      <div className="skeleton" style={{ width: 64, height: 64, borderRadius: "50%" }} />
    </div>
  );
}
