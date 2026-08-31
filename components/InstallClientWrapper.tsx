"use client";

import { useEffect, useState } from "react";
import InstallPrompt from "./InstallPrompt";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function InstallClientWrapper() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return (
    <>
      <InstallPrompt />
      <SpeedInsights />
    </>
  );
}

