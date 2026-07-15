import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CentralEquipamentoDecisionDialog from '../CentralEquipamentoDecisionDialog';
import type { CentralApprovalItem } from '@/services/central-aprovacoes/types';

const mutateMock = vi.fn();
let mutationState = { isPending: false };

vi.mock('@/hooks/equipamentos/useDecidirSolicEquip', () => ({
  useDecidirSolicEquip: () => ({
    mutate: mutateMock,
    isPending: mutationState.isPending,
  }),
}));

const baseItem: CentralApprovalItem = {
  id: 'sol-1',
  modulo: 'equipamentos',
  moduloLabel: 'Equipamentos',
  protocolo: 'SOL-6ACD6FBA',
  titulo: 'Equipamentos — TESTE-001 - Teste',
  solicitanteNome: 'Juliano SuperAdm',
  centroCustoLabel: 'TESTE-001 - Teste',
  valorEstimado: null,
  statusCodigo: 'PENDENTE_APROVACAO',
  statusLabel: 'Pendente Aprovação',
  dataReferencia: null,
  atualizadoEm: '2026-07-15T12:00:00Z',
  aguardandoMinhaAcao: true,
  canApprove: true,
  canReject: true,
  currentStageExecId: null,
  approveBlockReason: null,
  rejectBlockReason: null,
  authorizationSource: 'superadmin_self_approval',
  capabilitiesUnavailable: false,
  urgente: false,
  autoApproval: false,
  raw: null,
};

beforeEach(() => {
  mutateMock.mockReset();
  mutationState.isPending = false;
});

describe('CentralEquipamentoDecisionDialog', () => {
  it('aprovação comum: comentário opcional e dispatch APROVADO', () => {
    render(
      <CentralEquipamentoDecisionDialog
        open
        onOpenChange={() => {}}
        item={baseItem}
        mode="aprovar"
      />,
    );
    const btn = screen.getByRole('button', { name: /confirmar aprovação/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock.mock.calls[0][0]).toEqual({
      solicitacaoId: 'sol-1',
      decisao: 'APROVADO',
      comentario: null,
    });
  });

  it('reprovação: bloqueia comentário <10 e dispatch NEGADO com válido', () => {
    render(
      <CentralEquipamentoDecisionDialog
        open
        onOpenChange={() => {}}
        item={baseItem}
        mode="reprovar"
      />,
    );
    const btn = screen.getByRole('button', { name: /confirmar reprovação/i });
    expect(btn).toBeDisabled();

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'curto' } });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/mínimo de 10 caracteres/i)).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'motivo suficiente para reprovar' } });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ decisao: 'NEGADO', comentario: 'motivo suficiente para reprovar' }),
      expect.any(Object),
    );
  });

  it('autoapproval: exibe alerta e exige comentário ≥10 mesmo aprovando', () => {
    render(
      <CentralEquipamentoDecisionDialog
        open
        onOpenChange={() => {}}
        item={{ ...baseItem, autoApproval: true }}
        mode="aprovar"
      />,
    );
    expect(screen.getByText(/aprovando uma solicitação criada por você/i)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /confirmar aprovação/i });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'auto aprov justificada operacional' } });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ decisao: 'APROVADO', comentario: 'auto aprov justificada operacional' }),
      expect.any(Object),
    );
  });
});
