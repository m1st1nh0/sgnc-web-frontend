export type PapelUsuario = "adm" | "supervisor" | "funcionario";

export type UsuarioAutenticado = {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  ativo: boolean;
  senha_provisoria: boolean;
};

