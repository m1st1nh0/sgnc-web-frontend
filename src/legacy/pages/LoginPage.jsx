"use client";

import { useActionState } from "react";
import Form from "react-bootstrap/Form";

import { loginAction } from "@/app/actions/auth";
import AuthLayout from "../components/ui/AuthLayout";
import Botao from "../components/ui/Botao";
import CampoTexto from "../components/ui/CampoTexto";
import MensagemErro from "../components/ui/MensagemErro";

export default function LoginPage({ successMessage = "" }) {
  const [state, formAction, pending] = useActionState(loginAction, { error: "" });

  return (
    <AuthLayout>
      <h1 className="h4 mb-1 text-center">SGNC</h1>
      <p className="texto-secundario text-center mb-4">
        Sistema de Gestão de Não Conformidades
      </p>

      {successMessage && (
        <div className="sg-alerta sg-alerta--sucesso mb-3" role="status">
          {successMessage}
        </div>
      )}

      {state.error && <MensagemErro mensagem={state.error} />}

      <Form action={formAction}>
        <CampoTexto
          rotulo="Email"
          type="email"
          name="email"
          required
          autoFocus
          autoComplete="username"
        />

        <CampoTexto
          rotulo="Senha"
          type="password"
          name="senha"
          required
          autoComplete="current-password"
        />

        <Botao
          type="submit"
          className="w-100"
          variante="primario"
          carregando={pending}
          tamanho="lg"
        >
          Entrar
        </Botao>
      </Form>
    </AuthLayout>
  );
}
