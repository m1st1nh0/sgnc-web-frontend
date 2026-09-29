"use client";

import { useEffect, useState } from "react";

export default function LegacyApplication() {
  const [App, setApp] = useState(null);

  useEffect(() => {
    import("../../legacy/App.jsx").then((module) => setApp(() => module.default));
  }, []);

  if (!App) return <main className="container py-5">Carregando SGNC…</main>;
  return <App />;
}
