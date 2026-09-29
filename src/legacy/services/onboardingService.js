import { chamarApi } from "./api";

export function obterOnboarding() {
  return chamarApi("/onboarding/me");
}

export function iniciarOnboarding() {
  return chamarApi("/onboarding/me/iniciar", { method: "POST" });
}

export function concluirEtapaOnboarding(chave, origem, metadados = {}) {
  return chamarApi(`/onboarding/me/etapas/${chave}/concluir`, {
    method: "POST",
    body: { origem, metadados },
  });
}

export function dispensarOnboarding() {
  return chamarApi("/onboarding/me/dispensar", { method: "POST" });
}

export function concluirOnboarding() {
  return chamarApi("/onboarding/me/concluir", { method: "POST" });
}

export function restaurarOnboarding() {
  return chamarApi("/onboarding/me/restaurar", { method: "POST" });
}

export function revisarOnboarding() {
  return chamarApi("/onboarding/me/revisar", { method: "POST" });
}
