import { ProfileType } from "@/types/permissao";

export interface DepartmentDisplay {
  hasDepartment: boolean;
  isGlobalAccess: boolean;
  departmentName: string | null;
  displayText: string;
  secondaryText: string | null;
  badgeVariant: 'default' | 'secondary';
}

/**
 * Determina como exibir o departamento e acesso de um usuário
 * - Se acesso_global=true → "Acesso Global" (verde) + mostra departamento vinculado
 * - Se NÃO tem funcionario_id → "Acesso Global" (verde)
 * - Se TEM funcionario_id E departamento → Nome do departamento (laranja)
 */
export const getDepartmentDisplay = (profile: ProfileType): DepartmentDisplay => {
  // Se tem acesso global habilitado
  if (profile.acesso_global) {
    const departmentName = profile.bd_funcionarios?.bd_departamentos?.nome_departamento;
    return {
      hasDepartment: true,
      isGlobalAccess: true,
      departmentName,
      displayText: 'Acesso Global',
      secondaryText: departmentName ? `Vinculado: ${departmentName}` : null,
      badgeVariant: 'default'
    };
  }
  
  // Se não tem funcionario_id vinculado
  if (!profile.funcionario_id) {
    return {
      hasDepartment: false,
      isGlobalAccess: false,
      departmentName: null,
      displayText: 'Acesso Global',
      secondaryText: null,
      badgeVariant: 'default'
    };
  }
  
  // Vinculado a departamento específico
  const departmentName = profile.bd_funcionarios?.bd_departamentos?.nome_departamento;
  
  if (departmentName) {
    return {
      hasDepartment: true,
      isGlobalAccess: false,
      departmentName,
      displayText: departmentName,
      secondaryText: null,
      badgeVariant: 'secondary'
    };
  }
  
  return {
    hasDepartment: false,
    isGlobalAccess: false,
    departmentName: null,
    displayText: 'Acesso Global',
    secondaryText: null,
    badgeVariant: 'default'
  };
};
