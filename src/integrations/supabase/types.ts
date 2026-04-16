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
          funcao_nova_id: string | null
          horario_agendamento: string
          id: string
          local_atendimento_id: string
          modificado_por: string | null
          motivo_contratacao: string | null
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
          funcao_nova_id?: string | null
          horario_agendamento: string
          id?: string
          local_atendimento_id: string
          modificado_por?: string | null
          motivo_contratacao?: string | null
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
          funcao_nova_id?: string | null
          horario_agendamento?: string
          id?: string
          local_atendimento_id?: string
          modificado_por?: string | null
          motivo_contratacao?: string | null
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
            foreignKeyName: "bd_agendamentos_exames_funcao_nova_id_fkey"
            columns: ["funcao_nova_id"]
            isOneToOne: false
            referencedRelation: "bd_funcoes"
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
      bd_aprovacoes_excecao: {
        Row: {
          aprovado_por: string | null
          created_at: string | null
          data_aprovacao: string | null
          id: string
          justificativa: string
          percentual_acima: number | null
          solicitacao_id: string | null
          status: string
          updated_at: string | null
          valor_proposto: number
          valor_referencia_interno: number
        }
        Insert: {
          aprovado_por?: string | null
          created_at?: string | null
          data_aprovacao?: string | null
          id?: string
          justificativa: string
          percentual_acima?: number | null
          solicitacao_id?: string | null
          status?: string
          updated_at?: string | null
          valor_proposto?: number
          valor_referencia_interno?: number
        }
        Update: {
          aprovado_por?: string | null
          created_at?: string | null
          data_aprovacao?: string | null
          id?: string
          justificativa?: string
          percentual_acima?: number | null
          solicitacao_id?: string | null
          status?: string
          updated_at?: string | null
          valor_proposto?: number
          valor_referencia_interno?: number
        }
        Relationships: [
          {
            foreignKeyName: "bd_aprovacoes_excecao_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_equipamento"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_aprovacoes_fluxo_exec: {
        Row: {
          created_at: string | null
          data_aprovacao: string | null
          etapa_id: string | null
          etapa_nome_snapshot: string | null
          fluxo_versao: number | null
          id: string
          observacao: string | null
          ordem: number | null
          pode_aprovar: boolean | null
          solicitacao_id: string
          status: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_aprovacao?: string | null
          etapa_id?: string | null
          etapa_nome_snapshot?: string | null
          fluxo_versao?: number | null
          id?: string
          observacao?: string | null
          ordem?: number | null
          pode_aprovar?: boolean | null
          solicitacao_id: string
          status?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_aprovacao?: string | null
          etapa_id?: string | null
          etapa_nome_snapshot?: string | null
          fluxo_versao?: number | null
          id?: string
          observacao?: string | null
          ordem?: number | null
          pode_aprovar?: boolean | null
          solicitacao_id?: string
          status?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_aprovacoes_fluxo_exec_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "bd_fluxo_etapas"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_aprovacoes_inclusao_funcionario: {
        Row: {
          aprovado_por: string | null
          created_at: string | null
          data_resposta: string | null
          data_solicitacao: string | null
          funcionario_id: string
          id: string
          justificativa: string | null
          solicitacao_id: string
          solicitado_por: string | null
          status: string
        }
        Insert: {
          aprovado_por?: string | null
          created_at?: string | null
          data_resposta?: string | null
          data_solicitacao?: string | null
          funcionario_id: string
          id?: string
          justificativa?: string | null
          solicitacao_id: string
          solicitado_por?: string | null
          status?: string
        }
        Update: {
          aprovado_por?: string | null
          created_at?: string | null
          data_resposta?: string | null
          data_solicitacao?: string | null
          funcionario_id?: string
          id?: string
          justificativa?: string | null
          solicitacao_id?: string
          solicitado_por?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_aprovacoes_inclusao_funcionario_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_aprovacoes_inclusao_funcionario_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_arquivo_morto: {
        Row: {
          cpf: string | null
          created_at: string | null
          data_desligamento: string | null
          funcionario_id: string | null
          id: string
          motivo_desligamento: string | null
          nome_completo: string
          observacoes: string | null
          recontratavel: boolean | null
          tipo_desligamento: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string | null
          data_desligamento?: string | null
          funcionario_id?: string | null
          id?: string
          motivo_desligamento?: string | null
          nome_completo: string
          observacoes?: string | null
          recontratavel?: boolean | null
          tipo_desligamento?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string | null
          data_desligamento?: string | null
          funcionario_id?: string | null
          id?: string
          motivo_desligamento?: string | null
          nome_completo?: string
          observacoes?: string | null
          recontratavel?: boolean | null
          tipo_desligamento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_arquivo_morto_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_assinaturas: {
        Row: {
          assinatura_png: string | null
          cargo: string | null
          cpf: string | null
          data_assinatura: string | null
          documento_id: string | null
          etapa_exec_id: string | null
          hash_assinatura: string | null
          id: string
          ip: string | null
          nome_usuario: string
          solicitacao_id: string
          tipo_assinatura: string | null
          usuario_id: string
        }
        Insert: {
          assinatura_png?: string | null
          cargo?: string | null
          cpf?: string | null
          data_assinatura?: string | null
          documento_id?: string | null
          etapa_exec_id?: string | null
          hash_assinatura?: string | null
          id?: string
          ip?: string | null
          nome_usuario: string
          solicitacao_id: string
          tipo_assinatura?: string | null
          usuario_id: string
        }
        Update: {
          assinatura_png?: string | null
          cargo?: string | null
          cpf?: string | null
          data_assinatura?: string | null
          documento_id?: string | null
          etapa_exec_id?: string | null
          hash_assinatura?: string | null
          id?: string
          ip?: string | null
          nome_usuario?: string
          solicitacao_id?: string
          tipo_assinatura?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_assinaturas_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "bd_documentos_fluxo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_assinaturas_etapa_exec_id_fkey"
            columns: ["etapa_exec_id"]
            isOneToOne: false
            referencedRelation: "bd_aprovacoes_fluxo_exec"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_assinaturas_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_assinaturas_usuarios: {
        Row: {
          assinatura_hash: string | null
          assinatura_url: string
          ativo: boolean | null
          cargo: string | null
          cpf: string
          created_at: string | null
          id: string
          ip_registro: string | null
          nome_completo: string
          updated_at: string | null
          usuario_id: string
        }
        Insert: {
          assinatura_hash?: string | null
          assinatura_url: string
          ativo?: boolean | null
          cargo?: string | null
          cpf: string
          created_at?: string | null
          id?: string
          ip_registro?: string | null
          nome_completo: string
          updated_at?: string | null
          usuario_id: string
        }
        Update: {
          assinatura_hash?: string | null
          assinatura_url?: string
          ativo?: boolean | null
          cargo?: string | null
          cpf?: string
          created_at?: string | null
          id?: string
          ip_registro?: string | null
          nome_completo?: string
          updated_at?: string | null
          usuario_id?: string
        }
        Relationships: []
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
      bd_cache_enderecos: {
        Row: {
          created_at: string | null
          endereco: string
          id: string
          latitude: number
          longitude: number
        }
        Insert: {
          created_at?: string | null
          endereco: string
          id?: string
          latitude: number
          longitude: number
        }
        Update: {
          created_at?: string | null
          endereco?: string
          id?: string
          latitude?: number
          longitude?: number
        }
        Relationships: []
      }
      bd_caminhoes_equipamentos: {
        Row: {
          aluguel: string | null
          ano_fabricacao: string | null
          capacidade: string | null
          capacidade_unidade: string | null
          capacidade_valor: number | null
          catalogo_equipamento_id: string | null
          categoria_ativo_id: string | null
          chassi: string | null
          cor: string | null
          created_at: string | null
          departamento_id: string | null
          empresa_id: string | null
          empresa_locadora_id: string | null
          fabricante: string | null
          fabricante_id: string | null
          frota: string | null
          frota_id: string | null
          id: string
          imagem_url: string | null
          informacoes_complementares: string | null
          linha_operacional_id: string | null
          modelo_id: string | null
          modificado_por: string | null
          motor: string | null
          numero_frota: string | null
          numero_serie: string | null
          observacoes: string | null
          placa: string | null
          proprietario_tipo: string | null
          renavam: string | null
          situacao: string | null
          status_cadastro: string | null
          status_disponibilidade: string | null
          status_ipva: string | null
          subcategoria_ativo_id: string | null
          tipo_ativo: string | null
          tipo_combustivel: string | null
          tipo_equipamento_id: string | null
          updated_at: string | null
        }
        Insert: {
          aluguel?: string | null
          ano_fabricacao?: string | null
          capacidade?: string | null
          capacidade_unidade?: string | null
          capacidade_valor?: number | null
          catalogo_equipamento_id?: string | null
          categoria_ativo_id?: string | null
          chassi?: string | null
          cor?: string | null
          created_at?: string | null
          departamento_id?: string | null
          empresa_id?: string | null
          empresa_locadora_id?: string | null
          fabricante?: string | null
          fabricante_id?: string | null
          frota?: string | null
          frota_id?: string | null
          id?: string
          imagem_url?: string | null
          informacoes_complementares?: string | null
          linha_operacional_id?: string | null
          modelo_id?: string | null
          modificado_por?: string | null
          motor?: string | null
          numero_frota?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          placa?: string | null
          proprietario_tipo?: string | null
          renavam?: string | null
          situacao?: string | null
          status_cadastro?: string | null
          status_disponibilidade?: string | null
          status_ipva?: string | null
          subcategoria_ativo_id?: string | null
          tipo_ativo?: string | null
          tipo_combustivel?: string | null
          tipo_equipamento_id?: string | null
          updated_at?: string | null
        }
        Update: {
          aluguel?: string | null
          ano_fabricacao?: string | null
          capacidade?: string | null
          capacidade_unidade?: string | null
          capacidade_valor?: number | null
          catalogo_equipamento_id?: string | null
          categoria_ativo_id?: string | null
          chassi?: string | null
          cor?: string | null
          created_at?: string | null
          departamento_id?: string | null
          empresa_id?: string | null
          empresa_locadora_id?: string | null
          fabricante?: string | null
          fabricante_id?: string | null
          frota?: string | null
          frota_id?: string | null
          id?: string
          imagem_url?: string | null
          informacoes_complementares?: string | null
          linha_operacional_id?: string | null
          modelo_id?: string | null
          modificado_por?: string | null
          motor?: string | null
          numero_frota?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          placa?: string | null
          proprietario_tipo?: string | null
          renavam?: string | null
          situacao?: string | null
          status_cadastro?: string | null
          status_disponibilidade?: string | null
          status_ipva?: string | null
          subcategoria_ativo_id?: string | null
          tipo_ativo?: string | null
          tipo_combustivel?: string | null
          tipo_equipamento_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_caminhoes_equipamentos_catalogo_equipamento_id_fkey"
            columns: ["catalogo_equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_catalogo_equipamentos"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "bd_caminhoes_equipamentos_fabricante_id_fkey"
            columns: ["fabricante_id"]
            isOneToOne: false
            referencedRelation: "bd_fabricantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_caminhoes_equipamentos_frota_id_fkey"
            columns: ["frota_id"]
            isOneToOne: false
            referencedRelation: "bd_frotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_caminhoes_equipamentos_linha_operacional_id_fkey"
            columns: ["linha_operacional_id"]
            isOneToOne: false
            referencedRelation: "bd_linhas_operacionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_caminhoes_equipamentos_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "bd_modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_caminhoes_equipamentos_subcategoria_ativo_id_fkey"
            columns: ["subcategoria_ativo_id"]
            isOneToOne: false
            referencedRelation: "bd_subcategorias_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_caminhoes_equipamentos_tipo_equipamento_id_fkey"
            columns: ["tipo_equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_tipos_equipamento"
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
      bd_catalogo_equipamentos: {
        Row: {
          ano_fabricacao_padrao: number | null
          ativo: boolean | null
          capacidade: string | null
          categoria_id: string | null
          combustivel: string | null
          cor_padrao: string | null
          created_at: string | null
          descricao_padrao: string | null
          fabricante_id: string | null
          id: string
          imagem_url: string | null
          modelo_id: string | null
          motor_padrao: string | null
          potencia: string | null
          subcategoria_id: string | null
          tipo_equipamento_id: string | null
          updated_at: string | null
        }
        Insert: {
          ano_fabricacao_padrao?: number | null
          ativo?: boolean | null
          capacidade?: string | null
          categoria_id?: string | null
          combustivel?: string | null
          cor_padrao?: string | null
          created_at?: string | null
          descricao_padrao?: string | null
          fabricante_id?: string | null
          id?: string
          imagem_url?: string | null
          modelo_id?: string | null
          motor_padrao?: string | null
          potencia?: string | null
          subcategoria_id?: string | null
          tipo_equipamento_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ano_fabricacao_padrao?: number | null
          ativo?: boolean | null
          capacidade?: string | null
          categoria_id?: string | null
          combustivel?: string | null
          cor_padrao?: string | null
          created_at?: string | null
          descricao_padrao?: string | null
          fabricante_id?: string | null
          id?: string
          imagem_url?: string | null
          modelo_id?: string | null
          motor_padrao?: string | null
          potencia?: string | null
          subcategoria_id?: string | null
          tipo_equipamento_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_catalogo_equipamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "bd_categorias_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_catalogo_equipamentos_fabricante_id_fkey"
            columns: ["fabricante_id"]
            isOneToOne: false
            referencedRelation: "bd_fabricantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_catalogo_equipamentos_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "bd_modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_catalogo_equipamentos_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "bd_subcategorias_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_catalogo_equipamentos_tipo_equipamento_id_fkey"
            columns: ["tipo_equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_tipos_equipamento"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_catalogo_variacoes: {
        Row: {
          capacidade_unidade: string | null
          capacidade_valor: number | null
          created_at: string | null
          descricao_padrao: string | null
          id: string
          origem: string
          subcategoria_id: string
          updated_at: string | null
        }
        Insert: {
          capacidade_unidade?: string | null
          capacidade_valor?: number | null
          created_at?: string | null
          descricao_padrao?: string | null
          id?: string
          origem?: string
          subcategoria_id: string
          updated_at?: string | null
        }
        Update: {
          capacidade_unidade?: string | null
          capacidade_valor?: number | null
          created_at?: string | null
          descricao_padrao?: string | null
          id?: string
          origem?: string
          subcategoria_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_catalogo_variacoes_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "bd_subcategorias_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_categorias_ativos: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          descricao: string | null
          grupo_id: string | null
          id: string
          nome_categoria: string
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          descricao?: string | null
          grupo_id?: string | null
          id?: string
          nome_categoria: string
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          descricao?: string | null
          grupo_id?: string | null
          id?: string
          nome_categoria?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_categorias_ativos_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "bd_grupos_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_centros_custo: {
        Row: {
          adm_sede_funcionario_id: string | null
          aprovador_diarias_id: string | null
          cnpj_vinculado: string | null
          codigo_centro_custo: string
          created_at: string | null
          departamento_id: string | null
          diretoria_id: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_completo: string | null
          endereco_estado: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          geocoding_status: string | null
          id: string
          latitude: number | null
          longitude: number | null
          modificado_por: string | null
          nome_alterdata: string | null
          nome_centro_custo: string
          raio_ponto_metros: number | null
          situacao: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          adm_sede_funcionario_id?: string | null
          aprovador_diarias_id?: string | null
          cnpj_vinculado?: string | null
          codigo_centro_custo: string
          created_at?: string | null
          departamento_id?: string | null
          diretoria_id?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_completo?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          geocoding_status?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          modificado_por?: string | null
          nome_alterdata?: string | null
          nome_centro_custo: string
          raio_ponto_metros?: number | null
          situacao?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          adm_sede_funcionario_id?: string | null
          aprovador_diarias_id?: string | null
          cnpj_vinculado?: string | null
          codigo_centro_custo?: string
          created_at?: string | null
          departamento_id?: string | null
          diretoria_id?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_completo?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          geocoding_status?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          modificado_por?: string | null
          nome_alterdata?: string | null
          nome_centro_custo?: string
          raio_ponto_metros?: number | null
          situacao?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_centros_custo_adm_sede_funcionario_id_fkey"
            columns: ["adm_sede_funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_centros_custo_aprovador_diarias_id_fkey"
            columns: ["aprovador_diarias_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_centros_custo_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "bd_departamentos"
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
      bd_configuracoes_sistema: {
        Row: {
          ativo: boolean
          chave: string
          created_at: string | null
          descricao: string | null
          id: string
          updated_at: string | null
          valor: string
        }
        Insert: {
          ativo?: boolean
          chave: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor?: string
        }
        Update: {
          ativo?: boolean
          chave?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor?: string
        }
        Relationships: []
      }
      bd_cotacoes: {
        Row: {
          created_at: string | null
          data_abertura: string
          id: string
          solicitacao_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_abertura?: string
          id?: string
          solicitacao_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_abertura?: string
          id?: string
          solicitacao_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_cotacoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_equipamento"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_cotacoes_itens: {
        Row: {
          cotacao_id: string
          created_at: string | null
          id: string
          quantidade: number
          tipo_equipamento_id: string | null
        }
        Insert: {
          cotacao_id: string
          created_at?: string | null
          id?: string
          quantidade?: number
          tipo_equipamento_id?: string | null
        }
        Update: {
          cotacao_id?: string
          created_at?: string | null
          id?: string
          quantidade?: number
          tipo_equipamento_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_cotacoes_itens_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "bd_cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_cotacoes_itens_tipo_equipamento_id_fkey"
            columns: ["tipo_equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_tipos_equipamento"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_cotacoes_propostas: {
        Row: {
          ano_fabricacao: string | null
          com_operador: boolean | null
          cotacao_item_id: string
          created_at: string | null
          empresa_id: string | null
          fabricante_id: string | null
          id: string
          modelo_id: string | null
          observacoes: string | null
          prazo_entrega: string | null
          status: string
          updated_at: string | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          ano_fabricacao?: string | null
          com_operador?: boolean | null
          cotacao_item_id: string
          created_at?: string | null
          empresa_id?: string | null
          fabricante_id?: string | null
          id?: string
          modelo_id?: string | null
          observacoes?: string | null
          prazo_entrega?: string | null
          status?: string
          updated_at?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          ano_fabricacao?: string | null
          com_operador?: boolean | null
          cotacao_item_id?: string
          created_at?: string | null
          empresa_id?: string | null
          fabricante_id?: string | null
          id?: string
          modelo_id?: string | null
          observacoes?: string | null
          prazo_entrega?: string | null
          status?: string
          updated_at?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "bd_cotacoes_propostas_cotacao_item_id_fkey"
            columns: ["cotacao_item_id"]
            isOneToOne: false
            referencedRelation: "bd_cotacoes_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_cotacoes_propostas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "bd_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_cotacoes_propostas_fabricante_id_fkey"
            columns: ["fabricante_id"]
            isOneToOne: false
            referencedRelation: "bd_fabricantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_cotacoes_propostas_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "bd_modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_custos_equipamentos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          equipamento_id: string | null
          id: string
          tipo_equipamento_id: string | null
          updated_at: string | null
          valor_diaria: number | null
          valor_hora: number | null
          valor_mensal: number | null
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          equipamento_id?: string | null
          id?: string
          tipo_equipamento_id?: string | null
          updated_at?: string | null
          valor_diaria?: number | null
          valor_hora?: number | null
          valor_mensal?: number | null
          vigencia_fim?: string | null
          vigencia_inicio: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          equipamento_id?: string | null
          id?: string
          tipo_equipamento_id?: string | null
          updated_at?: string | null
          valor_diaria?: number | null
          valor_hora?: number | null
          valor_mensal?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_custos_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_caminhoes_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_custos_equipamentos_tipo_equipamento_id_fkey"
            columns: ["tipo_equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_tipos_equipamento"
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
      bd_desligamentos: {
        Row: {
          created_at: string
          criado_por: string
          data_efetiva_desligamento: string | null
          data_fim_aviso: string | null
          data_inicio_aviso: string | null
          data_solicitacao: string
          dias_aviso: number | null
          funcionario_id: string
          id: string
          modificado_por: string | null
          motivo: string | null
          observacoes: string | null
          recontratavel: boolean
          status: string
          tipo_desligamento: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por: string
          data_efetiva_desligamento?: string | null
          data_fim_aviso?: string | null
          data_inicio_aviso?: string | null
          data_solicitacao?: string
          dias_aviso?: number | null
          funcionario_id: string
          id?: string
          modificado_por?: string | null
          motivo?: string | null
          observacoes?: string | null
          recontratavel?: boolean
          status?: string
          tipo_desligamento: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          data_efetiva_desligamento?: string | null
          data_fim_aviso?: string | null
          data_inicio_aviso?: string | null
          data_solicitacao?: string
          dias_aviso?: number | null
          funcionario_id?: string
          id?: string
          modificado_por?: string | null
          motivo?: string | null
          observacoes?: string | null
          recontratavel?: boolean
          status?: string
          tipo_desligamento?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_desligamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
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
      bd_diaria_logs: {
        Row: {
          created_at: string
          dados_extras: Json | null
          id: string
          justificativa: string | null
          solicitacao_id: string
          tipo_evento: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          dados_extras?: Json | null
          id?: string
          justificativa?: string | null
          solicitacao_id: string
          tipo_evento: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          dados_extras?: Json | null
          id?: string
          justificativa?: string | null
          solicitacao_id?: string
          tipo_evento?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_diaria_logs_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
            referencedColumns: ["id"]
          },
        ]
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
          tipo_apontamento: string | null
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
          tipo_apontamento?: string | null
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
          tipo_apontamento?: string | null
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
          data_fim_semana: string | null
          data_inicio: string
          data_inicio_semana: string | null
          engenheiro_solicitante_id: string | null
          etapa_atual: number | null
          flag_extraordinaria: boolean | null
          id: string
          justificativa: string
          justificativa_extraordinaria: string | null
          modificado_por: string | null
          motor_aprovacao: string
          numero_solicitacao: string
          observacao_gerente: string | null
          qtde_dias_uteis_estimado: number | null
          qtde_fds_estimado: number | null
          qtde_feriados_estimado: number | null
          responsavel_campo_id: string | null
          status: string
          status_fluxo: string | null
          tipo_envio: string | null
          tipo_solicitacao: string | null
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
          data_fim_semana?: string | null
          data_inicio: string
          data_inicio_semana?: string | null
          engenheiro_solicitante_id?: string | null
          etapa_atual?: number | null
          flag_extraordinaria?: boolean | null
          id?: string
          justificativa: string
          justificativa_extraordinaria?: string | null
          modificado_por?: string | null
          motor_aprovacao?: string
          numero_solicitacao: string
          observacao_gerente?: string | null
          qtde_dias_uteis_estimado?: number | null
          qtde_fds_estimado?: number | null
          qtde_feriados_estimado?: number | null
          responsavel_campo_id?: string | null
          status?: string
          status_fluxo?: string | null
          tipo_envio?: string | null
          tipo_solicitacao?: string | null
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
          data_fim_semana?: string | null
          data_inicio?: string
          data_inicio_semana?: string | null
          engenheiro_solicitante_id?: string | null
          etapa_atual?: number | null
          flag_extraordinaria?: boolean | null
          id?: string
          justificativa?: string
          justificativa_extraordinaria?: string | null
          modificado_por?: string | null
          motor_aprovacao?: string
          numero_solicitacao?: string
          observacao_gerente?: string | null
          qtde_dias_uteis_estimado?: number | null
          qtde_fds_estimado?: number | null
          qtde_feriados_estimado?: number | null
          responsavel_campo_id?: string | null
          status?: string
          status_fluxo?: string | null
          tipo_envio?: string | null
          tipo_solicitacao?: string | null
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
      bd_disponibilidade_equipamentos: {
        Row: {
          centro_custo_id: string | null
          confiabilidade_previsao:
            | Database["public"]["Enums"]["confiabilidade_previsao_enum"]
            | null
          created_at: string | null
          data_inicio: string | null
          equipamento_id: string
          id: string
          motivo_risco: string | null
          observacao: string | null
          previsao_liberacao: string | null
          status_operacional: Database["public"]["Enums"]["status_operacional_enum"]
          updated_at: string | null
        }
        Insert: {
          centro_custo_id?: string | null
          confiabilidade_previsao?:
            | Database["public"]["Enums"]["confiabilidade_previsao_enum"]
            | null
          created_at?: string | null
          data_inicio?: string | null
          equipamento_id: string
          id?: string
          motivo_risco?: string | null
          observacao?: string | null
          previsao_liberacao?: string | null
          status_operacional?: Database["public"]["Enums"]["status_operacional_enum"]
          updated_at?: string | null
        }
        Update: {
          centro_custo_id?: string | null
          confiabilidade_previsao?:
            | Database["public"]["Enums"]["confiabilidade_previsao_enum"]
            | null
          created_at?: string | null
          data_inicio?: string | null
          equipamento_id?: string
          id?: string
          motivo_risco?: string | null
          observacao?: string | null
          previsao_liberacao?: string | null
          status_operacional?: Database["public"]["Enums"]["status_operacional_enum"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_caminhoes_equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_documentos_fluxo: {
        Row: {
          criado_em: string | null
          criado_por: string | null
          etapa_origem: number | null
          id: string
          solicitacao_id: string
          tipo_documento: string
          url_arquivo: string | null
          versao: number | null
        }
        Insert: {
          criado_em?: string | null
          criado_por?: string | null
          etapa_origem?: number | null
          id?: string
          solicitacao_id: string
          tipo_documento: string
          url_arquivo?: string | null
          versao?: number | null
        }
        Update: {
          criado_em?: string | null
          criado_por?: string | null
          etapa_origem?: number | null
          id?: string
          solicitacao_id?: string
          tipo_documento?: string
          url_arquivo?: string | null
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_documentos_fluxo_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_documentos_relacao: {
        Row: {
          documento_filho_id: string
          documento_pai_id: string
          id: string
        }
        Insert: {
          documento_filho_id: string
          documento_pai_id: string
          id?: string
        }
        Update: {
          documento_filho_id?: string
          documento_pai_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_documentos_relacao_documento_filho_id_fkey"
            columns: ["documento_filho_id"]
            isOneToOne: false
            referencedRelation: "bd_documentos_fluxo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_documentos_relacao_documento_pai_id_fkey"
            columns: ["documento_pai_id"]
            isOneToOne: false
            referencedRelation: "bd_documentos_fluxo"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_empresas: {
        Row: {
          agencia: string | null
          aprovado_compliance: boolean | null
          atualizado_via_integracao: boolean | null
          banco: string | null
          cnpj: string
          conta: string | null
          created_at: string | null
          data_integracao: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_completo: string | null
          endereco_estado: string | null
          endereco_latitude: number | null
          endereco_longitude: number | null
          fornece_equipamento: boolean | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logo_url: string | null
          modificado_por: string | null
          nome_contato: string | null
          nome_empresa: string
          origem_cadastro: string | null
          pertence_ao_grupo: boolean | null
          pessoa_tipo: string | null
          pix: string | null
          situacao: string | null
          status_homologacao: string | null
          telefone: string | null
          tipo_conta: string | null
          tipo_empresa: string | null
          updated_at: string | null
        }
        Insert: {
          agencia?: string | null
          aprovado_compliance?: boolean | null
          atualizado_via_integracao?: boolean | null
          banco?: string | null
          cnpj: string
          conta?: string | null
          created_at?: string | null
          data_integracao?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_completo?: string | null
          endereco_estado?: string | null
          endereco_latitude?: number | null
          endereco_longitude?: number | null
          fornece_equipamento?: boolean | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logo_url?: string | null
          modificado_por?: string | null
          nome_contato?: string | null
          nome_empresa: string
          origem_cadastro?: string | null
          pertence_ao_grupo?: boolean | null
          pessoa_tipo?: string | null
          pix?: string | null
          situacao?: string | null
          status_homologacao?: string | null
          telefone?: string | null
          tipo_conta?: string | null
          tipo_empresa?: string | null
          updated_at?: string | null
        }
        Update: {
          agencia?: string | null
          aprovado_compliance?: boolean | null
          atualizado_via_integracao?: boolean | null
          banco?: string | null
          cnpj?: string
          conta?: string | null
          created_at?: string | null
          data_integracao?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_completo?: string | null
          endereco_estado?: string | null
          endereco_latitude?: number | null
          endereco_longitude?: number | null
          fornece_equipamento?: boolean | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logo_url?: string | null
          modificado_por?: string | null
          nome_contato?: string | null
          nome_empresa?: string
          origem_cadastro?: string | null
          pertence_ao_grupo?: boolean | null
          pessoa_tipo?: string | null
          pix?: string | null
          situacao?: string | null
          status_homologacao?: string | null
          telefone?: string | null
          tipo_conta?: string | null
          tipo_empresa?: string | null
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
      bd_envios: {
        Row: {
          criado_por: string | null
          data_envio: string | null
          destino: string
          documento_id: string
          id: string
          solicitacao_id: string
          status: string | null
        }
        Insert: {
          criado_por?: string | null
          data_envio?: string | null
          destino: string
          documento_id: string
          id?: string
          solicitacao_id: string
          status?: string | null
        }
        Update: {
          criado_por?: string | null
          data_envio?: string | null
          destino?: string
          documento_id?: string
          id?: string
          solicitacao_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_envios_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "bd_documentos_fluxo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_envios_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
            referencedColumns: ["id"]
          },
        ]
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
      bd_fabricantes: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
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
      bd_fluxo_centro_custo: {
        Row: {
          ativo: boolean | null
          centro_custo_id: string
          created_at: string | null
          fluxo_id: string
          id: string
        }
        Insert: {
          ativo?: boolean | null
          centro_custo_id: string
          created_at?: string | null
          fluxo_id: string
          id?: string
        }
        Update: {
          ativo?: boolean | null
          centro_custo_id?: string
          created_at?: string | null
          fluxo_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_fluxo_centro_custo_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_fluxo_centro_custo_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_fluxo_centro_custo_fluxo_id_fkey"
            columns: ["fluxo_id"]
            isOneToOne: false
            referencedRelation: "bd_fluxos_aprovacao"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_fluxo_etapas: {
        Row: {
          ativo: boolean | null
          cargo_id: string | null
          created_at: string | null
          fluxo_id: string
          id: string
          nome_exibicao: string
          nome_tecnico: string
          obrigatorio: boolean | null
          ordem: number
          permite_multiplo: boolean | null
          status_fluxo_nome: string | null
          tipo_aprovador: string
        }
        Insert: {
          ativo?: boolean | null
          cargo_id?: string | null
          created_at?: string | null
          fluxo_id: string
          id?: string
          nome_exibicao: string
          nome_tecnico: string
          obrigatorio?: boolean | null
          ordem: number
          permite_multiplo?: boolean | null
          status_fluxo_nome?: string | null
          tipo_aprovador: string
        }
        Update: {
          ativo?: boolean | null
          cargo_id?: string | null
          created_at?: string | null
          fluxo_id?: string
          id?: string
          nome_exibicao?: string
          nome_tecnico?: string
          obrigatorio?: boolean | null
          ordem?: number
          permite_multiplo?: boolean | null
          status_fluxo_nome?: string | null
          tipo_aprovador?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_fluxo_etapas_fluxo_id_fkey"
            columns: ["fluxo_id"]
            isOneToOne: false
            referencedRelation: "bd_fluxos_aprovacao"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_fluxo_historico: {
        Row: {
          data_movimentacao: string | null
          id: string
          observacao: string | null
          solicitacao_id: string
          status_anterior: string | null
          status_novo: string
          usuario_id: string | null
        }
        Insert: {
          data_movimentacao?: string | null
          id?: string
          observacao?: string | null
          solicitacao_id: string
          status_anterior?: string | null
          status_novo: string
          usuario_id?: string | null
        }
        Update: {
          data_movimentacao?: string | null
          id?: string
          observacao?: string | null
          solicitacao_id?: string
          status_anterior?: string | null
          status_novo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_fluxo_historico_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_fluxos_aprovacao: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string | null
          versao: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string | null
          versao?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
          versao?: number | null
        }
        Relationships: []
      }
      bd_frotas: {
        Row: {
          ativo: boolean | null
          codigo: string
          created_at: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          tipo_propriedade_padrao: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          tipo_propriedade_padrao?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          tipo_propriedade_padrao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_frotas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "bd_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_funcionario_status_historico: {
        Row: {
          created_at: string | null
          data_fim: string | null
          data_inicio: string
          funcionario_id: string
          id: string
          motivo: string | null
          registrado_por: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio: string
          funcionario_id: string
          id?: string
          motivo?: string | null
          registrado_por?: string | null
          status: string
        }
        Update: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          funcionario_id?: string
          id?: string
          motivo?: string | null
          registrado_por?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_funcionario_status_historico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
        ]
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
          data_desligamento: string | null
          data_ferias: string | null
          data_nascimento: string | null
          departamento_id: string | null
          diarias: number | null
          email: string | null
          empresa_id: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_completo: string | null
          endereco_estado: string | null
          endereco_numero: string | null
          endereco_rua: string | null
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
          tipo_escala: string
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
          data_desligamento?: string | null
          data_ferias?: string | null
          data_nascimento?: string | null
          departamento_id?: string | null
          diarias?: number | null
          email?: string | null
          empresa_id?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_completo?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
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
          tipo_escala?: string
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
          data_desligamento?: string | null
          data_ferias?: string | null
          data_nascimento?: string | null
          departamento_id?: string | null
          diarias?: number | null
          email?: string | null
          empresa_id?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_completo?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
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
          tipo_escala?: string
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
          salario_base: number | null
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
          salario_base?: number | null
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
          salario_base?: number | null
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
      bd_grupos_ativos: {
        Row: {
          ativo: boolean | null
          categoria_id: string
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria_id: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria_id?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_grupos_ativos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "bd_categorias_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_historico_funcional: {
        Row: {
          cargo_anterior: string | null
          cargo_novo: string | null
          centro_custo_anterior: string | null
          centro_custo_novo: string | null
          created_at: string
          funcionario_id: string
          id: string
          motivo: string | null
          percentual_aumento: number | null
          salario_anterior: number | null
          salario_novo: number | null
          tipo_evento: string
        }
        Insert: {
          cargo_anterior?: string | null
          cargo_novo?: string | null
          centro_custo_anterior?: string | null
          centro_custo_novo?: string | null
          created_at?: string
          funcionario_id: string
          id?: string
          motivo?: string | null
          percentual_aumento?: number | null
          salario_anterior?: number | null
          salario_novo?: number | null
          tipo_evento: string
        }
        Update: {
          cargo_anterior?: string | null
          cargo_novo?: string | null
          centro_custo_anterior?: string | null
          centro_custo_novo?: string | null
          created_at?: string
          funcionario_id?: string
          id?: string
          motivo?: string | null
          percentual_aumento?: number | null
          salario_anterior?: number | null
          salario_novo?: number | null
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_historico_funcional_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
        ]
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
      bd_integracao_fornecedores_log: {
        Row: {
          cnpj: string
          created_at: string | null
          empresa_id_gerada: string | null
          fornecedor_externo_id: string | null
          id: string
          mensagem: string | null
          origem: string | null
          payload_json: Json
          processed_at: string | null
          status_processamento: string | null
        }
        Insert: {
          cnpj: string
          created_at?: string | null
          empresa_id_gerada?: string | null
          fornecedor_externo_id?: string | null
          id?: string
          mensagem?: string | null
          origem?: string | null
          payload_json: Json
          processed_at?: string | null
          status_processamento?: string | null
        }
        Update: {
          cnpj?: string
          created_at?: string | null
          empresa_id_gerada?: string | null
          fornecedor_externo_id?: string | null
          id?: string
          mensagem?: string | null
          origem?: string | null
          payload_json?: Json
          processed_at?: string | null
          status_processamento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_integracao_fornecedores_log_empresa_id_gerada_fkey"
            columns: ["empresa_id_gerada"]
            isOneToOne: false
            referencedRelation: "bd_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_licitacoes_orgaos_pendentes: {
        Row: {
          created_at: string
          id: string
          licitacao_id: string | null
          licitacao_numero: string | null
          nome_api_normalizado: string
          nome_api_original: string
          observacoes: string | null
          origem: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          licitacao_id?: string | null
          licitacao_numero?: string | null
          nome_api_normalizado: string
          nome_api_original: string
          observacoes?: string | null
          origem?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          licitacao_id?: string | null
          licitacao_numero?: string | null
          nome_api_normalizado?: string
          nome_api_original?: string
          observacoes?: string | null
          origem?: string | null
          status?: string | null
        }
        Relationships: []
      }
      bd_linhas_operacionais: {
        Row: {
          ativo: boolean | null
          codigo: string
          cor_hex: string | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          cor_hex?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          cor_hex?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
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
          dias_atendimento: string[] | null
          endereco: string
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          nome_local: string
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          criado_em?: string
          dias_atendimento?: string[] | null
          endereco: string
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          nome_local: string
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          criado_em?: string
          dias_atendimento?: string[] | null
          endereco?: string
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          nome_local?: string
          telefone?: string | null
        }
        Relationships: []
      }
      bd_localizacao_equipamentos: {
        Row: {
          centro_custo_id: string | null
          data_registro: string | null
          equipamento_id: string
          id: string
          latitude: number | null
          longitude: number | null
          origem: Database["public"]["Enums"]["origem_localizacao_enum"] | null
        }
        Insert: {
          centro_custo_id?: string | null
          data_registro?: string | null
          equipamento_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          origem?: Database["public"]["Enums"]["origem_localizacao_enum"] | null
        }
        Update: {
          centro_custo_id?: string | null
          data_registro?: string | null
          equipamento_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          origem?: Database["public"]["Enums"]["origem_localizacao_enum"] | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_localizacao_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_localizacao_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_localizacao_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_caminhoes_equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_log_comunicacao: {
        Row: {
          created_at: string | null
          destinatario: string | null
          enviado_por: string | null
          funcionario_id: string | null
          id: string
          mensagem: string | null
          metadata: Json | null
          tipo: string
        }
        Insert: {
          created_at?: string | null
          destinatario?: string | null
          enviado_por?: string | null
          funcionario_id?: string | null
          id?: string
          mensagem?: string | null
          metadata?: Json | null
          tipo?: string
        }
        Update: {
          created_at?: string | null
          destinatario?: string | null
          enviado_por?: string | null
          funcionario_id?: string | null
          id?: string
          mensagem?: string | null
          metadata?: Json | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_log_comunicacao_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_matching_config: {
        Row: {
          ativo: boolean
          created_at: string | null
          grupo: string
          id: string
          nome: string
          peso: number
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string | null
          grupo: string
          id?: string
          nome: string
          peso?: number
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string | null
          grupo?: string
          id?: string
          nome?: string
          peso?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      bd_matching_exclusoes: {
        Row: {
          ativo: boolean
          created_at: string | null
          id: string
          motivo: string | null
          termo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string | null
          id?: string
          motivo?: string | null
          termo: string
        }
        Update: {
          ativo?: boolean
          created_at?: string | null
          id?: string
          motivo?: string | null
          termo?: string
        }
        Relationships: []
      }
      bd_modelos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          fabricante_id: string
          id: string
          nome_modelo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          fabricante_id: string
          id?: string
          nome_modelo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          fabricante_id?: string
          id?: string
          nome_modelo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_modelos_fabricante_id_fkey"
            columns: ["fabricante_id"]
            isOneToOne: false
            referencedRelation: "bd_fabricantes"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_movimentacao_saida: {
        Row: {
          checklist_json: Json | null
          combustivel: string | null
          created_at: string | null
          data_hora: string | null
          fotos_json: Json | null
          horimetro: number | null
          id: string
          latitude: number | null
          longitude: number | null
          movimentacao_id: string
          responsavel_id: string | null
        }
        Insert: {
          checklist_json?: Json | null
          combustivel?: string | null
          created_at?: string | null
          data_hora?: string | null
          fotos_json?: Json | null
          horimetro?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          movimentacao_id: string
          responsavel_id?: string | null
        }
        Update: {
          checklist_json?: Json | null
          combustivel?: string | null
          created_at?: string | null
          data_hora?: string | null
          fotos_json?: Json | null
          horimetro?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          movimentacao_id?: string
          responsavel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_movimentacao_saida_movimentacao_id_fkey"
            columns: ["movimentacao_id"]
            isOneToOne: false
            referencedRelation: "bd_movimentacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_movimentacao_saida_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_movimentacao_transporte: {
        Row: {
          caminhao_id: string | null
          created_at: string | null
          empresa_id: string | null
          id: string
          motorista_cpf: string | null
          motorista_id: string | null
          motorista_nome: string | null
          movimentacao_id: string
          observacoes: string | null
          placa: string | null
          tipo_transporte: string | null
        }
        Insert: {
          caminhao_id?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          motorista_cpf?: string | null
          motorista_id?: string | null
          motorista_nome?: string | null
          movimentacao_id: string
          observacoes?: string | null
          placa?: string | null
          tipo_transporte?: string | null
        }
        Update: {
          caminhao_id?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          motorista_cpf?: string | null
          motorista_id?: string | null
          motorista_nome?: string | null
          movimentacao_id?: string
          observacoes?: string | null
          placa?: string | null
          tipo_transporte?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_movimentacao_transporte_caminhao_id_fkey"
            columns: ["caminhao_id"]
            isOneToOne: false
            referencedRelation: "bd_caminhoes_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_movimentacao_transporte_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "bd_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_movimentacao_transporte_movimentacao_id_fkey"
            columns: ["movimentacao_id"]
            isOneToOne: false
            referencedRelation: "bd_movimentacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_movimentacoes: {
        Row: {
          created_at: string | null
          custo_total: number | null
          destino_id: string | null
          destino_tipo: string
          distancia_km: number | null
          equipamento_id: string | null
          id: string
          origem_id: string | null
          origem_tipo: string
          prazo_estimado_horas: number | null
          responsavel_transporte: string | null
          solicitacao_id: string
          solicitacao_planejamento_id: string | null
          status: string | null
          tipo_atendimento: string | null
          tipo_deslocamento: string | null
          updated_at: string | null
          valor_km: number | null
        }
        Insert: {
          created_at?: string | null
          custo_total?: number | null
          destino_id?: string | null
          destino_tipo: string
          distancia_km?: number | null
          equipamento_id?: string | null
          id?: string
          origem_id?: string | null
          origem_tipo: string
          prazo_estimado_horas?: number | null
          responsavel_transporte?: string | null
          solicitacao_id: string
          solicitacao_planejamento_id?: string | null
          status?: string | null
          tipo_atendimento?: string | null
          tipo_deslocamento?: string | null
          updated_at?: string | null
          valor_km?: number | null
        }
        Update: {
          created_at?: string | null
          custo_total?: number | null
          destino_id?: string | null
          destino_tipo?: string
          distancia_km?: number | null
          equipamento_id?: string | null
          id?: string
          origem_id?: string | null
          origem_tipo?: string
          prazo_estimado_horas?: number | null
          responsavel_transporte?: string | null
          solicitacao_id?: string
          solicitacao_planejamento_id?: string | null
          status?: string | null
          tipo_atendimento?: string | null
          tipo_deslocamento?: string | null
          updated_at?: string | null
          valor_km?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_movimentacoes_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_caminhoes_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_movimentacoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_equipamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_movimentacoes_solicitacao_planejamento_id_fkey"
            columns: ["solicitacao_planejamento_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_planejamento"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_notificacoes: {
        Row: {
          acao_realizada: boolean | null
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
          acao_realizada?: boolean | null
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
          acao_realizada?: boolean | null
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
      bd_orgaos_alias: {
        Row: {
          alias_nome: string
          alias_normalizado: string
          created_at: string
          id: string
          orgao_id: string
        }
        Insert: {
          alias_nome: string
          alias_normalizado: string
          created_at?: string
          id?: string
          orgao_id: string
        }
        Update: {
          alias_nome?: string
          alias_normalizado?: string
          created_at?: string
          id?: string
          orgao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_orgaos_alias_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "bd_orgaos_publicos"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_orgaos_historico_metricas: {
        Row: {
          id: string
          orgao_id: string
          total_ganhas: number
          total_licitacoes: number
          total_participadas: number
          total_perdidas: number
          updated_at: string
          valor_total_estimado: number
          valor_total_ganho: number
        }
        Insert: {
          id?: string
          orgao_id: string
          total_ganhas?: number
          total_licitacoes?: number
          total_participadas?: number
          total_perdidas?: number
          updated_at?: string
          valor_total_estimado?: number
          valor_total_ganho?: number
        }
        Update: {
          id?: string
          orgao_id?: string
          total_ganhas?: number
          total_licitacoes?: number
          total_participadas?: number
          total_perdidas?: number
          updated_at?: string
          valor_total_estimado?: number
          valor_total_ganho?: number
        }
        Relationships: [
          {
            foreignKeyName: "bd_orgaos_historico_metricas_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: true
            referencedRelation: "bd_orgaos_publicos"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_orgaos_publicos: {
        Row: {
          area_atuacao: string | null
          ativo: boolean
          created_at: string
          esfera: string | null
          frequencia_licitacoes: string | null
          id: string
          nivel_prioridade: number | null
          nome: string
          observacoes: string | null
          perfil_contratacao: string | null
          sigla: string
          ticket_medio: number | null
          updated_at: string
        }
        Insert: {
          area_atuacao?: string | null
          ativo?: boolean
          created_at?: string
          esfera?: string | null
          frequencia_licitacoes?: string | null
          id?: string
          nivel_prioridade?: number | null
          nome: string
          observacoes?: string | null
          perfil_contratacao?: string | null
          sigla: string
          ticket_medio?: number | null
          updated_at?: string
        }
        Update: {
          area_atuacao?: string | null
          ativo?: boolean
          created_at?: string
          esfera?: string | null
          frequencia_licitacoes?: string | null
          id?: string
          nivel_prioridade?: number | null
          nome?: string
          observacoes?: string | null
          perfil_contratacao?: string | null
          sigla?: string
          ticket_medio?: number | null
          updated_at?: string
        }
        Relationships: []
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
      bd_permission_audit_logs: {
        Row: {
          created_at: string | null
          id: string
          origem: string | null
          permitido: boolean | null
          rota: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          origem?: string | null
          permitido?: boolean | null
          rota?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          origem?: string | null
          permitido?: boolean | null
          rota?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bd_permissions: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          modulo: string | null
          nome: string
          rota: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          modulo?: string | null
          nome: string
          rota?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          modulo?: string | null
          nome?: string
          rota?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
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
      bd_permissoes_acoes: {
        Row: {
          acao: string
          created_at: string | null
          descricao: string | null
          id: string
          permission_id: string
        }
        Insert: {
          acao: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          permission_id: string
        }
        Update: {
          acao?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          permission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_permissoes_acoes_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "bd_permissions"
            referencedColumns: ["id"]
          },
        ]
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
          grupos_match: string[] | null
          id: string
          link_origem_pncp: string | null
          match_termos: string[] | null
          modalidade_contratacao: string | null
          municipio_ibge: string | null
          municipio_nome: string | null
          numero_controle_pncp: string
          objeto: string
          orgao_cnpj: string | null
          orgao_id: string | null
          orgao_nome: string | null
          orgao_sigla: string | null
          participando: boolean | null
          perfil_busca_id: string | null
          perfil_busca_nome: string | null
          prioridade: string | null
          raw_data: Json | null
          score_busca: number | null
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
          grupos_match?: string[] | null
          id?: string
          link_origem_pncp?: string | null
          match_termos?: string[] | null
          modalidade_contratacao?: string | null
          municipio_ibge?: string | null
          municipio_nome?: string | null
          numero_controle_pncp: string
          objeto: string
          orgao_cnpj?: string | null
          orgao_id?: string | null
          orgao_nome?: string | null
          orgao_sigla?: string | null
          participando?: boolean | null
          perfil_busca_id?: string | null
          perfil_busca_nome?: string | null
          prioridade?: string | null
          raw_data?: Json | null
          score_busca?: number | null
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
          grupos_match?: string[] | null
          id?: string
          link_origem_pncp?: string | null
          match_termos?: string[] | null
          modalidade_contratacao?: string | null
          municipio_ibge?: string | null
          municipio_nome?: string | null
          numero_controle_pncp?: string
          objeto?: string
          orgao_cnpj?: string | null
          orgao_id?: string | null
          orgao_nome?: string | null
          orgao_sigla?: string | null
          participando?: boolean | null
          perfil_busca_id?: string | null
          perfil_busca_nome?: string | null
          prioridade?: string | null
          raw_data?: Json | null
          score_busca?: number | null
          status_resultado?: string | null
          uf?: string | null
          unidade_nome?: string | null
          updated_at?: string | null
          user_id?: string | null
          valor_total_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_pncp_contratacoes_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "bd_orgaos_publicos"
            referencedColumns: ["id"]
          },
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
      bd_ponto_ajustes: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          batida_original_id: string | null
          campo_alterado: string | null
          created_at: string | null
          funcionario_id: string
          id: string
          motivo: string
          solicitado_por: string
          status: string | null
          tipo_ajuste: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          batida_original_id?: string | null
          campo_alterado?: string | null
          created_at?: string | null
          funcionario_id: string
          id?: string
          motivo: string
          solicitado_por: string
          status?: string | null
          tipo_ajuste: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          batida_original_id?: string | null
          campo_alterado?: string | null
          created_at?: string | null
          funcionario_id?: string
          id?: string
          motivo?: string
          solicitado_por?: string
          status?: string | null
          tipo_ajuste?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_ponto_ajustes_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_ajustes_batida_original_id_fkey"
            columns: ["batida_original_id"]
            isOneToOne: false
            referencedRelation: "bd_ponto_batidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_ajustes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_ajustes_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ponto_apontamento_integracao: {
        Row: {
          apontamento_id: string
          batida_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          apontamento_id: string
          batida_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          apontamento_id?: string
          batida_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_ponto_apontamento_integracao_apontamento_id_fkey"
            columns: ["apontamento_id"]
            isOneToOne: false
            referencedRelation: "bd_apontamento_equipe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_apontamento_integracao_apontamento_id_fkey"
            columns: ["apontamento_id"]
            isOneToOne: false
            referencedRelation: "vw_apontamento_equipe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_apontamento_integracao_batida_id_fkey"
            columns: ["batida_id"]
            isOneToOne: false
            referencedRelation: "bd_ponto_batidas"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ponto_audit_log: {
        Row: {
          acao: string
          created_at: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          ip: string | null
          registro_id: string | null
          tabela: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          ip?: string | null
          registro_id?: string | null
          tabela: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          ip?: string | null
          registro_id?: string | null
          tabela?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      bd_ponto_batidas: {
        Row: {
          centro_custo_id: string | null
          created_at: string | null
          data_hora_considerada: string | null
          data_hora_dispositivo: string
          data_hora_servidor: string | null
          data_operacional: string | null
          dentro_raio: boolean | null
          device_fingerprint: string | null
          dispositivo_id: string | null
          distancia_centro_metros: number | null
          foto_url: string | null
          funcionario_id: string
          id: string
          ip_address: string | null
          justificativa: string | null
          latitude: number | null
          longitude: number | null
          modificado_por: string | null
          modo_registro: Database["public"]["Enums"]["ponto_modo_registro"]
          offline_uuid: string | null
          origem_dados: string | null
          precisao_gps_metros: number | null
          score_risco: number | null
          status_sync: Database["public"]["Enums"]["ponto_status_sync"] | null
          status_validacao:
            | Database["public"]["Enums"]["ponto_status_validacao"]
            | null
          tipo_batida: Database["public"]["Enums"]["ponto_tipo_batida"]
          tipo_registro: string | null
          updated_at: string | null
          user_agent: string | null
          validado_em: string | null
          validado_por: string | null
        }
        Insert: {
          centro_custo_id?: string | null
          created_at?: string | null
          data_hora_considerada?: string | null
          data_hora_dispositivo: string
          data_hora_servidor?: string | null
          data_operacional?: string | null
          dentro_raio?: boolean | null
          device_fingerprint?: string | null
          dispositivo_id?: string | null
          distancia_centro_metros?: number | null
          foto_url?: string | null
          funcionario_id: string
          id?: string
          ip_address?: string | null
          justificativa?: string | null
          latitude?: number | null
          longitude?: number | null
          modificado_por?: string | null
          modo_registro: Database["public"]["Enums"]["ponto_modo_registro"]
          offline_uuid?: string | null
          origem_dados?: string | null
          precisao_gps_metros?: number | null
          score_risco?: number | null
          status_sync?: Database["public"]["Enums"]["ponto_status_sync"] | null
          status_validacao?:
            | Database["public"]["Enums"]["ponto_status_validacao"]
            | null
          tipo_batida: Database["public"]["Enums"]["ponto_tipo_batida"]
          tipo_registro?: string | null
          updated_at?: string | null
          user_agent?: string | null
          validado_em?: string | null
          validado_por?: string | null
        }
        Update: {
          centro_custo_id?: string | null
          created_at?: string | null
          data_hora_considerada?: string | null
          data_hora_dispositivo?: string
          data_hora_servidor?: string | null
          data_operacional?: string | null
          dentro_raio?: boolean | null
          device_fingerprint?: string | null
          dispositivo_id?: string | null
          distancia_centro_metros?: number | null
          foto_url?: string | null
          funcionario_id?: string
          id?: string
          ip_address?: string | null
          justificativa?: string | null
          latitude?: number | null
          longitude?: number | null
          modificado_por?: string | null
          modo_registro?: Database["public"]["Enums"]["ponto_modo_registro"]
          offline_uuid?: string | null
          origem_dados?: string | null
          precisao_gps_metros?: number | null
          score_risco?: number | null
          status_sync?: Database["public"]["Enums"]["ponto_status_sync"] | null
          status_validacao?:
            | Database["public"]["Enums"]["ponto_status_validacao"]
            | null
          tipo_batida?: Database["public"]["Enums"]["ponto_tipo_batida"]
          tipo_registro?: string | null
          updated_at?: string | null
          user_agent?: string | null
          validado_em?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "bd_ponto_dispositivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ponto_config: {
        Row: {
          centro_custo_id: string
          created_at: string | null
          exige_foto: boolean | null
          exige_gps: boolean | null
          horario_entrada_padrao: string | null
          horario_saida_padrao: string | null
          id: string
          intervalo_minimo_min: number | null
          intervalo_obrigatorio: boolean | null
          jornada_padrao_horas: number | null
          modo_geofence: string | null
          permite_offline_pwa: boolean | null
          permite_ponto_fora_raio: boolean | null
          retencao_fotos_dias: number | null
          tolerancia_minutos: number | null
          updated_at: string | null
          vigente_desde: string | null
        }
        Insert: {
          centro_custo_id: string
          created_at?: string | null
          exige_foto?: boolean | null
          exige_gps?: boolean | null
          horario_entrada_padrao?: string | null
          horario_saida_padrao?: string | null
          id?: string
          intervalo_minimo_min?: number | null
          intervalo_obrigatorio?: boolean | null
          jornada_padrao_horas?: number | null
          modo_geofence?: string | null
          permite_offline_pwa?: boolean | null
          permite_ponto_fora_raio?: boolean | null
          retencao_fotos_dias?: number | null
          tolerancia_minutos?: number | null
          updated_at?: string | null
          vigente_desde?: string | null
        }
        Update: {
          centro_custo_id?: string
          created_at?: string | null
          exige_foto?: boolean | null
          exige_gps?: boolean | null
          horario_entrada_padrao?: string | null
          horario_saida_padrao?: string | null
          id?: string
          intervalo_minimo_min?: number | null
          intervalo_obrigatorio?: boolean | null
          jornada_padrao_horas?: number | null
          modo_geofence?: string | null
          permite_offline_pwa?: boolean | null
          permite_ponto_fora_raio?: boolean | null
          retencao_fotos_dias?: number | null
          tolerancia_minutos?: number | null
          updated_at?: string | null
          vigente_desde?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_ponto_config_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: true
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_config_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: true
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
        ]
      }
      bd_ponto_diaria_integracao: {
        Row: {
          batida_id: string
          created_at: string | null
          id: string
          presenca_diaria_id: string
          solicitacao_id: string
        }
        Insert: {
          batida_id: string
          created_at?: string | null
          id?: string
          presenca_diaria_id: string
          solicitacao_id: string
        }
        Update: {
          batida_id?: string
          created_at?: string | null
          id?: string
          presenca_diaria_id?: string
          solicitacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_ponto_diaria_integracao_batida_id_fkey"
            columns: ["batida_id"]
            isOneToOne: false
            referencedRelation: "bd_ponto_batidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_presenca_diaria_id_fkey"
            columns: ["presenca_diaria_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_presencas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_presenca_diaria_id_fkey"
            columns: ["presenca_diaria_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["presenca_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ponto_dispositivos: {
        Row: {
          ativo: boolean | null
          centro_custo_id: string
          codigo_dispositivo: string
          created_at: string | null
          device_secret_hash: string | null
          id: string
          latitude_fixa: number | null
          longitude_fixa: number | null
          nome: string
          registrado_por: string | null
          ultimo_heartbeat: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          centro_custo_id: string
          codigo_dispositivo: string
          created_at?: string | null
          device_secret_hash?: string | null
          id?: string
          latitude_fixa?: number | null
          longitude_fixa?: number | null
          nome: string
          registrado_por?: string | null
          ultimo_heartbeat?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          centro_custo_id?: string
          codigo_dispositivo?: string
          created_at?: string | null
          device_secret_hash?: string | null
          id?: string
          latitude_fixa?: number | null
          longitude_fixa?: number | null
          nome?: string
          registrado_por?: string | null
          ultimo_heartbeat?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ponto_vinculos_operacionais: {
        Row: {
          ativo: boolean | null
          centro_custo_id: string
          created_at: string | null
          criado_por: string | null
          data_fim: string | null
          data_inicio: string
          equipe_id: string | null
          funcionario_id: string
          id: string
          tipo_vinculo: Database["public"]["Enums"]["ponto_tipo_vinculo"]
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          centro_custo_id: string
          created_at?: string | null
          criado_por?: string | null
          data_fim?: string | null
          data_inicio: string
          equipe_id?: string | null
          funcionario_id: string
          id?: string
          tipo_vinculo: Database["public"]["Enums"]["ponto_tipo_vinculo"]
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          centro_custo_id?: string
          created_at?: string | null
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          equipe_id?: string | null
          funcionario_id?: string
          id?: string
          tipo_vinculo?: Database["public"]["Enums"]["ponto_tipo_vinculo"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_ponto_vinculos_operacionais_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_vinculos_operacionais_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_vinculos_operacionais_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_vinculos_operacionais_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "bd_equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_vinculos_operacionais_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_portfolio_empresas: {
        Row: {
          ano_fabricacao: string | null
          ativo: boolean | null
          catalogo_equipamento_id: string | null
          catalogo_variacao_id: string | null
          created_at: string | null
          empresa_id: string
          fabricante: string | null
          fornece_com_operador: boolean | null
          fornece_sem_operador: boolean | null
          id: string
          modelo: string | null
          observacoes: string | null
          quantidade_estimada: number | null
          tipo_equipamento_id: string | null
          updated_at: string | null
          valor_ref_com_operador: number | null
          valor_ref_sem_operador: number | null
        }
        Insert: {
          ano_fabricacao?: string | null
          ativo?: boolean | null
          catalogo_equipamento_id?: string | null
          catalogo_variacao_id?: string | null
          created_at?: string | null
          empresa_id: string
          fabricante?: string | null
          fornece_com_operador?: boolean | null
          fornece_sem_operador?: boolean | null
          id?: string
          modelo?: string | null
          observacoes?: string | null
          quantidade_estimada?: number | null
          tipo_equipamento_id?: string | null
          updated_at?: string | null
          valor_ref_com_operador?: number | null
          valor_ref_sem_operador?: number | null
        }
        Update: {
          ano_fabricacao?: string | null
          ativo?: boolean | null
          catalogo_equipamento_id?: string | null
          catalogo_variacao_id?: string | null
          created_at?: string | null
          empresa_id?: string
          fabricante?: string | null
          fornece_com_operador?: boolean | null
          fornece_sem_operador?: boolean | null
          id?: string
          modelo?: string | null
          observacoes?: string | null
          quantidade_estimada?: number | null
          tipo_equipamento_id?: string | null
          updated_at?: string | null
          valor_ref_com_operador?: number | null
          valor_ref_sem_operador?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_portfolio_empresas_catalogo_equipamento_id_fkey"
            columns: ["catalogo_equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_catalogo_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_portfolio_empresas_catalogo_variacao_id_fkey"
            columns: ["catalogo_variacao_id"]
            isOneToOne: false
            referencedRelation: "bd_catalogo_variacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_portfolio_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "bd_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_portfolio_empresas_tipo_equipamento_id_fkey"
            columns: ["tipo_equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_tipos_equipamento"
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
      bd_role_permission_actions: {
        Row: {
          acao: string
          created_at: string | null
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          acao: string
          created_at?: string | null
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          acao?: string
          created_at?: string | null
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_role_permission_actions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "bd_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_role_permission_actions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "bd_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "bd_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "bd_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_roles: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
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
      bd_solicitacoes_equip_aprovacoes: {
        Row: {
          aprovador_id: string | null
          comentario: string | null
          created_at: string | null
          data_decisao: string | null
          etapa_aprovacao: string
          id: string
          solicitacao_id: string
          status: string | null
        }
        Insert: {
          aprovador_id?: string | null
          comentario?: string | null
          created_at?: string | null
          data_decisao?: string | null
          etapa_aprovacao: string
          id?: string
          solicitacao_id: string
          status?: string | null
        }
        Update: {
          aprovador_id?: string | null
          comentario?: string | null
          created_at?: string | null
          data_decisao?: string | null
          etapa_aprovacao?: string
          id?: string
          solicitacao_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_solicitacoes_equip_aprovacoes_aprovador_id_fkey"
            columns: ["aprovador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equip_aprovacoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_equipamento"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_solicitacoes_equipamento: {
        Row: {
          apontador_responsavel_id: string | null
          aprovador_centro_custo_id: string | null
          centro_custo_id: string
          com_operador: boolean | null
          created_at: string | null
          data_inicio: string
          engenheiro_solicitante_id: string | null
          id: string
          justificativa: string
          possui_disponibilidade_interna: boolean | null
          prioridade: Database["public"]["Enums"]["prioridade_solicitacao_enum"]
          quantidade: number
          quantidade_disponivel_encontrada: number | null
          regime_trabalho: string | null
          resultado_matching: string | null
          solicitante_id: string | null
          status: Database["public"]["Enums"]["status_solicitacao_equip_enum"]
          status_fluxo: string | null
          sugestao_acao: string | null
          tempo_previsto_dias: number | null
          tipo_equipamento_id: string | null
          updated_at: string | null
        }
        Insert: {
          apontador_responsavel_id?: string | null
          aprovador_centro_custo_id?: string | null
          centro_custo_id: string
          com_operador?: boolean | null
          created_at?: string | null
          data_inicio: string
          engenheiro_solicitante_id?: string | null
          id?: string
          justificativa: string
          possui_disponibilidade_interna?: boolean | null
          prioridade?: Database["public"]["Enums"]["prioridade_solicitacao_enum"]
          quantidade?: number
          quantidade_disponivel_encontrada?: number | null
          regime_trabalho?: string | null
          resultado_matching?: string | null
          solicitante_id?: string | null
          status?: Database["public"]["Enums"]["status_solicitacao_equip_enum"]
          status_fluxo?: string | null
          sugestao_acao?: string | null
          tempo_previsto_dias?: number | null
          tipo_equipamento_id?: string | null
          updated_at?: string | null
        }
        Update: {
          apontador_responsavel_id?: string | null
          aprovador_centro_custo_id?: string | null
          centro_custo_id?: string
          com_operador?: boolean | null
          created_at?: string | null
          data_inicio?: string
          engenheiro_solicitante_id?: string | null
          id?: string
          justificativa?: string
          possui_disponibilidade_interna?: boolean | null
          prioridade?: Database["public"]["Enums"]["prioridade_solicitacao_enum"]
          quantidade?: number
          quantidade_disponivel_encontrada?: number | null
          regime_trabalho?: string | null
          resultado_matching?: string | null
          solicitante_id?: string | null
          status?: Database["public"]["Enums"]["status_solicitacao_equip_enum"]
          status_fluxo?: string | null
          sugestao_acao?: string | null
          tempo_previsto_dias?: number | null
          tipo_equipamento_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_solicitacoes_equipamento_apontador_responsavel_id_fkey"
            columns: ["apontador_responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_aprovador_centro_custo_id_fkey"
            columns: ["aprovador_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_tipo_equipamento_id_fkey"
            columns: ["tipo_equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_tipos_equipamento"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_solicitacoes_itens: {
        Row: {
          capacidade_descricao: string | null
          capacidade_unidade: string | null
          capacidade_valor: number | null
          catalogo_equipamento_id: string | null
          catalogo_variacao_id: string | null
          com_operador: boolean
          created_at: string | null
          descricao_livre: string | null
          id: string
          item_nao_catalogado: boolean
          observacoes: string | null
          quantidade: number
          regime_personalizado: string | null
          regime_trabalho: string | null
          solicitacao_id: string
          status_item: string
          subcategoria_id: string | null
          tempo_previsto_dias: number | null
          tipo_item: string
          updated_at: string | null
        }
        Insert: {
          capacidade_descricao?: string | null
          capacidade_unidade?: string | null
          capacidade_valor?: number | null
          catalogo_equipamento_id?: string | null
          catalogo_variacao_id?: string | null
          com_operador?: boolean
          created_at?: string | null
          descricao_livre?: string | null
          id?: string
          item_nao_catalogado?: boolean
          observacoes?: string | null
          quantidade?: number
          regime_personalizado?: string | null
          regime_trabalho?: string | null
          solicitacao_id: string
          status_item?: string
          subcategoria_id?: string | null
          tempo_previsto_dias?: number | null
          tipo_item: string
          updated_at?: string | null
        }
        Update: {
          capacidade_descricao?: string | null
          capacidade_unidade?: string | null
          capacidade_valor?: number | null
          catalogo_equipamento_id?: string | null
          catalogo_variacao_id?: string | null
          com_operador?: boolean
          created_at?: string | null
          descricao_livre?: string | null
          id?: string
          item_nao_catalogado?: boolean
          observacoes?: string | null
          quantidade?: number
          regime_personalizado?: string | null
          regime_trabalho?: string | null
          solicitacao_id?: string
          status_item?: string
          subcategoria_id?: string | null
          tempo_previsto_dias?: number | null
          tipo_item?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_solicitacoes_itens_catalogo_equipamento_id_fkey"
            columns: ["catalogo_equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_catalogo_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_itens_catalogo_variacao_id_fkey"
            columns: ["catalogo_variacao_id"]
            isOneToOne: false
            referencedRelation: "bd_catalogo_variacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_itens_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_equipamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_itens_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "bd_subcategorias_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_solicitacoes_planejamento: {
        Row: {
          created_at: string | null
          data_prevista_entrega: string | null
          decisao: string | null
          id: string
          observacoes: string | null
          responsavel_transporte_id: string | null
          solicitacao_id: string
          status: string | null
          updated_at: string | null
          usuario_transporte_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_prevista_entrega?: string | null
          decisao?: string | null
          id?: string
          observacoes?: string | null
          responsavel_transporte_id?: string | null
          solicitacao_id: string
          status?: string | null
          updated_at?: string | null
          usuario_transporte_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_prevista_entrega?: string | null
          decisao?: string | null
          id?: string
          observacoes?: string | null
          responsavel_transporte_id?: string | null
          solicitacao_id?: string
          status?: string | null
          updated_at?: string | null
          usuario_transporte_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_solicitacoes_planejamento_responsavel_transporte_id_fkey"
            columns: ["responsavel_transporte_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_planejamento_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_equipamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_planejamento_usuario_transporte_id_fkey"
            columns: ["usuario_transporte_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          grupo_id: string | null
          id: string
          nome_subcategoria: string
        }
        Insert: {
          ativo?: boolean | null
          categoria_id: string
          criado_em?: string | null
          descricao?: string | null
          grupo_id?: string | null
          id?: string
          nome_subcategoria: string
        }
        Update: {
          ativo?: boolean | null
          categoria_id?: string
          criado_em?: string | null
          descricao?: string | null
          grupo_id?: string | null
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
          {
            foreignKeyName: "bd_subcategorias_ativos_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "bd_grupos_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_tipos_equipamento: {
        Row: {
          ativo: boolean | null
          capacidade_m3: number | null
          capacidade_pessoas: number | null
          capacidade_ton: number | null
          categoria_id: string | null
          created_at: string | null
          descricao_padronizada: string
          exige_operador: boolean | null
          id: string
          linha_operacional_id: string | null
          subcategoria_id: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          capacidade_m3?: number | null
          capacidade_pessoas?: number | null
          capacidade_ton?: number | null
          categoria_id?: string | null
          created_at?: string | null
          descricao_padronizada: string
          exige_operador?: boolean | null
          id?: string
          linha_operacional_id?: string | null
          subcategoria_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          capacidade_m3?: number | null
          capacidade_pessoas?: number | null
          capacidade_ton?: number | null
          categoria_id?: string | null
          created_at?: string | null
          descricao_padronizada?: string
          exige_operador?: boolean | null
          id?: string
          linha_operacional_id?: string | null
          subcategoria_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_tipos_equipamento_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "bd_categorias_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_tipos_equipamento_linha_operacional_id_fkey"
            columns: ["linha_operacional_id"]
            isOneToOne: false
            referencedRelation: "bd_linhas_operacionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_tipos_equipamento_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "bd_subcategorias_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_user_permission_overrides: {
        Row: {
          acao: string
          created_at: string | null
          id: string
          permission_id: string
          permitido: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          acao: string
          created_at?: string | null
          id?: string
          permission_id: string
          permitido?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          acao?: string
          created_at?: string | null
          id?: string
          permission_id?: string
          permitido?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_user_permission_overrides_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "bd_permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_user_roles: {
        Row: {
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "bd_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      bd_vale_transporte: {
        Row: {
          agendamento_id: string | null
          assinatura_base64: string | null
          bairro: string | null
          candidato_id: string | null
          cep: string | null
          cidade: string | null
          comprovante_url: string | null
          created_at: string | null
          created_by: string | null
          data_solicitacao: string | null
          endereco: string | null
          estado: string | null
          id: string
          linhas: Json | null
          motivo: string | null
          motivo_outros_texto: string | null
          motivos_nao_beneficiario: string[] | null
          numero: string | null
          pdf_assinado_url: string | null
          pdf_gerado_url: string | null
          pdf_url: string | null
          rua: string | null
          tipo: string
          valor_jae: number | null
          valor_riocard: number | null
          valor_total: number | null
        }
        Insert: {
          agendamento_id?: string | null
          assinatura_base64?: string | null
          bairro?: string | null
          candidato_id?: string | null
          cep?: string | null
          cidade?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          created_by?: string | null
          data_solicitacao?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          linhas?: Json | null
          motivo?: string | null
          motivo_outros_texto?: string | null
          motivos_nao_beneficiario?: string[] | null
          numero?: string | null
          pdf_assinado_url?: string | null
          pdf_gerado_url?: string | null
          pdf_url?: string | null
          rua?: string | null
          tipo: string
          valor_jae?: number | null
          valor_riocard?: number | null
          valor_total?: number | null
        }
        Update: {
          agendamento_id?: string | null
          assinatura_base64?: string | null
          bairro?: string | null
          candidato_id?: string | null
          cep?: string | null
          cidade?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          created_by?: string | null
          data_solicitacao?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          linhas?: Json | null
          motivo?: string | null
          motivo_outros_texto?: string | null
          motivos_nao_beneficiario?: string[] | null
          numero?: string | null
          pdf_assinado_url?: string | null
          pdf_gerado_url?: string | null
          pdf_url?: string | null
          rua?: string | null
          tipo?: string
          valor_jae?: number | null
          valor_riocard?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_vale_transporte_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "bd_agendamentos_exames"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          acesso_global: boolean | null
          assinatura_png: string | null
          cargo: string | null
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
          assinatura_png?: string | null
          cargo?: string | null
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
          assinatura_png?: string | null
          cargo?: string | null
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
          engenheiro_solicitante_id: string | null
          engenheiro_solicitante_nome: string | null
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
            foreignKeyName: "bd_diaria_solicitacoes_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
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
      _map_tipo_aprovador_to_role: { Args: { p_tipo: string }; Returns: string }
      _map_tipo_aprovador_to_status: {
        Args: { p_tipo: string }
        Returns: string
      }
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
      aprovar_diretor_adm: {
        Args: {
          p_assinatura_png: string
          p_cargo: string
          p_cpf?: string
          p_nome_usuario: string
          p_solicitacao_id: string
        }
        Returns: undefined
      }
      aprovar_diretor_operacional: {
        Args: {
          p_assinatura_png: string
          p_cargo: string
          p_cpf?: string
          p_nome_usuario: string
          p_solicitacao_id: string
        }
        Returns: undefined
      }
      aprovar_etapa_dinamica: {
        Args: {
          p_etapa_exec_id: string
          p_observacao?: string
          p_solicitacao_id: string
        }
        Returns: undefined
      }
      aprovar_gerente_adm: {
        Args: {
          p_assinatura_png: string
          p_cargo: string
          p_cpf?: string
          p_nome_usuario: string
          p_solicitacao_id: string
        }
        Returns: undefined
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
      buscar_equipamentos_disponiveis: {
        Args: { p_tipo_equipamento_id: string }
        Returns: {
          empresa_id: string
          empresa_nome: string
          equipamento_id: string
          frota: string
          placa: string
          quantidade_disponivel: number
          tipo_resultado: string
        }[]
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
      classificar_orgao_pendente: {
        Args: {
          p_criar_alias?: boolean
          p_orgao_id: string
          p_pendente_id: string
        }
        Returns: number
      }
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
      fn_calcular_distancia_haversine: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
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
      gerenciar_convocado_diaria: {
        Args: {
          p_acao: string
          p_funcionario_data: Json
          p_solicitacao_id: string
        }
        Returns: undefined
      }
      get_admsede_centros_custo: {
        Args: { p_user_id?: string }
        Returns: string[]
      }
      get_configuracao_sistema: { Args: { p_chave: string }; Returns: string }
      get_etapas_utilizadas: {
        Args: { p_checklist_id?: string; p_obra_id: string }
        Returns: string[]
      }
      get_funcionario_id_for_auth: { Args: never; Returns: string }
      get_funcionarios_para_diarias: {
        Args: never
        Returns: {
          agencia: string
          banco: string
          centro_custo_id: string
          chave_pix: string
          conta_corrente: string
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
      get_status_funcionario_na_data: {
        Args: { p_data: string; p_funcionario_id: string }
        Returns: string
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
      has_ponto_permission: { Args: { _permission: string }; Returns: boolean }
      has_sso_full_access: { Args: { p_user_id?: string }; Returns: boolean }
      has_sso_permission: { Args: { p_user_id?: string }; Returns: boolean }
      iniciar_fluxo_dinamico: {
        Args: { p_solicitacao_id: string }
        Returns: undefined
      }
      is_admsede_for_cc: {
        Args: { p_cc_id: string; p_user_id: string }
        Returns: boolean
      }
      is_departmental_super_admin: { Args: never; Returns: boolean }
      is_ponto_superadmin: { Args: never; Returns: boolean }
      is_super_admin: { Args: { p_user_id: string }; Returns: boolean }
      liberar_proxima_etapa_dinamica: {
        Args: { p_solicitacao_id: string }
        Returns: undefined
      }
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
      rbac_auto_migrate_user: { Args: { p_user_id: string }; Returns: Json }
      rejeitar_etapa_dinamica: {
        Args: {
          p_etapa_exec_id: string
          p_observacao?: string
          p_solicitacao_id: string
        }
        Returns: undefined
      }
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
      reprovar_diretor_adm: {
        Args: { p_observacao?: string; p_solicitacao_id: string }
        Returns: undefined
      }
      reprovar_diretor_operacional: {
        Args: { p_observacao?: string; p_solicitacao_id: string }
        Returns: undefined
      }
      reprovar_gerente_adm: {
        Args: { p_observacao?: string; p_solicitacao_id: string }
        Returns: undefined
      }
      sincronizar_hora_saida_aplicacao: {
        Args: { p_registro_aplicacao_id: string }
        Returns: undefined
      }
      sync_convocados_pre_valores: { Args: never; Returns: number }
      sync_presencas_valores_funcao: { Args: never; Returns: Json }
      sync_profile_funcao_sistema: {
        Args: { _profile_id: string }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_configuracao_sistema: {
        Args: { p_chave: string; p_valor: string }
        Returns: undefined
      }
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
      verificar_equipamento_duplicado: {
        Args: { p_chassi?: string; p_numero_serie?: string; p_placa?: string }
        Returns: {
          campo_duplicado: string
          id: string
          valor_encontrado: string
        }[]
      }
      verificar_etapa_disponivel: {
        Args: { p_checklist_id?: string; p_etapa: string; p_obra_id: string }
        Returns: boolean
      }
    }
    Enums: {
      confiabilidade_previsao_enum: "ALTA" | "MEDIA" | "BAIXA"
      origem_localizacao_enum: "CENTRO_CUSTO" | "MANUAL" | "TELEMETRIA"
      ponto_modo_registro: "pwa_pessoal" | "totem"
      ponto_status_sync: "sincronizado" | "pendente_sync" | "erro_sync"
      ponto_status_validacao:
        | "valida"
        | "pendente_revisao"
        | "invalidada"
        | "ajuste_manual"
      ponto_tipo_batida:
        | "entrada"
        | "intervalo_inicio"
        | "intervalo_fim"
        | "saida"
      ponto_tipo_vinculo: "fixo" | "temporario" | "mobilizado" | "compartilhado"
      prioridade_solicitacao_enum: "NORMAL" | "ALTA" | "URGENTE"
      status_operacional_enum:
        | "DISPONIVEL"
        | "ALOCADO"
        | "MANUTENCAO"
        | "INDISPONIVEL"
      status_solicitacao_equip_enum:
        | "ABERTO"
        | "EM_ANALISE"
        | "ATENDIDO"
        | "NEGADO"
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
    Enums: {
      confiabilidade_previsao_enum: ["ALTA", "MEDIA", "BAIXA"],
      origem_localizacao_enum: ["CENTRO_CUSTO", "MANUAL", "TELEMETRIA"],
      ponto_modo_registro: ["pwa_pessoal", "totem"],
      ponto_status_sync: ["sincronizado", "pendente_sync", "erro_sync"],
      ponto_status_validacao: [
        "valida",
        "pendente_revisao",
        "invalidada",
        "ajuste_manual",
      ],
      ponto_tipo_batida: [
        "entrada",
        "intervalo_inicio",
        "intervalo_fim",
        "saida",
      ],
      ponto_tipo_vinculo: ["fixo", "temporario", "mobilizado", "compartilhado"],
      prioridade_solicitacao_enum: ["NORMAL", "ALTA", "URGENTE"],
      status_operacional_enum: [
        "DISPONIVEL",
        "ALOCADO",
        "MANUTENCAO",
        "INDISPONIVEL",
      ],
      status_solicitacao_equip_enum: [
        "ABERTO",
        "EM_ANALISE",
        "ATENDIDO",
        "NEGADO",
      ],
    },
  },
} as const
