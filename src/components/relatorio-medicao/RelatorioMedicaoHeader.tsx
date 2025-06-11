
import React from "react";
import { Card, CardContent } from "@/components/ui/card";

interface RelatorioMedicaoHeaderProps {
  pmNumero?: string;
  mesReferencia: string;
  periodo: string;
}

const RelatorioMedicaoHeader: React.FC<RelatorioMedicaoHeaderProps> = ({
  pmNumero = "9",
  mesReferencia,
  periodo
}) => {
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 flex items-center justify-center">
              <img 
                src="/lovable-uploads/dcf6c980-f927-4180-b109-b425da1323ba.png" 
                alt="Lytorânea Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="text-lg font-bold text-blue-600">LYTORÂNEA</div>
            </div>
          </div>
          <div className="text-center flex-1 mx-8">
            <h1 className="text-2xl font-bold text-gray-800">RELATÓRIO DE MEDIÇÃO</h1>
          </div>
          <div className="w-24"></div>
        </div>
        
        <div className="grid grid-cols-3 gap-6 mt-6">
          <div className="text-center">
            <label className="text-sm font-medium text-gray-600">PM nº:</label>
            <div className="text-lg font-semibold">{pmNumero}</div>
          </div>
          <div className="text-center">
            <label className="text-sm font-medium text-gray-600">Mês de Referência:</label>
            <div className="text-lg font-semibold">{mesReferencia}</div>
          </div>
          <div className="text-center">
            <label className="text-sm font-medium text-gray-600">Período:</label>
            <div className="text-lg font-semibold">{periodo}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RelatorioMedicaoHeader;
