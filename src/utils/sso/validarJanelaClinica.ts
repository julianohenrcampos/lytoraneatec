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
