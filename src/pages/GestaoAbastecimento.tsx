import MainLayout from '@/components/layout/MainLayout';
import { useGuardianWebAuth } from '@/hooks/abastecimento/useGuardianWebAuth';
import { useAbastecimentos } from '@/hooks/abastecimento/useAbastecimentos';
import { AbastecimentoLoginForm } from '@/components/abastecimento/AbastecimentoLoginForm';
import { AbastecimentoDashboard } from '@/components/abastecimento/AbastecimentoDashboard';
import { usePageTitle } from "@/contexts/PageTitleContext";

const GestaoAbastecimento = () => {
  usePageTitle("Gestão de Abastecimento");
  const auth = useGuardianWebAuth();
  const abast = useAbastecimentos(auth.token);

  return (
    <MainLayout>
      {auth.isAuthenticated ? (
        <AbastecimentoDashboard auth={auth} abastecimentos={abast} />
      ) : (
        <AbastecimentoLoginForm auth={auth} />
      )}
    </MainLayout>
  );
};

export default GestaoAbastecimento;