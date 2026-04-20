// Compat shim — antigo AddressAutocomplete delegando para a versão V2 em /shared.
// Mantém a API anterior (props value/isValidated) e enriquece o callback com
// metadados de qualidade (geocoding_status/source) compatíveis com a nova trigger.

import React from "react";
import SharedAddressAutocomplete, {
  type AddressResult as SharedAddressResult,
} from "@/components/shared/AddressAutocomplete";

export type AddressResult = SharedAddressResult;

interface Props {
  value?: string;
  isValidated?: boolean;
  onAddressSelected: (result: AddressResult) => void;
  disabled?: boolean;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  initialStatus?: AddressResult["geocoding_status"] | null;
}

const AddressAutocomplete: React.FC<Props> = ({
  value,
  onAddressSelected,
  disabled,
  initialLatitude,
  initialLongitude,
  initialStatus,
}) => {
  return (
    <SharedAddressAutocomplete
      value={value}
      initialLatitude={initialLatitude}
      initialLongitude={initialLongitude}
      initialStatus={initialStatus}
      onAddressSelected={onAddressSelected}
      disabled={disabled}
      placeholder="Digite o endereço da obra..."
    />
  );
};

export default AddressAutocomplete;
