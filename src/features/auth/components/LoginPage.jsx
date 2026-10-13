"use client";

import { useActionState, useState } from "react";

import { loginAction } from "@/app/actions/auth";
import AuthLayout from "../../../components/ui/AuthLayout.jsx";
import Botao from "../../../components/ui/Botao.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";

export default function LoginPage({ successMessage = "" }) {
  const [state, formAction, pending] = useActionState(loginAction, { error: "" });
  const [senhaVisivel, setSenhaVisivel] = useState(false);

  return (
    <AuthLayout>
      <div className="sg-auth__cabecalho">
        <h1>Entrar no SGNC</h1>
        <p>Sistema de Gestão de Não Conformidades</p>
      </div>

      {successMessage && (
        <div className="sg-alerta sg-alerta--sucesso" role="status">
          {successMessage}
        </div>
      )}

      {state.error && <MensagemErro mensagem={state.error} />}

      <form action={formAction} className="sg-auth__form">
        <label className="sg-auth__campo">
          Email
          <input
            className="sg-auth__input"
            type="email"
            name="email"
            required
            autoFocus
            autoComplete="username"
            placeholder="nome@empresa.com.br"
          />
        </label>

        <label className="sg-auth__campo" htmlFor="login-senha">Senha</label>
        <div className="sg-auth__senha">
          <input
            id="login-senha"
            className="sg-auth__input"
            type={senhaVisivel ? "text" : "password"}
            name="senha"
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            className="sg-auth__mostrar"
            onClick={() => setSenhaVisivel((visivel) => !visivel)}
            aria-pressed={senhaVisivel}
            aria-controls="login-senha"
          >
            {senhaVisivel ? "Ocultar" : "Mostrar"}
          </button>
        </div>

        <Botao type="submit" className="sg-auth__entrar" variante="sucesso" carregando={pending} tamanho="lg">
          Entrar
        </Botao>
      </form>

      <p className="sg-auth__ajuda">Problemas para entrar? Fale com o administrador do sistema da sua área.</p>
    </AuthLayout>
  );
}
