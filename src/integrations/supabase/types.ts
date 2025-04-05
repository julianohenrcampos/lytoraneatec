export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      bd_apontamento_equipe: {
        Row: {
          colaborador_id: string | null
          created_at: string | null
          data_registro: string
          equipe_id: string
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          lista_entrega_id: string | null
          nome_colaborador: string
          presente: boolean | null
          registrado_por: string | null
          updated_at: string | null
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string | null
          data_registro: string
          equipe_id: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          lista_entrega_id?: string | null
          nome_colaborador: string
          presente?: boolean | null
          registrado_por?: string | null
          updated_at?: string | null
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string | null
          data_registro?: string
          equipe_id?: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          lista_entrega_id?: string | null
          nome_colaborador?: string
          presente?: boolean | null
          registrado_por?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_apontamento_equipe_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_apontamento_equipe_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "bd_equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_apontamento_equipe_lista_entrega_id_fkey"
            columns: ["lista_entrega_id"]
            isOneToOne: false
            referencedRelation: "bd_lista_programacao_entrega"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_apontamento_equipe_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "bd_usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_apontamento_equipe_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_avaliacao_equipe: {
        Row: {
          anotacoes: string | null
          colaborador_id: string
          competencia_tecnica: number | null
          comunicacao: number | null
          created_at: string | null
          criado_por: string | null
          data_avaliacao: string
          equipe_id: string
          id: string
          organizacao: number | null
          pontualidade: number | null
          proatividade: number | null
          trabalho_em_equipe: number | null
        }
        Insert: {
          anotacoes?: string | null
          colaborador_id: string
          competencia_tecnica?: number | null
          comunicacao?: number | null
          created_at?: string | null
          criado_por?: string | null
          data_avaliacao: string
          equipe_id: string
          id?: string
          organizacao?: number | null
          pontualidade?: number | null
          proatividade?: number | null
          trabalho_em_equipe?: number | null
        }
        Update: {
          anotacoes?: string | null
          colaborador_id?: string
          competencia_tecnica?: number | null
          comunicacao?: number | null
          created_at?: string | null
          criado_por?: string | null
          data_avaliacao?: string
          equipe_id?: string
          id?: string
          organizacao?: number | null
          pontualidade?: number | null
          proatividade?: number | null
          trabalho_em_equipe?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_avaliacao_equipe_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_avaliacao_equipe_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "bd_usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_avaliacao_equipe_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_avaliacao_equipe_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "bd_equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_caminhoes_equipamentos: {
        Row: {
          aluguel: string | null
          ano_fabricacao: string | null
          capacidade: string | null
          cor: string | null
          created_at: string | null
          departamento_id: string | null
          empresa_id: string | null
          frota: string | null
          id: string
          imagem_url: string | null
          marca: string | null
          modelo: string | null
          motor: string | null
          numero_frota: string | null
          observacoes: string | null
          placa: string | null
          situacao: string | null
          status_ipva: string | null
          tipo_combustivel: string | null
          tipo_veiculo: string | null
          updated_at: string | null
        }
        Insert: {
          aluguel?: string | null
          ano_fabricacao?: string | null
          capacidade?: string | null
          cor?: string | null
          created_at?: string | null
          departamento_id?: string | null
          empresa_id?: string | null
          frota?: string | null
          id?: string
          imagem_url?: string | null
          marca?: string | null
          modelo?: string | null
          motor?: string | null
          numero_frota?: string | null
          observacoes?: string | null
          placa?: string | null
          situacao?: string | null
          status_ipva?: string | null
          tipo_combustivel?: string | null
          tipo_veiculo?: string | null
          updated_at?: string | null
        }
        Update: {
          aluguel?: string | null
          ano_fabricacao?: string | null
          capacidade?: string | null
          cor?: string | null
          created_at?: string | null
          departamento_id?: string | null
          empresa_id?: string | null
          frota?: string | null
          id?: string
          imagem_url?: string | null
          marca?: string | null
          modelo?: string | null
          motor?: string | null
          numero_frota?: string | null
          observacoes?: string | null
          placa?: string | null
          situacao?: string | null
          status_ipva?: string | null
          tipo_combustivel?: string | null
          tipo_veiculo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_caminhoes_equipamentos_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "bd_departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_caminhoes_equipamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "bd_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_centros_custo: {
        Row: {
          cnpj_vinculado: string | null
          codigo_centro_custo: string
          created_at: string | null
          id: string
          nome_centro_custo: string
          situacao: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          cnpj_vinculado?: string | null
          codigo_centro_custo: string
          created_at?: string | null
          id?: string
          nome_centro_custo: string
          situacao?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          cnpj_vinculado?: string | null
          codigo_centro_custo?: string
          created_at?: string | null
          id?: string
          nome_centro_custo?: string
          situacao?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bd_chamados_os: {
        Row: {
          caminhao_equipamento_id: string | null
          centro_custo_id: string | null
          created_at: string | null
          data_solicitacao: string
          descricao_problema: string | null
          fotos_avarias: string[] | null
          hora_solicitacao: string
          id: string
          numero_chamado: string
          prioridade: string | null
          solicitante_id: string | null
          status: string | null
          tipo_falha: string | null
          updated_at: string | null
        }
        Insert: {
          caminhao_equipamento_id?: string | null
          centro_custo_id?: string | null
          created_at?: string | null
          data_solicitacao?: string
          descricao_problema?: string | null
          fotos_avarias?: string[] | null
          hora_solicitacao?: string
          id?: string
          numero_chamado: string
          prioridade?: string | null
          solicitante_id?: string | null
          status?: string | null
          tipo_falha?: string | null
          updated_at?: string | null
        }
        Update: {
          caminhao_equipamento_id?: string | null
          centro_custo_id?: string | null
          created_at?: string | null
          data_solicitacao?: string
          descricao_problema?: string | null
          fotos_avarias?: string[] | null
          hora_solicitacao?: string
          id?: string
          numero_chamado?: string
          prioridade?: string | null
          solicitante_id?: string | null
          status?: string | null
          tipo_falha?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_chamados_os_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_caminhoes_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_departamentos: {
        Row: {
          created_at: string | null
          empresa_id: string | null
          id: string
          nome_departamento: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          nome_departamento: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          nome_departamento?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_departamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "bd_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_empresas: {
        Row: {
          cnpj: string
          created_at: string | null
          id: string
          nome_empresa: string
          situacao: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          cnpj: string
          created_at?: string | null
          id?: string
          nome_empresa: string
          situacao?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          cnpj?: string
          created_at?: string | null
          id?: string
          nome_empresa?: string
          situacao?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bd_equipes: {
        Row: {
          apontador_id: string | null
          created_at: string | null
          encarregado_id: string | null
          equipe: string[] | null
          id: string
          nome_equipe: string
          updated_at: string | null
        }
        Insert: {
          apontador_id?: string | null
          created_at?: string | null
          encarregado_id?: string | null
          equipe?: string[] | null
          id?: string
          nome_equipe: string
          updated_at?: string | null
        }
        Update: {
          apontador_id?: string | null
          created_at?: string | null
          encarregado_id?: string | null
          equipe?: string[] | null
          id?: string
          nome_equipe?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_equipes_apontador_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_equipes_encarregado_id_fkey"
            columns: ["encarregado_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_funcionarios: {
        Row: {
          adicional_noturno: number | null
          centro_custo_id: string | null
          cpf: string
          created_at: string | null
          custo_passagem: number | null
          data_admissao: string | null
          data_demissao: string | null
          data_ferias: string | null
          data_nascimento: string | null
          departamento_id: string | null
          diarias: number | null
          email: string | null
          empresa_id: string | null
          endereco_completo: string | null
          equipe_id: string | null
          escolaridade: string | null
          funcao_id: string | null
          genero: string | null
          gratificacao: number | null
          id: string
          imagem: string | null
          insalubridade: number | null
          nome_completo: string
          periculosidade: number | null
          refeicao: number | null
          salario_base: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          adicional_noturno?: number | null
          centro_custo_id?: string | null
          cpf: string
          created_at?: string | null
          custo_passagem?: number | null
          data_admissao?: string | null
          data_demissao?: string | null
          data_ferias?: string | null
          data_nascimento?: string | null
          departamento_id?: string | null
          diarias?: number | null
          email?: string | null
          empresa_id?: string | null
          endereco_completo?: string | null
          equipe_id?: string | null
          escolaridade?: string | null
          funcao_id?: string | null
          genero?: string | null
          gratificacao?: number | null
          id?: string
          imagem?: string | null
          insalubridade?: number | null
          nome_completo: string
          periculosidade?: number | null
          refeicao?: number | null
          salario_base?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          adicional_noturno?: number | null
          centro_custo_id?: string | null
          cpf?: string
          created_at?: string | null
          custo_passagem?: number | null
          data_admissao?: string | null
          data_demissao?: string | null
          data_ferias?: string | null
          data_nascimento?: string | null
          departamento_id?: string | null
          diarias?: number | null
          email?: string | null
          empresa_id?: string | null
          endereco_completo?: string | null
          equipe_id?: string | null
          escolaridade?: string | null
          funcao_id?: string | null
          genero?: string | null
          gratificacao?: number | null
          id?: string
          imagem?: string | null
          insalubridade?: number | null
          nome_completo?: string
          periculosidade?: number | null
          refeicao?: number | null
          salario_base?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionarios_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "bd_departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "bd_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionarios_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "bd_funcoes"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_funcoes: {
        Row: {
          created_at: string | null
          id: string
          nome_funcao: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome_funcao: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nome_funcao?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      bd_funcoes_permissao: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          nome_funcao: string
          permissoes: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome_funcao: string
          permissoes?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome_funcao?: string
          permissoes?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bd_lista_programacao_entrega: {
        Row: {
          apontador_id: string
          caminhao_id: string
          created_at: string | null
          data_entrega: string
          equipe_id: string
          id: string
          logradouro: string
          programacao_entrega_id: string
          programacao_id: string | null
          quantidade_massa: number
          requisicao_id: string
          status: string
          tipo_lancamento: string
          updated_at: string | null
          usina_id: string
        }
        Insert: {
          apontador_id: string
          caminhao_id: string
          created_at?: string | null
          data_entrega?: string
          equipe_id: string
          id?: string
          logradouro: string
          programacao_entrega_id: string
          programacao_id?: string | null
          quantidade_massa: number
          requisicao_id: string
          status?: string
          tipo_lancamento: string
          updated_at?: string | null
          usina_id: string
        }
        Update: {
          apontador_id?: string
          caminhao_id?: string
          created_at?: string | null
          data_entrega?: string
          equipe_id?: string
          id?: string
          logradouro?: string
          programacao_entrega_id?: string
          programacao_id?: string | null
          quantidade_massa?: number
          requisicao_id?: string
          status?: string
          tipo_lancamento?: string
          updated_at?: string | null
          usina_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_lista_programacao_entrega_apontador_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_lista_programacao_entrega_caminhao_id_fkey"
            columns: ["caminhao_id"]
            isOneToOne: false
            referencedRelation: "bd_caminhoes_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_lista_programacao_entrega_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "bd_equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_lista_programacao_entrega_programacao_entrega_id_fkey"
            columns: ["programacao_entrega_id"]
            isOneToOne: false
            referencedRelation: "bd_programacao_entrega"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_lista_programacao_entrega_programacao_id_fkey"
            columns: ["programacao_id"]
            isOneToOne: false
            referencedRelation: "bd_programacao_entrega"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_lista_programacao_entrega_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "bd_requisicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_lista_programacao_entrega_usina_id_fkey"
            columns: ["usina_id"]
            isOneToOne: false
            referencedRelation: "bd_usinas"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ordens_servico: {
        Row: {
          anotacoes_internas: string | null
          caminhao_equipamento_id: string | null
          centro_custo_id: string | null
          chamado_id: string | null
          created_at: string | null
          data_fim_atendimento: string | null
          data_inicio_atendimento: string | null
          data_solicitacao: string | null
          descricao_problema: string | null
          duracao_servico: unknown | null
          encerrado_por_id: string | null
          executado_por_id: string | null
          fotos_avarias: string[] | null
          hora_fim_atendimento: string | null
          hora_inicio_atendimento: string | null
          hora_solicitacao: string | null
          horimetro_km: number | null
          horimetro_km_final: number | null
          horimetro_km_inicial: number | null
          id: string
          numero_chamado: string | null
          prioridade: string | null
          setor: string | null
          solicitante_id: string | null
          status: string | null
          tipo_falha: string | null
          tratativa: string | null
          updated_at: string | null
        }
        Insert: {
          anotacoes_internas?: string | null
          caminhao_equipamento_id?: string | null
          centro_custo_id?: string | null
          chamado_id?: string | null
          created_at?: string | null
          data_fim_atendimento?: string | null
          data_inicio_atendimento?: string | null
          data_solicitacao?: string | null
          descricao_problema?: string | null
          duracao_servico?: unknown | null
          encerrado_por_id?: string | null
          executado_por_id?: string | null
          fotos_avarias?: string[] | null
          hora_fim_atendimento?: string | null
          hora_inicio_atendimento?: string | null
          hora_solicitacao?: string | null
          horimetro_km?: number | null
          horimetro_km_final?: number | null
          horimetro_km_inicial?: number | null
          id?: string
          numero_chamado?: string | null
          prioridade?: string | null
          setor?: string | null
          solicitante_id?: string | null
          status?: string | null
          tipo_falha?: string | null
          tratativa?: string | null
          updated_at?: string | null
        }
        Update: {
          anotacoes_internas?: string | null
          caminhao_equipamento_id?: string | null
          centro_custo_id?: string | null
          chamado_id?: string | null
          created_at?: string | null
          data_fim_atendimento?: string | null
          data_inicio_atendimento?: string | null
          data_solicitacao?: string | null
          descricao_problema?: string | null
          duracao_servico?: unknown | null
          encerrado_por_id?: string | null
          executado_por_id?: string | null
          fotos_avarias?: string[] | null
          hora_fim_atendimento?: string | null
          hora_inicio_atendimento?: string | null
          hora_solicitacao?: string | null
          horimetro_km?: number | null
          horimetro_km_final?: number | null
          horimetro_km_inicial?: number | null
          id?: string
          numero_chamado?: string | null
          prioridade?: string | null
          setor?: string | null
          solicitante_id?: string | null
          status?: string | null
          tipo_falha?: string | null
          tratativa?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_ordens_servico_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_caminhoes_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_servico_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_servico_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "bd_chamados_os"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_os_mao_obra: {
        Row: {
          created_at: string | null
          funcao: string | null
          id: string
          os_id: string | null
          quantidade: number | null
          updated_at: string | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          created_at?: string | null
          funcao?: string | null
          id?: string
          os_id?: string | null
          quantidade?: number | null
          updated_at?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          created_at?: string | null
          funcao?: string | null
          id?: string
          os_id?: string | null
          quantidade?: number | null
          updated_at?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_os_mao_obra_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "bd_ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_os_materiais_utilizados: {
        Row: {
          created_at: string | null
          descricao_material: string | null
          id: string
          os_id: string | null
          quantidade: number | null
          updated_at: string | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          created_at?: string | null
          descricao_material?: string | null
          id?: string
          os_id?: string | null
          quantidade?: number | null
          updated_at?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          created_at?: string | null
          descricao_material?: string | null
          id?: string
          os_id?: string | null
          quantidade?: number | null
          updated_at?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_os_materiais_utilizados_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "bd_ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_os_movimentacoes: {
        Row: {
          created_at: string | null
          data_movimentacao: string | null
          hora_movimentacao: string | null
          id: string
          motivo: string | null
          os_id: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_movimentacao?: string | null
          hora_movimentacao?: string | null
          id?: string
          motivo?: string | null
          os_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_movimentacao?: string | null
          hora_movimentacao?: string | null
          id?: string
          motivo?: string | null
          os_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_os_movimentacoes_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "bd_ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_permissoes: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          nome_permissao: string
          rota: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome_permissao: string
          rota?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome_permissao?: string
          rota?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bd_programacao_entrega: {
        Row: {
          centro_custo_id: string
          created_at: string | null
          data_entrega: string
          id: string
          requisicao_id: string
          updated_at: string | null
        }
        Insert: {
          centro_custo_id: string
          created_at?: string | null
          data_entrega: string
          id?: string
          requisicao_id: string
          updated_at?: string | null
        }
        Update: {
          centro_custo_id?: string
          created_at?: string | null
          data_entrega?: string
          id?: string
          requisicao_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_programacao_entrega_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_programacao_entrega_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "bd_requisicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_registro_apontamento_aplicacao: {
        Row: {
          anotacoes_apontador: string | null
          area: number | null
          bordo: string | null
          comprimento: number | null
          created_at: string | null
          data_aplicacao: string
          espessura: number | null
          estaca_final: number | null
          estaca_inicial: number | null
          hora_aplicacao: string | null
          hora_chegada_local: string
          hora_saida_caminhao: string | null
          id: string
          largura_media: number | null
          lista_entrega_id: string | null
          registro_carga_id: string | null
          temperatura_aplicacao: number | null
          temperatura_chegada: number | null
          updated_at: string | null
        }
        Insert: {
          anotacoes_apontador?: string | null
          area?: number | null
          bordo?: string | null
          comprimento?: number | null
          created_at?: string | null
          data_aplicacao: string
          espessura?: number | null
          estaca_final?: number | null
          estaca_inicial?: number | null
          hora_aplicacao?: string | null
          hora_chegada_local: string
          hora_saida_caminhao?: string | null
          id?: string
          largura_media?: number | null
          lista_entrega_id?: string | null
          registro_carga_id?: string | null
          temperatura_aplicacao?: number | null
          temperatura_chegada?: number | null
          updated_at?: string | null
        }
        Update: {
          anotacoes_apontador?: string | null
          area?: number | null
          bordo?: string | null
          comprimento?: number | null
          created_at?: string | null
          data_aplicacao?: string
          espessura?: number | null
          estaca_final?: number | null
          estaca_inicial?: number | null
          hora_aplicacao?: string | null
          hora_chegada_local?: string
          hora_saida_caminhao?: string | null
          id?: string
          largura_media?: number | null
          lista_entrega_id?: string | null
          registro_carga_id?: string | null
          temperatura_aplicacao?: number | null
          temperatura_chegada?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_registro_apontamento_aplicacao_lista_entrega_id_fkey"
            columns: ["lista_entrega_id"]
            isOneToOne: false
            referencedRelation: "bd_lista_programacao_entrega"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_aplicacao_registro_carga_id_fkey"
            columns: ["registro_carga_id"]
            isOneToOne: false
            referencedRelation: "bd_registro_cargas"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_registro_apontamento_cam_equipa: {
        Row: {
          abastecimento: number | null
          caminhao_equipamento_id: string | null
          centro_custo_id: string | null
          created_at: string | null
          data: string | null
          hora_final: string | null
          hora_inicial: string | null
          horimetro_final: number | null
          horimetro_inicial: number | null
          id: string
          operador_id: string | null
          situacao: string | null
          updated_at: string | null
        }
        Insert: {
          abastecimento?: number | null
          caminhao_equipamento_id?: string | null
          centro_custo_id?: string | null
          created_at?: string | null
          data?: string | null
          hora_final?: string | null
          hora_inicial?: string | null
          horimetro_final?: number | null
          horimetro_inicial?: number | null
          id?: string
          operador_id?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Update: {
          abastecimento?: number | null
          caminhao_equipamento_id?: string | null
          centro_custo_id?: string | null
          created_at?: string | null
          data?: string | null
          hora_final?: string | null
          hora_inicial?: string | null
          horimetro_final?: number | null
          horimetro_inicial?: number | null
          id?: string
          operador_id?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_caminhoes_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_registro_apontamento_inspecao: {
        Row: {
          anotacoes: string | null
          apontamento_caminhao_equipamento_id: string | null
          cinto_seguranca: string | null
          created_at: string | null
          documentacao: string | null
          drenagem_tanque_ar: string | null
          engate_reboque: string | null
          estado_equipamentos: string | null
          estado_implementos: string | null
          fotos_avarias: string[] | null
          id: string
          inspecao_veicular: string | null
          limpeza_interna: string | null
          material_amarracao: string | null
          material_desgaste: string | null
          material_rodante: string | null
          nivel_agua: string | null
          nivel_combustivel: string | null
          nivel_oleo: string | null
          sistema_eletrico: string | null
          tacografo: string | null
          updated_at: string | null
        }
        Insert: {
          anotacoes?: string | null
          apontamento_caminhao_equipamento_id?: string | null
          cinto_seguranca?: string | null
          created_at?: string | null
          documentacao?: string | null
          drenagem_tanque_ar?: string | null
          engate_reboque?: string | null
          estado_equipamentos?: string | null
          estado_implementos?: string | null
          fotos_avarias?: string[] | null
          id?: string
          inspecao_veicular?: string | null
          limpeza_interna?: string | null
          material_amarracao?: string | null
          material_desgaste?: string | null
          material_rodante?: string | null
          nivel_agua?: string | null
          nivel_combustivel?: string | null
          nivel_oleo?: string | null
          sistema_eletrico?: string | null
          tacografo?: string | null
          updated_at?: string | null
        }
        Update: {
          anotacoes?: string | null
          apontamento_caminhao_equipamento_id?: string | null
          cinto_seguranca?: string | null
          created_at?: string | null
          documentacao?: string | null
          drenagem_tanque_ar?: string | null
          engate_reboque?: string | null
          estado_equipamentos?: string | null
          estado_implementos?: string | null
          fotos_avarias?: string[] | null
          id?: string
          inspecao_veicular?: string | null
          limpeza_interna?: string | null
          material_amarracao?: string | null
          material_desgaste?: string | null
          material_rodante?: string | null
          nivel_agua?: string | null
          nivel_combustivel?: string | null
          nivel_oleo?: string | null
          sistema_eletrico?: string | null
          tacografo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_registro_apontamento_inspe_apontamento_caminhao_equipam_fkey"
            columns: ["apontamento_caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_registro_apontamento_cam_equipa"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_registro_cargas: {
        Row: {
          data_saida: string
          hora_saida: string
          id: string
          imagem_ticket_retorno: string | null
          imagem_ticket_saida: string
          lista_entrega_id: string
          programacao_id: string
          status_registro: string | null
          temperatura_saida: number | null
          tonelada_real: number | null
          tonelada_retorno: number | null
          tonelada_saida: number
        }
        Insert: {
          data_saida: string
          hora_saida: string
          id?: string
          imagem_ticket_retorno?: string | null
          imagem_ticket_saida: string
          lista_entrega_id: string
          programacao_id: string
          status_registro?: string | null
          temperatura_saida?: number | null
          tonelada_real?: number | null
          tonelada_retorno?: number | null
          tonelada_saida: number
        }
        Update: {
          data_saida?: string
          hora_saida?: string
          id?: string
          imagem_ticket_retorno?: string | null
          imagem_ticket_saida?: string
          lista_entrega_id?: string
          programacao_id?: string
          status_registro?: string | null
          temperatura_saida?: number | null
          tonelada_real?: number | null
          tonelada_retorno?: number | null
          tonelada_saida?: number
        }
        Relationships: [
          {
            foreignKeyName: "bd_registro_cargas_lista_entrega_id_fkey"
            columns: ["lista_entrega_id"]
            isOneToOne: false
            referencedRelation: "bd_lista_programacao_entrega"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_cargas_programacao_id_fkey"
            columns: ["programacao_id"]
            isOneToOne: false
            referencedRelation: "bd_programacao_entrega"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_registro_os: {
        Row: {
          anotacoes_internas: string | null
          caminhao_equipamento_id: string | null
          centro_custo_id: string | null
          created_at: string | null
          data_solicitacao: string
          descricao_problema: string | null
          fotos_os: string[] | null
          hora_solicitacao: string
          id: string
          numero_chamado: string
          prioridade: string | null
          solicitante_id: string | null
          status: string | null
          tipo_falha: string | null
          updated_at: string | null
        }
        Insert: {
          anotacoes_internas?: string | null
          caminhao_equipamento_id?: string | null
          centro_custo_id?: string | null
          created_at?: string | null
          data_solicitacao: string
          descricao_problema?: string | null
          fotos_os?: string[] | null
          hora_solicitacao: string
          id?: string
          numero_chamado: string
          prioridade?: string | null
          solicitante_id?: string | null
          status?: string | null
          tipo_falha?: string | null
          updated_at?: string | null
        }
        Update: {
          anotacoes_internas?: string | null
          caminhao_equipamento_id?: string | null
          centro_custo_id?: string | null
          created_at?: string | null
          data_solicitacao?: string
          descricao_problema?: string | null
          fotos_os?: string[] | null
          hora_solicitacao?: string
          id?: string
          numero_chamado?: string
          prioridade?: string | null
          solicitante_id?: string | null
          status?: string | null
          tipo_falha?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_registro_os_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_caminhoes_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_requisicoes: {
        Row: {
          centro_custo_id: string | null
          created_at: string | null
          data_requisicao: string
          diretoria: string | null
          engenheiro_id: string | null
          gerencia: string | null
          id: string
          numero: string
          updated_at: string | null
        }
        Insert: {
          centro_custo_id?: string | null
          created_at?: string | null
          data_requisicao?: string
          diretoria?: string | null
          engenheiro_id?: string | null
          gerencia?: string | null
          id?: string
          numero: string
          updated_at?: string | null
        }
        Update: {
          centro_custo_id?: string | null
          created_at?: string | null
          data_requisicao?: string
          diretoria?: string | null
          engenheiro_id?: string | null
          gerencia?: string | null
          id?: string
          numero?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_requisicoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_requisicoes_engenheiro_id_fkey"
            columns: ["engenheiro_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ruas_requisicao: {
        Row: {
          area: number | null
          bairro: string | null
          comprimento: number
          created_at: string | null
          espessura: number
          id: string
          largura: number
          logradouro: string
          pintura_ligacao: string
          requisicao_id: string | null
          traco: string
          updated_at: string | null
          volume: number | null
        }
        Insert: {
          area?: number | null
          bairro?: string | null
          comprimento: number
          created_at?: string | null
          espessura: number
          id?: string
          largura: number
          logradouro: string
          pintura_ligacao: string
          requisicao_id?: string | null
          traco: string
          updated_at?: string | null
          volume?: number | null
        }
        Update: {
          area?: number | null
          bairro?: string | null
          comprimento?: number
          created_at?: string | null
          espessura?: number
          id?: string
          largura?: number
          logradouro?: string
          pintura_ligacao?: string
          requisicao_id?: string | null
          traco?: string
          updated_at?: string | null
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_ruas_requisicao_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "bd_requisicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_usinas: {
        Row: {
          created_at: string | null
          endereco: string | null
          id: string
          nome_usina: string
          producao_total: number | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          endereco?: string | null
          id?: string
          nome_usina: string
          producao_total?: number | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          endereco?: string | null
          id?: string
          nome_usina?: string
          producao_total?: number | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          funcao_permissao: string | null
          funcoes: string[] | null
          id: string
          imagem_url: string | null
          nome_completo: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          funcao_permissao?: string | null
          funcoes?: string[] | null
          id: string
          imagem_url?: string | null
          nome_completo?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          funcao_permissao?: string | null
          funcoes?: string[] | null
          id?: string
          imagem_url?: string | null
          nome_completo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_funcao_permissao_fkey"
            columns: ["funcao_permissao"]
            isOneToOne: false
            referencedRelation: "bd_funcoes_permissao"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      bd_usuarios: {
        Row: {
          email: string | null
          id: string | null
          imagem_url: string | null
          nome_completo: string | null
        }
        Insert: {
          email?: string | null
          id?: string | null
          imagem_url?: string | null
          nome_completo?: string | null
        }
        Update: {
          email?: string | null
          id?: string | null
          imagem_url?: string | null
          nome_completo?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
