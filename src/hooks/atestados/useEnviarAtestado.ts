import { useMutation } from "@tanstack/react-query";
import {
  criarUploadUrl,
  enviarAtestado,
  uploadArquivo,
} from "@/services/atestadosService";
import type { AtestadoSubmeterResponse } from "@/types/atestadoMedico";

export type EtapaEnvio = "preparando" | "enviando_arquivo" | "registrando";

interface EnviarAtestadoParams {
  token_validacao: string;
  file: File;
  data_emissao: string;
  data_inicio_afastamento: string;
  dias_afastamento: number;
  sistema_afetado_codigo: string;
  sistema_afetado_observacao?: string;
  onEtapa?: (etapa: EtapaEnvio) => void;
}

/** Repete apenas etapas idempotentes (nunca `atestado-submeter`). */
async function comRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    const code = e?.code || "";
    if (code === "timeout" || code === "network_error" || code === "upload_failed") {
      return await fn();
    }
    throw e;
  }
}

async function pipeline(
  params: EnviarAtestadoParams
): Promise<AtestadoSubmeterResponse> {
  const nome = params.file.name || "";
  const ponto = nome.lastIndexOf(".");
  const ext = ponto >= 0 ? nome.slice(ponto + 1).toLowerCase() : "";
  if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) {
    const err: any = new Error("arquivo_extensao_invalida");
    err.code = "arquivo_extensao_invalida";
    throw err;
  }

  params.onEtapa?.("preparando");
  const upload = await comRetry(() =>
    criarUploadUrl({
      token_validacao: params.token_validacao,
      extensao: ext,
    })
  );

  params.onEtapa?.("enviando_arquivo");
  await comRetry(() =>
    uploadArquivo({
      bucket: upload.bucket,
      arquivo_path: upload.arquivo_path,
      token: upload.token,
      file: params.file,
    })
  );

  params.onEtapa?.("registrando");
  return enviarAtestado({
    token_validacao: params.token_validacao,
    arquivo_path: upload.arquivo_path,
    data_emissao: params.data_emissao,
    data_inicio_afastamento: params.data_inicio_afastamento,
    dias_afastamento: params.dias_afastamento,
    sistema_afetado_codigo: params.sistema_afetado_codigo,
    sistema_afetado_observacao: params.sistema_afetado_observacao,
  });
}

export function useEnviarAtestado() {
  return useMutation({ mutationFn: pipeline });
}
