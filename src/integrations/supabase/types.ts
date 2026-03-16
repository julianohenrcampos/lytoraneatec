export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      bd_abast_sync_log: {
        Row: {
          atualizados: number | null
          created_at: string | null
          data_fim: string
          data_inicio: string
          duracao_segundos: number | null
          executado_por: string | null
          id: string
          mensagem_erro: string | null
          novos_registros: number | null
          status: string | null
          total_registros: number | null
        }
        Insert: {
          atualizados?: number | null
          created_at?: string | null
          data_fim: string
          data_inicio: string
          duracao_segundos?: number | null
          executado_por?: string | null
          id?: string
          mensagem_erro?: string | null
          novos_registros?: number | null
          status?: string | null
          total_registros?: number | null
        }
        Update: {
          atualizados?: number | null
          created_at?: string | null
          data_fim?: string
          data_inicio?: string
          duracao_segundos?: number | null
          executado_por?: string | null
          id?: string
          mensagem_erro?: string | null
          novos_registros?: number | null
          status?: string | null
          total_registros?: number | null
        }
        Relationships: []
      }
      bd_abastecimentos: {
        Row: {
          bico: string | null
          cc: string | null
          codigo_terceiro: string | null
          comboista: string | null
          comboista_tag: string | null
          combustivel: string | null
          created_at: string | null
          created_by: string | null
          data_abast: string
          data_integracao: string | null
          encerrante_fim: number | null
          estoque: string | null
          foto_verificada: boolean | null
          frota: string | null
          frota_tag: string | null
          hora_abast: string | null
          id: string
          identificacao_do_ponto: string | null
          identificador: string | null
          latitude: number | null
          litragem: number | null
          longitude: number | null
          medidor: number | null
          medidor_anterior_data: string | null
          medidor_anterior_valor: number | null
          medidor_unidade: string | null
          medidor_via_entrada: string | null
          operacao: string | null
          operador: string | null
          operador_tag: string | null
          placa: string | null
          registrado_editado_por: string | null
          registro_editado_em: string | null
          tipo_procedimento: string | null
          updated_at: string | null
        }
        Insert: {
          bico?: string | null
          cc?: string | null
          codigo_terceiro?: string | null
          comboista?: string | null
          comboista_tag?: string | null
          combustivel?: string | null
          created_at?: string | null
          created_by?: string | null
          data_abast: string
          data_integracao?: string | null
          encerrante_fim?: number | null
          estoque?: string | null
          foto_verificada?: boolean | null
          frota?: string | null
          frota_tag?: string | null
          hora_abast?: string | null
          id?: string
          identificacao_do_ponto?: string | null
          identificador?: string | null
          latitude?: number | null
          litragem?: number | null
          longitude?: number | null
          medidor?: number | null
          medidor_anterior_data?: string | null
          medidor_anterior_valor?: number | null
          medidor_unidade?: string | null
          medidor_via_entrada?: string | null
          operacao?: string | null
          operador?: string | null
          operador_tag?: string | null
          placa?: string | null
          registrado_editado_por?: string | null
          registro_editado_em?: string | null
          tipo_procedimento?: string | null
          updated_at?: string | null
        }
        Update: {
          bico?: string | null
          cc?: string | null
          codigo_terceiro?: string | null
          comboista?: string | null
          comboista_tag?: string | null
          combustivel?: string | null
          created_at?: string | null
          created_by?: string | null
          data_abast?: string
          data_integracao?: string | null
          encerrante_fim?: number | null
          estoque?: string | null
          foto_verificada?: boolean | null
          frota?: string | null
          frota_tag?: string | null
          hora_abast?: string | null
          id?: string
          identificacao_do_ponto?: string | null
          identificador?: string | null
          latitude?: number | null
          litragem?: number | null
          longitude?: number | null
          medidor?: number | null
          medidor_anterior_data?: string | null
          medidor_anterior_valor?: number | null
          medidor_unidade?: string | null
          medidor_via_entrada?: string | null
          operacao?: string | null
          operador?: string | null
          operador_tag?: string | null
          placa?: string | null
          registrado_editado_por?: string | null
          registro_editado_em?: string | null
          tipo_procedimento?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bd_agendamentos_exames: {
        Row: {
          banco_agencia: string | null
          banco_conta: string | null
          contrato: string | null
          cpf: string | null
          criado_em: string
          criado_por: string
          data_agendamento: string
          data_inicio_prevista: string | null
          data_nascimento: string | null
          data_registro_carteira: string | null
          data_resultado_exame: string | null
          doc_certidao_filhos: boolean | null
          doc_certificado_reservista: boolean | null
          doc_cnh: boolean | null
          doc_comprovante_escolaridade: boolean | null
          doc_comprovante_residencia: boolean | null
          doc_exame_toxicologico: boolean | null
          doc_pis_pasep: boolean | null
          doc_titulo_eleitor: boolean | null
          documentos_anexados: boolean
          email: string | null
          empresa: string
          etapa_atual: number | null
          etapa1_concluida: boolean | null
          funcao: string
          horario_agendamento: string
          id: string
          local_atendimento_id: string
          modificado_por: string | null
          motivo_mudanca_risco: string | null
          nome_colaborador: string
          observacoes: string | null
          possui_carteira_digital: boolean | null
          possui_conta_santander: boolean | null
          rg: string | null
          status: string
          status_carteira: string | null
          status_integracao: string | null
          tecnico_seguranca: string | null
          telefone_celular: string | null
          tipo_exame: string
          vr_entregue_em: string | null
          vr_solicitado_em: string | null
          vt_entregue_em: string | null
          vt_solicitado_em: string | null
        }
        Insert: {
          banco_agencia?: string | null
          banco_conta?: string | null
          contrato?: string | null
          cpf?: string | null
          criado_em?: string
          criado_por: string
          data_agendamento: string
          data_inicio_prevista?: string | null
          data_nascimento?: string | null
          data_registro_carteira?: string | null
          data_resultado_exame?: string | null
          doc_certidao_filhos?: boolean | null
          doc_certificado_reservista?: boolean | null
          doc_cnh?: boolean | null
          doc_comprovante_escolaridade?: boolean | null
          doc_comprovante_residencia?: boolean | null
          doc_exame_toxicologico?: boolean | null
          doc_pis_pasep?: boolean | null
          doc_titulo_eleitor?: boolean | null
          documentos_anexados?: boolean
          email?: string | null
          empresa: string
          etapa_atual?: number | null
          etapa1_concluida?: boolean | null
          funcao: string
          horario_agendamento: string
          id?: string
          local_atendimento_id: string
          modificado_por?: string | null
          motivo_mudanca_risco?: string | null
          nome_colaborador: string
          observacoes?: string | null
          possui_carteira_digital?: boolean | null
          possui_conta_santander?: boolean | null
          rg?: string | null
          status?: string
          status_carteira?: string | null
          status_integracao?: string | null
          tecnico_seguranca?: string | null
          telefone_celular?: string | null
          tipo_exame: string
          vr_entregue_em?: string | null
          vr_solicitado_em?: string | null
          vt_entregue_em?: string | null
          vt_solicitado_em?: string | null
        }
        Update: {
          banco_agencia?: string | null
          banco_conta?: string | null
          contrato?: string | null
          cpf?: string | null
          criado_em?: string
          criado_por?: string
          data_agendamento?: string
          data_inicio_prevista?: string | null
          data_nascimento?: string | null
          data_registro_carteira?: string | null
          data_resultado_exame?: string | null
          doc_certidao_filhos?: boolean | null
          doc_certificado_reservista?: boolean | null
          doc_cnh?: boolean | null
          doc_comprovante_escolaridade?: boolean | null
          doc_comprovante_residencia?: boolean | null
          doc_exame_toxicologico?: boolean | null
          doc_pis_pasep?: boolean | null
          doc_titulo_eleitor?: boolean | null
          documentos_anexados?: boolean
          email?: string | null
          empresa?: string
          etapa_atual?: number | null
          etapa1_concluida?: boolean | null
          funcao?: string
          horario_agendamento?: string
          id?: string
          local_atendimento_id?: string
          modificado_por?: string | null
          motivo_mudanca_risco?: string | null
          nome_colaborador?: string
          observacoes?: string | null
          possui_carteira_digital?: boolean | null
          possui_conta_santander?: boolean | null
          rg?: string | null
          status?: string
          status_carteira?: string | null
          status_integracao?: string | null
          tecnico_seguranca?: string | null
          telefone_celular?: string | null
          tipo_exame?: string
          vr_entregue_em?: string | null
          vr_solicitado_em?: string | null
          vt_entregue_em?: string | null
          vt_solicitado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_agendamentos_exames_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_agendamentos_exames_local_atendimento_id_fkey"
            columns: ["local_atendimento_id"]
            isOneToOne: false
            referencedRelation: "bd_locais_atendimento"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_agendamentos_exames_anexos: {
        Row: {
          agendamento_id: string
          arquivo_nome: string
          arquivo_path: string
          criado_em: string
          criado_por: string
          id: string
          tipo: string | null
        }
        Insert: {
          agendamento_id: string
          arquivo_nome: string
          arquivo_path: string
          criado_em?: string
          criado_por: string
          id?: string
          tipo?: string | null
        }
        Update: {
          agendamento_id?: string
          arquivo_nome?: string
          arquivo_path?: string
          criado_em?: string
          criado_por?: string
          id?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_agendamentos_exames_anexos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "bd_agendamentos_exames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_agendamentos_exames_anexos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          modificado_por: string | null
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
          modificado_por?: string | null
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
          modificado_por?: string | null
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
            foreignKeyName: "bd_apontamento_equipe_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_auditoria_correcao_registros_carga: {
        Row: {
          data_correcao: string | null
          id: string
          motivo: string
          registro_carga_id: string
          tonelada_real_anterior: number | null
          tonelada_real_corrigida: number | null
          tonelada_retorno_anterior: number | null
          tonelada_retorno_corrigida: number | null
          tonelada_saida_anterior: number
          tonelada_saida_corrigida: number
        }
        Insert: {
          data_correcao?: string | null
          id?: string
          motivo?: string
          registro_carga_id: string
          tonelada_real_anterior?: number | null
          tonelada_real_corrigida?: number | null
          tonelada_retorno_anterior?: number | null
          tonelada_retorno_corrigida?: number | null
          tonelada_saida_anterior: number
          tonelada_saida_corrigida: number
        }
        Update: {
          data_correcao?: string | null
          id?: string
          motivo?: string
          registro_carga_id?: string
          tonelada_real_anterior?: number | null
          tonelada_real_corrigida?: number | null
          tonelada_retorno_anterior?: number | null
          tonelada_retorno_corrigida?: number | null
          tonelada_saida_anterior?: number
          tonelada_saida_corrigida?: number
        }
        Relationships: []
      }
      bd_auditoria_correcao_volume_formula: {
        Row: {
          area: number
          data_correcao: string | null
          espessura_cm: number
          espessura_metros: number
          id: string
          motivo: string
          rua_requisicao_id: string
          volume_anterior: number
          volume_corrigido: number
        }
        Insert: {
          area: number
          data_correcao?: string | null
          espessura_cm: number
          espessura_metros: number
          id?: string
          motivo?: string
          rua_requisicao_id: string
          volume_anterior: number
          volume_corrigido: number
        }
        Update: {
          area?: number
          data_correcao?: string | null
          espessura_cm?: number
          espessura_metros?: number
          id?: string
          motivo?: string
          rua_requisicao_id?: string
          volume_anterior?: number
          volume_corrigido?: number
        }
        Relationships: []
      }
      bd_auditoria_log: {
        Row: {
          campos_alterados: string[] | null
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          operacao: string
          registro_id: string | null
          tabela: string
          usuario_id: string | null
        }
        Insert: {
          campos_alterados?: string[] | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          operacao: string
          registro_id?: string | null
          tabela: string
          usuario_id?: string | null
        }
        Update: {
          campos_alterados?: string[] | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          operacao?: string
          registro_id?: string | null
          tabela?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      bd_auditoria_sync_equipe_funcionario: {
        Row: {
          data_sync: string | null
          equipe_id_anterior: string | null
          equipe_id_novo: string
          funcionario_id: string
          id: string
          motivo: string | null
          nome_equipe: string
          nome_funcionario: string
        }
        Insert: {
          data_sync?: string | null
          equipe_id_anterior?: string | null
          equipe_id_novo: string
          funcionario_id: string
          id?: string
          motivo?: string | null
          nome_equipe: string
          nome_funcionario: string
        }
        Update: {
          data_sync?: string | null
          equipe_id_anterior?: string | null
          equipe_id_novo?: string
          funcionario_id?: string
          id?: string
          motivo?: string | null
          nome_equipe?: string
          nome_funcionario?: string
        }
        Relationships: []
      }
      bd_auditoria_volume_correcao: {
        Row: {
          data_correcao: string | null
          id: string
          motivo: string
          rua_requisicao_id: string
          volume_anterior: number
          volume_corrigido: number
        }
        Insert: {
          data_correcao?: string | null
          id?: string
          motivo: string
          rua_requisicao_id: string
          volume_anterior: number
          volume_corrigido: number
        }
        Update: {
          data_correcao?: string | null
          id?: string
          motivo?: string
          rua_requisicao_id?: string
          volume_anterior?: number
          volume_corrigido?: number
        }
        Relationships: []
      }
      bd_avaliacao_equipe: {
        Row: {
          colaborador_id: string
          competencia_tecnica: number | null
          comunicacao: number | null
          created_at: string
          created_by: string | null
          data_avaliacao: string
          equipe_id: string
          id: string
          modificado_por: string | null
          observacoes: string | null
          organizacao: number | null
          pontualidade: number | null
          proatividade: number | null
          trabalho_em_equipe: number | null
          updated_at: string
        }
        Insert: {
          colaborador_id: string
          competencia_tecnica?: number | null
          comunicacao?: number | null
          created_at?: string
          created_by?: string | null
          data_avaliacao?: string
          equipe_id: string
          id?: string
          modificado_por?: string | null
          observacoes?: string | null
          organizacao?: number | null
          pontualidade?: number | null
          proatividade?: number | null
          trabalho_em_equipe?: number | null
          updated_at?: string
        }
        Update: {
          colaborador_id?: string
          competencia_tecnica?: number | null
          comunicacao?: number | null
          created_at?: string
          created_by?: string | null
          data_avaliacao?: string
          equipe_id?: string
          id?: string
          modificado_por?: string | null
          observacoes?: string | null
          organizacao?: number | null
          pontualidade?: number | null
          proatividade?: number | null
          trabalho_em_equipe?: number | null
          updated_at?: string
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
          categoria_ativo_id: string | null
          chassi: string | null
          cor: string | null
          created_at: string | null
          departamento_id: string | null
          empresa_id: string | null
          empresa_locadora_id: string | null
          fabricante: string | null
          frota: string | null
          id: string
          imagem_url: string | null
          informacoes_complementares: string | null
          modelo: string | null
          modificado_por: string | null
          motor: string | null
          numero_frota: string | null
          numero_serie: string | null
          observacoes: string | null
          placa: string | null
          proprietario_tipo: string | null
          situacao: string | null
          status_cadastro: string | null
          status_disponibilidade: string | null
          status_ipva: string | null
          subcategoria_ativo_id: string | null
          tipo_ativo: string | null
          tipo_combustivel: string | null
          tipo_veiculo: string | null
          updated_at: string | null
        }
        Insert: {
          aluguel?: string | null
          ano_fabricacao?: string | null
          capacidade?: string | null
          categoria_ativo_id?: string | null
          chassi?: string | null
          cor?: string | null
          created_at?: string | null
          departamento_id?: string | null
          empresa_id?: string | null
          empresa_locadora_id?: string | null
          fabricante?: string | null
          frota?: string | null
          id?: string
          imagem_url?: string | null
          informacoes_complementares?: string | null
          modelo?: string | null
          modificado_por?: string | null
          motor?: string | null
          numero_frota?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          placa?: string | null
          proprietario_tipo?: string | null
          situacao?: string | null
          status_cadastro?: string | null
          status_disponibilidade?: string | null
          status_ipva?: string | null
          subcategoria_ativo_id?: string | null
          tipo_ativo?: string | null
          tipo_combustivel?: string | null
          tipo_veiculo?: string | null
          updated_at?: string | null
        }
        Update: {
          aluguel?: string | null
          ano_fabricacao?: string | null
          capacidade?: string | null
          categoria_ativo_id?: string | null
          chassi?: string | null
          cor?: string | null
          created_at?: string | null
          departamento_id?: string | null
          empresa_id?: string | null
          empresa_locadora_id?: string | null
          fabricante?: string | null
          frota?: string | null
          id?: string
          imagem_url?: string | null
          informacoes_complementares?: string | null
          modelo?: string | null
          modificado_por?: string | null
          motor?: string | null
          numero_frota?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          placa?: string | null
          proprietario_tipo?: string | null
          situacao?: string | null
          status_cadastro?: string | null
          status_disponibilidade?: string | null
          status_ipva?: string | null
          subcategoria_ativo_id?: string | null
          tipo_ativo?: string | null
          tipo_combustivel?: string | null
          tipo_veiculo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_caminhoes_equipamentos_categoria_ativo_id_fkey"
            columns: ["categoria_ativo_id"]
            isOneToOne: false
            referencedRelation: "bd_categorias_ativos"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "bd_caminhoes_equipamentos_empresa_locadora_id_fkey"
            columns: ["empresa_locadora_id"]
            isOneToOne: false
            referencedRelation: "bd_empresas_locadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_caminhoes_equipamentos_subcategoria_ativo_id_fkey"
            columns: ["subcategoria_ativo_id"]
            isOneToOne: false
            referencedRelation: "bd_subcategorias_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_carga_status_historico: {
        Row: {
          alterado_por: string | null
          created_at: string
          data_alteracao: string
          id: string
          lista_entrega_id: string | null
          massa_remanescente: number | null
          observacoes: string | null
          percentual_aplicado: number | null
          registro_carga_id: string | null
          status_anterior: string | null
          status_novo: string
        }
        Insert: {
          alterado_por?: string | null
          created_at?: string
          data_alteracao?: string
          id?: string
          lista_entrega_id?: string | null
          massa_remanescente?: number | null
          observacoes?: string | null
          percentual_aplicado?: number | null
          registro_carga_id?: string | null
          status_anterior?: string | null
          status_novo: string
        }
        Update: {
          alterado_por?: string | null
          created_at?: string
          data_alteracao?: string
          id?: string
          lista_entrega_id?: string | null
          massa_remanescente?: number | null
          observacoes?: string | null
          percentual_aplicado?: number | null
          registro_carga_id?: string | null
          status_anterior?: string | null
          status_novo?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_carga_status_historico_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_carga_status_historico_lista_entrega_id_fkey"
            columns: ["lista_entrega_id"]
            isOneToOne: false
            referencedRelation: "bd_lista_programacao_entrega"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_carga_status_historico_registro_carga_id_fkey"
            columns: ["registro_carga_id"]
            isOneToOne: false
            referencedRelation: "bd_registro_cargas"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_categorias_ativos: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          descricao: string | null
          id: string
          nome_categoria: string
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome_categoria: string
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome_categoria?: string
        }
        Relationships: []
      }
      bd_centros_custo: {
        Row: {
          aprovador_diarias_id: string | null
          cnpj_vinculado: string | null
          codigo_centro_custo: string
          created_at: string | null
          diretoria_id: string | null
          id: string
          modificado_por: string | null
          nome_alterdata: string | null
          nome_centro_custo: string
          situacao: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          aprovador_diarias_id?: string | null
          cnpj_vinculado?: string | null
          codigo_centro_custo: string
          created_at?: string | null
          diretoria_id?: string | null
          id?: string
          modificado_por?: string | null
          nome_alterdata?: string | null
          nome_centro_custo: string
          situacao?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          aprovador_diarias_id?: string | null
          cnpj_vinculado?: string | null
          codigo_centro_custo?: string
          created_at?: string | null
          diretoria_id?: string | null
          id?: string
          modificado_por?: string | null
          nome_alterdata?: string | null
          nome_centro_custo?: string
          situacao?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_centros_custo_aprovador_diarias_id_fkey"
            columns: ["aprovador_diarias_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_centros_custo_diretoria_id_fkey"
            columns: ["diretoria_id"]
            isOneToOne: false
            referencedRelation: "bd_diretorias"
            referencedColumns: ["id"]
          },
        ]
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
          modificado_por: string | null
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
          modificado_por?: string | null
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
          modificado_por?: string | null
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
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_departamentos: {
        Row: {
          created_at: string | null
          empresa_id: string
          id: string
          modificado_por: string | null
          nome_departamento: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          id?: string
          modificado_por?: string | null
          nome_departamento?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          modificado_por?: string | null
          nome_departamento?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_departamento_empresa"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "bd_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_diaria_apontamentos: {
        Row: {
          created_at: string | null
          criado_por: string | null
          data_abertura: string | null
          data_finalizacao: string | null
          edicao_liberada: boolean | null
          id: string
          modificado_por: string | null
          observacoes: string | null
          responsavel_campo_id: string
          solicitacao_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          criado_por?: string | null
          data_abertura?: string | null
          data_finalizacao?: string | null
          edicao_liberada?: boolean | null
          id?: string
          modificado_por?: string | null
          observacoes?: string | null
          responsavel_campo_id: string
          solicitacao_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          criado_por?: string | null
          data_abertura?: string | null
          data_finalizacao?: string | null
          edicao_liberada?: boolean | null
          id?: string
          modificado_por?: string | null
          observacoes?: string | null
          responsavel_campo_id?: string
          solicitacao_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_diaria_apontamentos_responsavel_campo_id_fkey"
            columns: ["responsavel_campo_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_apontamentos_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: true
            referencedRelation: "bd_diaria_solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_diaria_aprovacoes: {
        Row: {
          acao: string
          comentario: string | null
          entidade: string
          entidade_id: string
          feito_em: string | null
          feito_por: string | null
          id: string
        }
        Insert: {
          acao: string
          comentario?: string | null
          entidade: string
          entidade_id: string
          feito_em?: string | null
          feito_por?: string | null
          id?: string
        }
        Update: {
          acao?: string
          comentario?: string | null
          entidade?: string
          entidade_id?: string
          feito_em?: string | null
          feito_por?: string | null
          id?: string
        }
        Relationships: []
      }
      bd_diaria_presencas: {
        Row: {
          confirmado_em: string | null
          confirmado_por: string | null
          created_at: string | null
          data: string
          funcao_id: string | null
          funcionario_id: string
          hora_entrada: string | null
          hora_saida: string | null
          id: string
          intervalo_fim: string | null
          intervalo_inicio: string | null
          modificado_por: string | null
          observacoes: string | null
          presente: boolean | null
          recebe_refeicao: boolean | null
          solicitacao_id: string
          tipo_diaria: string | null
          turno: string
          updated_at: string | null
          usar_diaria_exclusiva: boolean | null
          valor_diaria_aplicada: number
          valor_refeicao_aplicado: number | null
        }
        Insert: {
          confirmado_em?: string | null
          confirmado_por?: string | null
          created_at?: string | null
          data: string
          funcao_id?: string | null
          funcionario_id: string
          hora_entrada?: string | null
          hora_saida?: string | null
          id?: string
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          modificado_por?: string | null
          observacoes?: string | null
          presente?: boolean | null
          recebe_refeicao?: boolean | null
          solicitacao_id: string
          tipo_diaria?: string | null
          turno?: string
          updated_at?: string | null
          usar_diaria_exclusiva?: boolean | null
          valor_diaria_aplicada?: number
          valor_refeicao_aplicado?: number | null
        }
        Update: {
          confirmado_em?: string | null
          confirmado_por?: string | null
          created_at?: string | null
          data?: string
          funcao_id?: string | null
          funcionario_id?: string
          hora_entrada?: string | null
          hora_saida?: string | null
          id?: string
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          modificado_por?: string | null
          observacoes?: string | null
          presente?: boolean | null
          recebe_refeicao?: boolean | null
          solicitacao_id?: string
          tipo_diaria?: string | null
          turno?: string
          updated_at?: string | null
          usar_diaria_exclusiva?: boolean | null
          valor_diaria_aplicada?: number
          valor_refeicao_aplicado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_diaria_presencas_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "bd_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_diaria_solicitacoes: {
        Row: {
          autorizado_em: string | null
          autorizado_por: string | null
          centro_custo_id: string
          considera_fds_feriado: boolean | null
          convocados_pre: Json | null
          created_at: string | null
          criado_por: string | null
          data_fim: string
          data_inicio: string
          engenheiro_solicitante_id: string | null
          id: string
          justificativa: string
          modificado_por: string | null
          numero_solicitacao: string
          observacao_gerente: string | null
          qtde_dias_uteis_estimado: number | null
          qtde_fds_estimado: number | null
          qtde_feriados_estimado: number | null
          responsavel_campo_id: string | null
          status: string
          updated_at: string | null
          valor_estimado_total: number | null
        }
        Insert: {
          autorizado_em?: string | null
          autorizado_por?: string | null
          centro_custo_id: string
          considera_fds_feriado?: boolean | null
          convocados_pre?: Json | null
          created_at?: string | null
          criado_por?: string | null
          data_fim: string
          data_inicio: string
          engenheiro_solicitante_id?: string | null
          id?: string
          justificativa: string
          modificado_por?: string | null
          numero_solicitacao: string
          observacao_gerente?: string | null
          qtde_dias_uteis_estimado?: number | null
          qtde_fds_estimado?: number | null
          qtde_feriados_estimado?: number | null
          responsavel_campo_id?: string | null
          status?: string
          updated_at?: string | null
          valor_estimado_total?: number | null
        }
        Update: {
          autorizado_em?: string | null
          autorizado_por?: string | null
          centro_custo_id?: string
          considera_fds_feriado?: boolean | null
          convocados_pre?: Json | null
          created_at?: string | null
          criado_por?: string | null
          data_fim?: string
          data_inicio?: string
          engenheiro_solicitante_id?: string | null
          id?: string
          justificativa?: string
          modificado_por?: string | null
          numero_solicitacao?: string
          observacao_gerente?: string | null
          qtde_dias_uteis_estimado?: number | null
          qtde_fds_estimado?: number | null
          qtde_feriados_estimado?: number | null
          responsavel_campo_id?: string | null
          status?: string
          updated_at?: string | null
          valor_estimado_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_responsavel_campo_id_fkey"
            columns: ["responsavel_campo_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_diaria_status: {
        Row: {
          criado_em: string | null
          criado_por: string | null
          data: string
          editado_em: string | null
          editado_por: string | null
          id: string
          solicitacao_id: string
          status: string
        }
        Insert: {
          criado_em?: string | null
          criado_por?: string | null
          data: string
          editado_em?: string | null
          editado_por?: string | null
          id?: string
          solicitacao_id: string
          status?: string
        }
        Update: {
          criado_em?: string | null
          criado_por?: string | null
          data?: string
          editado_em?: string | null
          editado_por?: string | null
          id?: string
          solicitacao_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_diaria_status_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_diretorias: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          diretor_id: string | null
          id: string
          modificado_por: string | null
          nome: string
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          diretor_id?: string | null
          id?: string
          modificado_por?: string | null
          nome: string
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          diretor_id?: string | null
          id?: string
          modificado_por?: string | null
          nome?: string
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_diretorias_diretor_id_fkey"
            columns: ["diretor_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_empresas: {
        Row: {
          cnpj: string
          created_at: string | null
          id: string
          modificado_por: string | null
          nome_empresa: string
          situacao: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          cnpj: string
          created_at?: string | null
          id?: string
          modificado_por?: string | null
          nome_empresa: string
          situacao?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          cnpj?: string
          created_at?: string | null
          id?: string
          modificado_por?: string | null
          nome_empresa?: string
          situacao?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bd_empresas_locadoras: {
        Row: {
          cartao_cnpj_url: string | null
          contrato_social_url: string | null
          criado_em: string | null
          documento_mei_url: string | null
          id: string
          nome_empresa: string
          proposta_url: string | null
          rg_cpf_socio_url: string | null
        }
        Insert: {
          cartao_cnpj_url?: string | null
          contrato_social_url?: string | null
          criado_em?: string | null
          documento_mei_url?: string | null
          id?: string
          nome_empresa: string
          proposta_url?: string | null
          rg_cpf_socio_url?: string | null
        }
        Update: {
          cartao_cnpj_url?: string | null
          contrato_social_url?: string | null
          criado_em?: string | null
          documento_mei_url?: string | null
          id?: string
          nome_empresa?: string
          proposta_url?: string | null
          rg_cpf_socio_url?: string | null
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
          modificado_por: string | null
          nome_equipe: string
          updated_at: string | null
        }
        Insert: {
          apontador_id?: string | null
          created_at?: string | null
          encarregado_id?: string | null
          equipe?: string[] | null
          id?: string
          modificado_por?: string | null
          nome_equipe: string
          updated_at?: string | null
        }
        Update: {
          apontador_id?: string | null
          created_at?: string | null
          encarregado_id?: string | null
          equipe?: string[] | null
          id?: string
          modificado_por?: string | null
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
          {
            foreignKeyName: "fk_equipes_apontador"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_equipes_encarregado"
            columns: ["encarregado_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_feriados: {
        Row: {
          created_at: string | null
          data: string
          id: string
          modificado_por: string | null
          municipio: string | null
          nome: string
          tipo: string | null
          uf: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data: string
          id?: string
          modificado_por?: string | null
          municipio?: string | null
          nome: string
          tipo?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string
          id?: string
          modificado_por?: string | null
          municipio?: string | null
          nome?: string
          tipo?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bd_funcionarios: {
        Row: {
          adicional_noturno: number | null
          agencia: string | null
          banco: string | null
          centro_custo_id: string | null
          chave_pix: string | null
          conta_corrente: string | null
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
          matricula: string | null
          modificado_por: string | null
          nome_completo: string
          observacoes: string | null
          periculosidade: number | null
          refeicao: number | null
          salario_base: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          adicional_noturno?: number | null
          agencia?: string | null
          banco?: string | null
          centro_custo_id?: string | null
          chave_pix?: string | null
          conta_corrente?: string | null
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
          matricula?: string | null
          modificado_por?: string | null
          nome_completo: string
          observacoes?: string | null
          periculosidade?: number | null
          refeicao?: number | null
          salario_base?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          adicional_noturno?: number | null
          agencia?: string | null
          banco?: string | null
          centro_custo_id?: string | null
          chave_pix?: string | null
          conta_corrente?: string | null
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
          matricula?: string | null
          modificado_por?: string | null
          nome_completo?: string
          observacoes?: string | null
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
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
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
            foreignKeyName: "bd_funcionarios_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "bd_equipes"
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
          descricao: string | null
          id: string
          modificado_por: string | null
          nome_funcao: string
          situacao: string | null
          updated_at: string | null
          valor_diaria: number | null
          valor_diaria_exclusiva: number | null
          valor_refeicao: number | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          modificado_por?: string | null
          nome_funcao: string
          situacao?: string | null
          updated_at?: string | null
          valor_diaria?: number | null
          valor_diaria_exclusiva?: number | null
          valor_refeicao?: number | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          modificado_por?: string | null
          nome_funcao?: string
          situacao?: string | null
          updated_at?: string | null
          valor_diaria?: number | null
          valor_diaria_exclusiva?: number | null
          valor_refeicao?: number | null
        }
        Relationships: []
      }
      bd_funcoes_permissao: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          modificado_por: string | null
          nome_funcao: string
          permissoes: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          modificado_por?: string | null
          nome_funcao: string
          permissoes?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          modificado_por?: string | null
          nome_funcao?: string
          permissoes?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bd_importacao_alterdata: {
        Row: {
          centro_custo_id: string | null
          codigo_centro: string | null
          cpf: string | null
          created_at: string | null
          created_by: string | null
          data_admissao: string | null
          departamento: string | null
          empresa_id: string | null
          empresa_nome: string | null
          erro: string | null
          funcao_id: string | null
          funcao_nome: string | null
          id: string
          lote_importacao: string | null
          matricula: string | null
          nome_funcionario: string | null
          status_processamento: string
        }
        Insert: {
          centro_custo_id?: string | null
          codigo_centro?: string | null
          cpf?: string | null
          created_at?: string | null
          created_by?: string | null
          data_admissao?: string | null
          departamento?: string | null
          empresa_id?: string | null
          empresa_nome?: string | null
          erro?: string | null
          funcao_id?: string | null
          funcao_nome?: string | null
          id?: string
          lote_importacao?: string | null
          matricula?: string | null
          nome_funcionario?: string | null
          status_processamento?: string
        }
        Update: {
          centro_custo_id?: string | null
          codigo_centro?: string | null
          cpf?: string | null
          created_at?: string | null
          created_by?: string | null
          data_admissao?: string | null
          departamento?: string | null
          empresa_id?: string | null
          empresa_nome?: string | null
          erro?: string | null
          funcao_id?: string | null
          funcao_nome?: string | null
          id?: string
          lote_importacao?: string | null
          matricula?: string | null
          nome_funcionario?: string | null
          status_processamento?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_importacao_alterdata_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_importacao_alterdata_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_importacao_alterdata_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "bd_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_importacao_alterdata_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "bd_funcoes"
            referencedColumns: ["id"]
          },
        ]
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
          modificado_por: string | null
          programacao_entrega_id: string | null
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
          modificado_por?: string | null
          programacao_entrega_id?: string | null
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
          modificado_por?: string | null
          programacao_entrega_id?: string | null
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
      bd_locais_atendimento: {
        Row: {
          ativo: boolean
          cidade: string | null
          criado_em: string
          endereco: string
          id: string
          nome_local: string
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          criado_em?: string
          endereco: string
          id?: string
          nome_local: string
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          criado_em?: string
          endereco?: string
          id?: string
          nome_local?: string
          telefone?: string | null
        }
        Relationships: []
      }
      bd_notificacoes: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          link: string | null
          mensagem: string
          metadata: Json | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          link?: string | null
          mensagem: string
          metadata?: Json | null
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          link?: string | null
          mensagem?: string
          metadata?: Json | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      bd_notificacoes_usuarios: {
        Row: {
          created_at: string | null
          id: string
          lida: boolean | null
          lida_em: string | null
          notificacao_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lida?: boolean | null
          lida_em?: string | null
          notificacao_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lida?: boolean | null
          lida_em?: string | null
          notificacao_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_notificacoes_usuarios_notificacao_id_fkey"
            columns: ["notificacao_id"]
            isOneToOne: false
            referencedRelation: "bd_notificacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ordens_servico: {
        Row: {
          caminhao_equipamento_id: string | null
          chamado_id: string | null
          created_at: string | null
          data_abertura: string
          data_encerramento_atendimento: string | null
          data_inicio_atendimento: string | null
          descricao_servico: string | null
          duracao_total: string | null
          encerrado_por_id: string | null
          executado_por_id: string | null
          hora_encerramento_atendimento: string | null
          hora_inicio_atendimento: string | null
          horimetro_odometro_final: string | null
          horimetro_odometro_inicial: string | null
          id: string
          mecanico_id: string | null
          modificado_por: string | null
          numero_os: string
          obra_patio: string | null
          setor_executante: string | null
          status: string | null
          telefone_solicitante: string | null
          terceirizada: boolean | null
          tipo_manutencao: string | null
          tipo_servico: string | null
          tratativa_solucao: string | null
          updated_at: string | null
          valor_servico: number | null
        }
        Insert: {
          caminhao_equipamento_id?: string | null
          chamado_id?: string | null
          created_at?: string | null
          data_abertura?: string
          data_encerramento_atendimento?: string | null
          data_inicio_atendimento?: string | null
          descricao_servico?: string | null
          duracao_total?: string | null
          encerrado_por_id?: string | null
          executado_por_id?: string | null
          hora_encerramento_atendimento?: string | null
          hora_inicio_atendimento?: string | null
          horimetro_odometro_final?: string | null
          horimetro_odometro_inicial?: string | null
          id?: string
          mecanico_id?: string | null
          modificado_por?: string | null
          numero_os: string
          obra_patio?: string | null
          setor_executante?: string | null
          status?: string | null
          telefone_solicitante?: string | null
          terceirizada?: boolean | null
          tipo_manutencao?: string | null
          tipo_servico?: string | null
          tratativa_solucao?: string | null
          updated_at?: string | null
          valor_servico?: number | null
        }
        Update: {
          caminhao_equipamento_id?: string | null
          chamado_id?: string | null
          created_at?: string | null
          data_abertura?: string
          data_encerramento_atendimento?: string | null
          data_inicio_atendimento?: string | null
          descricao_servico?: string | null
          duracao_total?: string | null
          encerrado_por_id?: string | null
          executado_por_id?: string | null
          hora_encerramento_atendimento?: string | null
          hora_inicio_atendimento?: string | null
          horimetro_odometro_final?: string | null
          horimetro_odometro_inicial?: string | null
          id?: string
          mecanico_id?: string | null
          modificado_por?: string | null
          numero_os?: string
          obra_patio?: string | null
          setor_executante?: string | null
          status?: string | null
          telefone_solicitante?: string | null
          terceirizada?: boolean | null
          tipo_manutencao?: string | null
          tipo_servico?: string | null
          tratativa_solucao?: string | null
          updated_at?: string | null
          valor_servico?: number | null
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
            foreignKeyName: "bd_ordens_servico_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "bd_chamados_os"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_servico_mecanico_id_fkey"
            columns: ["mecanico_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_os_mao_obra: {
        Row: {
          created_at: string
          funcao: string
          id: string
          os_id: string
          quantidade: number
          updated_at: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          funcao: string
          id?: string
          os_id: string
          quantidade: number
          updated_at?: string
          valor_total: number
          valor_unitario: number
        }
        Update: {
          created_at?: string
          funcao?: string
          id?: string
          os_id?: string
          quantidade?: number
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_bd_os_mao_obra_os_id"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "bd_ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bd_os_mao_obra_os_id"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "vw_os_resumo_financeiro"
            referencedColumns: ["os_id"]
          },
          {
            foreignKeyName: "fk_mao_obra_os"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "bd_ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_mao_obra_os"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "vw_os_resumo_financeiro"
            referencedColumns: ["os_id"]
          },
        ]
      }
      bd_os_materiais_utilizados: {
        Row: {
          created_at: string
          descricao_material: string
          id: string
          os_id: string
          quantidade: number
          updated_at: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          descricao_material: string
          id?: string
          os_id: string
          quantidade: number
          updated_at?: string
          valor_total: number
          valor_unitario: number
        }
        Update: {
          created_at?: string
          descricao_material?: string
          id?: string
          os_id?: string
          quantidade?: number
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_bd_os_materiais_utilizados_os_id"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "bd_ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bd_os_materiais_utilizados_os_id"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "vw_os_resumo_financeiro"
            referencedColumns: ["os_id"]
          },
          {
            foreignKeyName: "fk_material_os"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "bd_ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_material_os"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "vw_os_resumo_financeiro"
            referencedColumns: ["os_id"]
          },
        ]
      }
      bd_permissoes: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          modificado_por: string | null
          nome_permissao: string
          rota: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          modificado_por?: string | null
          nome_permissao: string
          rota?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          modificado_por?: string | null
          nome_permissao?: string
          rota?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bd_pncp_config_monitoramento: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          dias_busca_completa: number | null
          dias_busca_rapida: number | null
          id: string
          modalidades_ativas: number[] | null
          municipios_ibge_interesse: string[] | null
          palavras_excluir: string[] | null
          palavras_incluir: string[] | null
          prazo_minimo_dias: number | null
          salvar_todas_licitacoes: boolean | null
          sync_automatico: boolean | null
          sync_horario_1: string | null
          sync_horario_2: string | null
          sync_horario_3: string | null
          ufs_ativas: string[] | null
          updated_at: string | null
          valor_minimo: number | null
          valor_prioridade_alta: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          dias_busca_completa?: number | null
          dias_busca_rapida?: number | null
          id?: string
          modalidades_ativas?: number[] | null
          municipios_ibge_interesse?: string[] | null
          palavras_excluir?: string[] | null
          palavras_incluir?: string[] | null
          prazo_minimo_dias?: number | null
          salvar_todas_licitacoes?: boolean | null
          sync_automatico?: boolean | null
          sync_horario_1?: string | null
          sync_horario_2?: string | null
          sync_horario_3?: string | null
          ufs_ativas?: string[] | null
          updated_at?: string | null
          valor_minimo?: number | null
          valor_prioridade_alta?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          dias_busca_completa?: number | null
          dias_busca_rapida?: number | null
          id?: string
          modalidades_ativas?: number[] | null
          municipios_ibge_interesse?: string[] | null
          palavras_excluir?: string[] | null
          palavras_incluir?: string[] | null
          prazo_minimo_dias?: number | null
          salvar_todas_licitacoes?: boolean | null
          sync_automatico?: boolean | null
          sync_horario_1?: string | null
          sync_horario_2?: string | null
          sync_horario_3?: string | null
          ufs_ativas?: string[] | null
          updated_at?: string | null
          valor_minimo?: number | null
          valor_prioridade_alta?: number | null
        }
        Relationships: []
      }
      bd_pncp_contratacoes: {
        Row: {
          created_at: string | null
          data_fim_propostas: string | null
          data_inicio_propostas: string | null
          data_marcacao_participando: string | null
          data_publicacao: string | null
          descartada: boolean | null
          id: string
          link_origem_pncp: string | null
          match_termos: string[] | null
          modalidade_contratacao: string | null
          municipio_ibge: string | null
          municipio_nome: string | null
          numero_controle_pncp: string
          objeto: string
          orgao_cnpj: string | null
          orgao_nome: string | null
          participando: boolean | null
          perfil_busca_id: string | null
          perfil_busca_nome: string | null
          prioridade: string | null
          raw_data: Json | null
          status_resultado: string | null
          uf: string | null
          unidade_nome: string | null
          updated_at: string | null
          user_id: string | null
          valor_total_estimado: number | null
        }
        Insert: {
          created_at?: string | null
          data_fim_propostas?: string | null
          data_inicio_propostas?: string | null
          data_marcacao_participando?: string | null
          data_publicacao?: string | null
          descartada?: boolean | null
          id?: string
          link_origem_pncp?: string | null
          match_termos?: string[] | null
          modalidade_contratacao?: string | null
          municipio_ibge?: string | null
          municipio_nome?: string | null
          numero_controle_pncp: string
          objeto: string
          orgao_cnpj?: string | null
          orgao_nome?: string | null
          participando?: boolean | null
          perfil_busca_id?: string | null
          perfil_busca_nome?: string | null
          prioridade?: string | null
          raw_data?: Json | null
          status_resultado?: string | null
          uf?: string | null
          unidade_nome?: string | null
          updated_at?: string | null
          user_id?: string | null
          valor_total_estimado?: number | null
        }
        Update: {
          created_at?: string | null
          data_fim_propostas?: string | null
          data_inicio_propostas?: string | null
          data_marcacao_participando?: string | null
          data_publicacao?: string | null
          descartada?: boolean | null
          id?: string
          link_origem_pncp?: string | null
          match_termos?: string[] | null
          modalidade_contratacao?: string | null
          municipio_ibge?: string | null
          municipio_nome?: string | null
          numero_controle_pncp?: string
          objeto?: string
          orgao_cnpj?: string | null
          orgao_nome?: string | null
          participando?: boolean | null
          perfil_busca_id?: string | null
          perfil_busca_nome?: string | null
          prioridade?: string | null
          raw_data?: Json | null
          status_resultado?: string | null
          uf?: string | null
          unidade_nome?: string | null
          updated_at?: string | null
          user_id?: string | null
          valor_total_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_pncp_contratacoes_perfil_busca_id_fkey"
            columns: ["perfil_busca_id"]
            isOneToOne: false
            referencedRelation: "bd_pncp_perfis_busca"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_pncp_perfis_busca: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string | null
          descricao: string | null
          id: string
          modalidades_ativas: number[] | null
          nome: string
          palavras_excluir: string[] | null
          palavras_incluir: string[] | null
          palavras_primarias: string[] | null
          palavras_secundarias: string[] | null
          ufs_ativas: string[] | null
          updated_at: string | null
          user_id: string | null
          valor_maximo: number | null
          valor_minimo: number | null
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          modalidades_ativas?: number[] | null
          nome: string
          palavras_excluir?: string[] | null
          palavras_incluir?: string[] | null
          palavras_primarias?: string[] | null
          palavras_secundarias?: string[] | null
          ufs_ativas?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          valor_maximo?: number | null
          valor_minimo?: number | null
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          modalidades_ativas?: number[] | null
          nome?: string
          palavras_excluir?: string[] | null
          palavras_incluir?: string[] | null
          palavras_primarias?: string[] | null
          palavras_secundarias?: string[] | null
          ufs_ativas?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          valor_maximo?: number | null
          valor_minimo?: number | null
        }
        Relationships: []
      }
      bd_pncp_sync_log: {
        Row: {
          created_at: string | null
          data_execucao: string | null
          duracao_segundos: number | null
          executado_por: string | null
          id: string
          mensagem_erro: string | null
          status: string | null
          total_atualizados: number | null
          total_duplicados: number | null
          total_encontrados: number | null
          total_inseridos: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_execucao?: string | null
          duracao_segundos?: number | null
          executado_por?: string | null
          id?: string
          mensagem_erro?: string | null
          status?: string | null
          total_atualizados?: number | null
          total_duplicados?: number | null
          total_encontrados?: number | null
          total_inseridos?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_execucao?: string | null
          duracao_segundos?: number | null
          executado_por?: string | null
          id?: string
          mensagem_erro?: string | null
          status?: string | null
          total_atualizados?: number | null
          total_duplicados?: number | null
          total_encontrados?: number | null
          total_inseridos?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      bd_pncp_todas_licitacoes: {
        Row: {
          created_at: string | null
          data_fim_propostas: string | null
          data_inicio_propostas: string | null
          data_publicacao: string | null
          id: string
          link_origem_pncp: string | null
          modalidade_contratacao: string | null
          motivo_nao_match: string | null
          municipio_ibge: string | null
          municipio_nome: string | null
          numero_controle_pncp: string
          objeto: string | null
          orgao_cnpj: string | null
          orgao_nome: string | null
          raw_data: Json | null
          status_analise: string | null
          sync_id: string | null
          uf: string | null
          unidade_nome: string | null
          updated_at: string | null
          valor_total_estimado: number | null
        }
        Insert: {
          created_at?: string | null
          data_fim_propostas?: string | null
          data_inicio_propostas?: string | null
          data_publicacao?: string | null
          id?: string
          link_origem_pncp?: string | null
          modalidade_contratacao?: string | null
          motivo_nao_match?: string | null
          municipio_ibge?: string | null
          municipio_nome?: string | null
          numero_controle_pncp: string
          objeto?: string | null
          orgao_cnpj?: string | null
          orgao_nome?: string | null
          raw_data?: Json | null
          status_analise?: string | null
          sync_id?: string | null
          uf?: string | null
          unidade_nome?: string | null
          updated_at?: string | null
          valor_total_estimado?: number | null
        }
        Update: {
          created_at?: string | null
          data_fim_propostas?: string | null
          data_inicio_propostas?: string | null
          data_publicacao?: string | null
          id?: string
          link_origem_pncp?: string | null
          modalidade_contratacao?: string | null
          motivo_nao_match?: string | null
          municipio_ibge?: string | null
          municipio_nome?: string | null
          numero_controle_pncp?: string
          objeto?: string | null
          orgao_cnpj?: string | null
          orgao_nome?: string | null
          raw_data?: Json | null
          status_analise?: string | null
          sync_id?: string | null
          uf?: string | null
          unidade_nome?: string | null
          updated_at?: string | null
          valor_total_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_pncp_todas_licitacoes_sync_id_fkey"
            columns: ["sync_id"]
            isOneToOne: false
            referencedRelation: "bd_pncp_sync_log"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_programacao_entrega: {
        Row: {
          centro_custo_id: string | null
          created_at: string | null
          data_entrega: string | null
          data_programacao: string
          id: string
          modificado_por: string | null
          observacoes: string | null
          requisicao_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          centro_custo_id?: string | null
          created_at?: string | null
          data_entrega?: string | null
          data_programacao?: string
          id?: string
          modificado_por?: string | null
          observacoes?: string | null
          requisicao_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          centro_custo_id?: string | null
          created_at?: string | null
          data_entrega?: string | null
          data_programacao?: string
          id?: string
          modificado_por?: string | null
          observacoes?: string | null
          requisicao_id?: string | null
          status?: string | null
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
            foreignKeyName: "bd_programacao_entrega_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
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
      bd_registro_aplicacao_detalhes: {
        Row: {
          area_aplicada: number
          bordo: string | null
          comprimento: number | null
          condicoes_climaticas: string | null
          created_at: string | null
          created_by: string | null
          data_aplicacao: string
          densidade_compactacao: number | null
          equipamento_compactacao: string | null
          espessura_aplicada: number | null
          espessura_calculada: number | null
          estaca_final: number | null
          estaca_inicial: number | null
          fotos_aplicacao: string[] | null
          hora_fim_aplicacao: string | null
          hora_inicio_aplicacao: string | null
          id: string
          largura_media: number | null
          lista_entrega_id: string
          logradouro_id: string | null
          logradouro_nome: string
          modificado_por: string | null
          numero_passadas: number | null
          observacoes_aplicacao: string | null
          registro_aplicacao_id: string
          registro_carga_id: string
          sequencia_aplicacao: number
          temperatura_aplicacao: number | null
          tonelada_aplicada: number
          updated_at: string | null
        }
        Insert: {
          area_aplicada: number
          bordo?: string | null
          comprimento?: number | null
          condicoes_climaticas?: string | null
          created_at?: string | null
          created_by?: string | null
          data_aplicacao?: string
          densidade_compactacao?: number | null
          equipamento_compactacao?: string | null
          espessura_aplicada?: number | null
          espessura_calculada?: number | null
          estaca_final?: number | null
          estaca_inicial?: number | null
          fotos_aplicacao?: string[] | null
          hora_fim_aplicacao?: string | null
          hora_inicio_aplicacao?: string | null
          id?: string
          largura_media?: number | null
          lista_entrega_id: string
          logradouro_id?: string | null
          logradouro_nome: string
          modificado_por?: string | null
          numero_passadas?: number | null
          observacoes_aplicacao?: string | null
          registro_aplicacao_id: string
          registro_carga_id: string
          sequencia_aplicacao?: number
          temperatura_aplicacao?: number | null
          tonelada_aplicada: number
          updated_at?: string | null
        }
        Update: {
          area_aplicada?: number
          bordo?: string | null
          comprimento?: number | null
          condicoes_climaticas?: string | null
          created_at?: string | null
          created_by?: string | null
          data_aplicacao?: string
          densidade_compactacao?: number | null
          equipamento_compactacao?: string | null
          espessura_aplicada?: number | null
          espessura_calculada?: number | null
          estaca_final?: number | null
          estaca_inicial?: number | null
          fotos_aplicacao?: string[] | null
          hora_fim_aplicacao?: string | null
          hora_inicio_aplicacao?: string | null
          id?: string
          largura_media?: number | null
          lista_entrega_id?: string
          logradouro_id?: string | null
          logradouro_nome?: string
          modificado_por?: string | null
          numero_passadas?: number | null
          observacoes_aplicacao?: string | null
          registro_aplicacao_id?: string
          registro_carga_id?: string
          sequencia_aplicacao?: number
          temperatura_aplicacao?: number | null
          tonelada_aplicada?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_registro_aplicacao_detalhes_lista_entrega_id_fkey"
            columns: ["lista_entrega_id"]
            isOneToOne: false
            referencedRelation: "bd_lista_programacao_entrega"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_aplicacao_detalhes_registro_aplicacao_id_fkey"
            columns: ["registro_aplicacao_id"]
            isOneToOne: false
            referencedRelation: "bd_registro_apontamento_aplicacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_aplicacao_detalhes_registro_carga_id_fkey"
            columns: ["registro_carga_id"]
            isOneToOne: false
            referencedRelation: "bd_registro_cargas"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_registro_apontamento_aplicacao: {
        Row: {
          anotacoes_apontador: string | null
          aplicacao_numero: number | null
          aplicacao_sequencia: number | null
          area: number | null
          bordo: string | null
          carga_finalizada: boolean | null
          carga_origem_id: string | null
          carga_total_aplicada: number | null
          comprimento: number | null
          created_at: string | null
          created_by: string | null
          data_aplicacao: string
          espessura: number | null
          espessura_calculada: number | null
          estaca_final: number | null
          estaca_inicial: number | null
          hora_aplicacao: string | null
          hora_chegada_local: string
          hora_saida_caminhao: string | null
          id: string
          largura_media: number | null
          lista_entrega_id: string | null
          logradouro_aplicado: string | null
          logradouro_id: string | null
          modificado_por: string | null
          observacoes_gerais: string | null
          percentual_aplicado: number | null
          registro_carga_id: string | null
          status_aplicacao: string | null
          temperatura_aplicacao: number | null
          temperatura_chegada: number | null
          tonelada_aplicada: number | null
          updated_at: string | null
        }
        Insert: {
          anotacoes_apontador?: string | null
          aplicacao_numero?: number | null
          aplicacao_sequencia?: number | null
          area?: number | null
          bordo?: string | null
          carga_finalizada?: boolean | null
          carga_origem_id?: string | null
          carga_total_aplicada?: number | null
          comprimento?: number | null
          created_at?: string | null
          created_by?: string | null
          data_aplicacao: string
          espessura?: number | null
          espessura_calculada?: number | null
          estaca_final?: number | null
          estaca_inicial?: number | null
          hora_aplicacao?: string | null
          hora_chegada_local: string
          hora_saida_caminhao?: string | null
          id?: string
          largura_media?: number | null
          lista_entrega_id?: string | null
          logradouro_aplicado?: string | null
          logradouro_id?: string | null
          modificado_por?: string | null
          observacoes_gerais?: string | null
          percentual_aplicado?: number | null
          registro_carga_id?: string | null
          status_aplicacao?: string | null
          temperatura_aplicacao?: number | null
          temperatura_chegada?: number | null
          tonelada_aplicada?: number | null
          updated_at?: string | null
        }
        Update: {
          anotacoes_apontador?: string | null
          aplicacao_numero?: number | null
          aplicacao_sequencia?: number | null
          area?: number | null
          bordo?: string | null
          carga_finalizada?: boolean | null
          carga_origem_id?: string | null
          carga_total_aplicada?: number | null
          comprimento?: number | null
          created_at?: string | null
          created_by?: string | null
          data_aplicacao?: string
          espessura?: number | null
          espessura_calculada?: number | null
          estaca_final?: number | null
          estaca_inicial?: number | null
          hora_aplicacao?: string | null
          hora_chegada_local?: string
          hora_saida_caminhao?: string | null
          id?: string
          largura_media?: number | null
          lista_entrega_id?: string | null
          logradouro_aplicado?: string | null
          logradouro_id?: string | null
          modificado_por?: string | null
          observacoes_gerais?: string | null
          percentual_aplicado?: number | null
          registro_carga_id?: string | null
          status_aplicacao?: string | null
          temperatura_aplicacao?: number | null
          temperatura_chegada?: number | null
          tonelada_aplicada?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_registro_apontamento_aplicacao_carga_origem_id_fkey"
            columns: ["carga_origem_id"]
            isOneToOne: false
            referencedRelation: "bd_registro_cargas"
            referencedColumns: ["id"]
          },
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
          created_by: string | null
          data: string | null
          hora_final: string | null
          hora_inicial: string | null
          horimetro_final: number | null
          horimetro_inicial: number | null
          id: string
          modificado_por: string | null
          operador_id: string | null
          situacao: string | null
          updated_at: string | null
        }
        Insert: {
          abastecimento?: number | null
          caminhao_equipamento_id?: string | null
          centro_custo_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: string | null
          hora_final?: string | null
          hora_inicial?: string | null
          horimetro_final?: number | null
          horimetro_inicial?: number | null
          id?: string
          modificado_por?: string | null
          operador_id?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Update: {
          abastecimento?: number | null
          caminhao_equipamento_id?: string | null
          centro_custo_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: string | null
          hora_final?: string | null
          hora_inicial?: string | null
          horimetro_final?: number | null
          horimetro_inicial?: number | null
          id?: string
          modificado_por?: string | null
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
            foreignKeyName: "bd_registro_apontamento_cam_equipa_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
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
          apontamento_caminhao_equipamento_id: string
          avarias_observadas: string | null
          created_at: string | null
          created_by: string | null
          data_inspecao: string
          direcao_funcionamento: string | null
          equipamentos_seguranca: string | null
          estado_pneus: string | null
          fotos_inspecao: string[] | null
          freios_funcionamento: string | null
          hora_inspecao: string
          id: string
          inspecao_aprovada: boolean | null
          limpeza_veiculo: string | null
          luzes_funcionamento: string | null
          modificado_por: string | null
          nivel_agua: string | null
          nivel_combustivel: string | null
          nivel_oleo: string | null
          observacoes_gerais: string | null
          pressao_pneus: string | null
          updated_at: string | null
        }
        Insert: {
          apontamento_caminhao_equipamento_id: string
          avarias_observadas?: string | null
          created_at?: string | null
          created_by?: string | null
          data_inspecao?: string
          direcao_funcionamento?: string | null
          equipamentos_seguranca?: string | null
          estado_pneus?: string | null
          fotos_inspecao?: string[] | null
          freios_funcionamento?: string | null
          hora_inspecao?: string
          id?: string
          inspecao_aprovada?: boolean | null
          limpeza_veiculo?: string | null
          luzes_funcionamento?: string | null
          modificado_por?: string | null
          nivel_agua?: string | null
          nivel_combustivel?: string | null
          nivel_oleo?: string | null
          observacoes_gerais?: string | null
          pressao_pneus?: string | null
          updated_at?: string | null
        }
        Update: {
          apontamento_caminhao_equipamento_id?: string
          avarias_observadas?: string | null
          created_at?: string | null
          created_by?: string | null
          data_inspecao?: string
          direcao_funcionamento?: string | null
          equipamentos_seguranca?: string | null
          estado_pneus?: string | null
          fotos_inspecao?: string[] | null
          freios_funcionamento?: string | null
          hora_inspecao?: string
          id?: string
          inspecao_aprovada?: boolean | null
          limpeza_veiculo?: string | null
          luzes_funcionamento?: string | null
          modificado_por?: string | null
          nivel_agua?: string | null
          nivel_combustivel?: string | null
          nivel_oleo?: string | null
          observacoes_gerais?: string | null
          pressao_pneus?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bd_registro_cargas: {
        Row: {
          created_at: string | null
          data_saida: string
          hora_saida: string
          id: string
          imagem_ticket_retorno: string | null
          imagem_ticket_saida: string
          lista_entrega_id: string
          modificado_por: string | null
          programacao_id: string
          status_registro: string | null
          temperatura_saida: number | null
          tonelada_real: number | null
          tonelada_retorno: number | null
          tonelada_saida: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_saida: string
          hora_saida: string
          id?: string
          imagem_ticket_retorno?: string | null
          imagem_ticket_saida: string
          lista_entrega_id: string
          modificado_por?: string | null
          programacao_id: string
          status_registro?: string | null
          temperatura_saida?: number | null
          tonelada_real?: number | null
          tonelada_retorno?: number | null
          tonelada_saida: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_saida?: string
          hora_saida?: string
          id?: string
          imagem_ticket_retorno?: string | null
          imagem_ticket_saida?: string
          lista_entrega_id?: string
          modificado_por?: string | null
          programacao_id?: string
          status_registro?: string | null
          temperatura_saida?: number | null
          tonelada_real?: number | null
          tonelada_retorno?: number | null
          tonelada_saida?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_registro_cargas_lista_entrega_id_fkey"
            columns: ["lista_entrega_id"]
            isOneToOne: false
            referencedRelation: "bd_lista_programacao_entrega"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_registro_desvios_fotos: {
        Row: {
          created_at: string | null
          id: string
          legenda: string | null
          path: string
          registro_id: string
          url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          legenda?: string | null
          path: string
          registro_id: string
          url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          legenda?: string | null
          path?: string
          registro_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_registro_desvios_fotos_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "bd_registro_desvios_sso"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_registro_desvios_sso: {
        Row: {
          adequacao_imediata: string | null
          analise_tecnica: string
          atualizado_em: string | null
          classificacao_desvio: string
          criado_em: string | null
          criado_por: string | null
          data_registro: string
          encarregado_mestre: string | null
          engenheiro_obra: string
          gerente_regional: string
          id: string
          modificado_por: string | null
          numero_relatorio: string | null
          obra_id: string
          prazo_correcao: string | null
          reincidencia: boolean
          responsavel_acao: string | null
          status_acao: string
          tecnico_seguranca: string
          tipo_outros: string | null
          tipos_desvio: string[]
        }
        Insert: {
          adequacao_imediata?: string | null
          analise_tecnica: string
          atualizado_em?: string | null
          classificacao_desvio?: string
          criado_em?: string | null
          criado_por?: string | null
          data_registro?: string
          encarregado_mestre?: string | null
          engenheiro_obra: string
          gerente_regional: string
          id?: string
          modificado_por?: string | null
          numero_relatorio?: string | null
          obra_id: string
          prazo_correcao?: string | null
          reincidencia?: boolean
          responsavel_acao?: string | null
          status_acao?: string
          tecnico_seguranca: string
          tipo_outros?: string | null
          tipos_desvio?: string[]
        }
        Update: {
          adequacao_imediata?: string | null
          analise_tecnica?: string
          atualizado_em?: string | null
          classificacao_desvio?: string
          criado_em?: string | null
          criado_por?: string | null
          data_registro?: string
          encarregado_mestre?: string | null
          engenheiro_obra?: string
          gerente_regional?: string
          id?: string
          modificado_por?: string | null
          numero_relatorio?: string | null
          obra_id?: string
          prazo_correcao?: string | null
          reincidencia?: boolean
          responsavel_acao?: string | null
          status_acao?: string
          tecnico_seguranca?: string
          tipo_outros?: string | null
          tipos_desvio?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "bd_registro_desvios_sso_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_desvios_sso_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_desvios_sso_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
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
          modificado_por: string | null
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
          modificado_por?: string | null
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
          modificado_por?: string | null
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
            foreignKeyName: "bd_requisicoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
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
          modificado_por: string | null
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
          modificado_por?: string | null
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
          modificado_por?: string | null
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
      bd_sso_checklist_itens: {
        Row: {
          avaliacao: string
          checklist_id: string
          created_at: string | null
          descricao: string
          evidencia: string | null
          fotos: Json | null
          id: string
          item_modelo_id: string
          ordem: number
          tema: string
          updated_at: string | null
        }
        Insert: {
          avaliacao: string
          checklist_id: string
          created_at?: string | null
          descricao: string
          evidencia?: string | null
          fotos?: Json | null
          id?: string
          item_modelo_id: string
          ordem: number
          tema: string
          updated_at?: string | null
        }
        Update: {
          avaliacao?: string
          checklist_id?: string
          created_at?: string | null
          descricao?: string
          evidencia?: string | null
          fotos?: Json | null
          id?: string
          item_modelo_id?: string
          ordem?: number
          tema?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_sso_checklist_itens_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "bd_sso_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_sso_checklist_itens_item_modelo_id_fkey"
            columns: ["item_modelo_id"]
            isOneToOne: false
            referencedRelation: "bd_sso_itens_modelo"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_sso_checklists: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por: string
          data_inspecao: string
          engenheiro_obra: string
          etapa_vistoria: string
          gerente_regional: string
          id: string
          modificado_por: string | null
          nota_objetivo: number
          nota_real: number | null
          obra_id: string
          observacoes_gerais: string | null
          resultado_avaliacao: string | null
          tecnico_seguranca: string
          total_aplicaveis: number | null
          total_conformes: number | null
          total_efetivo: number | null
          total_itens: number
          total_na: number | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por: string
          data_inspecao: string
          engenheiro_obra: string
          etapa_vistoria?: string
          gerente_regional: string
          id?: string
          modificado_por?: string | null
          nota_objetivo?: number
          nota_real?: number | null
          obra_id: string
          observacoes_gerais?: string | null
          resultado_avaliacao?: string | null
          tecnico_seguranca: string
          total_aplicaveis?: number | null
          total_conformes?: number | null
          total_efetivo?: number | null
          total_itens?: number
          total_na?: number | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string
          data_inspecao?: string
          engenheiro_obra?: string
          etapa_vistoria?: string
          gerente_regional?: string
          id?: string
          modificado_por?: string | null
          nota_objetivo?: number
          nota_real?: number | null
          obra_id?: string
          observacoes_gerais?: string | null
          resultado_avaliacao?: string | null
          tecnico_seguranca?: string
          total_aplicaveis?: number | null
          total_conformes?: number | null
          total_efetivo?: number | null
          total_itens?: number
          total_na?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_sso_checklists_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_sso_checklists_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
        ]
      }
      bd_sso_itens_modelo: {
        Row: {
          created_at: string | null
          descricao: string
          id: string
          ordem: number
          tema: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao: string
          id?: string
          ordem: number
          tema: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string
          id?: string
          ordem?: number
          tema?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      bd_sso_ver_agir: {
        Row: {
          centro_custo_id: string | null
          created_at: string
          criado_por: string
          data_registro: string
          descricao_nao_conformidade: string
          engenheiro_id: string | null
          engenheiro_nome: string
          foto_antes_url: string | null
          foto_depois_url: string | null
          hora_registro: string
          id: string
          local: string
          modificado_por: string | null
          obra: string
          observacao_gestao: string | null
          resultado_alcancado_solucao: string
          status: string
          tecnico_seguranca_id: string | null
          tecnico_seguranca_nome: string
          updated_at: string | null
          visto_gestao: boolean | null
          visto_gestao_em: string | null
          visto_gestao_por: string | null
        }
        Insert: {
          centro_custo_id?: string | null
          created_at?: string
          criado_por: string
          data_registro: string
          descricao_nao_conformidade: string
          engenheiro_id?: string | null
          engenheiro_nome: string
          foto_antes_url?: string | null
          foto_depois_url?: string | null
          hora_registro: string
          id?: string
          local: string
          modificado_por?: string | null
          obra: string
          observacao_gestao?: string | null
          resultado_alcancado_solucao: string
          status?: string
          tecnico_seguranca_id?: string | null
          tecnico_seguranca_nome: string
          updated_at?: string | null
          visto_gestao?: boolean | null
          visto_gestao_em?: string | null
          visto_gestao_por?: string | null
        }
        Update: {
          centro_custo_id?: string | null
          created_at?: string
          criado_por?: string
          data_registro?: string
          descricao_nao_conformidade?: string
          engenheiro_id?: string | null
          engenheiro_nome?: string
          foto_antes_url?: string | null
          foto_depois_url?: string | null
          hora_registro?: string
          id?: string
          local?: string
          modificado_por?: string | null
          obra?: string
          observacao_gestao?: string | null
          resultado_alcancado_solucao?: string
          status?: string
          tecnico_seguranca_id?: string | null
          tecnico_seguranca_nome?: string
          updated_at?: string | null
          visto_gestao?: boolean | null
          visto_gestao_em?: string | null
          visto_gestao_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_sso_ver_agir_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_sso_ver_agir_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_sso_ver_agir_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_sso_ver_agir_engenheiro_id_fkey"
            columns: ["engenheiro_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_sso_ver_agir_tecnico_seguranca_id_fkey"
            columns: ["tecnico_seguranca_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_sso_ver_agir_visto_gestao_por_fkey"
            columns: ["visto_gestao_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_subcategorias_ativos: {
        Row: {
          ativo: boolean | null
          categoria_id: string
          criado_em: string | null
          descricao: string | null
          id: string
          nome_subcategoria: string
        }
        Insert: {
          ativo?: boolean | null
          categoria_id: string
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome_subcategoria: string
        }
        Update: {
          ativo?: boolean | null
          categoria_id?: string
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome_subcategoria?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_subcategorias_ativos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "bd_categorias_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_usinas: {
        Row: {
          created_at: string | null
          endereco: string | null
          id: string
          modificado_por: string | null
          nome_usina: string
          producao_total: number | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          endereco?: string | null
          id?: string
          modificado_por?: string | null
          nome_usina: string
          producao_total?: number | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          endereco?: string | null
          id?: string
          modificado_por?: string | null
          nome_usina?: string
          producao_total?: number | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          acesso_global: boolean | null
          created_at: string | null
          email: string | null
          funcao_permissao: string | null
          funcao_sistema: string | null
          funcionario_id: string | null
          funcoes: string[] | null
          id: string
          imagem_url: string | null
          modificado_por: string | null
          nome_completo: string | null
          updated_at: string | null
        }
        Insert: {
          acesso_global?: boolean | null
          created_at?: string | null
          email?: string | null
          funcao_permissao?: string | null
          funcao_sistema?: string | null
          funcionario_id?: string | null
          funcoes?: string[] | null
          id: string
          imagem_url?: string | null
          modificado_por?: string | null
          nome_completo?: string | null
          updated_at?: string | null
        }
        Update: {
          acesso_global?: boolean | null
          created_at?: string | null
          email?: string | null
          funcao_permissao?: string | null
          funcao_sistema?: string | null
          funcionario_id?: string | null
          funcoes?: string[] | null
          id?: string
          imagem_url?: string | null
          modificado_por?: string | null
          nome_completo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_funcao_permissao_fkey"
            columns: ["funcao_permissao"]
            isOneToOne: false
            referencedRelation: "bd_funcoes_permissao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_apontamento_equipe: {
        Row: {
          colaborador: Json | null
          colaborador_id: string | null
          created_at: string | null
          data_registro: string | null
          equipe: Json | null
          equipe_id: string | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string | null
          lista_entrega: Json | null
          lista_entrega_id: string | null
          nome_colaborador: string | null
          presente: boolean | null
          registrado_por: string | null
          updated_at: string | null
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
            foreignKeyName: "bd_apontamento_equipe_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_os_resumo_financeiro: {
        Row: {
          os_id: string | null
          total_geral: number | null
          total_mao_obra: number | null
          total_materiais: number | null
        }
        Relationships: []
      }
      vw_relatorio_diarias_folha: {
        Row: {
          agencia_funcionario: string | null
          apontador_id: string | null
          apontador_nome: string | null
          banco_funcionario: string | null
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          confirmado_em: string | null
          confirmado_por: string | null
          conta_funcionario: string | null
          cpf_funcionario: string | null
          created_at: string | null
          data: string | null
          empresa_funcionario: string | null
          empresa_id: string | null
          funcao_id: string | null
          funcionario_id: string | null
          hora_entrada: string | null
          hora_saida: string | null
          intervalo_fim: string | null
          intervalo_inicio: string | null
          matricula_funcionario: string | null
          nome_centro_custo: string | null
          nome_funcao: string | null
          nome_funcionario: string | null
          numero_solicitacao: string | null
          observacoes: string | null
          pix_funcionario: string | null
          presenca_id: string | null
          presenca_status: string | null
          recebe_refeicao: boolean | null
          solicitacao_data_fim: string | null
          solicitacao_data_inicio: string | null
          solicitacao_id: string | null
          solicitante_id: string | null
          solicitante_nome: string | null
          status_funcionario: string | null
          status_solicitacao: string | null
          tipo_diaria: string | null
          usar_diaria_exclusiva: boolean | null
          valor_diaria_aplicada: number | null
          valor_refeicao_aplicado: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_diaria_apontamentos_responsavel_campo_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "bd_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "bd_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      api_listar_apontamentos: {
        Args: { _data_fim?: string; _data_inicio?: string; _equipe?: string }
        Returns: {
          colaborador: Json | null
          colaborador_id: string | null
          created_at: string | null
          data_registro: string | null
          equipe: Json | null
          equipe_id: string | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string | null
          lista_entrega: Json | null
          lista_entrega_id: string | null
          nome_colaborador: string | null
          presente: boolean | null
          registrado_por: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vw_apontamento_equipe"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      atualizar_status_entrega_automatico: {
        Args: {
          lista_id: string
          massa_remanescente?: number
          novo_status: string
          percentual_aplicado?: number
        }
        Returns: boolean
      }
      calcular_espessura_aplicacao: {
        Args: { area_aplicada: number; tonelada_aplicada: number }
        Returns: {
          descricao: string
          espessura_cm: number
          status: string
        }[]
      }
      calcular_massa_remanescente: {
        Args: { entrega_id: string }
        Returns: number
      }
      calcular_massa_remanescente_aplicacao: {
        Args: { aplicacao_id: string }
        Returns: number
      }
      calcular_massa_remanescente_em_tempo_real: {
        Args: { p_registro_aplicacao_id: string }
        Returns: number
      }
      can_delete_agendamento_exame: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      check_email_duplicate_normalized: {
        Args: { p_email: string; p_exclude_id?: string }
        Returns: boolean
      }
      check_is_admsso: { Args: { user_id?: string }; Returns: boolean }
      check_is_super_admin: { Args: { user_id?: string }; Returns: boolean }
      check_vistorias_sso_pendentes: { Args: never; Returns: undefined }
      compute_funcao_sistema: { Args: { _profile_id: string }; Returns: string }
      convert_chamado_para_os: {
        Args: { p_chamado_id: string; p_tipo_falha?: string }
        Returns: Json
      }
      converter_kg_para_toneladas: {
        Args: { p_valor: number }
        Returns: number
      }
      criar_aplicacao_por_rua: {
        Args: {
          p_area_aplicada: number
          p_bordo?: string
          p_comprimento?: number
          p_data_aplicacao?: string
          p_espessura_aplicada?: number
          p_hora_chegada_local?: string
          p_hora_fim_aplicacao?: string
          p_hora_inicio_aplicacao?: string
          p_largura_media?: number
          p_lista_entrega_id: string
          p_logradouro_nome: string
          p_observacoes_aplicacao?: string
          p_registro_carga_id: string
          p_temperatura_aplicacao?: number
          p_tonelada_aplicada: number
        }
        Returns: Json
      }
      finalizar_carga_aplicacao: {
        Args: { aplicacao_id: string }
        Returns: Json
      }
      finalizar_carga_manual: { Args: { carga_id: string }; Returns: Json }
      fn_calcular_nota_checklist: {
        Args: { p_checklist_id: string }
        Returns: Json
      }
      fn_recalcula_total_os: { Args: { p_os_id: string }; Returns: undefined }
      force_update_all_delivery_statuses: {
        Args: never
        Returns: {
          entrega_id: string
          massa_remanescente: number
          percentual_aplicado: number
          status_anterior: string
          status_novo: string
        }[]
      }
      garantir_registro_aplicacao_principal: {
        Args: {
          p_created_by: string
          p_data_aplicacao: string
          p_hora_chegada_local: string
          p_lista_entrega_id: string
          p_registro_carga_id: string
        }
        Returns: string
      }
      generate_numero_solicitacao: { Args: never; Returns: string }
      get_etapas_utilizadas: {
        Args: { p_checklist_id?: string; p_obra_id: string }
        Returns: string[]
      }
      get_funcionarios_para_diarias: {
        Args: never
        Returns: {
          centro_custo_id: string
          cpf: string
          funcao_id: string
          funcao_nome: string
          id: string
          matricula: string
          nome_completo: string
          status_funcionario: string
          valor_diaria: number
          valor_diaria_exclusiva: number
          valor_refeicao: number
        }[]
      }
      get_sso_admin_users: {
        Args: never
        Returns: {
          user_id: string
        }[]
      }
      get_ultimo_horimetro_privilegiado: {
        Args: { caminhao_id: string }
        Returns: number
      }
      get_user_departamento_id: { Args: never; Returns: string }
      get_user_funcionario_id: { Args: { user_id?: string }; Returns: string }
      has_permission: {
        Args: { p_permission_name: string; p_user_id?: string }
        Returns: boolean
      }
      has_pncp_access: { Args: { p_user_id?: string }; Returns: boolean }
      has_sso_full_access: { Args: { p_user_id?: string }; Returns: boolean }
      has_sso_permission: { Args: { p_user_id?: string }; Returns: boolean }
      is_departmental_super_admin: { Args: never; Returns: boolean }
      link_profile_from_funcionario_email: {
        Args: { _funcionario_id: string }
        Returns: boolean
      }
      link_profile_to_funcionario_by_email: {
        Args: { _profile_id: string }
        Returns: boolean
      }
      listar_ghost_funcionarios: {
        Args: never
        Returns: {
          duplicate_type: string
          funcionario_details: Json
          normalized_value: string
          total_count: number
        }[]
      }
      log_aplicacao_debug: {
        Args: { p_dados: Json; p_funcao: string; p_resultado?: Json }
        Returns: undefined
      }
      merge_duplicate_funcionarios: {
        Args: never
        Returns: {
          action_summary: string
          keep_id: string
          name_norm: string
          removed_ids: string[]
        }[]
      }
      merge_duplicate_funcionarios_by_email_normalized: {
        Args: never
        Returns: {
          action_summary: string
          keep_id: string
          normalized_email: string
          removed_ids: string[]
        }[]
      }
      merge_duplicate_funcionarios_normalized: {
        Args: never
        Returns: {
          action_summary: string
          keep_id: string
          normalized_name: string
          removed_ids: string[]
        }[]
      }
      normalize_email: { Args: { input_email: string }; Returns: string }
      normalize_text: { Args: { input_text: string }; Returns: string }
      relatorio_correcao_status_massa: {
        Args: never
        Returns: {
          entregas_ativas: number
          entregas_em_aplicacao: number
          entregas_entregues: number
          entregas_enviadas: number
          massa_media_toneladas: number
          registros_corrigidos: number
          total_entregas: number
        }[]
      }
      sincronizar_hora_saida_aplicacao: {
        Args: { p_registro_aplicacao_id: string }
        Returns: undefined
      }
      sync_profile_funcao_sistema: {
        Args: { _profile_id: string }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_profile_funcionario_id: {
        Args: { _funcionario_id: string; _profile_id: string }
        Returns: undefined
      }
      usuario_acessa_equipe: {
        Args: { p_equipe_id: string; p_user_id: string }
        Returns: boolean
      }
      verificar_duplicidade_solicitacao: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_funcionario_ids: string[]
          p_solicitacao_atual_id?: string
        }
        Returns: Json
      }
      verificar_etapa_disponivel: {
        Args: { p_checklist_id?: string; p_etapa: string; p_obra_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
