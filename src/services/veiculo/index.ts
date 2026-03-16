
import { fetchVeiculos, getVeiculos, getVeiculoById } from './queries';
import { createVeiculo, updateVeiculo, deleteVeiculo } from './mutations';
import { importVeiculos, exportVeiculos } from './importExport';
import { getMarcasDropdown, getFabricantesDropdown, getDepartamentosDropdown, getEmpresasDropdown, getCategoriasDropdown, getSubcategoriasDropdown } from './dropdowns';
import { VeiculoFilter } from './types';

export {
  fetchVeiculos,
  getVeiculos,
  getVeiculoById,
  createVeiculo,
  updateVeiculo,
  deleteVeiculo,
  importVeiculos,
  exportVeiculos,
  getMarcasDropdown,
  getFabricantesDropdown,
  getDepartamentosDropdown,
  getEmpresasDropdown,
  getCategoriasDropdown,
  getSubcategoriasDropdown,
};

// Re-export the VeiculoFilter type using export type
export type { VeiculoFilter };
