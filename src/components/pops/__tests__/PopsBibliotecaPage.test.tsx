import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PopComRascunho } from '@/types/pops';

const gate = vi.fn();
const biblioteca = vi.fn();

vi.mock('@/hooks/pops/usePopsData', () => ({
  usePopsGate: () => gate(),
  usePopsBiblioteca: () => biblioteca(),
}));

vi.mock('@/components/pops/PopViewerDialog', () => ({
  default: () => null,
}));

import PopsBibliotecaPage from '@/components/pops/PopsBibliotecaPage';

function pop(over: Partial<PopComRascunho> & { id: string; codigo: string }): PopComRascunho {
  return {
    titulo: 'Título',
    categoria: 'Operacional',
    setor_id: 'setor-1',
    setor_nome: 'Logística',
    status: 'ativo',
    versao_major: 1,
    versao_minor: 0,
    publicado_em: '2026-07-27',
    obsoleto_em: null,
    motivo_obsolescencia: null,
    elaborado_por_id: null,
    elaborado_por_nome_snapshot: 'Maria Silva',
    arquivo_path: 'pops/a.pdf',
    arquivo_nome_original: 'a.pdf',
    arquivo_tamanho_bytes: 10,
    arquivo_sha256: null,
    created_at: '2026-07-01',
    updated_at: '2026-07-01',
    rascunho: null,
    ...over,
  } as PopComRascunho;
}

describe('PopsBibliotecaPage', () => {
  it('renderiza um card por POP vigente', () => {
    gate.mockReturnValue({ data: true, isLoading: false });
    biblioteca.mockReturnValue({
      data: [
        pop({ id: '1', codigo: 'POP-001' }),
        pop({ id: '2', codigo: 'POP-002', versao_minor: 2 }),
      ],
      isLoading: false,
    });

    render(<PopsBibliotecaPage />);

    expect(screen.getByText('POP-001')).toBeInTheDocument();
    expect(screen.getByText('POP-002')).toBeInTheDocument();
    expect(screen.getByText('Versão 1.2')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Visualizar POP POP-00/ })).toHaveLength(2);
  });

  it('usa grid responsivo sem rolagem horizontal', () => {
    gate.mockReturnValue({ data: true, isLoading: false });
    biblioteca.mockReturnValue({ data: [pop({ id: '1', codigo: 'POP-001' })], isLoading: false });

    render(<PopsBibliotecaPage />);
    const grid = screen.getByTestId('pops-grid');
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('md:grid-cols-2');
    expect(grid.className).toContain('xl:grid-cols-3');
    expect(grid.className).not.toContain('overflow-x');
  });

  it('mostra estado vazio quando não há POPs', () => {
    gate.mockReturnValue({ data: true, isLoading: false });
    biblioteca.mockReturnValue({ data: [], isLoading: false });

    render(<PopsBibliotecaPage />);
    expect(screen.getByText('Nenhum POP vigente encontrado.')).toBeInTheDocument();
    expect(screen.queryByTestId('pops-grid')).toBeNull();
  });
});
