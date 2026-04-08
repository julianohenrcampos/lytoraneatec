
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { Veiculo, VeiculoFormData, ImportResult } from "./types";

// ==================== TEMPLATE ====================

const TEMPLATE_COLUMNS = [
  "categoria",
  "subcategoria",
  "linha_operacional",
  "frota_codigo",
  "codigo_frota",
  "placa",
  "chassi",
  "fabricante",
  "modelo",
  "ano_fabricacao",
  "empresa",
  "tipo_empresa",
  "departamento",
  "status_operacional",
  "capacidade",
  "aluguel",
  "observacoes",
];

export const downloadEquipamentoTemplate = () => {
  const wb = XLSX.utils.book_new();

  const exampleRow: Record<string, string> = {
    categoria: "EQUIPAMENTO",
    subcategoria: "ESCAVADEIRA",
    linha_operacional: "AM",
    frota_codigo: "LOC",
    codigo_frota: "LOC-001",
    placa: "ABC1D23",
    chassi: "9BWZZZ377VT004251",
    fabricante: "CAT",
    modelo: "320D",
    ano_fabricacao: "2022",
    empresa: "ACAM",
    tipo_empresa: "LOCADO",
    departamento: "ASFALTO",
    status_operacional: "Operando",
    capacidade: "22T",
    aluguel: "",
    observacoes: "",
  };

  const wsData = XLSX.utils.json_to_sheet([exampleRow], { header: TEMPLATE_COLUMNS });
  wsData["!cols"] = TEMPLATE_COLUMNS.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, wsData, "EQUIPAMENTOS");

  const instrucoes = [
    ["INSTRUÇÕES DE PREENCHIMENTO"],
    [""],
    ["CAMPOS OBRIGATÓRIOS:"],
    ["- categoria: nome da categoria do ativo (ex: EQUIPAMENTO, VEÍCULO). Deve existir no cadastro."],
    ["- subcategoria: nome da subcategoria (ex: ESCAVADEIRA, CAMINHÃO BASCULANTE). Deve existir no cadastro."],
    ["- frota_codigo: código da frota cadastrada (ex: LOC, LYE, LYC). Deve existir em bd_frotas."],
    ["- departamento: nome do departamento (ex: ASFALTO, TERRAPLANAGEM). Deve existir no cadastro."],
    ["- Ao menos PLACA ou CHASSI é obrigatório para identificação do equipamento."],
    [""],
    ["CAMPOS OPCIONAIS MAS RECOMENDADOS:"],
    ["- linha_operacional: código da linha operacional (ex: AM, BR, PR). Se informado, deve existir no cadastro."],
    ["- codigo_frota: identificação operacional (ex: LOC-001, LYE-015)"],
    ["- fabricante: nome do fabricante (ex: CAT, VOLVO, KOMATSU). Será criado automaticamente se não existir."],
    ["- modelo: texto livre com o modelo do equipamento (ex: 320D, FH 540, PC200)"],
    ["- ano_fabricacao: ano de fabricação (ex: 2022)"],
    ["- empresa: nome da empresa cadastrada. Deve existir no cadastro."],
    ["- capacidade: capacidade do equipamento (ex: 22T, 8m³)"],
    ["- aluguel: valor de locação mensal"],
    [""],
    ["VALORES PERMITIDOS:"],
    ["- tipo_empresa: PROPRIO, LOCADO, TERCEIRO"],
    ["- status_operacional: Operando, Em Manutenção, Disponível, Intempérie"],
    ["- linha_operacional: AM (Amarela), BR (Branca), PR (Preta)"],
    [""],
    ["VALIDAÇÕES NA IMPORTAÇÃO:"],
    ["- categoria e subcategoria devem existir no cadastro"],
    ["- frota_codigo deve existir no cadastro de frotas"],
    ["- Se placa ou chassi já existir no banco, a linha será rejeitada (duplicidade)"],
    ["- fabricante será criado automaticamente se não existir"],
    ["- empresa deve existir no cadastro de empresas (se informada)"],
    ["- linha_operacional deve existir no cadastro (se informada)"],
    [""],
    ["EXEMPLOS DE FROTAS:"],
    ["- LOC (Locados), LYE (Lytorânea Equipamentos), LYC (Lytorânea Caminhões)"],
  ];

  const wsInstr = XLSX.utils.aoa_to_sheet(instrucoes);
  wsInstr["!cols"] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, "INSTRUCOES");

  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  saveAs(blob, "modelo_importacao_equipamentos.xlsx");
};

// ==================== EXPORT ====================

export const exportVeiculos = async (veiculos: Veiculo[]) => {
  const [frotasRes, fabricantesRes, linhasRes, departamentosRes] = await Promise.all([
    supabase.from("bd_frotas").select("id, codigo"),
    supabase.from("bd_fabricantes").select("id, nome"),
    supabase.from("bd_linhas_operacionais").select("id, codigo, nome").eq("ativo", true),
    supabase.from("bd_departamentos").select("id, nome_departamento"),
  ]);

  const frotasMap = new Map((frotasRes.data || []).map((f: any) => [f.id, f.codigo]));
  const fabricantesMap = new Map((fabricantesRes.data || []).map((f: any) => [f.id, f.nome]));
  const linhasMap = new Map((linhasRes.data || []).map((l: any) => [l.id, l.codigo]));
  const departamentosMap = new Map((departamentosRes.data || []).map((d: any) => [d.id, d.nome_departamento]));

  const data = veiculos.map((v) => ({
    categoria: v.nome_categoria || "",
    subcategoria: v.nome_subcategoria || "",
    linha_operacional: linhasMap.get((v as any).linha_operacional_id) || "",
    frota_codigo: frotasMap.get((v as any).frota_id) || v.frota || "",
    codigo_frota: v.numero_frota || "",
    placa: v.placa || "",
    chassi: v.chassi || "",
    fabricante: fabricantesMap.get((v as any).fabricante_id) || v.fabricante || "",
    modelo: v.motor || "",
    ano_fabricacao: v.ano_fabricacao || "",
    empresa: v.nome_empresa || "",
    tipo_empresa: v.proprietario_tipo || "",
    departamento: departamentosMap.get(v.departamento_id || "") || v.nome_departamento || "",
    status_operacional: v.situacao || "",
    capacidade: v.capacidade || "",
    aluguel: v.aluguel || "",
    observacoes: v.observacoes || "",
  }));

  const ws = XLSX.utils.json_to_sheet(data, { header: TEMPLATE_COLUMNS });
  ws["!cols"] = TEMPLATE_COLUMNS.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "EQUIPAMENTOS");

  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  saveAs(blob, `Equipamentos_${new Date().toISOString().split("T")[0]}.xlsx`);
};

// ==================== IMPORT ====================

interface ImportLineError {
  linha: number;
  message: string;
}

export const importVeiculos = async (
  veiculos: VeiculoFormData[] | File
): Promise<ImportResult> => {
  try {
    if (veiculos instanceof File) {
      return await importFromFile(veiculos);
    }
    return processImportVeiculos(veiculos);
  } catch (error: any) {
    console.error("Error importing veiculos:", error);
    return {
      success: [],
      errors: [{ message: error.message || "Erro ao importar veículos" }],
    };
  }
};

async function importFromFile(file: File): Promise<ImportResult> {
  const data = await parseXlsxFile(file);
  if (!data || data.length === 0) {
    return { success: [], errors: [{ message: "Arquivo vazio ou sem dados válidos." }] };
  }

  const [frotasRes, fabricantesRes, empresasRes, categoriasRes, subcatsRes, linhasRes, departamentosRes] =
    await Promise.all([
      supabase.from("bd_frotas").select("id, codigo").eq("ativo", true),
      supabase.from("bd_fabricantes").select("id, nome").eq("ativo", true),
      supabase.from("bd_empresas").select("id, nome_empresa"),
      supabase.from("bd_categorias_ativos").select("id, nome_categoria"),
      supabase.from("bd_subcategorias_ativos").select("id, nome_subcategoria, categoria_id"),
      supabase.from("bd_linhas_operacionais").select("id, codigo, nome").eq("ativo", true),
      supabase.from("bd_departamentos").select("id, nome_departamento"),
    ]);

  const frotas = frotasRes.data || [];
  let fabricantes = fabricantesRes.data || [];
  const empresas = empresasRes.data || [];
  const categorias = categoriasRes.data || [];
  const subcats = subcatsRes.data || [];
  const linhas = linhasRes.data || [];
  const departamentos = departamentosRes.data || [];
  const existingPlacas = new Set<string>();
  const existingChassis = new Set<string>();

  const { data: existingEquips } = await supabase
    .from("bd_caminhoes_equipamentos")
    .select("placa, chassi");

  (existingEquips || []).forEach((e: any) => {
    if (e.placa) existingPlacas.add(e.placa.toUpperCase().replace(/[^A-Z0-9]/g, ""));
    if (e.chassi) existingChassis.add(e.chassi.toUpperCase().replace(/[^A-Z0-9]/g, ""));
  });

  const errors: ImportLineError[] = [];
  const validRecords: any[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const linha = i + 2;
    const record: any = {};

    // 1. Validate categoria (obrigatório)
    const catNome = (row.categoria || "").toString().trim();
    if (!catNome) {
      errors.push({ linha, message: `Campo "categoria" é obrigatório.` });
      continue;
    }
    const cat = categorias.find((c: any) => c.nome_categoria.toUpperCase() === catNome.toUpperCase());
    if (!cat) {
      errors.push({ linha, message: `Categoria "${catNome}" não encontrada no cadastro.` });
      continue;
    }
    record.categoria_ativo_id = cat.id;

    // 2. Validate subcategoria (obrigatório)
    const subNome = (row.subcategoria || "").toString().trim();
    if (!subNome) {
      errors.push({ linha, message: `Campo "subcategoria" é obrigatório.` });
      continue;
    }
    const sub = subcats.find((s: any) => s.nome_subcategoria.toUpperCase() === subNome.toUpperCase());
    if (!sub) {
      errors.push({ linha, message: `Subcategoria "${subNome}" não encontrada no cadastro.` });
      continue;
    }
    record.subcategoria_ativo_id = sub.id;

    // 3. Validate frota_codigo (obrigatório)
    const frotaCodigo = (row.frota_codigo || "").toString().trim().toUpperCase();
    if (!frotaCodigo) {
      errors.push({ linha, message: `Campo "frota_codigo" é obrigatório.` });
      continue;
    }
    const frota = frotas.find((f: any) => f.codigo.toUpperCase() === frotaCodigo);
    if (!frota) {
      errors.push({ linha, message: `Frota "${frotaCodigo}" não encontrada no cadastro.` });
      continue;
    }
    record.frota_id = frota.id;
    record.frota = frotaCodigo;

    // 4. Validate placa/chassi (ao menos um)
    const placa = (row.placa || "").toString().trim();
    const chassi = (row.chassi || "").toString().trim();
    const placaNorm = placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const chassiNorm = chassi.toUpperCase().replace(/[^A-Z0-9]/g, "");

    if (!placaNorm && !chassiNorm) {
      errors.push({ linha, message: `Ao menos "placa" ou "chassi" é obrigatório.` });
      continue;
    }

    if (placaNorm && existingPlacas.has(placaNorm)) {
      errors.push({ linha, message: `Placa "${placa}" já existe no banco de dados.` });
      continue;
    }
    if (chassiNorm && existingChassis.has(chassiNorm)) {
      errors.push({ linha, message: `Chassi "${chassi}" já existe no banco de dados.` });
      continue;
    }

    if (placaNorm) existingPlacas.add(placaNorm);
    if (chassiNorm) existingChassis.add(chassiNorm);

    record.placa = placa || null;
    record.chassi = chassi || null;

    // 5. Linha operacional (opcional)
    const linhaCodigo = (row.linha_operacional || "").toString().trim().toUpperCase();
    if (linhaCodigo) {
      const linhaOp = linhas.find((l: any) => l.codigo.toUpperCase() === linhaCodigo);
      if (linhaOp) {
        record.linha_operacional_id = linhaOp.id;
      }
      // se não encontrar, ignora (opcional)
    }

    // 6. Fabricante (lookup + autocreate)
    const fabNome = (row.fabricante || "").toString().trim();
    if (fabNome) {
      let fab = fabricantes.find((f: any) => f.nome.toUpperCase() === fabNome.toUpperCase());
      if (!fab) {
        const { data: newFab, error: fabErr } = await supabase
          .from("bd_fabricantes")
          .insert({ nome: fabNome, ativo: true })
          .select()
          .single();
        if (fabErr) {
          errors.push({ linha, message: `Erro ao criar fabricante "${fabNome}": ${fabErr.message}` });
          continue;
        }
        fab = newFab;
        fabricantes = [...fabricantes, newFab];
      }
      record.fabricante_id = fab.id;
      record.fabricante = fabNome;
    }

    // 7. Modelo (texto livre — salvar em campo 'motor' que é usado como modelo texto)
    const modeloTexto = (row.modelo || "").toString().trim();
    if (modeloTexto) {
      record.motor = modeloTexto;
    }

    // 8. Empresa (lookup)
    const empresaNome = (row.empresa || "").toString().trim();
    if (empresaNome) {
      const empresa = empresas.find(
        (e: any) => e.nome_empresa.toUpperCase() === empresaNome.toUpperCase()
      );
      if (!empresa) {
        errors.push({ linha, message: `Empresa "${empresaNome}" não encontrada no cadastro.` });
        continue;
      }
      record.empresa_id = empresa.id;
    }

    // 9. Departamento (lookup)
    const depNome = (row.departamento || "").toString().trim();
    if (depNome) {
      const dep = departamentos.find(
        (d: any) => (d.nome_departamento || "").toUpperCase() === depNome.toUpperCase()
      );
      if (dep) {
        record.departamento_id = dep.id;
      }
    }

    // 10. Campos simples
    record.numero_frota = (row.codigo_frota || "").toString().trim() || null;
    record.ano_fabricacao = (row.ano_fabricacao || "").toString().trim() || null;
    record.situacao = (row.status_operacional || "").toString().trim() || "Disponível";
    record.proprietario_tipo = (row.tipo_empresa || "").toString().trim() || null;
    record.capacidade = (row.capacidade || "").toString().trim() || null;
    record.aluguel = (row.aluguel || "").toString().trim() || null;
    record.observacoes = (row.observacoes || "").toString().trim() || null;
    record.status_cadastro = "ativo";
    record.status_disponibilidade = "disponivel";

    validRecords.push(record);
  }

  // Insert valid records in batches
  const successResults: Veiculo[] = [];
  if (validRecords.length > 0) {
    for (let i = 0; i < validRecords.length; i += 50) {
      const batch = validRecords.slice(i, i + 50);
      const { data: inserted, error: insertErr } = await supabase
        .from("bd_caminhoes_equipamentos")
        .insert(batch)
        .select();

      if (insertErr) {
        errors.push({ linha: 0, message: `Erro ao inserir lote: ${insertErr.message}` });
      } else if (inserted) {
        successResults.push(...(inserted as Veiculo[]));
      }
    }
  }

  return {
    success: successResults,
    errors: errors.map((e) =>
      e.linha > 0
        ? { message: `Linha ${e.linha}: ${e.message}` }
        : { message: e.message }
    ),
  };
}

function parseXlsxFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        resolve(jsonData);
      } catch (err) {
        reject(new Error("Erro ao ler o arquivo Excel."));
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });
}

// Legacy process for direct data arrays (CSV path)
const processImportVeiculos = async (veiculos: VeiculoFormData[]): Promise<ImportResult> => {
  try {
    const validVeiculos = veiculos.filter(
      (v) => v.categoria_ativo_id || v.placa || v.chassi
    );

    if (validVeiculos.length === 0) {
      return {
        success: [],
        errors: [{ message: "Nenhum veículo válido encontrado. É necessário ao menos Placa, Chassi ou Categoria." }],
      };
    }

    const processedVeiculos = validVeiculos.map((v) => ({
      ...v,
      departamento_id: v.departamento_id === "" || v.departamento_id === "_none" ? null : v.departamento_id,
      empresa_id: v.empresa_id === "" || v.empresa_id === "_none" ? null : v.empresa_id,
    }));

    const { data, error } = await supabase
      .from("bd_caminhoes_equipamentos")
      .insert(processedVeiculos)
      .select();

    if (error) {
      return { success: [], errors: [{ message: error.message }] };
    }

    return { success: data as Veiculo[], errors: [] };
  } catch (error: any) {
    return {
      success: [],
      errors: [{ message: error.message || "Erro ao processar importação" }],
    };
  }
};
