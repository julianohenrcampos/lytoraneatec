import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PopCard from '@/components/pops/PopCard';

const base = {
  id: 'pop-1',
  codigo: 'POP-001',
  titulo: 'Procedimento de Abastecimento',
  setor: 'Logística',
  categoria: 'Operacional',
  versaoMajor: 2,
  versaoMinor: 3,
  elaboradoPor: 'Maria Silva',
  publicadoEm: '2026-07-27',
};

describe('PopCard', () => {
  it('exibe código, versão, título, setor e categoria', () => {
    render(<PopCard {...base} onVisualizar={vi.fn()} />);

    expect(screen.getByText('POP-001')).toBeInTheDocument();
    expect(screen.getByText('Versão 2.3')).toBeInTheDocument();
    expect(screen.getByText('Procedimento de Abastecimento')).toBeInTheDocument();
    expect(screen.getByText('Logística')).toBeInTheDocument();
    expect(screen.getByText('Operacional')).toBeInTheDocument();
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('27/07/2026')).toBeInTheDocument();
  });

  it('aplica fallbacks para campos opcionais ausentes', () => {
    render(
      <PopCard
        {...base}
        setor={null}
        categoria={null}
        elaboradoPor={null}
        publicadoEm={null}
        onVisualizar={vi.fn()}
      />,
    );

    expect(screen.getByText('Sem setor')).toBeInTheDocument();
    expect(screen.getByText('Sem categoria')).toBeInTheDocument();
    expect(screen.getByText('Não informado')).toBeInTheDocument();
    expect(screen.getByText('Não informada')).toBeInTheDocument();
    expect(screen.queryByText(/undefined|null/i)).toBeNull();
  });

  it('chama onVisualizar com o id do POP e possui aria-label acessível', async () => {
    const onVisualizar = vi.fn();
    render(<PopCard {...base} onVisualizar={onVisualizar} />);

    const botao = screen.getByRole('button', {
      name: 'Visualizar POP POP-001 — Procedimento de Abastecimento',
    });
    await userEvent.click(botao);

    expect(onVisualizar).toHaveBeenCalledWith('pop-1');
  });

  it('não oferece ação de download', () => {
    const { container } = render(<PopCard {...base} onVisualizar={vi.fn()} />);
    expect(screen.queryByText(/baixar|download/i)).toBeNull();
    expect(within(container).queryByRole('link')).toBeNull();
  });

  it('desabilita a ação quando não há arquivo', async () => {
    const onVisualizar = vi.fn();
    render(<PopCard {...base} disabled onVisualizar={onVisualizar} />);
    const botao = screen.getByRole('button');
    expect(botao).toBeDisabled();
    await userEvent.click(botao, { pointerEventsCheck: 0 });
    expect(onVisualizar).not.toHaveBeenCalled();
  });
});
