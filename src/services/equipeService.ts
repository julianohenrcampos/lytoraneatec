
// Importing individual services
import {
  fetchEquipes,
  getEquipeById,
  createEquipe,
  updateEquipe,
  deleteEquipe,
  fetchFuncionariosByRole,
  processImportData
} from './equipe';

// Export all equipe services
export {
  fetchEquipes,
  getEquipeById,
  createEquipe,
  updateEquipe,
  deleteEquipe,
  fetchFuncionariosByRole,
  processImportData
};

// Check if a equipe name already exists
export const checkEquipeNameExists = async (name: string, excludeId?: string): Promise<boolean> => {
  try {
    const equipes = await fetchEquipes({ nome_equipe: name });
    
    if (!equipes || equipes.length === 0) return false;
    
    // If we're updating and need to exclude the current ID
    if (excludeId) {
      return equipes.some(equipe => equipe.id !== excludeId);
    }
    
    return equipes.length > 0;
  } catch (error) {
    console.error("Error checking if equipe name exists:", error);
    return false;
  }
};
