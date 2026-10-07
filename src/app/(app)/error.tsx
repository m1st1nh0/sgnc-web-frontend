"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="container py-4"><h1>Não foi possível carregar esta página</h1><p>Tente novamente em instantes.</p><button onClick={reset}>Tentar novamente</button></main>;
}
