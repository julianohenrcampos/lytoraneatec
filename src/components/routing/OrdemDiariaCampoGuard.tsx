import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrdemDiariaCampoAccess } from "@/hooks/ordemDiariaCampo/useOrdemDiariaCampoAccess";

interface Props {
  children: React.ReactNode;
}

/**
 * Guard dedicado da visão de campo. Não exige permissão administrativa.
 * Libera quando o usuário é:
 *  - SuperAdm, ou
 *  - tem `engenharia_ordem_diaria_view` ou `engenharia_ordem_diaria_campo_view`, ou
 *  - é responsável principal de qualquer ordem emitida, ou
 *  - é responsável por algum item emitido.
 *
 * Caso contrário, mostra estado vazio "sem ordens atribuídas" (não erro 403).
 */
const OrdemDiariaCampoGuard: React.FC<Props> = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: hasAccess, isLoading: accessLoading, isError } =
    useOrdemDiariaCampoAccess();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (isError || hasAccess === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-sm w-full text-center space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">
            Nenhuma Ordem do Dia disponível para seu usuário.
          </h2>

          <p className="text-sm text-muted-foreground">
            Você ainda não foi designado como responsável em nenhuma Ordem
            Diária emitida. Procure o engenheiro/mestre responsável.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default OrdemDiariaCampoGuard;
