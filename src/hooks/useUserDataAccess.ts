
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';

interface UserDataAccess {
  userId: string | null;
  userRole: string | null;
  canAccessAllData: boolean;
  allowedTeamIds: string[];
  onlyOwnRecords: boolean;
  isLoading: boolean;
}

export const useUserDataAccess = (): UserDataAccess => {
  const { user } = useAuth();
  const { perfil, isLoading: profileLoading } = useProfile();

  // Definir papéis baseado na função do usuário
  const isSuperAdm = perfil?.funcao_sistema === "SuperAdm";
  const isAdmin = ["Administrador", "AdmRH", "AdmLogistica", "AdmEquipamentos"].includes(perfil?.funcao_sistema || "");
  const isApontador = perfil?.funcao_sistema === "Apontador";
  const isEncarregado = perfil?.funcao_sistema === "Encarregado";

  // Lógica de acesso
  const canAccessAllData = isSuperAdm || isAdmin;
  const allowedTeamIds = perfil?.equipes || [];
  const onlyOwnRecords = !isSuperAdm && !isAdmin;

  return {
    userId: user?.id || null,
    userRole: perfil?.funcao_sistema || null,
    canAccessAllData,
    allowedTeamIds,
    onlyOwnRecords,
    isLoading: profileLoading
  };
};
