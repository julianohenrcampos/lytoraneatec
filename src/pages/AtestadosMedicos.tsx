// Fase 2-A — Página pública de envio de atestado médico.
// Fora dos guards de autenticação. token_validacao vive somente em memória (useState).

import { useState } from "react";
import AtestadoShell from "@/components/atestados/AtestadoShell";
import AtestadoStepper from "@/components/atestados/AtestadoStepper";
import EtapaOrientacoes from "@/components/atestados/EtapaOrientacoes";
import EtapaValidacaoMatricula from "@/components/atestados/EtapaValidacaoMatricula";
import EtapaFormularioAtestado from "@/components/atestados/EtapaFormularioAtestado";
import TelaProtocoloEnviado from "@/components/atestados/TelaProtocoloEnviado";
import type {
  AtestadoFuncionarioSnapshot,
  AtestadoSubmeterResponse,
} from "@/types/atestadoMedico";

type Etapa = "orientacoes" | "validacao" | "formulario" | "protocolo";

export default function AtestadosMedicos() {
  const [etapa, setEtapa] = useState<Etapa>("orientacoes");
  const [token, setToken] = useState<string | null>(null);
  const [funcionario, setFuncionario] =
    useState<AtestadoFuncionarioSnapshot | null>(null);
  const [resultado, setResultado] = useState<AtestadoSubmeterResponse | null>(
    null
  );

  const current =
    etapa === "orientacoes"
      ? 1
      : etapa === "validacao"
      ? 2
      : etapa === "formulario"
      ? 3
      : 4;

  function reset() {
    setToken(null);
    setFuncionario(null);
    setResultado(null);
    setEtapa("orientacoes");
  }

  return (
    <AtestadoShell>
      <AtestadoStepper current={current as 1 | 2 | 3 | 4} />

      {etapa === "orientacoes" && (
        <EtapaOrientacoes onIniciar={() => setEtapa("validacao")} />
      )}

      {etapa === "validacao" && (
        <EtapaValidacaoMatricula
          onValidado={(resp) => {
            setToken(resp.token_validacao);
            setFuncionario(resp.funcionario);
            setEtapa("formulario");
          }}
          onVoltar={() => setEtapa("orientacoes")}
        />
      )}

      {etapa === "formulario" && token && funcionario && (
        <EtapaFormularioAtestado
          tokenValidacao={token}
          funcionarioNome={funcionario.nome}
          funcionarioMatricula={funcionario.matricula}
          onEnviado={(resp) => {
            setToken(null); // limpa token da memória assim que confirmado
            setResultado(resp);
            setEtapa("protocolo");
          }}
          onTokenInvalido={() => {
            setToken(null);
            setFuncionario(null);
            setEtapa("validacao");
          }}
        />
      )}

      {etapa === "protocolo" && resultado && (
        <TelaProtocoloEnviado
          protocolo={resultado.protocolo}
          dentroPrazo24h={resultado.dentro_prazo_24h}
          onNovo={reset}
        />
      )}
    </AtestadoShell>
  );
}
