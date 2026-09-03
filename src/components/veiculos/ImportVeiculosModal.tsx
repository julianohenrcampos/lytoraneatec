// PR-3 V3 — Compat shim. O antigo ImportVeiculosModal virou fachada do ImportadorV3Modal.
// Nenhuma rota nova; o único modal de importação passa a ser o V3.
import React from 'react';
import ImportadorV3Modal from './import/ImportadorV3Modal';

interface ImportVeiculosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  // props legadas ignoradas — mantidas apenas para compatibilidade de assinatura.
  onImport?: (...args: unknown[]) => unknown;
}

const ImportVeiculosModal: React.FC<ImportVeiculosModalProps> = ({ isOpen, onClose, onSuccess }) => (
  <ImportadorV3Modal isOpen={isOpen} onClose={onClose} onImportSucesso={onSuccess} />
);

export default ImportVeiculosModal;
