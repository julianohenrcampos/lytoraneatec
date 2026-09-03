import { Navigate, useLocation } from 'react-router-dom';

/**
 * Redireciona a rota legada `/gestao-aprovacoes-diarias` para a Central de Aprovações,
 * preservando search string.
 */
export default function RedirectGestaoAprovacoesToCentral() {
  const { search, hash } = useLocation();
  return <Navigate to={`/gestao-rh/central-aprovacoes${search}${hash}`} replace />;
}
