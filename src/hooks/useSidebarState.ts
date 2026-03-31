
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { menuStructure } from '@/constants/menuStructure';

export const useSidebarState = () => {
  const location = useLocation();

  const getInitialOpenGroups = () => {
    const path = location.pathname;
    const initialState: Record<string, boolean> = {};
    
    menuStructure.forEach(group => {
      initialState[group.title] = false;
    });
    
    // Dashboard routes that live inside modules
    if (path === '/dashboard-rh') {
      initialState["Gestão de RH"] = true;
    } else if (path === '/dashboard-maquinas') {
      initialState["Gestão Veic/Equip"] = true;
    } else if (path === '/dashboard-cbuq') {
      initialState["Requisições e Logística"] = true;
    } else if (path.includes('/gestao-rh/')) {
      initialState["Gestão de RH"] = true;
    } else if (path.includes('/gestao-maquinas/')) {
      initialState["Gestão Veic/Equip"] = true;
    } else if (path.includes('/requisicoes/diarias/')) {
      initialState["Diárias"] = true;
    } else if (path.includes('/requisicoes/') || path.includes('/programacao-entrega') || path.includes('/registro-aplicacao') || path.includes('/relatorio-aplicacao-diaria')) {
      initialState["Requisições e Logística"] = true;
    } else if (path.includes('/licitacoes/')) {
      initialState["Licitações"] = true;
    } else if (path.includes('/sso/')) {
      // Agendamento de Exames e Clínicas estão em Gestão de RH agora,
      // mas suas rotas ainda são /sso/agendamento-exames e /sso/clinicas
      if (path.includes('/sso/agendamento-exames') || path.includes('/sso/clinicas')) {
        initialState["Gestão de RH"] = true;
      } else {
        initialState["SSO - Segurança"] = true;
      }
    } else if (path.includes('/admin/')) {
      initialState["Administração"] = true;
    }
    
    return initialState;
  };
  
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(getInitialOpenGroups());
  
  useEffect(() => {
    setOpenGroups(getInitialOpenGroups());
  }, [location.pathname]);
  
  useEffect(() => {
    const savedOpenGroups = localStorage.getItem('sidebarOpenGroups');
    if (savedOpenGroups) {
      try {
        const parsedState = JSON.parse(savedOpenGroups);
        const currentState = getInitialOpenGroups();
        const mergedState = { ...parsedState, ...currentState };
        setOpenGroups(mergedState);
      } catch (error) {
        console.error("Error parsing saved sidebar state:", error);
        setOpenGroups(getInitialOpenGroups());
      }
    }
  }, []);
  
  useEffect(() => {
    localStorage.setItem('sidebarOpenGroups', JSON.stringify(openGroups));
  }, [openGroups]);
  
  const toggleGroup = (group: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  return {
    openGroups,
    setOpenGroups,
    toggleGroup
  };
};
