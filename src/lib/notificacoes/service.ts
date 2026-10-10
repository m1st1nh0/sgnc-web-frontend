import { requireApiUser as requireUser } from "@/lib/auth/api";
import "server-only";

import { ApiError } from "@/lib/api/error";
import { createAdminClient } from "@/lib/supabase/admin";
import { resumirNotificacoes } from "@/lib/notificacoes/resumo";

const COLUNAS = "id, evento, papel_destinatario, nivel, nc_id, medida_id, titulo, mensagem, link, criada_em, atualizada_em, lida_em, resolvida_em";

/** Últimas 30 notificações da própria pessoa (não resolvidas primeiro) e o contador de não lidas. */
export async function listarNotificacoes() {
  const user = await requireUser();
  const admin = createAdminClient() as any;
  const [pendentes, recentes] = await Promise.all([
    admin.from("notificacoes").select(COLUNAS).eq("usuario_id", user.id).is("resolvida_em", null)
      .order("atualizada_em", { ascending: false }).limit(30),
    admin.from("notificacoes").select(COLUNAS).eq("usuario_id", user.id).not("resolvida_em", "is", null)
      .order("atualizada_em", { ascending: false }).limit(30),
  ]);
  if (pendentes.error || recentes.error) throw new ApiError("Não foi possível carregar as notificações.", 500);
  const resumo = resumirNotificacoes([...(pendentes.data ?? []), ...(recentes.data ?? [])]);
  return { ...resumo, itens: resumo.itens.slice(0, 30) };
}

export async function marcarNotificacaoLida(id: number) {
  const user = await requireUser();
  if (!Number.isInteger(id) || id <= 0) throw new ApiError("Notificação inválida.", 422);
  const { error } = await (createAdminClient() as any).from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("id", id).eq("usuario_id", user.id).is("lida_em", null);
  if (error) throw new ApiError("Não foi possível marcar a notificação como lida.", 500);
  return { ok: true };
}

export async function marcarTodasLidas() {
  const user = await requireUser();
  const { error } = await (createAdminClient() as any).from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("usuario_id", user.id).is("lida_em", null);
  if (error) throw new ApiError("Não foi possível marcar as notificações como lidas.", 500);
  return { ok: true };
}
