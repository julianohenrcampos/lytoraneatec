import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Abastecimento } from '@/types/abastecimento';

interface AbastecimentoTableProps {
  abastecimentos: Abastecimento[];
}

export const AbastecimentoTable = ({ abastecimentos }: AbastecimentoTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const totalPages = Math.ceil(abastecimentos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = abastecimentos.slice(startIndex, endIndex);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const formatNumber = (num: number | undefined) => {
    if (!num) return '-';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registros de Abastecimento</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Frota</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Combustível</TableHead>
                <TableHead className="text-right">Litros</TableHead>
                <TableHead>Comboista</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>CC</TableHead>
                <TableHead className="text-right">Medidor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentItems.length > 0 ? (
                currentItems.map((abast, index) => (
                  <TableRow key={abast.identificador || index}>
                    <TableCell>{formatDate(abast.data_abast)}</TableCell>
                    <TableCell>{abast.hora_abast || '-'}</TableCell>
                    <TableCell className="font-medium">{abast.frota || '-'}</TableCell>
                    <TableCell>{abast.placa || '-'}</TableCell>
                    <TableCell>{abast.combustivel || '-'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(abast.litragem)}
                    </TableCell>
                    <TableCell className="text-sm">{abast.comboista || '-'}</TableCell>
                    <TableCell className="text-sm">{abast.operador || '-'}</TableCell>
                    <TableCell>{abast.cc || '-'}</TableCell>
                    <TableCell className="text-right">{formatNumber(abast.medidor)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado. Use os filtros acima para buscar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Mostrando {startIndex + 1} - {Math.min(endIndex, abastecimentos.length)} de{' '}
              {abastecimentos.length} registros
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <div className="text-sm">
                Página {currentPage} de {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
