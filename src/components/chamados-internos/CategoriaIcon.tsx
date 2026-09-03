/**
 * Mapeamento visual (não-normativo) entre `codigo` da categoria e ícone Lucide.
 * Não altera dados; se o código não estiver no mapa, cai para LifeBuoy.
 */
import * as React from "react";
import {
  Bus,
  Utensils,
  Banknote,
  Laptop,
  Wifi,
  Wrench,
  Zap,
  Plug,
  ShieldAlert,
  ClipboardList,
  LifeBuoy,
  ScrollText,
  Truck,
  Construction,
  ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";


const MAP: Record<string, LucideIcon> = {
  passagem: Bus,
  transporte: Bus,
  alim: Utensils,
  alimentacao: Utensils,
  diaria: Banknote,
  diarias: Banknote,
  financeiro: Banknote,
  pc: Laptop,
  computador: Laptop,
  computadores: Laptop,
  ti: Laptop,
  net: Wifi,
  internet: Wifi,
  infra: Wifi,
  manut: Wrench,
  manutencao: Wrench,
  eletrico: Zap,
  eletrica: Zap,
  inst: Plug,
  instalacao: Plug,
  acid: ShieldAlert,
  acidente: ShieldAlert,
  sso: ShieldAlert,
  outros: ClipboardList,
  asfalto_mudanca_regras: ScrollText,
  asfalto_transportes: Truck,
  asfalto_equipamentos: Construction,
  asfalto_descontos: Banknote,
  asfalto_movimentacoes: ArrowLeftRight,
  solicitacao_equipamento: Truck,
};


export function getCategoriaIcon(codigo: string | null | undefined): LucideIcon {
  if (!codigo) return LifeBuoy;
  const key = codigo.trim().toLowerCase();
  return MAP[key] ?? LifeBuoy;
}

interface Props {
  codigo: string | null | undefined;
  className?: string;
  size?: number;
}

export const CategoriaIcon: React.FC<Props> = ({ codigo, className, size = 20 }) => {
  const Icon = getCategoriaIcon(codigo);
  return <Icon className={className} size={size} aria-hidden />;
};

export default CategoriaIcon;
