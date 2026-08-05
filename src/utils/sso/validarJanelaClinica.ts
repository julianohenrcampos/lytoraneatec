// Validação centralizada da janela de atendimento da clínica (dia da semana + horário).
// Usada tanto pelo useEffect da Etapa 2 quanto pelo submit do AgendamentoExamesDialog.

export interface ClinicaJanela {
  dias_atendimento?: string[] | null;
  horario_inicio?: string | null;
  horario_fim?: string | null;
}

const DIAS_SEMANA_MAP: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

export interface ResultadoJanela {
  ok: boolean;
  motivo?: string;
}

export interface ValidarJanelaOptions {
  /**
   * Modo strict: usado no submit. Bloqueia quando a clínica não está
   * selecionada ou não tem janela cadastrada (sem fallback silencioso).
   * Default false (modo live, usado em useEffect de formulário).
   */
  strict?: boolean;
}

/**
 * Valida se data/horário caem dentro da janela de atendimento da clínica.
 */
export function validarJanelaClinica(
  clinica: ClinicaJanela | null | undefined,
  dataISO: string,
  horario: string,
  options: ValidarJanelaOptions = {}
): ResultadoJanela {
  const { strict = false } = options;

  if (!clinica) {
    if (strict) {
      return { ok: false, motivo: 'Selecione um local de atendimento antes de salvar.' };
    }
    return { ok: true };
  }
  if (!dataISO || !horario) {
    if (strict) {
      return { ok: false, motivo: 'Informe data e horário do agendamento.' };
    }
    return { ok: true };
  }

  const temDias =
    Array.isArray(clinica.dias_atendimento) && clinica.dias_atendimento.length > 0;
  const temInicio = !!clinica.horario_inicio;
  const temFim = !!clinica.horario_fim;

  if (strict && (!temDias || !temInicio || !temFim)) {
    return {
      ok: false,
      motivo:
        'Clínica sem horário de funcionamento cadastrado. Cadastre dias e horários em "Locais de Atendimento" antes de agendar.',
    };
  }

  const diasAtendimento = temDias
    ? (clinica.dias_atendimento as string[])
    : ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  const horarioInicio = (clinica.horario_inicio || '07:00').substring(0, 5);
  const horarioFim = (clinica.horario_fim || '17:00').substring(0, 5);

  const dataSelecionada = new Date(dataISO + 'T12:00:00');
  const diaSemana = DIAS_SEMANA_MAP[dataSelecionada.getDay()];

  if (!diasAtendimento.includes(diaSemana)) {
    return {
      ok: false,
      motivo: `A clínica não atende às ${diaSemana}s. Dias disponíveis: ${diasAtendimento.join(', ')}.`,
    };
  }

  const horarioSelecionado = horario.substring(0, 5);
  if (horarioSelecionado < horarioInicio || horarioSelecionado > horarioFim) {
    return {
      ok: false,
      motivo: `Horário fora do expediente da clínica (${horarioInicio} às ${horarioFim}).`,
    };
  }

  return { ok: true };
}
<<<<<<< HEAD
=======

/**
 * Verifica se pelo menos uma das clínicas ATIVAS está dentro da sua janela
 * (dia da semana + horário) no instante `agora`.
 *
 * Usado como gate global do botão "Novo Agendamento" e como segunda trava
 * no submit (caso o usuário tenha aberto o dialog dentro do expediente
 * e tentado salvar depois do encerramento).
 */
export interface ClinicaJanelaComStatus extends ClinicaJanela {
  ativo?: boolean | null;
}

export interface ResultadoAbertura {
  algumaAberta: boolean;
  motivo?: string;
  totalAtivas: number;
  abertasAgora: number;
}

export function algumaClinicaAbertaAgora(
  clinicas: ClinicaJanelaComStatus[] | null | undefined,
  agora: Date,
): ResultadoAbertura {
  const ativas = (clinicas || []).filter((c) => c.ativo !== false);
  if (ativas.length === 0) {
    return {
      algumaAberta: false,
      motivo: 'Nenhuma clínica ativa cadastrada.',
      totalAtivas: 0,
      abertasAgora: 0,
    };
  }

  const diaNome = DIAS_SEMANA_MAP[agora.getDay()];
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

  const abertas = ativas.filter((c) => {
    const dias =
      Array.isArray(c.dias_atendimento) && c.dias_atendimento.length > 0
        ? (c.dias_atendimento as string[])
        : ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
    if (!dias.includes(diaNome)) return false;
    const [hi, mi] = (c.horario_inicio || '07:00').substring(0, 5).split(':').map(Number);
    const [hf, mf] = (c.horario_fim || '17:00').substring(0, 5).split(':').map(Number);
    const ini = hi * 60 + (mi || 0);
    const fim = hf * 60 + (mf || 0);
    return minutosAgora >= ini && minutosAgora < fim;
  });

  if (abertas.length > 0) {
    return {
      algumaAberta: true,
      totalAtivas: ativas.length,
      abertasAgora: abertas.length,
    };
  }

  return {
    algumaAberta: false,
    motivo:
      'Horário comercial encerrado. Agendamento permitido apenas enquanto pelo menos uma clínica estiver dentro da janela de atendimento.',
    totalAtivas: ativas.length,
    abertasAgora: 0,
  };
}
>>>>>>> 52562f7989b0a86f866e932d6c49a2bc9dd1bc12
