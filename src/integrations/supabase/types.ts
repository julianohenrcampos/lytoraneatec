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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      _mv_relatorio_diarias_dirty: {
        Row: {
          dirty: boolean
          id: boolean
          updated_at: string
        }
        Insert: {
          dirty?: boolean
          id?: boolean
          updated_at?: string
        }
        Update: {
          dirty?: boolean
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
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
            foreignKeyName: "bd_agendamentos_exames_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_agendamentos_exames_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
            foreignKeyName: "bd_agendamentos_exames_funcao_nova_id_fkey"
            columns: ["funcao_nova_id"]
            isOneToOne: false
            referencedRelation: "vw_funcoes_publicas"
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
          {
            foreignKeyName: "bd_agendamentos_exames_anexos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_agendamentos_exames_anexos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
            foreignKeyName: "bd_apontamento_equipe_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_apontamento_equipe_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
          {
            foreignKeyName: "bd_apontamento_equipe_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_apontamento_equipe_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
          {
            foreignKeyName: "bd_aprovacoes_excecao_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_aprovacoes_excecao_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_operacional"
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
            foreignKeyName: "bd_aprovacoes_inclusao_funcionario_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_aprovacoes_inclusao_funcionario_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
          {
            foreignKeyName: "bd_arquivo_morto_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_arquivo_morto_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_assinaturas_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "vw_documentos_fluxo_diarias_seguro"
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
      bd_atestados_medicos: {
        Row: {
          alertas_gerados: Json
          analisado_em: string | null
          analisado_por: string | null
          arquivo_hash_sha256: string
          arquivo_mime: string
          arquivo_path: string
          arquivo_tamanho_bytes: number
          centro_custo_id: string | null
          centro_custo_snapshot: string | null
          cid: string | null
          created_at: string
          data_emissao: string
          data_inicio_afastamento: string | null
          declaracao_ciencia_nao_validacao: boolean
          declaracao_original_48h: boolean
          declaracao_veracidade: boolean
          declaracoes_aceitas_em: string | null
          dentro_prazo_24h: boolean
          dias_afastamento: number
          enviado_em: string
          funcionario_id: string
          id: string
          ip_origem: unknown
          lido: boolean
          lido_em: string | null
          lido_por: string | null
          lido_por_nome: string | null
          matricula_snapshot: string
          medico_nome: string | null
          medico_registro: string | null
          nome_snapshot: string
          notificacao_email_destino: string | null
          notificacao_email_enviada_em: string | null
          notificacao_email_erro: string | null
          notificacao_email_status: string
          notificacao_email_tentativas: number
          observacao: string | null
          observacao_saude: string | null
          origem_hmac_nonce: string
          prazo_calculo_regra: string
          protocolo: string
          sistema_afetado_codigo: string | null
          sistema_afetado_descricao: string | null
          sistema_afetado_observacao: string | null
          status: string
          tipo_documento: string
          tipo_documento_descricao: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          alertas_gerados?: Json
          analisado_em?: string | null
          analisado_por?: string | null
          arquivo_hash_sha256: string
          arquivo_mime: string
          arquivo_path: string
          arquivo_tamanho_bytes: number
          centro_custo_id?: string | null
          centro_custo_snapshot?: string | null
          cid?: string | null
          created_at?: string
          data_emissao: string
          data_inicio_afastamento?: string | null
          declaracao_ciencia_nao_validacao?: boolean
          declaracao_original_48h?: boolean
          declaracao_veracidade?: boolean
          declaracoes_aceitas_em?: string | null
          dentro_prazo_24h: boolean
          dias_afastamento: number
          enviado_em?: string
          funcionario_id: string
          id?: string
          ip_origem?: unknown
          lido?: boolean
          lido_em?: string | null
          lido_por?: string | null
          lido_por_nome?: string | null
          matricula_snapshot: string
          medico_nome?: string | null
          medico_registro?: string | null
          nome_snapshot: string
          notificacao_email_destino?: string | null
          notificacao_email_enviada_em?: string | null
          notificacao_email_erro?: string | null
          notificacao_email_status?: string
          notificacao_email_tentativas?: number
          observacao?: string | null
          observacao_saude?: string | null
          origem_hmac_nonce: string
          prazo_calculo_regra?: string
          protocolo: string
          sistema_afetado_codigo?: string | null
          sistema_afetado_descricao?: string | null
          sistema_afetado_observacao?: string | null
          status?: string
          tipo_documento?: string
          tipo_documento_descricao?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          alertas_gerados?: Json
          analisado_em?: string | null
          analisado_por?: string | null
          arquivo_hash_sha256?: string
          arquivo_mime?: string
          arquivo_path?: string
          arquivo_tamanho_bytes?: number
          centro_custo_id?: string | null
          centro_custo_snapshot?: string | null
          cid?: string | null
          created_at?: string
          data_emissao?: string
          data_inicio_afastamento?: string | null
          declaracao_ciencia_nao_validacao?: boolean
          declaracao_original_48h?: boolean
          declaracao_veracidade?: boolean
          declaracoes_aceitas_em?: string | null
          dentro_prazo_24h?: boolean
          dias_afastamento?: number
          enviado_em?: string
          funcionario_id?: string
          id?: string
          ip_origem?: unknown
          lido?: boolean
          lido_em?: string | null
          lido_por?: string | null
          lido_por_nome?: string | null
          matricula_snapshot?: string
          medico_nome?: string | null
          medico_registro?: string | null
          nome_snapshot?: string
          notificacao_email_destino?: string | null
          notificacao_email_enviada_em?: string | null
          notificacao_email_erro?: string | null
          notificacao_email_status?: string
          notificacao_email_tentativas?: number
          observacao?: string | null
          observacao_saude?: string | null
          origem_hmac_nonce?: string
          prazo_calculo_regra?: string
          protocolo?: string
          sistema_afetado_codigo?: string | null
          sistema_afetado_descricao?: string | null
          sistema_afetado_observacao?: string | null
          status?: string
          tipo_documento?: string
          tipo_documento_descricao?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_atestados_medicos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_atestados_medicos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_atestados_medicos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_atestados_medicos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_atestados_medicos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_atestados_medicos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_atestados_medicos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_atestados_medicos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_atestados_medicos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_atestados_medicos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_atestados_medicos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_atestados_nonces_utilizados: {
        Row: {
          funcionario_id: string
          ip_origem: unknown
          nonce: string
          usado_em: string
        }
        Insert: {
          funcionario_id: string
          ip_origem?: unknown
          nonce: string
          usado_em?: string
        }
        Update: {
          funcionario_id?: string
          ip_origem?: unknown
          nonce?: string
          usado_em?: string
        }
        Relationships: []
      }
      bd_ativos_auditoria: {
        Row: {
          acao: string
          actor_user_id: string
          contexto: string
          created_at: string
          detalhes: Json
          filtros: Json
          id: string
          recurso_id: string | null
          recurso_tipo: string
        }
        Insert: {
          acao: string
          actor_user_id: string
          contexto: string
          created_at?: string
          detalhes?: Json
          filtros?: Json
          id?: string
          recurso_id?: string | null
          recurso_tipo: string
        }
        Update: {
          acao?: string
          actor_user_id?: string
          contexto?: string
          created_at?: string
          detalhes?: Json
          filtros?: Json
          id?: string
          recurso_id?: string | null
          recurso_tipo?: string
        }
        Relationships: []
      }
      bd_auditoria_biometria: {
        Row: {
          created_at: string
          event_hash: string
          funcionario_id: string
          hash_anterior: string | null
          hash_novo: string | null
          id: string
          integridade_hash: string
          ip: string | null
          metadata: Json
          origem: Database["public"]["Enums"]["origem_auditoria_biometria"]
          tipo_evento: Database["public"]["Enums"]["tipo_evento_auditoria_biometria"]
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_hash: string
          funcionario_id: string
          hash_anterior?: string | null
          hash_novo?: string | null
          id?: string
          integridade_hash: string
          ip?: string | null
          metadata?: Json
          origem?: Database["public"]["Enums"]["origem_auditoria_biometria"]
          tipo_evento: Database["public"]["Enums"]["tipo_evento_auditoria_biometria"]
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_hash?: string
          funcionario_id?: string
          hash_anterior?: string | null
          hash_novo?: string | null
          id?: string
          integridade_hash?: string
          ip?: string | null
          metadata?: Json
          origem?: Database["public"]["Enums"]["origem_auditoria_biometria"]
          tipo_evento?: Database["public"]["Enums"]["tipo_evento_auditoria_biometria"]
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_auditoria_biometria_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_auditoria_biometria_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_auditoria_biometria_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
      bd_auditoria_leitura_funcionario_sensivel: {
        Row: {
          campos: string[]
          created_at: string
          funcionario_id: string
          id: string
          metadata: Json
          origem: string
          viewer_user_id: string
        }
        Insert: {
          campos?: string[]
          created_at?: string
          funcionario_id: string
          id?: string
          metadata?: Json
          origem: string
          viewer_user_id: string
        }
        Update: {
          campos?: string[]
          created_at?: string
          funcionario_id?: string
          id?: string
          metadata?: Json
          origem?: string
          viewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_auditoria_leitura_funcionario_sensivel_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_auditoria_leitura_funcionario_sensivel_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_auditoria_leitura_funcionario_sensivel_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
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
      bd_auditoria_log_archive: {
        Row: {
          archived_at: string
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
          archived_at?: string
          campos_alterados?: string[] | null
          created_at: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id: string
          operacao: string
          registro_id?: string | null
          tabela: string
          usuario_id?: string | null
        }
        Update: {
          archived_at?: string
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
            foreignKeyName: "bd_avaliacao_equipe_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_avaliacao_equipe_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
      bd_backend_exec_auditoria: {
        Row: {
          acao: string
          actor_user_id: string | null
          auth_email: string | null
          auth_mode: string
          auth_subject: string | null
          backend_tipo: string
          contexto: string | null
          created_at: string
          erro_resumo: string | null
          id: string
          nivel_risco: string
          origem_ip: unknown
          payload_resumo: Json
          permitido: boolean
          recurso: string
          request_id: string | null
          resultado_resumo: Json
          status_http: number | null
          sucesso: boolean
        }
        Insert: {
          acao?: string
          actor_user_id?: string | null
          auth_email?: string | null
          auth_mode?: string
          auth_subject?: string | null
          backend_tipo: string
          contexto?: string | null
          created_at?: string
          erro_resumo?: string | null
          id?: string
          nivel_risco?: string
          origem_ip?: unknown
          payload_resumo?: Json
          permitido?: boolean
          recurso: string
          request_id?: string | null
          resultado_resumo?: Json
          status_http?: number | null
          sucesso?: boolean
        }
        Update: {
          acao?: string
          actor_user_id?: string | null
          auth_email?: string | null
          auth_mode?: string
          auth_subject?: string | null
          backend_tipo?: string
          contexto?: string | null
          created_at?: string
          erro_resumo?: string | null
          id?: string
          nivel_risco?: string
          origem_ip?: unknown
          payload_resumo?: Json
          permitido?: boolean
          recurso?: string
          request_id?: string | null
          resultado_resumo?: Json
          status_http?: number | null
          sucesso?: boolean
        }
        Relationships: []
      }
      bd_bi_relatorios_auditoria: {
        Row: {
          acao: string
          created_at: string
          filtros: Json
          formato: string
          gerado_por: string
          id: string
          modulo: string
          nivel_dado: string
          quantidade_registros: number | null
          visao_origem: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          filtros?: Json
          formato: string
          gerado_por: string
          id?: string
          modulo: string
          nivel_dado: string
          quantidade_registros?: number | null
          visao_origem?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          filtros?: Json
          formato?: string
          gerado_por?: string
          id?: string
          modulo?: string
          nivel_dado?: string
          quantidade_registros?: number | null
          visao_origem?: string | null
        }
        Relationships: []
      }
      bd_cache_enderecos: {
        Row: {
          created_at: string | null
          endereco: string
          endereco_normalizado: string | null
          endereco_original: string | null
          geocoding_status: string | null
          id: string
          latitude: number
          longitude: number
          place_name: string | null
          place_type: string | null
          relevance: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          endereco: string
          endereco_normalizado?: string | null
          endereco_original?: string | null
          geocoding_status?: string | null
          id?: string
          latitude: number
          longitude: number
          place_name?: string | null
          place_type?: string | null
          relevance?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          endereco?: string
          endereco_normalizado?: string | null
          endereco_original?: string | null
          geocoding_status?: string | null
          id?: string
          latitude?: number
          longitude?: number
          place_name?: string | null
          place_type?: string | null
          relevance?: number | null
          updated_at?: string | null
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
          centro_custo_atual_id: string | null
          centro_custo_atual_origem: string
          centro_custo_atualizado_em: string | null
          centro_custo_atualizado_por: string | null
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
          modelo: string | null
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
          centro_custo_atual_id?: string | null
          centro_custo_atual_origem?: string
          centro_custo_atualizado_em?: string | null
          centro_custo_atualizado_por?: string | null
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
          modelo?: string | null
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
          centro_custo_atual_id?: string | null
          centro_custo_atual_origem?: string
          centro_custo_atualizado_em?: string | null
          centro_custo_atualizado_por?: string | null
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
          modelo?: string | null
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
            foreignKeyName: "bd_caminhoes_equipamentos_catalogo_equipamento_id_fkey"
            columns: ["catalogo_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_portfolio_tecnico_seguro"
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
          {
            foreignKeyName: "fk_caminhoes_eq_cc_atual"
            columns: ["centro_custo_atual_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_caminhoes_eq_cc_atual"
            columns: ["centro_custo_atual_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_caminhoes_eq_cc_atual"
            columns: ["centro_custo_atual_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_caminhoes_eq_cc_atual"
            columns: ["centro_custo_atual_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_caminhoes_eq_cc_atual"
            columns: ["centro_custo_atual_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_caminhoes_eq_cc_atual"
            columns: ["centro_custo_atual_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_caminhoes_eq_cc_atual"
            columns: ["centro_custo_atual_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_caminhoes_eq_cc_atual"
            columns: ["centro_custo_atual_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
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
            foreignKeyName: "bd_carga_status_historico_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_carga_status_historico_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
            foreignKeyName: "bd_carga_status_historico_lista_entrega_id_fkey"
            columns: ["lista_entrega_id"]
            isOneToOne: false
            referencedRelation: "vw_lista_programacao_entrega_segura"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_carga_status_historico_registro_carga_id_fkey"
            columns: ["registro_carga_id"]
            isOneToOne: false
            referencedRelation: "bd_registro_cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_carga_status_historico_registro_carga_id_fkey"
            columns: ["registro_carga_id"]
            isOneToOne: false
            referencedRelation: "vw_registro_cargas_seguro"
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
          adm_obra_funcionario_id: string | null
          adm_sede_funcionario_id: string | null
          aprovador_diarias_id: string | null
          cnpj_vinculado: string | null
          codigo_centro_custo: string
          created_at: string | null
          created_by: string | null
          departamento_id: string | null
          diretoria_id: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_completo: string | null
          endereco_estado: string | null
          endereco_normalizado: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          geocoding_relevance: number | null
          geocoding_source: string | null
          geocoding_status: string | null
          geocoding_updated_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          mapbox_place_name: string | null
          modificado_por: string | null
          nome_alterdata: string | null
          nome_centro_custo: string
          planejador_responsavel_id: string | null
          raio_ponto_metros: number | null
          situacao: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          adm_obra_funcionario_id?: string | null
          adm_sede_funcionario_id?: string | null
          aprovador_diarias_id?: string | null
          cnpj_vinculado?: string | null
          codigo_centro_custo: string
          created_at?: string | null
          created_by?: string | null
          departamento_id?: string | null
          diretoria_id?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_completo?: string | null
          endereco_estado?: string | null
          endereco_normalizado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          geocoding_relevance?: number | null
          geocoding_source?: string | null
          geocoding_status?: string | null
          geocoding_updated_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          mapbox_place_name?: string | null
          modificado_por?: string | null
          nome_alterdata?: string | null
          nome_centro_custo: string
          planejador_responsavel_id?: string | null
          raio_ponto_metros?: number | null
          situacao?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          adm_obra_funcionario_id?: string | null
          adm_sede_funcionario_id?: string | null
          aprovador_diarias_id?: string | null
          cnpj_vinculado?: string | null
          codigo_centro_custo?: string
          created_at?: string | null
          created_by?: string | null
          departamento_id?: string | null
          diretoria_id?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_completo?: string | null
          endereco_estado?: string | null
          endereco_normalizado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          geocoding_relevance?: number | null
          geocoding_source?: string | null
          geocoding_status?: string | null
          geocoding_updated_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          mapbox_place_name?: string | null
          modificado_por?: string | null
          nome_alterdata?: string | null
          nome_centro_custo?: string
          planejador_responsavel_id?: string | null
          raio_ponto_metros?: number | null
          situacao?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_centros_custo_adm_obra_funcionario_id_fkey"
            columns: ["adm_obra_funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_centros_custo_adm_obra_funcionario_id_fkey"
            columns: ["adm_obra_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_centros_custo_adm_obra_funcionario_id_fkey"
            columns: ["adm_obra_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_centros_custo_adm_sede_funcionario_id_fkey"
            columns: ["adm_sede_funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_centros_custo_adm_sede_funcionario_id_fkey"
            columns: ["adm_sede_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_centros_custo_adm_sede_funcionario_id_fkey"
            columns: ["adm_sede_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_centros_custo_aprovador_diarias_id_fkey"
            columns: ["aprovador_diarias_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_centros_custo_aprovador_diarias_id_fkey"
            columns: ["aprovador_diarias_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
          {
            foreignKeyName: "bd_centros_custo_planejador_responsavel_id_fkey"
            columns: ["planejador_responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_centros_custo_planejador_responsavel_id_fkey"
            columns: ["planejador_responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_centros_custo_planejador_responsavel_id_fkey"
            columns: ["planejador_responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_chamado_interno_anexos: {
        Row: {
          chamado_id: string
          created_at: string
          enviado_por: string | null
          evento_id: string | null
          id: string
          mime_type: string
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number
        }
        Insert: {
          chamado_id: string
          created_at?: string
          enviado_por?: string | null
          evento_id?: string | null
          id?: string
          mime_type: string
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number
        }
        Update: {
          chamado_id?: string
          created_at?: string
          enviado_por?: string | null
          evento_id?: string | null
          id?: string
          mime_type?: string
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "bd_chamado_interno_anexos_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "bd_chamados_internos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_chamado_interno_anexos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "bd_chamado_interno_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_chamado_interno_atendentes: {
        Row: {
          atendente_profile_id: string
          ativo: boolean
          created_at: string
          id: string
          setor: Database["public"]["Enums"]["chamado_interno_setor"]
          updated_at: string
        }
        Insert: {
          atendente_profile_id: string
          ativo?: boolean
          created_at?: string
          id?: string
          setor: Database["public"]["Enums"]["chamado_interno_setor"]
          updated_at?: string
        }
        Update: {
          atendente_profile_id?: string
          ativo?: boolean
          created_at?: string
          id?: string
          setor?: Database["public"]["Enums"]["chamado_interno_setor"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_at_profile"
            columns: ["atendente_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_at_profile"
            columns: ["atendente_profile_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_at_profile"
            columns: ["atendente_profile_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_chamado_interno_avaliacoes: {
        Row: {
          autor_profile_id: string
          chamado_id: string
          comentario: string | null
          created_at: string
          id: string
          nota: number
        }
        Insert: {
          autor_profile_id: string
          chamado_id: string
          comentario?: string | null
          created_at?: string
          id?: string
          nota: number
        }
        Update: {
          autor_profile_id?: string
          chamado_id?: string
          comentario?: string | null
          created_at?: string
          id?: string
          nota?: number
        }
        Relationships: [
          {
            foreignKeyName: "bd_chamado_interno_avaliacoes_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: true
            referencedRelation: "bd_chamados_internos"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_chamado_interno_categorias: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          is_critico: boolean
          nome: string
          ordem: number
          prioridade_padrao: Database["public"]["Enums"]["chamado_interno_prioridade"]
          requer_evidencia: boolean
          setor: Database["public"]["Enums"]["chamado_interno_setor"]
          sla_horas: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          is_critico?: boolean
          nome: string
          ordem: number
          prioridade_padrao?: Database["public"]["Enums"]["chamado_interno_prioridade"]
          requer_evidencia?: boolean
          setor: Database["public"]["Enums"]["chamado_interno_setor"]
          sla_horas?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          is_critico?: boolean
          nome?: string
          ordem?: number
          prioridade_padrao?: Database["public"]["Enums"]["chamado_interno_prioridade"]
          requer_evidencia?: boolean
          setor?: Database["public"]["Enums"]["chamado_interno_setor"]
          sla_horas?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      bd_chamado_interno_eventos: {
        Row: {
          autor_profile_id: string | null
          chamado_id: string
          created_at: string
          id: string
          mensagem: string | null
          payload: Json
          status_anterior:
            | Database["public"]["Enums"]["chamado_interno_status"]
            | null
          status_novo:
            | Database["public"]["Enums"]["chamado_interno_status"]
            | null
          tipo: Database["public"]["Enums"]["chamado_interno_evento_tipo"]
          visivel_solicitante: boolean
        }
        Insert: {
          autor_profile_id?: string | null
          chamado_id: string
          created_at?: string
          id?: string
          mensagem?: string | null
          payload?: Json
          status_anterior?:
            | Database["public"]["Enums"]["chamado_interno_status"]
            | null
          status_novo?:
            | Database["public"]["Enums"]["chamado_interno_status"]
            | null
          tipo: Database["public"]["Enums"]["chamado_interno_evento_tipo"]
          visivel_solicitante?: boolean
        }
        Update: {
          autor_profile_id?: string | null
          chamado_id?: string
          created_at?: string
          id?: string
          mensagem?: string | null
          payload?: Json
          status_anterior?:
            | Database["public"]["Enums"]["chamado_interno_status"]
            | null
          status_novo?:
            | Database["public"]["Enums"]["chamado_interno_status"]
            | null
          tipo?: Database["public"]["Enums"]["chamado_interno_evento_tipo"]
          visivel_solicitante?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fk_ev_autor"
            columns: ["autor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ev_autor"
            columns: ["autor_profile_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ev_autor"
            columns: ["autor_profile_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ev_chamado"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "bd_chamados_internos"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_chamados_internos: {
        Row: {
          aberto_por: string
          categoria_id: string
          centro_custo_id: string
          created_at: string
          descricao: string
          id: string
          is_critico: boolean
          numero: number
          prioridade: Database["public"]["Enums"]["chamado_interno_prioridade"]
          protocolo: string
          responsavel_atual_profile_id: string | null
          setor: Database["public"]["Enums"]["chamado_interno_setor"]
          sla_prazo: string | null
          solicitante_funcionario_id: string
          status: Database["public"]["Enums"]["chamado_interno_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          aberto_por: string
          categoria_id: string
          centro_custo_id: string
          created_at?: string
          descricao: string
          id?: string
          is_critico: boolean
          numero: number
          prioridade: Database["public"]["Enums"]["chamado_interno_prioridade"]
          protocolo: string
          responsavel_atual_profile_id?: string | null
          setor: Database["public"]["Enums"]["chamado_interno_setor"]
          sla_prazo?: string | null
          solicitante_funcionario_id: string
          status?: Database["public"]["Enums"]["chamado_interno_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          aberto_por?: string
          categoria_id?: string
          centro_custo_id?: string
          created_at?: string
          descricao?: string
          id?: string
          is_critico?: boolean
          numero?: number
          prioridade?: Database["public"]["Enums"]["chamado_interno_prioridade"]
          protocolo?: string
          responsavel_atual_profile_id?: string | null
          setor?: Database["public"]["Enums"]["chamado_interno_setor"]
          sla_prazo?: string | null
          solicitante_funcionario_id?: string
          status?: Database["public"]["Enums"]["chamado_interno_status"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ci_aberto_por"
            columns: ["aberto_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ci_aberto_por"
            columns: ["aberto_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ci_aberto_por"
            columns: ["aberto_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ci_categoria"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "bd_chamado_interno_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ci_cc"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ci_cc"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_ci_cc"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_ci_cc"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_ci_cc"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_ci_cc"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_ci_cc"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_ci_cc"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_ci_responsavel"
            columns: ["responsavel_atual_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ci_responsavel"
            columns: ["responsavel_atual_profile_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ci_responsavel"
            columns: ["responsavel_atual_profile_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ci_solicitante"
            columns: ["solicitante_funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ci_solicitante"
            columns: ["solicitante_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ci_solicitante"
            columns: ["solicitante_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_chamados_os_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_chamados_os_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
          {
            foreignKeyName: "bd_chamados_os_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_chamados_os_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
          {
            foreignKeyName: "bd_cotacoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_cotacoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_operacional"
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
            foreignKeyName: "bd_cotacoes_itens_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "vw_cotacoes_segura"
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
      bd_ct_checklists: {
        Row: {
          assinatura_id: string | null
          checklist_codigo: string
          checklist_versao: number
          created_at: string
          created_by: string | null
          fase: string
          id: string
          latitude: number | null
          longitude: number | null
          movimentacao_id: string | null
          realizado_em: string | null
          realizado_por_funcionario_id: string | null
          realizado_por_profile_id: string | null
          respostas: Json
          status: string
          tipo: string
          updated_at: string
          updated_by: string | null
          viagem_id: string
        }
        Insert: {
          assinatura_id?: string | null
          checklist_codigo: string
          checklist_versao?: number
          created_at?: string
          created_by?: string | null
          fase?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          movimentacao_id?: string | null
          realizado_em?: string | null
          realizado_por_funcionario_id?: string | null
          realizado_por_profile_id?: string | null
          respostas?: Json
          status?: string
          tipo: string
          updated_at?: string
          updated_by?: string | null
          viagem_id: string
        }
        Update: {
          assinatura_id?: string | null
          checklist_codigo?: string
          checklist_versao?: number
          created_at?: string
          created_by?: string | null
          fase?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          movimentacao_id?: string | null
          realizado_em?: string | null
          realizado_por_funcionario_id?: string | null
          realizado_por_profile_id?: string | null
          respostas?: Json
          status?: string
          tipo?: string
          updated_at?: string
          updated_by?: string | null
          viagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_ct_checklists_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "bd_assinaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_checklists_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "vw_assinaturas_diarias_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_checklists_movimentacao_id_fkey"
            columns: ["movimentacao_id"]
            isOneToOne: false
            referencedRelation: "bd_movimentacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_checklists_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "bd_ct_viagens"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ct_comando_requests: {
        Row: {
          command_hash: string
          created_at: string
          created_by: string
          operacao: string
          planejamento_id: string | null
          puxada_id: string | null
          request_id: string
          response_json: Json
          solicitacao_id: string | null
        }
        Insert: {
          command_hash: string
          created_at?: string
          created_by: string
          operacao: string
          planejamento_id?: string | null
          puxada_id?: string | null
          request_id: string
          response_json: Json
          solicitacao_id?: string | null
        }
        Update: {
          command_hash?: string
          created_at?: string
          created_by?: string
          operacao?: string
          planejamento_id?: string | null
          puxada_id?: string | null
          request_id?: string
          response_json?: Json
          solicitacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_ct_comando_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_comando_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_comando_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_comando_requests_planejamento_id_fkey"
            columns: ["planejamento_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_planejamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_comando_requests_puxada_id_fkey"
            columns: ["puxada_id"]
            isOneToOne: false
            referencedRelation: "bd_ct_puxadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_comando_requests_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_equipamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_comando_requests_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_comando_requests_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_operacional"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ct_puxada_caminhoes: {
        Row: {
          caminhao_equipamento_id: string
          created_at: string
          frota_snapshot: string | null
          id: string
          motorista_funcionario_id: string
          motorista_nome_snapshot: string
          placa_snapshot: string | null
          puxada_id: string
          updated_at: string
        }
        Insert: {
          caminhao_equipamento_id: string
          created_at?: string
          frota_snapshot?: string | null
          id?: string
          motorista_funcionario_id: string
          motorista_nome_snapshot: string
          placa_snapshot?: string | null
          puxada_id: string
          updated_at?: string
        }
        Update: {
          caminhao_equipamento_id?: string
          created_at?: string
          frota_snapshot?: string | null
          id?: string
          motorista_funcionario_id?: string
          motorista_nome_snapshot?: string
          placa_snapshot?: string | null
          puxada_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_ct_puxada_caminhoes_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_caminhoes_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_puxada_caminhoes_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_puxada_caminhoes_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_puxada_caminhoes_motorista_funcionario_id_fkey"
            columns: ["motorista_funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_puxada_caminhoes_motorista_funcionario_id_fkey"
            columns: ["motorista_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_puxada_caminhoes_motorista_funcionario_id_fkey"
            columns: ["motorista_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_puxada_caminhoes_puxada_id_fkey"
            columns: ["puxada_id"]
            isOneToOne: false
            referencedRelation: "bd_ct_puxadas"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ct_puxadas: {
        Row: {
          cancelado_em: string | null
          cancelado_por: string | null
          centro_custo_id: string
          codigo: string
          coleta_endereco: string | null
          coleta_latitude: number | null
          coleta_longitude: number | null
          created_at: string
          created_by: string
          data_puxada: string
          descarga_endereco: string | null
          descarga_latitude: number | null
          descarga_longitude: number | null
          distancia_rota_km: number | null
          duracao_rota_min: number | null
          id: string
          motivo_cancelamento: string | null
          observacoes: string | null
          planejador_nome_snapshot: string
          planejador_user_id: string
          programada_em: string | null
          programada_por: string | null
          rota_geometria: Json | null
          rota_resumo: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          centro_custo_id: string
          codigo: string
          coleta_endereco?: string | null
          coleta_latitude?: number | null
          coleta_longitude?: number | null
          created_at?: string
          created_by: string
          data_puxada: string
          descarga_endereco?: string | null
          descarga_latitude?: number | null
          descarga_longitude?: number | null
          distancia_rota_km?: number | null
          duracao_rota_min?: number | null
          id?: string
          motivo_cancelamento?: string | null
          observacoes?: string | null
          planejador_nome_snapshot: string
          planejador_user_id: string
          programada_em?: string | null
          programada_por?: string | null
          rota_geometria?: Json | null
          rota_resumo?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          centro_custo_id?: string
          codigo?: string
          coleta_endereco?: string | null
          coleta_latitude?: number | null
          coleta_longitude?: number | null
          created_at?: string
          created_by?: string
          data_puxada?: string
          descarga_endereco?: string | null
          descarga_latitude?: number | null
          descarga_longitude?: number | null
          distancia_rota_km?: number | null
          duracao_rota_min?: number | null
          id?: string
          motivo_cancelamento?: string | null
          observacoes?: string | null
          planejador_nome_snapshot?: string
          planejador_user_id?: string
          programada_em?: string | null
          programada_por?: string | null
          rota_geometria?: Json | null
          rota_resumo?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_ct_puxadas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_puxadas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_puxadas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_puxadas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_puxadas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_puxadas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_puxadas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_puxadas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_puxadas_planejador_user_id_fkey"
            columns: ["planejador_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_puxadas_planejador_user_id_fkey"
            columns: ["planejador_user_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_puxadas_planejador_user_id_fkey"
            columns: ["planejador_user_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ct_recebimento_itens: {
        Row: {
          created_at: string
          created_by: string | null
          equipamento_id: string | null
          fotos: Json
          id: string
          movimentacao_id: string
          nao_conformidade_tipo: string | null
          observacao: string | null
          recebimento_id: string
          respostas: Json
          resultado: string
          tratado_em: string | null
          tratado_por: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          equipamento_id?: string | null
          fotos?: Json
          id?: string
          movimentacao_id: string
          nao_conformidade_tipo?: string | null
          observacao?: string | null
          recebimento_id: string
          respostas?: Json
          resultado: string
          tratado_em?: string | null
          tratado_por?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          equipamento_id?: string | null
          fotos?: Json
          id?: string
          movimentacao_id?: string
          nao_conformidade_tipo?: string | null
          observacao?: string | null
          recebimento_id?: string
          respostas?: Json
          resultado?: string
          tratado_em?: string | null
          tratado_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_ct_recebimento_itens_movimentacao_id_fkey"
            columns: ["movimentacao_id"]
            isOneToOne: false
            referencedRelation: "bd_movimentacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_recebimento_itens_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "bd_ct_recebimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ct_recebimentos: {
        Row: {
          assinatura_id: string | null
          created_at: string
          created_by: string | null
          fotos: Json
          id: string
          latitude: number | null
          longitude: number | null
          observacoes: string | null
          operado_por_profile_id: string | null
          parada_id: string | null
          recebedor_documento_snapshot: string | null
          recebedor_nome_snapshot: string | null
          recebedor_previsto_id: string | null
          recebedor_real_id: string | null
          recebido_em: string | null
          status: string
          updated_at: string
          updated_by: string | null
          viagem_id: string
        }
        Insert: {
          assinatura_id?: string | null
          created_at?: string
          created_by?: string | null
          fotos?: Json
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacoes?: string | null
          operado_por_profile_id?: string | null
          parada_id?: string | null
          recebedor_documento_snapshot?: string | null
          recebedor_nome_snapshot?: string | null
          recebedor_previsto_id?: string | null
          recebedor_real_id?: string | null
          recebido_em?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          viagem_id: string
        }
        Update: {
          assinatura_id?: string | null
          created_at?: string
          created_by?: string | null
          fotos?: Json
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacoes?: string | null
          operado_por_profile_id?: string | null
          parada_id?: string | null
          recebedor_documento_snapshot?: string | null
          recebedor_nome_snapshot?: string | null
          recebedor_previsto_id?: string | null
          recebedor_real_id?: string | null
          recebido_em?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          viagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_ct_recebimentos_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "bd_assinaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_recebimentos_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "vw_assinaturas_diarias_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_recebimentos_parada_id_fkey"
            columns: ["parada_id"]
            isOneToOne: false
            referencedRelation: "bd_ct_viagem_paradas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_recebimentos_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "bd_ct_viagens"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ct_viagem_paradas: {
        Row: {
          cc_codigo_snapshot: string | null
          cc_nome_snapshot: string | null
          centro_custo_id: string
          chegada_registrada_em: string | null
          chegada_registrada_por: string | null
          concluida_em: string | null
          created_at: string
          created_by: string | null
          data_prevista: string | null
          endereco_snapshot: string | null
          hora_prevista: string | null
          id: string
          latitude: number | null
          longitude: number | null
          observacao: string | null
          ordem: number
          ponto_exato: string | null
          recebedor_previsto_funcionario_id: string | null
          recebedor_previsto_nome_snapshot: string | null
          status: string
          updated_at: string
          updated_by: string | null
          viagem_id: string
        }
        Insert: {
          cc_codigo_snapshot?: string | null
          cc_nome_snapshot?: string | null
          centro_custo_id: string
          chegada_registrada_em?: string | null
          chegada_registrada_por?: string | null
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          data_prevista?: string | null
          endereco_snapshot?: string | null
          hora_prevista?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacao?: string | null
          ordem: number
          ponto_exato?: string | null
          recebedor_previsto_funcionario_id?: string | null
          recebedor_previsto_nome_snapshot?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          viagem_id: string
        }
        Update: {
          cc_codigo_snapshot?: string | null
          cc_nome_snapshot?: string | null
          centro_custo_id?: string
          chegada_registrada_em?: string | null
          chegada_registrada_por?: string | null
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          data_prevista?: string | null
          endereco_snapshot?: string | null
          hora_prevista?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacao?: string | null
          ordem?: number
          ponto_exato?: string | null
          recebedor_previsto_funcionario_id?: string | null
          recebedor_previsto_nome_snapshot?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          viagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_ct_viagem_paradas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagem_paradas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagem_paradas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagem_paradas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagem_paradas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagem_paradas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagem_paradas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagem_paradas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagem_paradas_recebedor_previsto_funcionario_id_fkey"
            columns: ["recebedor_previsto_funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagem_paradas_recebedor_previsto_funcionario_id_fkey"
            columns: ["recebedor_previsto_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagem_paradas_recebedor_previsto_funcionario_id_fkey"
            columns: ["recebedor_previsto_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagem_paradas_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "bd_ct_viagens"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ct_viagens: {
        Row: {
          chegada_registrada_em: string | null
          chegada_registrada_por: string | null
          codigo: string
          created_at: string
          created_by: string | null
          data_prevista_entrega: string | null
          data_prevista_saida: string | null
          destino_cc_codigo_snapshot: string | null
          destino_cc_endereco_snapshot: string | null
          destino_cc_latitude_snapshot: number | null
          destino_cc_longitude_snapshot: number | null
          destino_cc_nome_snapshot: string | null
          destino_centro_custo_id: string | null
          destino_descarga_latitude: number | null
          destino_descarga_longitude: number | null
          destino_descricao: string | null
          destino_endereco_operacional: string | null
          destino_ponto_exato: string | null
          distancia_km: number | null
          distancia_operacional_km: number | null
          distancia_regra_aplicada: string | null
          distancia_rota_km: number | null
          duracao_rota_min: number | null
          empresa_transportadora_id: string | null
          empresa_transportadora_nome_snapshot: string | null
          finalizada_em: string | null
          id: string
          modalidade_deslocamento: string | null
          motorista_cpf_snapshot: string | null
          motorista_id: string | null
          motorista_nome_snapshot: string | null
          observacoes: string | null
          origem_cc_codigo_snapshot: string | null
          origem_cc_endereco_snapshot: string | null
          origem_cc_latitude_snapshot: number | null
          origem_cc_longitude_snapshot: number | null
          origem_cc_nome_snapshot: string | null
          origem_centro_custo_id: string | null
          origem_coleta_latitude: number | null
          origem_coleta_longitude: number | null
          origem_descricao: string | null
          origem_endereco_operacional: string | null
          origem_fluxo: string
          origem_ponto_exato: string | null
          placa_transportador_snapshot: string | null
          planejamento_id: string | null
          recebedor_previsto_funcionario_id: string | null
          recebedor_previsto_nome_snapshot: string | null
          recebedor_previsto_telefone_snapshot: string | null
          responsavel_transporte: string | null
          rota_geometria: Json | null
          rota_resumo: string | null
          solicitacao_id: string | null
          status: string
          tipo_transporte: string | null
          transportadora: string | null
          transporte_iniciado_em: string | null
          transporte_iniciado_por: string | null
          updated_at: string
          updated_by: string | null
          veiculo_transportador_id: string | null
        }
        Insert: {
          chegada_registrada_em?: string | null
          chegada_registrada_por?: string | null
          codigo?: string
          created_at?: string
          created_by?: string | null
          data_prevista_entrega?: string | null
          data_prevista_saida?: string | null
          destino_cc_codigo_snapshot?: string | null
          destino_cc_endereco_snapshot?: string | null
          destino_cc_latitude_snapshot?: number | null
          destino_cc_longitude_snapshot?: number | null
          destino_cc_nome_snapshot?: string | null
          destino_centro_custo_id?: string | null
          destino_descarga_latitude?: number | null
          destino_descarga_longitude?: number | null
          destino_descricao?: string | null
          destino_endereco_operacional?: string | null
          destino_ponto_exato?: string | null
          distancia_km?: number | null
          distancia_operacional_km?: number | null
          distancia_regra_aplicada?: string | null
          distancia_rota_km?: number | null
          duracao_rota_min?: number | null
          empresa_transportadora_id?: string | null
          empresa_transportadora_nome_snapshot?: string | null
          finalizada_em?: string | null
          id?: string
          modalidade_deslocamento?: string | null
          motorista_cpf_snapshot?: string | null
          motorista_id?: string | null
          motorista_nome_snapshot?: string | null
          observacoes?: string | null
          origem_cc_codigo_snapshot?: string | null
          origem_cc_endereco_snapshot?: string | null
          origem_cc_latitude_snapshot?: number | null
          origem_cc_longitude_snapshot?: number | null
          origem_cc_nome_snapshot?: string | null
          origem_centro_custo_id?: string | null
          origem_coleta_latitude?: number | null
          origem_coleta_longitude?: number | null
          origem_descricao?: string | null
          origem_endereco_operacional?: string | null
          origem_fluxo?: string
          origem_ponto_exato?: string | null
          placa_transportador_snapshot?: string | null
          planejamento_id?: string | null
          recebedor_previsto_funcionario_id?: string | null
          recebedor_previsto_nome_snapshot?: string | null
          recebedor_previsto_telefone_snapshot?: string | null
          responsavel_transporte?: string | null
          rota_geometria?: Json | null
          rota_resumo?: string | null
          solicitacao_id?: string | null
          status?: string
          tipo_transporte?: string | null
          transportadora?: string | null
          transporte_iniciado_em?: string | null
          transporte_iniciado_por?: string | null
          updated_at?: string
          updated_by?: string | null
          veiculo_transportador_id?: string | null
        }
        Update: {
          chegada_registrada_em?: string | null
          chegada_registrada_por?: string | null
          codigo?: string
          created_at?: string
          created_by?: string | null
          data_prevista_entrega?: string | null
          data_prevista_saida?: string | null
          destino_cc_codigo_snapshot?: string | null
          destino_cc_endereco_snapshot?: string | null
          destino_cc_latitude_snapshot?: number | null
          destino_cc_longitude_snapshot?: number | null
          destino_cc_nome_snapshot?: string | null
          destino_centro_custo_id?: string | null
          destino_descarga_latitude?: number | null
          destino_descarga_longitude?: number | null
          destino_descricao?: string | null
          destino_endereco_operacional?: string | null
          destino_ponto_exato?: string | null
          distancia_km?: number | null
          distancia_operacional_km?: number | null
          distancia_regra_aplicada?: string | null
          distancia_rota_km?: number | null
          duracao_rota_min?: number | null
          empresa_transportadora_id?: string | null
          empresa_transportadora_nome_snapshot?: string | null
          finalizada_em?: string | null
          id?: string
          modalidade_deslocamento?: string | null
          motorista_cpf_snapshot?: string | null
          motorista_id?: string | null
          motorista_nome_snapshot?: string | null
          observacoes?: string | null
          origem_cc_codigo_snapshot?: string | null
          origem_cc_endereco_snapshot?: string | null
          origem_cc_latitude_snapshot?: number | null
          origem_cc_longitude_snapshot?: number | null
          origem_cc_nome_snapshot?: string | null
          origem_centro_custo_id?: string | null
          origem_coleta_latitude?: number | null
          origem_coleta_longitude?: number | null
          origem_descricao?: string | null
          origem_endereco_operacional?: string | null
          origem_fluxo?: string
          origem_ponto_exato?: string | null
          placa_transportador_snapshot?: string | null
          planejamento_id?: string | null
          recebedor_previsto_funcionario_id?: string | null
          recebedor_previsto_nome_snapshot?: string | null
          recebedor_previsto_telefone_snapshot?: string | null
          responsavel_transporte?: string | null
          rota_geometria?: Json | null
          rota_resumo?: string | null
          solicitacao_id?: string | null
          status?: string
          tipo_transporte?: string | null
          transportadora?: string | null
          transporte_iniciado_em?: string | null
          transporte_iniciado_por?: string | null
          updated_at?: string
          updated_by?: string | null
          veiculo_transportador_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_ct_viagens_destino_centro_custo_id_fkey"
            columns: ["destino_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_destino_centro_custo_id_fkey"
            columns: ["destino_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_destino_centro_custo_id_fkey"
            columns: ["destino_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_destino_centro_custo_id_fkey"
            columns: ["destino_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_destino_centro_custo_id_fkey"
            columns: ["destino_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_destino_centro_custo_id_fkey"
            columns: ["destino_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_destino_centro_custo_id_fkey"
            columns: ["destino_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_destino_centro_custo_id_fkey"
            columns: ["destino_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_empresa_transportadora_id_fkey"
            columns: ["empresa_transportadora_id"]
            isOneToOne: false
            referencedRelation: "bd_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_origem_centro_custo_id_fkey"
            columns: ["origem_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_origem_centro_custo_id_fkey"
            columns: ["origem_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_origem_centro_custo_id_fkey"
            columns: ["origem_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_origem_centro_custo_id_fkey"
            columns: ["origem_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_origem_centro_custo_id_fkey"
            columns: ["origem_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_origem_centro_custo_id_fkey"
            columns: ["origem_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_origem_centro_custo_id_fkey"
            columns: ["origem_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_origem_centro_custo_id_fkey"
            columns: ["origem_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_recebedor_previsto_funcionario_id_fkey"
            columns: ["recebedor_previsto_funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_recebedor_previsto_funcionario_id_fkey"
            columns: ["recebedor_previsto_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_recebedor_previsto_funcionario_id_fkey"
            columns: ["recebedor_previsto_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_equipamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_veiculo_transportador_id_fkey"
            columns: ["veiculo_transportador_id"]
            isOneToOne: false
            referencedRelation: "bd_caminhoes_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_veiculo_transportador_id_fkey"
            columns: ["veiculo_transportador_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ct_viagens_veiculo_transportador_id_fkey"
            columns: ["veiculo_transportador_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ct_viagens_planejamento"
            columns: ["planejamento_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_planejamento"
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
            foreignKeyName: "bd_custos_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_custos_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
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
          {
            foreignKeyName: "bd_desligamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_desligamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_diaria_aditivos: {
        Row: {
          conflito_solicitacao_id: string | null
          created_at: string
          data_ajustada: string
          decidido_em: string | null
          decidido_por: string | null
          funcionario_id: string | null
          funcionarios_adicionados: Json | null
          funcionarios_removidos: Json | null
          id: string
          impacto_financeiro: Json | null
          justificativa: string
          notificacao_id: string | null
          observacao_aprovador: string | null
          retroativo: boolean
          snapshot_funcionario: Json | null
          solicitacao_id: string
          solicitado_em: string
          solicitado_por: string
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          conflito_solicitacao_id?: string | null
          created_at?: string
          data_ajustada: string
          decidido_em?: string | null
          decidido_por?: string | null
          funcionario_id?: string | null
          funcionarios_adicionados?: Json | null
          funcionarios_removidos?: Json | null
          id?: string
          impacto_financeiro?: Json | null
          justificativa: string
          notificacao_id?: string | null
          observacao_aprovador?: string | null
          retroativo?: boolean
          snapshot_funcionario?: Json | null
          solicitacao_id: string
          solicitado_em?: string
          solicitado_por: string
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          conflito_solicitacao_id?: string | null
          created_at?: string
          data_ajustada?: string
          decidido_em?: string | null
          decidido_por?: string | null
          funcionario_id?: string | null
          funcionarios_adicionados?: Json | null
          funcionarios_removidos?: Json | null
          id?: string
          impacto_financeiro?: Json | null
          justificativa?: string
          notificacao_id?: string | null
          observacao_aprovador?: string | null
          retroativo?: boolean
          snapshot_funcionario?: Json | null
          solicitacao_id?: string
          solicitado_em?: string
          solicitado_por?: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_diaria_aditivos_conflito_solicitacao_id_fkey"
            columns: ["conflito_solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_aditivos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_aditivos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_aditivos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_aditivos_notificacao_id_fkey"
            columns: ["notificacao_id"]
            isOneToOne: false
            referencedRelation: "bd_notificacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_aditivos_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
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
            foreignKeyName: "bd_diaria_apontamentos_responsavel_campo_id_fkey"
            columns: ["responsavel_campo_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_apontamentos_responsavel_campo_id_fkey"
            columns: ["responsavel_campo_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
      bd_diaria_calendario_operacional: {
        Row: {
          ativo: boolean
          created_at: string
          data: string
          descricao: string | null
          escopo_id: string | null
          escopo_tipo: string
          exige_aprovacao_adicao: boolean
          id: string
          permite_remessa_matriculados: boolean
          tipo_dia_operacional: string
          updated_at: string
          usa_diaria_exclusiva: boolean
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data: string
          descricao?: string | null
          escopo_id?: string | null
          escopo_tipo: string
          exige_aprovacao_adicao?: boolean
          id?: string
          permite_remessa_matriculados?: boolean
          tipo_dia_operacional?: string
          updated_at?: string
          usa_diaria_exclusiva?: boolean
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data?: string
          descricao?: string | null
          escopo_id?: string | null
          escopo_tipo?: string
          exige_aprovacao_adicao?: boolean
          id?: string
          permite_remessa_matriculados?: boolean
          tipo_dia_operacional?: string
          updated_at?: string
          usa_diaria_exclusiva?: boolean
        }
        Relationships: []
      }
      bd_diaria_excecao_solicitacoes: {
        Row: {
          created_at: string | null
          data: string
          funcionario_id: string
          id: string
          justificativa: string
          observacao_resolucao: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          solicitacao_destino_id: string
          solicitacao_origem_id: string
          solicitado_por: string
          status: string
        }
        Insert: {
          created_at?: string | null
          data: string
          funcionario_id: string
          id?: string
          justificativa: string
          observacao_resolucao?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          solicitacao_destino_id: string
          solicitacao_origem_id: string
          solicitado_por: string
          status?: string
        }
        Update: {
          created_at?: string | null
          data?: string
          funcionario_id?: string
          id?: string
          justificativa?: string
          observacao_resolucao?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          solicitacao_destino_id?: string
          solicitacao_origem_id?: string
          solicitado_por?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_diaria_excecao_solicitacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_excecao_solicitacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_excecao_solicitacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_excecao_solicitacoes_solicitacao_destino_id_fkey"
            columns: ["solicitacao_destino_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_excecao_solicitacoes_solicitacao_origem_id_fkey"
            columns: ["solicitacao_origem_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
            referencedColumns: ["id"]
          },
        ]
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
      bd_diaria_lote_funcionarios: {
        Row: {
          cpf_snap: string | null
          created_at: string
          data: string
          extras: Json
          funcao_id: string
          funcionario_id: string
          id: string
          lote_id: string
          matricula_snap: string | null
          nome_funcao_snap: string
          nome_funcionario_snap: string
          solicitacao_id: string
          status: Database["public"]["Enums"]["diaria_lote_item_status"]
          updated_at: string
          usar_diaria_exclusiva: boolean
          valor_diaria: number
          valor_diaria_exclusiva: number | null
          valor_refeicao: number
        }
        Insert: {
          cpf_snap?: string | null
          created_at?: string
          data: string
          extras?: Json
          funcao_id: string
          funcionario_id: string
          id?: string
          lote_id: string
          matricula_snap?: string | null
          nome_funcao_snap: string
          nome_funcionario_snap: string
          solicitacao_id: string
          status?: Database["public"]["Enums"]["diaria_lote_item_status"]
          updated_at?: string
          usar_diaria_exclusiva?: boolean
          valor_diaria: number
          valor_diaria_exclusiva?: number | null
          valor_refeicao?: number
        }
        Update: {
          cpf_snap?: string | null
          created_at?: string
          data?: string
          extras?: Json
          funcao_id?: string
          funcionario_id?: string
          id?: string
          lote_id?: string
          matricula_snap?: string | null
          nome_funcao_snap?: string
          nome_funcionario_snap?: string
          solicitacao_id?: string
          status?: Database["public"]["Enums"]["diaria_lote_item_status"]
          updated_at?: string
          usar_diaria_exclusiva?: boolean
          valor_diaria?: number
          valor_diaria_exclusiva?: number | null
          valor_refeicao?: number
        }
        Relationships: [
          {
            foreignKeyName: "bd_diaria_lote_funcionarios_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_lotes_convocacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_lote_funcionarios_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_diaria_lotes_convocacao: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          assinatura_aprovacao_png: string | null
          assinatura_hash: string | null
          cancelado_em: string | null
          criado_em: string
          criado_por: string
          enviado_aprovacao_em: string | null
          id: string
          metadata: Json
          motivo_cancelamento: string | null
          motivo_rejeicao: string | null
          nome: string | null
          origem: Database["public"]["Enums"]["diaria_lote_origem"]
          rejeitado_em: string | null
          rejeitado_por: string | null
          solicitacao_id: string
          status: Database["public"]["Enums"]["diaria_lote_status"]
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          assinatura_aprovacao_png?: string | null
          assinatura_hash?: string | null
          cancelado_em?: string | null
          criado_em?: string
          criado_por: string
          enviado_aprovacao_em?: string | null
          id?: string
          metadata?: Json
          motivo_cancelamento?: string | null
          motivo_rejeicao?: string | null
          nome?: string | null
          origem: Database["public"]["Enums"]["diaria_lote_origem"]
          rejeitado_em?: string | null
          rejeitado_por?: string | null
          solicitacao_id: string
          status?: Database["public"]["Enums"]["diaria_lote_status"]
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          assinatura_aprovacao_png?: string | null
          assinatura_hash?: string | null
          cancelado_em?: string | null
          criado_em?: string
          criado_por?: string
          enviado_aprovacao_em?: string | null
          id?: string
          metadata?: Json
          motivo_cancelamento?: string | null
          motivo_rejeicao?: string | null
          nome?: string | null
          origem?: Database["public"]["Enums"]["diaria_lote_origem"]
          rejeitado_em?: string | null
          rejeitado_por?: string | null
          solicitacao_id?: string
          status?: Database["public"]["Enums"]["diaria_lote_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bd_diaria_lotes_convocacao_solicitacao_id_fkey"
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
          conflito_solicitacao_id: string | null
          created_at: string | null
          data: string
          excecao_aprovada_em: string | null
          excecao_aprovada_por: string | null
          funcao_id: string | null
          funcionario_id: string
          hora_entrada: string | null
          hora_saida: string | null
          id: string
          intervalo_fim: string | null
          intervalo_inicio: string | null
          is_excecao: boolean
          justificativa_excecao: string | null
          modificado_por: string | null
          observacoes: string | null
          origem: string
          origem_batida_id: string | null
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
          conflito_solicitacao_id?: string | null
          created_at?: string | null
          data: string
          excecao_aprovada_em?: string | null
          excecao_aprovada_por?: string | null
          funcao_id?: string | null
          funcionario_id: string
          hora_entrada?: string | null
          hora_saida?: string | null
          id?: string
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          is_excecao?: boolean
          justificativa_excecao?: string | null
          modificado_por?: string | null
          observacoes?: string | null
          origem?: string
          origem_batida_id?: string | null
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
          conflito_solicitacao_id?: string | null
          created_at?: string | null
          data?: string
          excecao_aprovada_em?: string | null
          excecao_aprovada_por?: string | null
          funcao_id?: string | null
          funcionario_id?: string
          hora_entrada?: string | null
          hora_saida?: string | null
          id?: string
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          is_excecao?: boolean
          justificativa_excecao?: string | null
          modificado_por?: string | null
          observacoes?: string | null
          origem?: string
          origem_batida_id?: string | null
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
            foreignKeyName: "bd_diaria_presencas_conflito_solicitacao_id_fkey"
            columns: ["conflito_solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
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
            foreignKeyName: "bd_diaria_presencas_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "vw_funcoes_publicas"
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
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_origem_batida_id_fkey"
            columns: ["origem_batida_id"]
            isOneToOne: false
            referencedRelation: "bd_ponto_batidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_origem_batida_id_fkey"
            columns: ["origem_batida_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_batidas_gestao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_origem_batida_id_fkey"
            columns: ["origem_batida_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_batidas_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_origem_batida_id_fkey"
            columns: ["origem_batida_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_batidas_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_origem_batida_id_fkey"
            columns: ["origem_batida_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_logs_antifraude_seguro"
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
      bd_diaria_relatorio_auditoria: {
        Row: {
          acao: string
          arquivo_nome: string | null
          centro_custo_id: string | null
          contexto: string
          created_at: string
          filtros: Json
          formato: string | null
          id: string
          periodo_fim: string | null
          periodo_inicio: string | null
          quantidade_registros: number | null
          solicitacao_id: string | null
          user_id: string
        }
        Insert: {
          acao: string
          arquivo_nome?: string | null
          centro_custo_id?: string | null
          contexto: string
          created_at?: string
          filtros?: Json
          formato?: string | null
          id?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          quantidade_registros?: number | null
          solicitacao_id?: string | null
          user_id: string
        }
        Update: {
          acao?: string
          arquivo_nome?: string | null
          centro_custo_id?: string | null
          contexto?: string
          created_at?: string
          filtros?: Json
          formato?: string | null
          id?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          quantidade_registros?: number | null
          solicitacao_id?: string | null
          user_id?: string
        }
        Relationships: []
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
          lotes_modelo_relacional_ativo: boolean
          modificado_por: string | null
          motor_aprovacao: string
          numero_solicitacao: string
          observacao_gerente: string | null
          qtde_dias_uteis_estimado: number | null
          qtde_fds_estimado: number | null
          qtde_feriados_estimado: number | null
          regras_operacionais_snapshot: Json
          responsavel_campo_id: string | null
          status: string
          status_fluxo: string | null
          tipo_envio: string | null
          tipo_solicitacao: string
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
          lotes_modelo_relacional_ativo?: boolean
          modificado_por?: string | null
          motor_aprovacao?: string
          numero_solicitacao: string
          observacao_gerente?: string | null
          qtde_dias_uteis_estimado?: number | null
          qtde_fds_estimado?: number | null
          qtde_feriados_estimado?: number | null
          regras_operacionais_snapshot?: Json
          responsavel_campo_id?: string | null
          status?: string
          status_fluxo?: string | null
          tipo_envio?: string | null
          tipo_solicitacao?: string
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
          lotes_modelo_relacional_ativo?: boolean
          modificado_por?: string | null
          motor_aprovacao?: string
          numero_solicitacao?: string
          observacao_gerente?: string | null
          qtde_dias_uteis_estimado?: number | null
          qtde_fds_estimado?: number | null
          qtde_feriados_estimado?: number | null
          regras_operacionais_snapshot?: Json
          responsavel_campo_id?: string | null
          status?: string
          status_fluxo?: string | null
          tipo_envio?: string | null
          tipo_solicitacao?: string
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
            foreignKeyName: "bd_diaria_solicitacoes_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_responsavel_campo_id_fkey"
            columns: ["responsavel_campo_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_responsavel_campo_id_fkey"
            columns: ["responsavel_campo_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_responsavel_campo_id_fkey"
            columns: ["responsavel_campo_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
          {
            foreignKeyName: "bd_diretorias_diretor_id_fkey"
            columns: ["diretor_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diretorias_diretor_id_fkey"
            columns: ["diretor_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
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
            foreignKeyName: "bd_documentos_relacao_documento_filho_id_fkey"
            columns: ["documento_filho_id"]
            isOneToOne: false
            referencedRelation: "vw_documentos_fluxo_diarias_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_documentos_relacao_documento_pai_id_fkey"
            columns: ["documento_pai_id"]
            isOneToOne: false
            referencedRelation: "bd_documentos_fluxo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_documentos_relacao_documento_pai_id_fkey"
            columns: ["documento_pai_id"]
            isOneToOne: false
            referencedRelation: "vw_documentos_fluxo_diarias_seguro"
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
          endereco_normalizado: string | null
          fornece_equipamento: boolean | null
          geocoding_relevance: number | null
          geocoding_source: string | null
          geocoding_status: string | null
          geocoding_updated_at: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logo_url: string | null
          mapbox_place_name: string | null
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
          endereco_normalizado?: string | null
          fornece_equipamento?: boolean | null
          geocoding_relevance?: number | null
          geocoding_source?: string | null
          geocoding_status?: string | null
          geocoding_updated_at?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logo_url?: string | null
          mapbox_place_name?: string | null
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
          endereco_normalizado?: string | null
          fornece_equipamento?: boolean | null
          geocoding_relevance?: number | null
          geocoding_source?: string | null
          geocoding_status?: string | null
          geocoding_updated_at?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logo_url?: string | null
          mapbox_place_name?: string | null
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
            foreignKeyName: "bd_envios_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "vw_documentos_fluxo_diarias_seguro"
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
            foreignKeyName: "bd_equipes_apontador_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_equipes_apontador_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_equipes_encarregado_id_fkey"
            columns: ["encarregado_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_equipes_encarregado_id_fkey"
            columns: ["encarregado_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "fk_equipes_apontador"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_equipes_apontador"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_equipes_encarregado"
            columns: ["encarregado_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_equipes_encarregado"
            columns: ["encarregado_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_equipes_encarregado"
            columns: ["encarregado_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_fluxo_centro_custo_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_fluxo_centro_custo_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_fluxo_centro_custo_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_fluxo_centro_custo_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_fluxo_centro_custo_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
          permission_id: string | null
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
          permission_id?: string | null
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
          permission_id?: string | null
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
          {
            foreignKeyName: "bd_fluxo_etapas_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "bd_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_fluxo_etapas_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "vw_rbac_permissions_safe"
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
      bd_funcionario_classificacao_solicitacoes: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          cancelado_em: string | null
          cancelado_por: string | null
          cargo_atual_id: string | null
          cargo_atual_nome: string | null
          cargo_novo_id: string
          cargo_novo_nome: string
          centro_custo_id: string
          created_at: string
          data_efetivacao_desejada: string | null
          efetivado_em: string | null
          efetivado_por: string | null
          funcionario_id: string
          historico_funcional_id: string | null
          id: string
          motivo: string
          motivo_rejeicao: string | null
          observacao: string | null
          precisa_exame: boolean
          salario_atual: number | null
          salario_novo: number | null
          solicitacao_lote_id: string | null
          solicitado_em: string
          solicitado_por: string
          status: string
          updated_at: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          cargo_atual_id?: string | null
          cargo_atual_nome?: string | null
          cargo_novo_id: string
          cargo_novo_nome: string
          centro_custo_id: string
          created_at?: string
          data_efetivacao_desejada?: string | null
          efetivado_em?: string | null
          efetivado_por?: string | null
          funcionario_id: string
          historico_funcional_id?: string | null
          id?: string
          motivo: string
          motivo_rejeicao?: string | null
          observacao?: string | null
          precisa_exame?: boolean
          salario_atual?: number | null
          salario_novo?: number | null
          solicitacao_lote_id?: string | null
          solicitado_em?: string
          solicitado_por?: string
          status?: string
          updated_at?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          cargo_atual_id?: string | null
          cargo_atual_nome?: string | null
          cargo_novo_id?: string
          cargo_novo_nome?: string
          centro_custo_id?: string
          created_at?: string
          data_efetivacao_desejada?: string | null
          efetivado_em?: string | null
          efetivado_por?: string | null
          funcionario_id?: string
          historico_funcional_id?: string | null
          id?: string
          motivo?: string
          motivo_rejeicao?: string | null
          observacao?: string | null
          precisa_exame?: boolean
          salario_atual?: number | null
          salario_novo?: number | null
          solicitacao_lote_id?: string | null
          solicitado_em?: string
          solicitado_por?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_funcionario_classificacao_solici_historico_funcional_id_fkey"
            columns: ["historico_funcional_id"]
            isOneToOne: false
            referencedRelation: "bd_historico_funcional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionario_classificacao_solicitacoes_cargo_atual_id_fkey"
            columns: ["cargo_atual_id"]
            isOneToOne: false
            referencedRelation: "bd_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionario_classificacao_solicitacoes_cargo_atual_id_fkey"
            columns: ["cargo_atual_id"]
            isOneToOne: false
            referencedRelation: "vw_funcoes_publicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionario_classificacao_solicitacoes_cargo_novo_id_fkey"
            columns: ["cargo_novo_id"]
            isOneToOne: false
            referencedRelation: "bd_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionario_classificacao_solicitacoes_cargo_novo_id_fkey"
            columns: ["cargo_novo_id"]
            isOneToOne: false
            referencedRelation: "vw_funcoes_publicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionario_classificacao_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionario_classificacao_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionario_classificacao_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionario_classificacao_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionario_classificacao_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionario_classificacao_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionario_classificacao_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionario_classificacao_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionario_classificacao_solicitacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionario_classificacao_solicitacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionario_classificacao_solicitacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fcs_solicitacao_lote"
            columns: ["solicitacao_lote_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_classificacao"
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
          {
            foreignKeyName: "bd_funcionario_status_historico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionario_status_historico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_funcionarios: {
        Row: {
          adicional_noturno: number | null
          agencia: string | null
          assinatura_hash: string | null
          assinatura_updated_at: string | null
          assinatura_url: string | null
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
          endereco_normalizado: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          equipe_id: string | null
          escolaridade: string | null
          funcao_id: string | null
          genero: string | null
          geocoding_relevance: number | null
          geocoding_source: string | null
          geocoding_status: string | null
          geocoding_updated_at: string | null
          gratificacao: number | null
          id: string
          imagem: string | null
          insalubridade: number | null
          latitude: number | null
          longitude: number | null
          mapbox_place_name: string | null
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
          assinatura_hash?: string | null
          assinatura_updated_at?: string | null
          assinatura_url?: string | null
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
          endereco_normalizado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          equipe_id?: string | null
          escolaridade?: string | null
          funcao_id?: string | null
          genero?: string | null
          geocoding_relevance?: number | null
          geocoding_source?: string | null
          geocoding_status?: string | null
          geocoding_updated_at?: string | null
          gratificacao?: number | null
          id?: string
          imagem?: string | null
          insalubridade?: number | null
          latitude?: number | null
          longitude?: number | null
          mapbox_place_name?: string | null
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
          assinatura_hash?: string | null
          assinatura_updated_at?: string | null
          assinatura_url?: string | null
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
          endereco_normalizado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          equipe_id?: string | null
          escolaridade?: string | null
          funcao_id?: string | null
          genero?: string | null
          geocoding_relevance?: number | null
          geocoding_source?: string | null
          geocoding_status?: string | null
          geocoding_updated_at?: string | null
          gratificacao?: number | null
          id?: string
          imagem?: string | null
          insalubridade?: number | null
          latitude?: number | null
          longitude?: number | null
          mapbox_place_name?: string | null
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
          {
            foreignKeyName: "bd_funcionarios_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "vw_funcoes_publicas"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_funcionarios_biometria_facial: {
        Row: {
          ativo: boolean
          cadastrado_por_user_id: string | null
          created_at: string
          descriptor: string
          dispositivo_origem_id: string | null
          foto_url: string | null
          funcionario_id: string
          id: string
          origem: string
          pose: string | null
          principal: boolean | null
          qualidade_score: number | null
          status_validacao: string
          updated_at: string
          validado_em: string | null
          validado_por_user_id: string | null
          versao_cadastro: number | null
        }
        Insert: {
          ativo?: boolean
          cadastrado_por_user_id?: string | null
          created_at?: string
          descriptor: string
          dispositivo_origem_id?: string | null
          foto_url?: string | null
          funcionario_id: string
          id?: string
          origem: string
          pose?: string | null
          principal?: boolean | null
          qualidade_score?: number | null
          status_validacao?: string
          updated_at?: string
          validado_em?: string | null
          validado_por_user_id?: string | null
          versao_cadastro?: number | null
        }
        Update: {
          ativo?: boolean
          cadastrado_por_user_id?: string | null
          created_at?: string
          descriptor?: string
          dispositivo_origem_id?: string | null
          foto_url?: string | null
          funcionario_id?: string
          id?: string
          origem?: string
          pose?: string | null
          principal?: boolean | null
          qualidade_score?: number | null
          status_validacao?: string
          updated_at?: string
          validado_em?: string | null
          validado_por_user_id?: string | null
          versao_cadastro?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_funcionarios_biometria_facial_dispositivo_origem_id_fkey"
            columns: ["dispositivo_origem_id"]
            isOneToOne: false
            referencedRelation: "bd_ponto_dispositivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionarios_biometria_facial_dispositivo_origem_id_fkey"
            columns: ["dispositivo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_dispositivos_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionarios_biometria_facial_dispositivo_origem_id_fkey"
            columns: ["dispositivo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_dispositivos_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionarios_biometria_facial_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionarios_biometria_facial_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionarios_biometria_facial_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_funcionarios_sensivel: {
        Row: {
          adicional_noturno: number | null
          agencia: string | null
          banco: string | null
          chave_pix: string | null
          conta_corrente: string | null
          cpf: string | null
          cpf_hash: string | null
          created_at: string
          custo_passagem: number | null
          data_nascimento: string | null
          diarias: number | null
          email: string | null
          email_hash: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_completo: string | null
          endereco_estado: string | null
          endereco_normalizado: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          funcionario_id: string
          geocoding_relevance: number | null
          geocoding_source: string | null
          geocoding_status: string | null
          geocoding_updated_at: string | null
          gratificacao: number | null
          id: string
          imagem: string | null
          insalubridade: number | null
          latitude: number | null
          longitude: number | null
          mapbox_place_name: string | null
          modificado_por: string | null
          observacoes: string | null
          periculosidade: number | null
          pix_hash: string | null
          refeicao: number | null
          salario_base: number | null
          updated_at: string
        }
        Insert: {
          adicional_noturno?: number | null
          agencia?: string | null
          banco?: string | null
          chave_pix?: string | null
          conta_corrente?: string | null
          cpf?: string | null
          cpf_hash?: string | null
          created_at?: string
          custo_passagem?: number | null
          data_nascimento?: string | null
          diarias?: number | null
          email?: string | null
          email_hash?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_completo?: string | null
          endereco_estado?: string | null
          endereco_normalizado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          funcionario_id: string
          geocoding_relevance?: number | null
          geocoding_source?: string | null
          geocoding_status?: string | null
          geocoding_updated_at?: string | null
          gratificacao?: number | null
          id?: string
          imagem?: string | null
          insalubridade?: number | null
          latitude?: number | null
          longitude?: number | null
          mapbox_place_name?: string | null
          modificado_por?: string | null
          observacoes?: string | null
          periculosidade?: number | null
          pix_hash?: string | null
          refeicao?: number | null
          salario_base?: number | null
          updated_at?: string
        }
        Update: {
          adicional_noturno?: number | null
          agencia?: string | null
          banco?: string | null
          chave_pix?: string | null
          conta_corrente?: string | null
          cpf?: string | null
          cpf_hash?: string | null
          created_at?: string
          custo_passagem?: number | null
          data_nascimento?: string | null
          diarias?: number | null
          email?: string | null
          email_hash?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_completo?: string | null
          endereco_estado?: string | null
          endereco_normalizado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          funcionario_id?: string
          geocoding_relevance?: number | null
          geocoding_source?: string | null
          geocoding_status?: string | null
          geocoding_updated_at?: string | null
          gratificacao?: number | null
          id?: string
          imagem?: string | null
          insalubridade?: number | null
          latitude?: number | null
          longitude?: number | null
          mapbox_place_name?: string | null
          modificado_por?: string | null
          observacoes?: string | null
          periculosidade?: number | null
          pix_hash?: string | null
          refeicao?: number | null
          salario_base?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_funcionarios_sensivel_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: true
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionarios_sensivel_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: true
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionarios_sensivel_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: true
            referencedRelation: "vw_funcionarios_rh"
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
      bd_geocoding_falhas: {
        Row: {
          contexto: string | null
          created_at: string
          detalhes: Json | null
          endereco_normalizado: string | null
          endereco_original: string | null
          id: string
          motivo: string
          user_id: string | null
        }
        Insert: {
          contexto?: string | null
          created_at?: string
          detalhes?: Json | null
          endereco_normalizado?: string | null
          endereco_original?: string | null
          id?: string
          motivo: string
          user_id?: string | null
        }
        Update: {
          contexto?: string | null
          created_at?: string
          detalhes?: Json | null
          endereco_normalizado?: string | null
          endereco_original?: string | null
          id?: string
          motivo?: string
          user_id?: string | null
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
          agendamento_exame_id: string | null
          cargo_anterior: string | null
          cargo_novo: string | null
          cargo_novo_id: string | null
          centro_custo_anterior: string | null
          centro_custo_novo: string | null
          created_at: string
          data_efetivacao: string | null
          diferenca_percentual: number | null
          diferenca_valor: number | null
          funcionario_id: string
          id: string
          motivo: string | null
          percentual_aumento: number | null
          precisa_exame: boolean | null
          salario_anterior: number | null
          salario_novo: number | null
          tipo_evento: string
        }
        Insert: {
          agendamento_exame_id?: string | null
          cargo_anterior?: string | null
          cargo_novo?: string | null
          cargo_novo_id?: string | null
          centro_custo_anterior?: string | null
          centro_custo_novo?: string | null
          created_at?: string
          data_efetivacao?: string | null
          diferenca_percentual?: number | null
          diferenca_valor?: number | null
          funcionario_id: string
          id?: string
          motivo?: string | null
          percentual_aumento?: number | null
          precisa_exame?: boolean | null
          salario_anterior?: number | null
          salario_novo?: number | null
          tipo_evento: string
        }
        Update: {
          agendamento_exame_id?: string | null
          cargo_anterior?: string | null
          cargo_novo?: string | null
          cargo_novo_id?: string | null
          centro_custo_anterior?: string | null
          centro_custo_novo?: string | null
          created_at?: string
          data_efetivacao?: string | null
          diferenca_percentual?: number | null
          diferenca_valor?: number | null
          funcionario_id?: string
          id?: string
          motivo?: string | null
          percentual_aumento?: number | null
          precisa_exame?: boolean | null
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
          {
            foreignKeyName: "bd_historico_funcional_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_historico_funcional_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_hist_agendamento_exame"
            columns: ["agendamento_exame_id"]
            isOneToOne: false
            referencedRelation: "bd_agendamentos_exames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_hist_cargo_novo"
            columns: ["cargo_novo_id"]
            isOneToOne: false
            referencedRelation: "bd_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_hist_cargo_novo"
            columns: ["cargo_novo_id"]
            isOneToOne: false
            referencedRelation: "vw_funcoes_publicas"
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_importacao_alterdata_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_importacao_alterdata_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_importacao_alterdata_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_importacao_alterdata_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_importacao_alterdata_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
          {
            foreignKeyName: "bd_importacao_alterdata_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "vw_funcoes_publicas"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_importador_v2_execucoes: {
        Row: {
          arquivo_nome: string | null
          arquivo_sha256: string
          encerrado_em: string | null
          execucao_anterior_id: string | null
          execution_id: string
          iniciado_em: string
          iniciado_por: string | null
          resumo: Json | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_sha256: string
          encerrado_em?: string | null
          execucao_anterior_id?: string | null
          execution_id?: string
          iniciado_em?: string
          iniciado_por?: string | null
          resumo?: Json | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_sha256?: string
          encerrado_em?: string | null
          execucao_anterior_id?: string | null
          execution_id?: string
          iniciado_em?: string
          iniciado_por?: string | null
          resumo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_importador_v2_execucoes_execucao_anterior_id_fkey"
            columns: ["execucao_anterior_id"]
            isOneToOne: false
            referencedRelation: "bd_importador_v2_execucoes"
            referencedColumns: ["execution_id"]
          },
        ]
      }
      bd_importador_v2_linhas_processadas: {
        Row: {
          arquivo_sha256: string
          codigo_ativo_canonico: string
          created_at: string
          equipamento_id: string | null
          execucao_anterior_id: string | null
          execution_id: string
          id: string
          linha_excel: number
          mensagem: string | null
          payload_gravado: Json | null
          status: string
          tentativa: number
        }
        Insert: {
          arquivo_sha256: string
          codigo_ativo_canonico: string
          created_at?: string
          equipamento_id?: string | null
          execucao_anterior_id?: string | null
          execution_id: string
          id?: string
          linha_excel: number
          mensagem?: string | null
          payload_gravado?: Json | null
          status: string
          tentativa?: number
        }
        Update: {
          arquivo_sha256?: string
          codigo_ativo_canonico?: string
          created_at?: string
          equipamento_id?: string | null
          execucao_anterior_id?: string | null
          execution_id?: string
          id?: string
          linha_excel?: number
          mensagem?: string | null
          payload_gravado?: Json | null
          status?: string
          tentativa?: number
        }
        Relationships: [
          {
            foreignKeyName: "bd_importador_v2_linhas_processadas_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_caminhoes_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_importador_v2_linhas_processadas_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_importador_v2_linhas_processadas_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_importador_v2_linhas_processadas_execucao_anterior_id_fkey"
            columns: ["execucao_anterior_id"]
            isOneToOne: false
            referencedRelation: "bd_importador_v2_execucoes"
            referencedColumns: ["execution_id"]
          },
          {
            foreignKeyName: "bd_importador_v2_linhas_processadas_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "bd_importador_v2_execucoes"
            referencedColumns: ["execution_id"]
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
            foreignKeyName: "bd_lista_programacao_entrega_apontador_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_lista_programacao_entrega_apontador_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_lista_programacao_entrega_caminhao_id_fkey"
            columns: ["caminhao_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_lista_programacao_entrega_caminhao_id_fkey"
            columns: ["caminhao_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
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
            foreignKeyName: "bd_lista_programacao_entrega_programacao_entrega_id_fkey"
            columns: ["programacao_entrega_id"]
            isOneToOne: false
            referencedRelation: "vw_programacao_entrega_segura"
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
            foreignKeyName: "bd_lista_programacao_entrega_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "vw_requisicoes_operacional_segura"
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
          endereco_completo: string | null
          endereco_normalizado: string | null
          geocoding_relevance: number | null
          geocoding_source: string | null
          geocoding_status: string | null
          geocoding_updated_at: string | null
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          latitude: number | null
          longitude: number | null
          mapbox_place_name: string | null
          nome_local: string
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          criado_em?: string
          dias_atendimento?: string[] | null
          endereco: string
          endereco_completo?: string | null
          endereco_normalizado?: string | null
          geocoding_relevance?: number | null
          geocoding_source?: string | null
          geocoding_status?: string | null
          geocoding_updated_at?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          mapbox_place_name?: string | null
          nome_local: string
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          criado_em?: string
          dias_atendimento?: string[] | null
          endereco?: string
          endereco_completo?: string | null
          endereco_normalizado?: string | null
          geocoding_relevance?: number | null
          geocoding_source?: string | null
          geocoding_status?: string | null
          geocoding_updated_at?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          mapbox_place_name?: string | null
          nome_local?: string
          telefone?: string | null
        }
        Relationships: []
      }
      bd_localizacao_equipamentos: {
        Row: {
          apontamento_id: string | null
          centro_custo_id: string | null
          data_registro: string | null
          equipamento_id: string
          id: string
          latitude: number | null
          longitude: number | null
          origem: Database["public"]["Enums"]["origem_localizacao_enum"] | null
          precisao_gps: number | null
        }
        Insert: {
          apontamento_id?: string | null
          centro_custo_id?: string | null
          data_registro?: string | null
          equipamento_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          origem?: Database["public"]["Enums"]["origem_localizacao_enum"] | null
          precisao_gps?: number | null
        }
        Update: {
          apontamento_id?: string | null
          centro_custo_id?: string | null
          data_registro?: string | null
          equipamento_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          origem?: Database["public"]["Enums"]["origem_localizacao_enum"] | null
          precisao_gps?: number | null
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_localizacao_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_localizacao_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_localizacao_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_localizacao_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_localizacao_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
          {
            foreignKeyName: "bd_localizacao_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_localizacao_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_localizacao_apontamento"
            columns: ["apontamento_id"]
            isOneToOne: true
            referencedRelation: "bd_registro_apontamento_cam_equipa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_localizacao_apontamento"
            columns: ["apontamento_id"]
            isOneToOne: true
            referencedRelation: "vw_apontamento_cam_equipa_seguro"
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
          {
            foreignKeyName: "bd_log_comunicacao_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_log_comunicacao_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_log_operacional_datas: {
        Row: {
          acao: string
          created_at: string
          data: string
          descricao: string | null
          id: string
          usuario_id: string
        }
        Insert: {
          acao: string
          created_at?: string
          data: string
          descricao?: string | null
          id?: string
          usuario_id: string
        }
        Update: {
          acao?: string
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_log_operacional_datas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_log_operacional_datas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_log_operacional_datas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_logistica_auditoria: {
        Row: {
          acao: string
          actor_user_id: string
          contexto: string
          created_at: string
          detalhes: Json
          filtros: Json
          id: string
          recurso_id: string | null
          recurso_tipo: string
        }
        Insert: {
          acao: string
          actor_user_id: string
          contexto: string
          created_at?: string
          detalhes?: Json
          filtros?: Json
          id?: string
          recurso_id?: string | null
          recurso_tipo: string
        }
        Update: {
          acao?: string
          actor_user_id?: string
          contexto?: string
          created_at?: string
          detalhes?: Json
          filtros?: Json
          id?: string
          recurso_id?: string | null
          recurso_tipo?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "bd_movimentacao_saida_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_movimentacao_saida_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
            foreignKeyName: "bd_movimentacao_transporte_caminhao_id_fkey"
            columns: ["caminhao_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_movimentacao_transporte_caminhao_id_fkey"
            columns: ["caminhao_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
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
          atendimento_id: string | null
          created_at: string | null
          created_by: string | null
          custo_total: number | null
          destino_id: string | null
          destino_tipo: string
          distancia_km: number | null
          equipamento_id: string | null
          id: string
          observacoes: string | null
          origem_fluxo: string
          origem_id: string | null
          origem_tipo: string
          parada_id: string | null
          planejamento_id: string | null
          prazo_estimado_horas: number | null
          responsavel_transporte: string | null
          solicitacao_id: string | null
          solicitacao_planejamento_id: string | null
          status: string | null
          tipo_atendimento: string | null
          tipo_deslocamento: string | null
          tipo_movimentacao: string
          updated_at: string | null
          valor_km: number | null
          viagem_id: string | null
        }
        Insert: {
          atendimento_id?: string | null
          created_at?: string | null
          created_by?: string | null
          custo_total?: number | null
          destino_id?: string | null
          destino_tipo: string
          distancia_km?: number | null
          equipamento_id?: string | null
          id?: string
          observacoes?: string | null
          origem_fluxo?: string
          origem_id?: string | null
          origem_tipo: string
          parada_id?: string | null
          planejamento_id?: string | null
          prazo_estimado_horas?: number | null
          responsavel_transporte?: string | null
          solicitacao_id?: string | null
          solicitacao_planejamento_id?: string | null
          status?: string | null
          tipo_atendimento?: string | null
          tipo_deslocamento?: string | null
          tipo_movimentacao?: string
          updated_at?: string | null
          valor_km?: number | null
          viagem_id?: string | null
        }
        Update: {
          atendimento_id?: string | null
          created_at?: string | null
          created_by?: string | null
          custo_total?: number | null
          destino_id?: string | null
          destino_tipo?: string
          distancia_km?: number | null
          equipamento_id?: string | null
          id?: string
          observacoes?: string | null
          origem_fluxo?: string
          origem_id?: string | null
          origem_tipo?: string
          parada_id?: string | null
          planejamento_id?: string | null
          prazo_estimado_horas?: number | null
          responsavel_transporte?: string | null
          solicitacao_id?: string | null
          solicitacao_planejamento_id?: string | null
          status?: string | null
          tipo_atendimento?: string | null
          tipo_deslocamento?: string | null
          tipo_movimentacao?: string
          updated_at?: string | null
          valor_km?: number | null
          viagem_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_movimentacoes_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacao_item_atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_movimentacoes_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_caminhoes_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_movimentacoes_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_movimentacoes_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_movimentacoes_parada_id_fkey"
            columns: ["parada_id"]
            isOneToOne: false
            referencedRelation: "bd_ct_viagem_paradas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_movimentacoes_planejamento_id_fkey"
            columns: ["planejamento_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_planejamento"
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
            foreignKeyName: "bd_movimentacoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_movimentacoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_movimentacoes_solicitacao_planejamento_id_fkey"
            columns: ["solicitacao_planejamento_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_planejamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_movimentacoes_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "bd_ct_viagens"
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
      bd_ordens_diarias_obra: {
        Row: {
          cancelado_em: string | null
          cancelado_por: string | null
          cancelamento_motivo: string | null
          centro_custo_id: string
          created_at: string
          criado_por: string | null
          data_ordem: string
          emitido_em: string | null
          emitido_por: string | null
          id: string
          observacao_geral: string | null
          planejamento_id: string
          responsavel_funcao_snapshot: string | null
          responsavel_funcionario_id: string | null
          responsavel_nome_snapshot: string | null
          responsavel_profile_id: string | null
          semana_fim: string | null
          semana_inicio: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          cancelamento_motivo?: string | null
          centro_custo_id: string
          created_at?: string
          criado_por?: string | null
          data_ordem: string
          emitido_em?: string | null
          emitido_por?: string | null
          id?: string
          observacao_geral?: string | null
          planejamento_id: string
          responsavel_funcao_snapshot?: string | null
          responsavel_funcionario_id?: string | null
          responsavel_nome_snapshot?: string | null
          responsavel_profile_id?: string | null
          semana_fim?: string | null
          semana_inicio?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          cancelamento_motivo?: string | null
          centro_custo_id?: string
          created_at?: string
          criado_por?: string | null
          data_ordem?: string
          emitido_em?: string | null
          emitido_por?: string | null
          id?: string
          observacao_geral?: string | null
          planejamento_id?: string
          responsavel_funcao_snapshot?: string | null
          responsavel_funcionario_id?: string | null
          responsavel_nome_snapshot?: string | null
          responsavel_profile_id?: string | null
          semana_fim?: string | null
          semana_inicio?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_ordens_diarias_obra_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_emitido_por_fkey"
            columns: ["emitido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_emitido_por_fkey"
            columns: ["emitido_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_emitido_por_fkey"
            columns: ["emitido_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_planejamento_id_fkey"
            columns: ["planejamento_id"]
            isOneToOne: false
            referencedRelation: "bd_planejamentos_obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_responsavel_funcionario_id_fkey"
            columns: ["responsavel_funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_responsavel_funcionario_id_fkey"
            columns: ["responsavel_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_responsavel_funcionario_id_fkey"
            columns: ["responsavel_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_responsavel_profile_id_fkey"
            columns: ["responsavel_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_responsavel_profile_id_fkey"
            columns: ["responsavel_profile_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_responsavel_profile_id_fkey"
            columns: ["responsavel_profile_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ordens_diarias_obra_apontamentos: {
        Row: {
          centro_custo_id: string
          created_at: string
          data_referencia: string
          equipe_presente_snapshot: Json
          id: string
          item_id: string
          meta_dia_origem: string | null
          meta_dia_snapshot: number | null
          motivo_impedimento: string | null
          observacao: string | null
          ordem_id: string
          payload_hash: string
          percentual_realizado: number | null
          quantidade_executada: number | null
          registrado_em: string
          registrado_por: string
          registrado_por_funcionario_id: string | null
          registrado_por_nome_snapshot: string
          status_execucao: string
          unidade_snapshot: string | null
        }
        Insert: {
          centro_custo_id: string
          created_at?: string
          data_referencia: string
          equipe_presente_snapshot?: Json
          id?: string
          item_id: string
          meta_dia_origem?: string | null
          meta_dia_snapshot?: number | null
          motivo_impedimento?: string | null
          observacao?: string | null
          ordem_id: string
          payload_hash: string
          percentual_realizado?: number | null
          quantidade_executada?: number | null
          registrado_em?: string
          registrado_por: string
          registrado_por_funcionario_id?: string | null
          registrado_por_nome_snapshot: string
          status_execucao: string
          unidade_snapshot?: string | null
        }
        Update: {
          centro_custo_id?: string
          created_at?: string
          data_referencia?: string
          equipe_presente_snapshot?: Json
          id?: string
          item_id?: string
          meta_dia_origem?: string | null
          meta_dia_snapshot?: number | null
          motivo_impedimento?: string | null
          observacao?: string | null
          ordem_id?: string
          payload_hash?: string
          percentual_realizado?: number | null
          quantidade_executada?: number | null
          registrado_em?: string
          registrado_por?: string
          registrado_por_funcionario_id?: string | null
          registrado_por_nome_snapshot?: string
          status_execucao?: string
          unidade_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_ordens_diarias_obra_apontamentos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "bd_ordens_diarias_obra_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_apontamentos_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "bd_ordens_diarias_obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_apontamentos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_apontamentos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_apontamentos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ordens_diarias_obra_itens: {
        Row: {
          atividade_id: string | null
          atividade_is_critica_snapshot: boolean
          atividade_quantidade_planejada_snapshot: number | null
          atividade_unidade_medida_snapshot: string | null
          codigo_eap_snapshot: string | null
          created_at: string
          equipamentos_snapshot: Json
          equipe_snapshot: Json
          fonte_progresso_snapshot: string | null
          frente_servico_snapshot: string | null
          id: string
          materiais_snapshot: Json
          nome_atividade_snapshot: string
          observacao_item: string | null
          ordem_execucao: number | null
          ordem_id: string
          pendencias_snapshot: Json
          percentual_snapshot: number | null
          responsavel_item_funcao_snapshot: string | null
          responsavel_item_funcionario_id: string | null
          responsavel_item_nome_snapshot: string | null
          responsavel_item_profile_id: string | null
          status_atividade_snapshot: string | null
          updated_at: string
        }
        Insert: {
          atividade_id?: string | null
          atividade_is_critica_snapshot?: boolean
          atividade_quantidade_planejada_snapshot?: number | null
          atividade_unidade_medida_snapshot?: string | null
          codigo_eap_snapshot?: string | null
          created_at?: string
          equipamentos_snapshot?: Json
          equipe_snapshot?: Json
          fonte_progresso_snapshot?: string | null
          frente_servico_snapshot?: string | null
          id?: string
          materiais_snapshot?: Json
          nome_atividade_snapshot: string
          observacao_item?: string | null
          ordem_execucao?: number | null
          ordem_id: string
          pendencias_snapshot?: Json
          percentual_snapshot?: number | null
          responsavel_item_funcao_snapshot?: string | null
          responsavel_item_funcionario_id?: string | null
          responsavel_item_nome_snapshot?: string | null
          responsavel_item_profile_id?: string | null
          status_atividade_snapshot?: string | null
          updated_at?: string
        }
        Update: {
          atividade_id?: string | null
          atividade_is_critica_snapshot?: boolean
          atividade_quantidade_planejada_snapshot?: number | null
          atividade_unidade_medida_snapshot?: string | null
          codigo_eap_snapshot?: string | null
          created_at?: string
          equipamentos_snapshot?: Json
          equipe_snapshot?: Json
          fonte_progresso_snapshot?: string | null
          frente_servico_snapshot?: string | null
          id?: string
          materiais_snapshot?: Json
          nome_atividade_snapshot?: string
          observacao_item?: string | null
          ordem_execucao?: number | null
          ordem_id?: string
          pendencias_snapshot?: Json
          percentual_snapshot?: number | null
          responsavel_item_funcao_snapshot?: string | null
          responsavel_item_funcionario_id?: string | null
          responsavel_item_nome_snapshot?: string | null
          responsavel_item_profile_id?: string | null
          status_atividade_snapshot?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_ordens_diarias_obra_itens_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "bd_planejamento_atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_itens_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "bd_ordens_diarias_obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_itens_responsavel_item_funcionario__fkey"
            columns: ["responsavel_item_funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_itens_responsavel_item_funcionario__fkey"
            columns: ["responsavel_item_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_itens_responsavel_item_funcionario__fkey"
            columns: ["responsavel_item_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_itens_responsavel_item_profile_id_fkey"
            columns: ["responsavel_item_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_itens_responsavel_item_profile_id_fkey"
            columns: ["responsavel_item_profile_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_itens_responsavel_item_profile_id_fkey"
            columns: ["responsavel_item_profile_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
            foreignKeyName: "bd_ordens_servico_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_servico_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
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
            foreignKeyName: "bd_ordens_servico_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "vw_chamados_os_operacional_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_servico_mecanico_id_fkey"
            columns: ["mecanico_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_servico_mecanico_id_fkey"
            columns: ["mecanico_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_servico_mecanico_id_fkey"
            columns: ["mecanico_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
      bd_os_auditoria: {
        Row: {
          acao: string
          actor_user_id: string
          contexto: string
          created_at: string
          detalhes: Json
          id: string
          recurso_id: string | null
          recurso_tipo: string
        }
        Insert: {
          acao: string
          actor_user_id: string
          contexto: string
          created_at?: string
          detalhes?: Json
          id?: string
          recurso_id?: string | null
          recurso_tipo: string
        }
        Update: {
          acao?: string
          actor_user_id?: string
          contexto?: string
          created_at?: string
          detalhes?: Json
          id?: string
          recurso_id?: string | null
          recurso_tipo?: string
        }
        Relationships: []
      }
      bd_os_leituras_sensiveis: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          origem: string
          recurso_id: string
          recurso_tipo: string
          viewer_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          origem: string
          recurso_id: string
          recurso_tipo: string
          viewer_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          origem?: string
          recurso_id?: string
          recurso_tipo?: string
          viewer_user_id?: string
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
            referencedRelation: "vw_ordens_servico_admin_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bd_os_mao_obra_os_id"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "vw_ordens_servico_operacional_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bd_os_mao_obra_os_id"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "vw_os_custos_resumido_seguro"
            referencedColumns: ["os_id"]
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
            referencedRelation: "vw_ordens_servico_admin_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_mao_obra_os"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "vw_ordens_servico_operacional_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_mao_obra_os"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "vw_os_custos_resumido_seguro"
            referencedColumns: ["os_id"]
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
            referencedRelation: "vw_ordens_servico_admin_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bd_os_materiais_utilizados_os_id"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "vw_ordens_servico_operacional_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bd_os_materiais_utilizados_os_id"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "vw_os_custos_resumido_seguro"
            referencedColumns: ["os_id"]
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
            referencedRelation: "vw_ordens_servico_admin_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_material_os"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "vw_ordens_servico_operacional_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_material_os"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "vw_os_custos_resumido_seguro"
            referencedColumns: ["os_id"]
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
      bd_permission_change_audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          new_data: Json | null
          old_data: Json | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          new_data?: Json | null
          old_data?: Json | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          new_data?: Json | null
          old_data?: Json | null
          target_user_id?: string | null
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
          {
            foreignKeyName: "bd_permissoes_acoes_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "vw_rbac_permissions_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_planejamento_atividade_equipe: {
        Row: {
          atividade_id: string
          centro_custo_id: string
          centro_custo_origem_id: string
          created_at: string
          criado_por: string | null
          dias_previstos: number | null
          funcao_id: string | null
          funcionario_id: string
          horas_previstas: number | null
          id: string
          modificado_por: string | null
          observacao: string | null
          papel_na_tarefa: Database["public"]["Enums"]["papel_equipe_tarefa"]
          planejamento_id: string
          semana_fim: string
          semana_inicio: string
          status: Database["public"]["Enums"]["status_equipe_designada"]
          tipo_alocacao: Database["public"]["Enums"]["tipo_alocacao_equipe"]
          updated_at: string
        }
        Insert: {
          atividade_id: string
          centro_custo_id: string
          centro_custo_origem_id: string
          created_at?: string
          criado_por?: string | null
          dias_previstos?: number | null
          funcao_id?: string | null
          funcionario_id: string
          horas_previstas?: number | null
          id?: string
          modificado_por?: string | null
          observacao?: string | null
          papel_na_tarefa?: Database["public"]["Enums"]["papel_equipe_tarefa"]
          planejamento_id: string
          semana_fim: string
          semana_inicio: string
          status?: Database["public"]["Enums"]["status_equipe_designada"]
          tipo_alocacao: Database["public"]["Enums"]["tipo_alocacao_equipe"]
          updated_at?: string
        }
        Update: {
          atividade_id?: string
          centro_custo_id?: string
          centro_custo_origem_id?: string
          created_at?: string
          criado_por?: string | null
          dias_previstos?: number | null
          funcao_id?: string | null
          funcionario_id?: string
          horas_previstas?: number | null
          id?: string
          modificado_por?: string | null
          observacao?: string | null
          papel_na_tarefa?: Database["public"]["Enums"]["papel_equipe_tarefa"]
          planejamento_id?: string
          semana_fim?: string
          semana_inicio?: string
          status?: Database["public"]["Enums"]["status_equipe_designada"]
          tipo_alocacao?: Database["public"]["Enums"]["tipo_alocacao_equipe"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "bd_planejamento_atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "bd_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "vw_funcoes_publicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_planejamento_atividade_equipe_planejamento_id_fkey"
            columns: ["planejamento_id"]
            isOneToOne: false
            referencedRelation: "bd_planejamentos_obra"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_planejamento_atividades: {
        Row: {
          arquivo_origem_nome: string | null
          codigo_wbs: string | null
          created_at: string
          criado_por: string | null
          data_fim: string
          data_inicio: string
          descricao: string | null
          duracao_horas: number | null
          fonte_progresso: string | null
          frente_servico: string | null
          id: string
          id_externo: string | null
          is_critica: boolean
          is_marco: boolean
          is_resumo: boolean
          nome: string
          nome_resumo: string | null
          ordem_execucao: number | null
          outline_level: number | null
          outline_number: string | null
          percentual_concluido_importado: number | null
          percentual_manual: number | null
          percentual_manual_atualizado_em: string | null
          percentual_manual_atualizado_por: string | null
          percentual_manual_observacao: string | null
          planejamento_id: string
          prioridade: string | null
          producao_prevista: number | null
          quantidade_origem: string | null
          quantidade_prevista: number | null
          status: string
          trabalho_previsto_horas: number | null
          uid_externo: string | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          arquivo_origem_nome?: string | null
          codigo_wbs?: string | null
          created_at?: string
          criado_por?: string | null
          data_fim: string
          data_inicio: string
          descricao?: string | null
          duracao_horas?: number | null
          fonte_progresso?: string | null
          frente_servico?: string | null
          id?: string
          id_externo?: string | null
          is_critica?: boolean
          is_marco?: boolean
          is_resumo?: boolean
          nome: string
          nome_resumo?: string | null
          ordem_execucao?: number | null
          outline_level?: number | null
          outline_number?: string | null
          percentual_concluido_importado?: number | null
          percentual_manual?: number | null
          percentual_manual_atualizado_em?: string | null
          percentual_manual_atualizado_por?: string | null
          percentual_manual_observacao?: string | null
          planejamento_id: string
          prioridade?: string | null
          producao_prevista?: number | null
          quantidade_origem?: string | null
          quantidade_prevista?: number | null
          status?: string
          trabalho_previsto_horas?: number | null
          uid_externo?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          arquivo_origem_nome?: string | null
          codigo_wbs?: string | null
          created_at?: string
          criado_por?: string | null
          data_fim?: string
          data_inicio?: string
          descricao?: string | null
          duracao_horas?: number | null
          fonte_progresso?: string | null
          frente_servico?: string | null
          id?: string
          id_externo?: string | null
          is_critica?: boolean
          is_marco?: boolean
          is_resumo?: boolean
          nome?: string
          nome_resumo?: string | null
          ordem_execucao?: number | null
          outline_level?: number | null
          outline_number?: string | null
          percentual_concluido_importado?: number | null
          percentual_manual?: number | null
          percentual_manual_atualizado_em?: string | null
          percentual_manual_atualizado_por?: string | null
          percentual_manual_observacao?: string | null
          planejamento_id?: string
          prioridade?: string | null
          producao_prevista?: number | null
          quantidade_origem?: string | null
          quantidade_prevista?: number | null
          status?: string
          trabalho_previsto_horas?: number | null
          uid_externo?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_planejamento_atividades_planejamento_id_fkey"
            columns: ["planejamento_id"]
            isOneToOne: false
            referencedRelation: "bd_planejamentos_obra"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_planejamento_recursos: {
        Row: {
          atividade_id: string
          atividade_uid_externo: string | null
          created_at: string
          criado_por: string | null
          data_necessaria_fim: string | null
          data_necessaria_inicio: string | null
          descricao: string
          dias_previstos: number | null
          familia: string | null
          funcao_id: string | null
          grupo: string | null
          horas_previstas: number | null
          id: string
          observacao: string | null
          planejamento_id: string
          quantidade_prevista: number
          recurso_uid_externo: string | null
          status_origem: string
          tipo_equipamento_id: string | null
          tipo_recurso: string
          unidade: string | null
          updated_at: string
        }
        Insert: {
          atividade_id: string
          atividade_uid_externo?: string | null
          created_at?: string
          criado_por?: string | null
          data_necessaria_fim?: string | null
          data_necessaria_inicio?: string | null
          descricao: string
          dias_previstos?: number | null
          familia?: string | null
          funcao_id?: string | null
          grupo?: string | null
          horas_previstas?: number | null
          id?: string
          observacao?: string | null
          planejamento_id: string
          quantidade_prevista: number
          recurso_uid_externo?: string | null
          status_origem?: string
          tipo_equipamento_id?: string | null
          tipo_recurso: string
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          atividade_id?: string
          atividade_uid_externo?: string | null
          created_at?: string
          criado_por?: string | null
          data_necessaria_fim?: string | null
          data_necessaria_inicio?: string | null
          descricao?: string
          dias_previstos?: number | null
          familia?: string | null
          funcao_id?: string | null
          grupo?: string | null
          horas_previstas?: number | null
          id?: string
          observacao?: string | null
          planejamento_id?: string
          quantidade_prevista?: number
          recurso_uid_externo?: string | null
          status_origem?: string
          tipo_equipamento_id?: string | null
          tipo_recurso?: string
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_planejamento_recursos_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "bd_planejamento_atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_planejamento_recursos_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "bd_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_planejamento_recursos_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "vw_funcoes_publicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_planejamento_recursos_planejamento_id_fkey"
            columns: ["planejamento_id"]
            isOneToOne: false
            referencedRelation: "bd_planejamentos_obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_planejamento_recursos_tipo_equipamento_id_fkey"
            columns: ["tipo_equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_tipos_equipamento"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_planejamentos_obra: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          centro_custo_id: string
          created_at: string
          criado_por: string | null
          id: string
          observacao: string | null
          origem: string
          periodo_fim: string
          periodo_inicio: string
          status: string
          updated_at: string
          versao: number
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          centro_custo_id: string
          created_at?: string
          criado_por?: string | null
          id?: string
          observacao?: string | null
          origem?: string
          periodo_fim: string
          periodo_inicio: string
          status?: string
          updated_at?: string
          versao?: number
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          centro_custo_id?: string
          created_at?: string
          criado_por?: string | null
          id?: string
          observacao?: string | null
          origem?: string
          periodo_fim?: string
          periodo_inicio?: string
          status?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "bd_planejamentos_obra_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_planejamentos_obra_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamentos_obra_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamentos_obra_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamentos_obra_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamentos_obra_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamentos_obra_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_planejamentos_obra_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
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
            foreignKeyName: "bd_ponto_ajustes_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_ajustes_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
            foreignKeyName: "bd_ponto_ajustes_batida_original_id_fkey"
            columns: ["batida_original_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_batidas_gestao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_ajustes_batida_original_id_fkey"
            columns: ["batida_original_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_batidas_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_ajustes_batida_original_id_fkey"
            columns: ["batida_original_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_batidas_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_ajustes_batida_original_id_fkey"
            columns: ["batida_original_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_logs_antifraude_seguro"
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
            foreignKeyName: "bd_ponto_ajustes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_ajustes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_ajustes_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_ajustes_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_ajustes_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
            foreignKeyName: "bd_ponto_apontamento_integracao_apontamento_id_fkey"
            columns: ["apontamento_id"]
            isOneToOne: false
            referencedRelation: "vw_apontamento_equipe_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_apontamento_integracao_batida_id_fkey"
            columns: ["batida_id"]
            isOneToOne: false
            referencedRelation: "bd_ponto_batidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_apontamento_integracao_batida_id_fkey"
            columns: ["batida_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_batidas_gestao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_apontamento_integracao_batida_id_fkey"
            columns: ["batida_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_batidas_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_apontamento_integracao_batida_id_fkey"
            columns: ["batida_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_batidas_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_apontamento_integracao_batida_id_fkey"
            columns: ["batida_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_logs_antifraude_seguro"
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
          dispositivo_obra_id: string | null
          distancia_centro_metros: number | null
          foto_hash: string | null
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
          operador_id: string | null
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
          dispositivo_obra_id?: string | null
          distancia_centro_metros?: number | null
          foto_hash?: string | null
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
          operador_id?: string | null
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
          dispositivo_obra_id?: string | null
          distancia_centro_metros?: number | null
          foto_hash?: string | null
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
          operador_id?: string | null
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
            foreignKeyName: "bd_ponto_batidas_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_dispositivos_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_dispositivos_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_dispositivo_obra_id_fkey"
            columns: ["dispositivo_obra_id"]
            isOneToOne: false
            referencedRelation: "bd_ponto_dispositivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_dispositivo_obra_id_fkey"
            columns: ["dispositivo_obra_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_dispositivos_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_dispositivo_obra_id_fkey"
            columns: ["dispositivo_obra_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_dispositivos_seguro"
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
            foreignKeyName: "bd_ponto_batidas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
          gps_obrigatorio_dispositivo_obra: boolean
          horario_entrada_padrao: string | null
          horario_saida_padrao: string | null
          id: string
          integracao_diaria_ativa: boolean
          integracao_diaria_ativado_em: string | null
          integracao_diaria_ativado_por: string | null
          integracao_diaria_inicio: string | null
          integracao_diaria_observacao: string | null
          intervalo_minimo_min: number | null
          intervalo_obrigatorio: boolean | null
          intervalo_padrao_inicio: string
          intervalo_padrao_min: number
          jornada_padrao_horas: number | null
          jornada_para_intervalo_min: number
          match_min_confidence: number
          match_min_delta: number
          match_strong_confidence: number
          modo_geofence: string | null
          modo_reconhecimento_estrito: boolean
          permite_offline_pwa: boolean | null
          permite_ponto_fora_raio: boolean | null
          retencao_fotos_dias: number | null
          tempo_min_entre_batidas_min: number
          tempo_min_para_intervalo_min: number
          tolerancia_minutos: number | null
          updated_at: string | null
          vigente_desde: string | null
        }
        Insert: {
          centro_custo_id: string
          created_at?: string | null
          exige_foto?: boolean | null
          exige_gps?: boolean | null
          gps_obrigatorio_dispositivo_obra?: boolean
          horario_entrada_padrao?: string | null
          horario_saida_padrao?: string | null
          id?: string
          integracao_diaria_ativa?: boolean
          integracao_diaria_ativado_em?: string | null
          integracao_diaria_ativado_por?: string | null
          integracao_diaria_inicio?: string | null
          integracao_diaria_observacao?: string | null
          intervalo_minimo_min?: number | null
          intervalo_obrigatorio?: boolean | null
          intervalo_padrao_inicio?: string
          intervalo_padrao_min?: number
          jornada_padrao_horas?: number | null
          jornada_para_intervalo_min?: number
          match_min_confidence?: number
          match_min_delta?: number
          match_strong_confidence?: number
          modo_geofence?: string | null
          modo_reconhecimento_estrito?: boolean
          permite_offline_pwa?: boolean | null
          permite_ponto_fora_raio?: boolean | null
          retencao_fotos_dias?: number | null
          tempo_min_entre_batidas_min?: number
          tempo_min_para_intervalo_min?: number
          tolerancia_minutos?: number | null
          updated_at?: string | null
          vigente_desde?: string | null
        }
        Update: {
          centro_custo_id?: string
          created_at?: string | null
          exige_foto?: boolean | null
          exige_gps?: boolean | null
          gps_obrigatorio_dispositivo_obra?: boolean
          horario_entrada_padrao?: string | null
          horario_saida_padrao?: string | null
          id?: string
          integracao_diaria_ativa?: boolean
          integracao_diaria_ativado_em?: string | null
          integracao_diaria_ativado_por?: string | null
          integracao_diaria_inicio?: string | null
          integracao_diaria_observacao?: string | null
          intervalo_minimo_min?: number | null
          intervalo_obrigatorio?: boolean | null
          intervalo_padrao_inicio?: string
          intervalo_padrao_min?: number
          jornada_padrao_horas?: number | null
          jornada_para_intervalo_min?: number
          match_min_confidence?: number
          match_min_delta?: number
          match_strong_confidence?: number
          modo_geofence?: string | null
          modo_reconhecimento_estrito?: boolean
          permite_offline_pwa?: boolean | null
          permite_ponto_fora_raio?: boolean | null
          retencao_fotos_dias?: number | null
          tempo_min_entre_batidas_min?: number
          tempo_min_para_intervalo_min?: number
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_config_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: true
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_config_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: true
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_config_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: true
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_config_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: true
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_config_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: true
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
          centro_custo_id: string | null
          created_at: string | null
          data_operacional: string | null
          detalhes: Json
          funcionario_id: string | null
          id: string
          motivo: string | null
          presenca_diaria_id: string | null
          solicitacao_id: string | null
          status: string
          tipo_batida: string | null
          tipo_registro: string
          updated_at: string
        }
        Insert: {
          batida_id: string
          centro_custo_id?: string | null
          created_at?: string | null
          data_operacional?: string | null
          detalhes?: Json
          funcionario_id?: string | null
          id?: string
          motivo?: string | null
          presenca_diaria_id?: string | null
          solicitacao_id?: string | null
          status?: string
          tipo_batida?: string | null
          tipo_registro?: string
          updated_at?: string
        }
        Update: {
          batida_id?: string
          centro_custo_id?: string | null
          created_at?: string | null
          data_operacional?: string | null
          detalhes?: Json
          funcionario_id?: string | null
          id?: string
          motivo?: string | null
          presenca_diaria_id?: string | null
          solicitacao_id?: string | null
          status?: string
          tipo_batida?: string | null
          tipo_registro?: string
          updated_at?: string
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
            foreignKeyName: "bd_ponto_diaria_integracao_batida_id_fkey"
            columns: ["batida_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_batidas_gestao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_batida_id_fkey"
            columns: ["batida_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_batidas_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_batida_id_fkey"
            columns: ["batida_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_batidas_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_batida_id_fkey"
            columns: ["batida_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_logs_antifraude_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            referencedRelation: "mv_relatorio_diarias"
            referencedColumns: ["presenca_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_presenca_diaria_id_fkey"
            columns: ["presenca_diaria_id"]
            isOneToOne: false
            referencedRelation: "mv_relatorio_diarias_legacy_20260514"
            referencedColumns: ["presenca_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_presenca_diaria_id_fkey"
            columns: ["presenca_diaria_id"]
            isOneToOne: false
            referencedRelation: "vw_diaria_relatorio_financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_presenca_diaria_id_fkey"
            columns: ["presenca_diaria_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["presenca_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_presenca_diaria_id_fkey"
            columns: ["presenca_diaria_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["presenca_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_presenca_diaria_id_fkey"
            columns: ["presenca_diaria_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["presenca_id"]
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
      bd_ponto_dispositivo_centros_custo: {
        Row: {
          ativo: boolean
          centro_custo_id: string
          criado_em: string
          criado_por: string | null
          desativado_em: string | null
          desativado_por: string | null
          dispositivo_id: string
          id: string
        }
        Insert: {
          ativo?: boolean
          centro_custo_id: string
          criado_em?: string
          criado_por?: string | null
          desativado_em?: string | null
          desativado_por?: string | null
          dispositivo_id: string
          id?: string
        }
        Update: {
          ativo?: boolean
          centro_custo_id?: string
          criado_em?: string
          criado_por?: string | null
          desativado_em?: string | null
          desativado_por?: string | null
          dispositivo_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_ponto_dispositivo_centros_custo_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivo_centros_custo_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivo_centros_custo_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivo_centros_custo_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivo_centros_custo_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivo_centros_custo_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivo_centros_custo_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivo_centros_custo_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivo_centros_custo_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "bd_ponto_dispositivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivo_centros_custo_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_dispositivos_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivo_centros_custo_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_dispositivos_seguro"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ponto_dispositivo_sessoes: {
        Row: {
          criado_em: string
          device_fingerprint: string | null
          dispositivo_id: string
          expires_at: string
          id: string
          ip: unknown
          revogado_em: string | null
          revogado_motivo: string | null
          token_hash: string
          user_agent: string | null
        }
        Insert: {
          criado_em?: string
          device_fingerprint?: string | null
          dispositivo_id: string
          expires_at: string
          id?: string
          ip?: unknown
          revogado_em?: string | null
          revogado_motivo?: string | null
          token_hash: string
          user_agent?: string | null
        }
        Update: {
          criado_em?: string
          device_fingerprint?: string | null
          dispositivo_id?: string
          expires_at?: string
          id?: string
          ip?: unknown
          revogado_em?: string | null
          revogado_motivo?: string | null
          token_hash?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_ponto_dispositivo_sessoes_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "bd_ponto_dispositivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivo_sessoes_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_dispositivos_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivo_sessoes_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_dispositivos_seguro"
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
          device_fingerprint: string | null
          device_secret_hash: string | null
          device_session_expires_at: string | null
          device_session_token: string | null
          id: string
          latitude_fixa: number | null
          longitude_fixa: number | null
          modo_operacao: string
          nome: string
          registrado_por: string | null
          senha_hash: string | null
          tipo: string
          ultimo_heartbeat: string | null
          ultimo_login_at: string | null
          ultimo_login_ip: unknown
          updated_at: string | null
          usuario_responsavel_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          centro_custo_id: string
          codigo_dispositivo: string
          created_at?: string | null
          device_fingerprint?: string | null
          device_secret_hash?: string | null
          device_session_expires_at?: string | null
          device_session_token?: string | null
          id?: string
          latitude_fixa?: number | null
          longitude_fixa?: number | null
          modo_operacao?: string
          nome: string
          registrado_por?: string | null
          senha_hash?: string | null
          tipo?: string
          ultimo_heartbeat?: string | null
          ultimo_login_at?: string | null
          ultimo_login_ip?: unknown
          updated_at?: string | null
          usuario_responsavel_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          centro_custo_id?: string
          codigo_dispositivo?: string
          created_at?: string | null
          device_fingerprint?: string | null
          device_secret_hash?: string | null
          device_session_expires_at?: string | null
          device_session_token?: string | null
          id?: string
          latitude_fixa?: number | null
          longitude_fixa?: number | null
          modo_operacao?: string
          nome?: string
          registrado_por?: string | null
          senha_hash?: string | null
          tipo?: string
          ultimo_heartbeat?: string | null
          ultimo_login_at?: string | null
          ultimo_login_ip?: unknown
          updated_at?: string | null
          usuario_responsavel_id?: string | null
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
          {
            foreignKeyName: "bd_ponto_dispositivos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_usuario_responsavel_id_fkey"
            columns: ["usuario_responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_usuario_responsavel_id_fkey"
            columns: ["usuario_responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_usuario_responsavel_id_fkey"
            columns: ["usuario_responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_ponto_match_log: {
        Row: {
          confirmado_em: string | null
          criado_em: string
          decisao: string
          dispositivo_id: string | null
          funcionario_confirmado_id: string | null
          id: string
          margem: number | null
          margem_min_aplicada: number | null
          motivo: string | null
          threshold_aplicado: number | null
          top1_distancia: number | null
          top1_funcionario_id: string | null
          top2_distancia: number | null
          top2_funcionario_id: string | null
        }
        Insert: {
          confirmado_em?: string | null
          criado_em?: string
          decisao: string
          dispositivo_id?: string | null
          funcionario_confirmado_id?: string | null
          id?: string
          margem?: number | null
          margem_min_aplicada?: number | null
          motivo?: string | null
          threshold_aplicado?: number | null
          top1_distancia?: number | null
          top1_funcionario_id?: string | null
          top2_distancia?: number | null
          top2_funcionario_id?: string | null
        }
        Update: {
          confirmado_em?: string | null
          criado_em?: string
          decisao?: string
          dispositivo_id?: string | null
          funcionario_confirmado_id?: string | null
          id?: string
          margem?: number | null
          margem_min_aplicada?: number | null
          motivo?: string | null
          threshold_aplicado?: number | null
          top1_distancia?: number | null
          top1_funcionario_id?: string | null
          top2_distancia?: number | null
          top2_funcionario_id?: string | null
        }
        Relationships: []
      }
      bd_ponto_relatorio_auditoria: {
        Row: {
          contexto: string
          created_at: string
          detalhes: Json
          filtros: Json
          funcionario_id: string | null
          id: string
          origem: string | null
          quantidade_registros: number | null
          recurso: string
          tipo_acesso: string
          usuario_id: string | null
        }
        Insert: {
          contexto: string
          created_at?: string
          detalhes?: Json
          filtros?: Json
          funcionario_id?: string | null
          id?: string
          origem?: string | null
          quantidade_registros?: number | null
          recurso: string
          tipo_acesso: string
          usuario_id?: string | null
        }
        Update: {
          contexto?: string
          created_at?: string
          detalhes?: Json
          filtros?: Json
          funcionario_id?: string | null
          id?: string
          origem?: string | null
          quantidade_registros?: number | null
          recurso?: string
          tipo_acesso?: string
          usuario_id?: string | null
        }
        Relationships: []
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_vinculos_operacionais_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_vinculos_operacionais_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_vinculos_operacionais_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_vinculos_operacionais_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_vinculos_operacionais_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
            foreignKeyName: "bd_ponto_vinculos_operacionais_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_vinculos_operacionais_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
          {
            foreignKeyName: "bd_ponto_vinculos_operacionais_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_vinculos_operacionais_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_pop_rascunhos: {
        Row: {
          arquivo_mime_type: string | null
          arquivo_nome_original: string | null
          arquivo_path: string | null
          arquivo_sha256: string | null
          arquivo_tamanho_bytes: number | null
          categoria: string | null
          codigo: string
          created_at: string
          criado_por: string
          elaborado_por_id: string
          elaborado_por_nome_snapshot: string
          id: string
          motivo_revisao: string
          pop_id: string
          setor_id: string
          tipo_incremento: string
          titulo: string
          updated_at: string
        }
        Insert: {
          arquivo_mime_type?: string | null
          arquivo_nome_original?: string | null
          arquivo_path?: string | null
          arquivo_sha256?: string | null
          arquivo_tamanho_bytes?: number | null
          categoria?: string | null
          codigo: string
          created_at?: string
          criado_por: string
          elaborado_por_id: string
          elaborado_por_nome_snapshot: string
          id?: string
          motivo_revisao: string
          pop_id: string
          setor_id: string
          tipo_incremento: string
          titulo: string
          updated_at?: string
        }
        Update: {
          arquivo_mime_type?: string | null
          arquivo_nome_original?: string | null
          arquivo_path?: string | null
          arquivo_sha256?: string | null
          arquivo_tamanho_bytes?: number | null
          categoria?: string | null
          codigo?: string
          created_at?: string
          criado_por?: string
          elaborado_por_id?: string
          elaborado_por_nome_snapshot?: string
          id?: string
          motivo_revisao?: string
          pop_id?: string
          setor_id?: string
          tipo_incremento?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_bd_pop_rascunhos_pop"
            columns: ["pop_id"]
            isOneToOne: true
            referencedRelation: "bd_pops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bd_pop_rascunhos_setor"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "bd_departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_pops: {
        Row: {
          aprovado_por: string | null
          arquivo_mime_type: string | null
          arquivo_nome_original: string | null
          arquivo_path: string | null
          arquivo_sha256: string | null
          arquivo_tamanho_bytes: number | null
          atualizado_por: string | null
          categoria: string | null
          codigo: string
          created_at: string
          criado_por: string
          elaborado_por_id: string | null
          elaborado_por_nome_snapshot: string | null
          id: string
          motivo_obsolescencia: string | null
          obsoleto_em: string | null
          obsoleto_por: string | null
          publicado_em: string | null
          setor_id: string
          status: string
          titulo: string
          updated_at: string
          versao_major: number
          versao_minor: number
        }
        Insert: {
          aprovado_por?: string | null
          arquivo_mime_type?: string | null
          arquivo_nome_original?: string | null
          arquivo_path?: string | null
          arquivo_sha256?: string | null
          arquivo_tamanho_bytes?: number | null
          atualizado_por?: string | null
          categoria?: string | null
          codigo: string
          created_at?: string
          criado_por: string
          elaborado_por_id?: string | null
          elaborado_por_nome_snapshot?: string | null
          id?: string
          motivo_obsolescencia?: string | null
          obsoleto_em?: string | null
          obsoleto_por?: string | null
          publicado_em?: string | null
          setor_id: string
          status?: string
          titulo: string
          updated_at?: string
          versao_major?: number
          versao_minor?: number
        }
        Update: {
          aprovado_por?: string | null
          arquivo_mime_type?: string | null
          arquivo_nome_original?: string | null
          arquivo_path?: string | null
          arquivo_sha256?: string | null
          arquivo_tamanho_bytes?: number | null
          atualizado_por?: string | null
          categoria?: string | null
          codigo?: string
          created_at?: string
          criado_por?: string
          elaborado_por_id?: string | null
          elaborado_por_nome_snapshot?: string | null
          id?: string
          motivo_obsolescencia?: string | null
          obsoleto_em?: string | null
          obsoleto_por?: string | null
          publicado_em?: string | null
          setor_id?: string
          status?: string
          titulo?: string
          updated_at?: string
          versao_major?: number
          versao_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_bd_pops_setor"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "bd_departamentos"
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
            foreignKeyName: "bd_portfolio_empresas_catalogo_equipamento_id_fkey"
            columns: ["catalogo_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_portfolio_tecnico_seguro"
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_programacao_entrega_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_programacao_entrega_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_programacao_entrega_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_programacao_entrega_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_programacao_entrega_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
          {
            foreignKeyName: "bd_programacao_entrega_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "vw_requisicoes_operacional_segura"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_rate_limit_tentativas: {
        Row: {
          bloqueado_ate: string | null
          chave_tipo: string
          chave_valor: string
          created_at: string
          escopo: string
          id: string
          janela_inicio: string
          tentativas: number
          updated_at: string
        }
        Insert: {
          bloqueado_ate?: string | null
          chave_tipo: string
          chave_valor: string
          created_at?: string
          escopo: string
          id?: string
          janela_inicio?: string
          tentativas?: number
          updated_at?: string
        }
        Update: {
          bloqueado_ate?: string | null
          chave_tipo?: string
          chave_valor?: string
          created_at?: string
          escopo?: string
          id?: string
          janela_inicio?: string
          tentativas?: number
          updated_at?: string
        }
        Relationships: []
      }
      bd_rbac_legacy_map: {
        Row: {
          action_padrao: string | null
          created_at: string
          legacy_nome: string
          new_codigo: string | null
          observacao: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_padrao?: string | null
          created_at?: string
          legacy_nome: string
          new_codigo?: string | null
          observacao?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          action_padrao?: string | null
          created_at?: string
          legacy_nome?: string
          new_codigo?: string | null
          observacao?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_rbac_legacy_map_new_codigo_fk"
            columns: ["new_codigo"]
            isOneToOne: false
            referencedRelation: "bd_permissions"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "bd_rbac_legacy_map_new_codigo_fk"
            columns: ["new_codigo"]
            isOneToOne: false
            referencedRelation: "vw_rbac_permissions_safe"
            referencedColumns: ["codigo"]
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
          geo_accuracy: number | null
          geo_captured_at: string | null
          hora_fim_aplicacao: string | null
          hora_inicio_aplicacao: string | null
          id: string
          largura_media: number | null
          latitude: number | null
          lista_entrega_id: string | null
          logradouro_id: string | null
          logradouro_nome: string
          longitude: number | null
          modificado_por: string | null
          numero_passadas: number | null
          observacao_apontamento: string | null
          observacoes_aplicacao: string | null
          registro_aplicacao_id: string
          registro_carga_id: string | null
          rua_aplicacao_id: string | null
          sequencia_aplicacao: number
          sequencia_rua: number | null
          temperatura_aplicacao: number | null
          tipo_item: string | null
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
          geo_accuracy?: number | null
          geo_captured_at?: string | null
          hora_fim_aplicacao?: string | null
          hora_inicio_aplicacao?: string | null
          id?: string
          largura_media?: number | null
          latitude?: number | null
          lista_entrega_id?: string | null
          logradouro_id?: string | null
          logradouro_nome: string
          longitude?: number | null
          modificado_por?: string | null
          numero_passadas?: number | null
          observacao_apontamento?: string | null
          observacoes_aplicacao?: string | null
          registro_aplicacao_id: string
          registro_carga_id?: string | null
          rua_aplicacao_id?: string | null
          sequencia_aplicacao?: number
          sequencia_rua?: number | null
          temperatura_aplicacao?: number | null
          tipo_item?: string | null
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
          geo_accuracy?: number | null
          geo_captured_at?: string | null
          hora_fim_aplicacao?: string | null
          hora_inicio_aplicacao?: string | null
          id?: string
          largura_media?: number | null
          latitude?: number | null
          lista_entrega_id?: string | null
          logradouro_id?: string | null
          logradouro_nome?: string
          longitude?: number | null
          modificado_por?: string | null
          numero_passadas?: number | null
          observacao_apontamento?: string | null
          observacoes_aplicacao?: string | null
          registro_aplicacao_id?: string
          registro_carga_id?: string | null
          rua_aplicacao_id?: string | null
          sequencia_aplicacao?: number
          sequencia_rua?: number | null
          temperatura_aplicacao?: number | null
          tipo_item?: string | null
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
            foreignKeyName: "bd_registro_aplicacao_detalhes_lista_entrega_id_fkey"
            columns: ["lista_entrega_id"]
            isOneToOne: false
            referencedRelation: "vw_lista_programacao_entrega_segura"
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
            foreignKeyName: "bd_registro_aplicacao_detalhes_registro_aplicacao_id_fkey"
            columns: ["registro_aplicacao_id"]
            isOneToOne: false
            referencedRelation: "vw_registro_aplicacao_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_aplicacao_detalhes_registro_carga_id_fkey"
            columns: ["registro_carga_id"]
            isOneToOne: false
            referencedRelation: "bd_registro_cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_aplicacao_detalhes_registro_carga_id_fkey"
            columns: ["registro_carga_id"]
            isOneToOne: false
            referencedRelation: "vw_registro_cargas_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "det_rua_aplicacao_fk"
            columns: ["rua_aplicacao_id"]
            isOneToOne: false
            referencedRelation: "bd_registro_aplicacao_ruas"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_registro_aplicacao_ruas: {
        Row: {
          bairro: string | null
          chave_normalizada: string
          cidade: string | null
          created_at: string
          created_by: string | null
          geo_accuracy: number | null
          id: string
          latitude: number | null
          logradouro_nome: string
          logradouro_nome_local: string | null
          longitude: number | null
          ordem_rua: number
          origem_localizacao: string | null
          registro_aplicacao_id: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          chave_normalizada: string
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          geo_accuracy?: number | null
          id?: string
          latitude?: number | null
          logradouro_nome: string
          logradouro_nome_local?: string | null
          longitude?: number | null
          ordem_rua: number
          origem_localizacao?: string | null
          registro_aplicacao_id: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          chave_normalizada?: string
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          geo_accuracy?: number | null
          id?: string
          latitude?: number | null
          logradouro_nome?: string
          logradouro_nome_local?: string | null
          longitude?: number | null
          ordem_rua?: number
          origem_localizacao?: string | null
          registro_aplicacao_id?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ruas_registro_aplicacao_fk"
            columns: ["registro_aplicacao_id"]
            isOneToOne: false
            referencedRelation: "bd_registro_apontamento_aplicacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ruas_registro_aplicacao_fk"
            columns: ["registro_aplicacao_id"]
            isOneToOne: false
            referencedRelation: "vw_registro_aplicacao_seguro"
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
          atividade: string | null
          bordo: string | null
          carga_finalizada: boolean | null
          carga_origem_id: string | null
          carga_total_aplicada: number | null
          centro_custo_id: string | null
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
          origem_registro: string
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
          atividade?: string | null
          bordo?: string | null
          carga_finalizada?: boolean | null
          carga_origem_id?: string | null
          carga_total_aplicada?: number | null
          centro_custo_id?: string | null
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
          origem_registro?: string
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
          atividade?: string | null
          bordo?: string | null
          carga_finalizada?: boolean | null
          carga_origem_id?: string | null
          carga_total_aplicada?: number | null
          centro_custo_id?: string | null
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
          origem_registro?: string
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
            foreignKeyName: "bd_registro_apontamento_aplicacao_carga_origem_id_fkey"
            columns: ["carga_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_registro_cargas_seguro"
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
            foreignKeyName: "bd_registro_apontamento_aplicacao_lista_entrega_id_fkey"
            columns: ["lista_entrega_id"]
            isOneToOne: false
            referencedRelation: "vw_lista_programacao_entrega_segura"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_aplicacao_registro_carga_id_fkey"
            columns: ["registro_carga_id"]
            isOneToOne: false
            referencedRelation: "bd_registro_cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_aplicacao_registro_carga_id_fkey"
            columns: ["registro_carga_id"]
            isOneToOne: false
            referencedRelation: "vw_registro_cargas_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_raa_centro_custo"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_raa_centro_custo"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_raa_centro_custo"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_raa_centro_custo"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_raa_centro_custo"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_raa_centro_custo"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_raa_centro_custo"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "fk_raa_centro_custo"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
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
          turno: string
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
          turno?: string
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
          turno?: string
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
            foreignKeyName: "bd_registro_apontamento_cam_equipa_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_registro_apontamento_inspecao: {
        Row: {
          apontamento_caminhao_equipamento_id: string
          avarias_observadas: string | null
          checklist_codigo: string | null
          checklist_respostas: Json | null
          checklist_versao: number | null
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
          checklist_codigo?: string | null
          checklist_respostas?: Json | null
          checklist_versao?: number | null
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
          checklist_codigo?: string | null
          checklist_respostas?: Json | null
          checklist_versao?: number | null
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
          {
            foreignKeyName: "bd_registro_cargas_lista_entrega_id_fkey"
            columns: ["lista_entrega_id"]
            isOneToOne: false
            referencedRelation: "vw_lista_programacao_entrega_segura"
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
            foreignKeyName: "bd_registro_desvios_sso_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_desvios_sso_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_registro_desvios_sso_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_registro_desvios_sso_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_registro_desvios_sso_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_registro_desvios_sso_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_registro_desvios_sso_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
      bd_relatorio_aps_carimbos: {
        Row: {
          ativo: boolean
          bairro: string | null
          centro_custo_id: string | null
          cliente: string | null
          created_at: string
          created_by: string
          empresa: string | null
          id: string
          nome: string
          obra: string | null
          observacoes: string | null
          padrao_centro_custo: boolean
          revisao: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          centro_custo_id?: string | null
          cliente?: string | null
          created_at?: string
          created_by: string
          empresa?: string | null
          id?: string
          nome: string
          obra?: string | null
          observacoes?: string | null
          padrao_centro_custo?: boolean
          revisao?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          centro_custo_id?: string | null
          cliente?: string | null
          created_at?: string
          created_by?: string
          empresa?: string | null
          id?: string
          nome?: string
          obra?: string | null
          observacoes?: string | null
          padrao_centro_custo?: boolean
          revisao?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_relatorio_aps_carimbos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_relatorio_aps_carimbos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_relatorio_aps_carimbos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_relatorio_aps_carimbos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_relatorio_aps_carimbos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_relatorio_aps_carimbos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_relatorio_aps_carimbos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_relatorio_aps_carimbos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_requisicoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_requisicoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_requisicoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_requisicoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_requisicoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
          {
            foreignKeyName: "bd_requisicoes_engenheiro_id_fkey"
            columns: ["engenheiro_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_requisicoes_engenheiro_id_fkey"
            columns: ["engenheiro_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_role_permission_actions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "vw_rbac_permissions_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_role_permission_actions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "bd_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_role_permission_actions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "vw_rbac_roles_safe"
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
            foreignKeyName: "bd_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "vw_rbac_permissions_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "bd_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "vw_rbac_roles_safe"
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
          {
            foreignKeyName: "bd_ruas_requisicao_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "vw_requisicoes_operacional_segura"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_security_audit_log: {
        Row: {
          contexto: Json
          created_at: string
          event_type: string
          id: string
          ip: string | null
          rpc_name: string | null
          table_name: string | null
          target_id: string | null
          user_agent: string | null
          user_id: string | null
          view_name: string | null
        }
        Insert: {
          contexto?: Json
          created_at?: string
          event_type: string
          id?: string
          ip?: string | null
          rpc_name?: string | null
          table_name?: string | null
          target_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          view_name?: string | null
        }
        Update: {
          contexto?: Json
          created_at?: string
          event_type?: string
          id?: string
          ip?: string | null
          rpc_name?: string | null
          table_name?: string | null
          target_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          view_name?: string | null
        }
        Relationships: []
      }
      bd_solicitacao_desligamento_itens: {
        Row: {
          cargo_snapshot: string | null
          centro_custo_id: string | null
          centro_custo_snapshot: string | null
          cpf_snapshot: string | null
          created_at: string
          data_admissao_snapshot: string | null
          data_desligamento: string | null
          data_exame: string | null
          funcionario_id: string | null
          id: string
          matricula_snapshot: string | null
          nome_snapshot: string
          salario_manual: number | null
          solicitacao_id: string
          updated_at: string
          valor_rescisao_manual: number | null
        }
        Insert: {
          cargo_snapshot?: string | null
          centro_custo_id?: string | null
          centro_custo_snapshot?: string | null
          cpf_snapshot?: string | null
          created_at?: string
          data_admissao_snapshot?: string | null
          data_desligamento?: string | null
          data_exame?: string | null
          funcionario_id?: string | null
          id?: string
          matricula_snapshot?: string | null
          nome_snapshot: string
          salario_manual?: number | null
          solicitacao_id: string
          updated_at?: string
          valor_rescisao_manual?: number | null
        }
        Update: {
          cargo_snapshot?: string | null
          centro_custo_id?: string | null
          centro_custo_snapshot?: string | null
          cpf_snapshot?: string | null
          created_at?: string
          data_admissao_snapshot?: string | null
          data_desligamento?: string | null
          data_exame?: string | null
          funcionario_id?: string | null
          id?: string
          matricula_snapshot?: string | null
          nome_snapshot?: string
          salario_manual?: number | null
          solicitacao_id?: string
          updated_at?: string
          valor_rescisao_manual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_solicitacao_desligamento_itens_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacao_desligamento_itens_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_desligamento_itens_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_desligamento_itens_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_desligamento_itens_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_desligamento_itens_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_desligamento_itens_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_desligamento_itens_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_desligamento_itens_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacao_desligamento_itens_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacao_desligamento_itens_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacao_desligamento_itens_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_desligamento"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_solicitacao_item_atendimentos: {
        Row: {
          contexto_decisao: Json
          created_at: string
          created_by: string
          encerrado_em: string | null
          encerrado_por: string | null
          equipamento_id: string
          id: string
          janela_aprovada_fim: string
          janela_aprovada_inicio: string
          justificativa_override: string | null
          match_tipo: string
          modalidade: string
          motivo_encerramento: string | null
          override_disponibilidade: boolean
          override_periodo: boolean
          periodo_fim: string
          periodo_inicio: string
          request_id_criacao: string
          request_id_encerramento: string | null
          solicitacao_item_id: string
          status: string
          updated_at: string
        }
        Insert: {
          contexto_decisao: Json
          created_at?: string
          created_by: string
          encerrado_em?: string | null
          encerrado_por?: string | null
          equipamento_id: string
          id?: string
          janela_aprovada_fim: string
          janela_aprovada_inicio: string
          justificativa_override?: string | null
          match_tipo: string
          modalidade: string
          motivo_encerramento?: string | null
          override_disponibilidade?: boolean
          override_periodo?: boolean
          periodo_fim: string
          periodo_inicio: string
          request_id_criacao: string
          request_id_encerramento?: string | null
          solicitacao_item_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          contexto_decisao?: Json
          created_at?: string
          created_by?: string
          encerrado_em?: string | null
          encerrado_por?: string | null
          equipamento_id?: string
          id?: string
          janela_aprovada_fim?: string
          janela_aprovada_inicio?: string
          justificativa_override?: string | null
          match_tipo?: string
          modalidade?: string
          motivo_encerramento?: string | null
          override_disponibilidade?: boolean
          override_periodo?: boolean
          periodo_fim?: string
          periodo_inicio?: string
          request_id_criacao?: string
          request_id_encerramento?: string | null
          solicitacao_item_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sia_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sia_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sia_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sia_encerrado_por"
            columns: ["encerrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sia_encerrado_por"
            columns: ["encerrado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sia_encerrado_por"
            columns: ["encerrado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sia_equipamento"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_caminhoes_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sia_equipamento"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sia_equipamento"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sia_solicitacao_item"
            columns: ["solicitacao_item_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_solicitacao_transferencia_itens: {
        Row: {
          alteracao_passagem: boolean
          cargo_snapshot: string | null
          centro_custo_destino_id: string | null
          centro_custo_destino_snapshot: string | null
          centro_custo_origem_id: string | null
          centro_custo_origem_snapshot: string | null
          cpf_snapshot: string | null
          created_at: string
          data_admissao_snapshot: string | null
          data_transferencia: string | null
          funcionario_id: string | null
          id: string
          matricula_snapshot: string | null
          nome_snapshot: string
          salario_manual: number | null
          solicitacao_id: string
          updated_at: string
          valor_passagem_atual: number | null
          valor_passagem_novo: number | null
        }
        Insert: {
          alteracao_passagem?: boolean
          cargo_snapshot?: string | null
          centro_custo_destino_id?: string | null
          centro_custo_destino_snapshot?: string | null
          centro_custo_origem_id?: string | null
          centro_custo_origem_snapshot?: string | null
          cpf_snapshot?: string | null
          created_at?: string
          data_admissao_snapshot?: string | null
          data_transferencia?: string | null
          funcionario_id?: string | null
          id?: string
          matricula_snapshot?: string | null
          nome_snapshot: string
          salario_manual?: number | null
          solicitacao_id: string
          updated_at?: string
          valor_passagem_atual?: number | null
          valor_passagem_novo?: number | null
        }
        Update: {
          alteracao_passagem?: boolean
          cargo_snapshot?: string | null
          centro_custo_destino_id?: string | null
          centro_custo_destino_snapshot?: string | null
          centro_custo_origem_id?: string | null
          centro_custo_origem_snapshot?: string | null
          cpf_snapshot?: string | null
          created_at?: string
          data_admissao_snapshot?: string | null
          data_transferencia?: string | null
          funcionario_id?: string | null
          id?: string
          matricula_snapshot?: string | null
          nome_snapshot?: string
          salario_manual?: number | null
          solicitacao_id?: string
          updated_at?: string
          valor_passagem_atual?: number | null
          valor_passagem_novo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_centro_custo_destino_id_fkey"
            columns: ["centro_custo_destino_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_centro_custo_destino_id_fkey"
            columns: ["centro_custo_destino_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_centro_custo_destino_id_fkey"
            columns: ["centro_custo_destino_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_centro_custo_destino_id_fkey"
            columns: ["centro_custo_destino_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_centro_custo_destino_id_fkey"
            columns: ["centro_custo_destino_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_centro_custo_destino_id_fkey"
            columns: ["centro_custo_destino_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_centro_custo_destino_id_fkey"
            columns: ["centro_custo_destino_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_centro_custo_destino_id_fkey"
            columns: ["centro_custo_destino_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacao_transferencia_itens_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_transferencia"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_solicitacoes_classificacao: {
        Row: {
          cancelado_em: string | null
          cancelado_por: string | null
          created_at: string
          created_by: string
          data_solicitacao: string
          diretor_area_nome_snapshot: string | null
          diretoria_financeira_nome_snapshot: string | null
          gerente_area_nome_snapshot: string | null
          id: string
          motivo_cancelamento: string | null
          observacoes: string | null
          protocolo: string
          solicitante_id: string
          solicitante_nome_snapshot: string | null
          status: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          created_at?: string
          created_by?: string
          data_solicitacao?: string
          diretor_area_nome_snapshot?: string | null
          diretoria_financeira_nome_snapshot?: string | null
          gerente_area_nome_snapshot?: string | null
          id?: string
          motivo_cancelamento?: string | null
          observacoes?: string | null
          protocolo: string
          solicitante_id?: string
          solicitante_nome_snapshot?: string | null
          status?: string
          updated_at?: string
          updated_by?: string
        }
        Update: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          created_at?: string
          created_by?: string
          data_solicitacao?: string
          diretor_area_nome_snapshot?: string | null
          diretoria_financeira_nome_snapshot?: string | null
          gerente_area_nome_snapshot?: string | null
          id?: string
          motivo_cancelamento?: string | null
          observacoes?: string | null
          protocolo?: string
          solicitante_id?: string
          solicitante_nome_snapshot?: string | null
          status?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      bd_solicitacoes_desligamento: {
        Row: {
          created_at: string
          created_by: string | null
          data_solicitacao: string
          diretor_area_nome_snapshot: string | null
          diretoria_financeira_nome_snapshot: string | null
          gerente_area_nome_snapshot: string | null
          id: string
          observacoes: string | null
          protocolo: string
          solicitante_id: string | null
          solicitante_nome_snapshot: string | null
          status: string
          total_funcionarios: number
          total_rescisao: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_solicitacao?: string
          diretor_area_nome_snapshot?: string | null
          diretoria_financeira_nome_snapshot?: string | null
          gerente_area_nome_snapshot?: string | null
          id?: string
          observacoes?: string | null
          protocolo: string
          solicitante_id?: string | null
          solicitante_nome_snapshot?: string | null
          status?: string
          total_funcionarios?: number
          total_rescisao?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_solicitacao?: string
          diretor_area_nome_snapshot?: string | null
          diretoria_financeira_nome_snapshot?: string | null
          gerente_area_nome_snapshot?: string | null
          id?: string
          observacoes?: string | null
          protocolo?: string
          solicitante_id?: string | null
          solicitante_nome_snapshot?: string | null
          status?: string
          total_funcionarios?: number
          total_rescisao?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      bd_solicitacoes_desmobilizacao: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          cancelado_em: string | null
          cancelado_por: string | null
          centro_custo_origem_id: string
          concluido_em: string | null
          concluido_por: string | null
          created_at: string
          data_retirada: string
          engenheiro_responsavel_id: string
          engenheiro_solicitante_id: string
          equipamento_id: string
          exige_aprovacao: boolean
          hora_retirada: string | null
          id: string
          motivo_cancelamento: string | null
          motivo_recusa: string | null
          observacoes: string | null
          previsao_aplicada: boolean
          previsao_liberacao_anterior: string | null
          solicitante_id: string
          status: string
          updated_at: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          centro_custo_origem_id: string
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          data_retirada: string
          engenheiro_responsavel_id: string
          engenheiro_solicitante_id: string
          equipamento_id: string
          exige_aprovacao: boolean
          hora_retirada?: string | null
          id?: string
          motivo_cancelamento?: string | null
          motivo_recusa?: string | null
          observacoes?: string | null
          previsao_aplicada?: boolean
          previsao_liberacao_anterior?: string | null
          solicitante_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          centro_custo_origem_id?: string
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          data_retirada?: string
          engenheiro_responsavel_id?: string
          engenheiro_solicitante_id?: string
          equipamento_id?: string
          exige_aprovacao?: boolean
          hora_retirada?: string | null
          id?: string
          motivo_cancelamento?: string | null
          motivo_recusa?: string | null
          observacoes?: string | null
          previsao_aplicada?: boolean
          previsao_liberacao_anterior?: string | null
          solicitante_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_centro_custo_origem_id_fkey"
            columns: ["centro_custo_origem_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_concluido_por_fkey"
            columns: ["concluido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_concluido_por_fkey"
            columns: ["concluido_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_concluido_por_fkey"
            columns: ["concluido_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_engenheiro_responsavel_id_fkey"
            columns: ["engenheiro_responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_engenheiro_responsavel_id_fkey"
            columns: ["engenheiro_responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_engenheiro_responsavel_id_fkey"
            columns: ["engenheiro_responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_caminhoes_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_desmobilizacao_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
            foreignKeyName: "bd_solicitacoes_equip_aprovacoes_aprovador_id_fkey"
            columns: ["aprovador_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equip_aprovacoes_aprovador_id_fkey"
            columns: ["aprovador_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equip_aprovacoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_equipamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equip_aprovacoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equip_aprovacoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_operacional"
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
            foreignKeyName: "bd_solicitacoes_equipamento_apontador_responsavel_id_fkey"
            columns: ["apontador_responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_apontador_responsavel_id_fkey"
            columns: ["apontador_responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
            foreignKeyName: "bd_solicitacoes_equipamento_aprovador_centro_custo_id_fkey"
            columns: ["aprovador_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_aprovador_centro_custo_id_fkey"
            columns: ["aprovador_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
            foreignKeyName: "bd_solicitacoes_equipamento_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
            foreignKeyName: "bd_solicitacoes_itens_catalogo_equipamento_id_fkey"
            columns: ["catalogo_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_portfolio_tecnico_seguro"
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
            foreignKeyName: "bd_solicitacoes_itens_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_itens_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_operacional"
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
          content_hash: string | null
          created_at: string | null
          created_by: string | null
          data_prevista_entrega: string | null
          decisao: string | null
          id: string
          lock_version: number
          observacoes: string | null
          programado_em: string | null
          programado_por: string | null
          request_id: string | null
          responsavel_transporte_id: string | null
          revisao_de_planejamento_id: string | null
          solicitacao_id: string
          status: string | null
          status_planejamento: string
          updated_at: string | null
          updated_by: string | null
          usuario_transporte_id: string | null
          versao: number
          vigente: boolean
        }
        Insert: {
          content_hash?: string | null
          created_at?: string | null
          created_by?: string | null
          data_prevista_entrega?: string | null
          decisao?: string | null
          id?: string
          lock_version?: number
          observacoes?: string | null
          programado_em?: string | null
          programado_por?: string | null
          request_id?: string | null
          responsavel_transporte_id?: string | null
          revisao_de_planejamento_id?: string | null
          solicitacao_id: string
          status?: string | null
          status_planejamento?: string
          updated_at?: string | null
          updated_by?: string | null
          usuario_transporte_id?: string | null
          versao?: number
          vigente?: boolean
        }
        Update: {
          content_hash?: string | null
          created_at?: string | null
          created_by?: string | null
          data_prevista_entrega?: string | null
          decisao?: string | null
          id?: string
          lock_version?: number
          observacoes?: string | null
          programado_em?: string | null
          programado_por?: string | null
          request_id?: string | null
          responsavel_transporte_id?: string | null
          revisao_de_planejamento_id?: string | null
          solicitacao_id?: string
          status?: string | null
          status_planejamento?: string
          updated_at?: string | null
          updated_by?: string | null
          usuario_transporte_id?: string | null
          versao?: number
          vigente?: boolean
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
            foreignKeyName: "bd_solicitacoes_planejamento_responsavel_transporte_id_fkey"
            columns: ["responsavel_transporte_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_planejamento_responsavel_transporte_id_fkey"
            columns: ["responsavel_transporte_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_planejamento_revisao_de_planejamento_id_fkey"
            columns: ["revisao_de_planejamento_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_planejamento"
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
            foreignKeyName: "bd_solicitacoes_planejamento_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_planejamento_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_planejamento_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_planejamento_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_planejamento_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_planejamento_usuario_transporte_id_fkey"
            columns: ["usuario_transporte_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_planejamento_usuario_transporte_id_fkey"
            columns: ["usuario_transporte_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_planejamento_usuario_transporte_id_fkey"
            columns: ["usuario_transporte_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_solicitacoes_transferencia: {
        Row: {
          created_at: string
          created_by: string | null
          data_solicitacao: string
          diretor_area_nome_snapshot: string | null
          diretoria_financeira_nome_snapshot: string | null
          gerente_area_nome_snapshot: string | null
          id: string
          observacoes: string | null
          protocolo: string
          solicitante_id: string | null
          solicitante_nome_snapshot: string | null
          status: string
          total_funcionarios: number
          total_salarios: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_solicitacao?: string
          diretor_area_nome_snapshot?: string | null
          diretoria_financeira_nome_snapshot?: string | null
          gerente_area_nome_snapshot?: string | null
          id?: string
          observacoes?: string | null
          protocolo: string
          solicitante_id?: string | null
          solicitante_nome_snapshot?: string | null
          status?: string
          total_funcionarios?: number
          total_salarios?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_solicitacao?: string
          diretor_area_nome_snapshot?: string | null
          diretoria_financeira_nome_snapshot?: string | null
          gerente_area_nome_snapshot?: string | null
          id?: string
          observacoes?: string | null
          protocolo?: string
          solicitante_id?: string | null
          solicitante_nome_snapshot?: string | null
          status?: string
          total_funcionarios?: number
          total_salarios?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_sso_checklists_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_sso_checklists_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_sso_checklists_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_sso_checklists_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_sso_checklists_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_sso_ver_agir_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_sso_ver_agir_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_sso_ver_agir_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_sso_ver_agir_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_sso_ver_agir_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
            foreignKeyName: "bd_sso_ver_agir_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_sso_ver_agir_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
            foreignKeyName: "bd_sso_ver_agir_engenheiro_id_fkey"
            columns: ["engenheiro_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_sso_ver_agir_engenheiro_id_fkey"
            columns: ["engenheiro_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_sso_ver_agir_tecnico_seguranca_id_fkey"
            columns: ["tecnico_seguranca_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_sso_ver_agir_tecnico_seguranca_id_fkey"
            columns: ["tecnico_seguranca_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_sso_ver_agir_visto_gestao_por_fkey"
            columns: ["visto_gestao_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_sso_ver_agir_visto_gestao_por_fkey"
            columns: ["visto_gestao_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_sso_ver_agir_visto_gestao_por_fkey"
            columns: ["visto_gestao_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_storage_auditoria: {
        Row: {
          acao: string
          actor_user_id: string
          bucket_name: string
          created_at: string
          entidade_id: string | null
          entidade_tipo: string | null
          id: string
          metadata: Json
          object_path: string
        }
        Insert: {
          acao: string
          actor_user_id: string
          bucket_name: string
          created_at?: string
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          metadata?: Json
          object_path: string
        }
        Update: {
          acao?: string
          actor_user_id?: string
          bucket_name?: string
          created_at?: string
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          metadata?: Json
          object_path?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "bd_user_permission_overrides_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "vw_rbac_permissions_safe"
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
            foreignKeyName: "bd_user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "vw_rbac_roles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
          {
            foreignKeyName: "profiles_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mv_relatorio_diarias: {
        Row: {
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          data: string | null
          eh_excecao: boolean | null
          funcao_id: string | null
          funcionario_id: string | null
          nome_centro_custo: string | null
          nome_funcao: string | null
          nome_funcionario: string | null
          numero_solicitacao: string | null
          presenca_id: string | null
          presente: boolean | null
          recebe_refeicao: boolean | null
          solicitacao_id: string | null
          status_fluxo: string | null
          tem_presenca_real: boolean | null
          tipo_diaria: string | null
          usar_diaria_exclusiva: boolean | null
          valor_calculado: number | null
          valor_diaria_bruto_historico: number | null
          valor_diaria_suspeito_sem_presenca: number | null
          valor_refeicao: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "bd_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionarios_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "vw_funcoes_publicas"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_relatorio_diarias_legacy_20260514: {
        Row: {
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          data: string | null
          eh_excecao: boolean | null
          funcao_id: string | null
          funcionario_id: string | null
          nome_centro_custo: string | null
          nome_funcao: string | null
          nome_funcionario: string | null
          numero_solicitacao: string | null
          presenca_id: string | null
          presente: boolean | null
          recebe_refeicao: boolean | null
          solicitacao_id: string | null
          status_fluxo: string | null
          tipo_diaria: string | null
          usar_diaria_exclusiva: boolean | null
          valor_calculado: number | null
          valor_refeicao: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "bd_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_funcionarios_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "vw_funcoes_publicas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_apontamento_cam_equipa_seguro: {
        Row: {
          abastecimento: number | null
          caminhao_equipamento_id: string | null
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          created_at: string | null
          created_by: string | null
          data: string | null
          hora_final: string | null
          hora_inicial: string | null
          horimetro_final: number | null
          horimetro_inicial: number | null
          id: string | null
          nome_centro_custo: string | null
          operador_id: string | null
          operador_nome: string | null
          situacao: string | null
          updated_at: string | null
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
            foreignKeyName: "bd_registro_apontamento_cam_equipa_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_cam_equipa_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
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
            foreignKeyName: "bd_apontamento_equipe_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_apontamento_equipe_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
          {
            foreignKeyName: "bd_apontamento_equipe_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_apontamento_equipe_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_apontamento_equipe_seguro: {
        Row: {
          colaborador_id: string | null
          created_at: string | null
          data_registro: string | null
          equipe_id: string | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string | null
          lista_entrega_id: string | null
          nome_colaborador: string | null
          nome_equipe: string | null
          presente: boolean | null
          registrado_por: string | null
          registrado_por_nome: string | null
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
            foreignKeyName: "bd_apontamento_equipe_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_apontamento_equipe_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
          {
            foreignKeyName: "bd_apontamento_equipe_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_apontamento_equipe_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_aprovacoes_excecao_segura: {
        Row: {
          aprovado_por: string | null
          centro_custo_id: string | null
          created_at: string | null
          data_aprovacao: string | null
          id: string | null
          justificativa: string | null
          nome_centro_custo: string | null
          percentual_acima: number | null
          solicitacao_id: string | null
          status: string | null
          updated_at: string | null
          valor_proposto: number | null
          valor_referencia_interno: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_aprovacoes_excecao_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_equipamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_aprovacoes_excecao_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_aprovacoes_excecao_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_operacional"
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
        ]
      }
      vw_assinaturas_diarias_seguro: {
        Row: {
          adm_sede_funcionario_id: string | null
          aprovador_diarias_id: string | null
          cargo: string | null
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          data_assinatura: string | null
          documento_id: string | null
          etapa_exec_id: string | null
          hash_assinatura: string | null
          id: string | null
          nome_centro_custo: string | null
          nome_usuario: string | null
          numero_solicitacao: string | null
          responsavel_campo_id: string | null
          solicitacao_id: string | null
          solicitante_id: string | null
          tipo_assinatura: string | null
          usuario_id: string | null
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
            foreignKeyName: "bd_assinaturas_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "vw_documentos_fluxo_diarias_seguro"
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
          {
            foreignKeyName: "bd_centros_custo_adm_sede_funcionario_id_fkey"
            columns: ["adm_sede_funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_centros_custo_adm_sede_funcionario_id_fkey"
            columns: ["adm_sede_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_centros_custo_adm_sede_funcionario_id_fkey"
            columns: ["adm_sede_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_centros_custo_aprovador_diarias_id_fkey"
            columns: ["aprovador_diarias_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_centros_custo_aprovador_diarias_id_fkey"
            columns: ["aprovador_diarias_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_responsavel_campo_id_fkey"
            columns: ["responsavel_campo_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_responsavel_campo_id_fkey"
            columns: ["responsavel_campo_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_responsavel_campo_id_fkey"
            columns: ["responsavel_campo_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_ativos_logistica_manutencao: {
        Row: {
          aluguel: string | null
          ano_fabricacao: string | null
          capacidade: string | null
          capacidade_unidade: string | null
          capacidade_valor: number | null
          catalogo_equipamento_id: string | null
          categoria_ativo_id: string | null
          centro_custo_id: string | null
          chassi: string | null
          codigo_centro_custo: string | null
          cor: string | null
          created_at: string | null
          departamento_id: string | null
          empresa_id: string | null
          empresa_locadora_id: string | null
          fabricante: string | null
          fabricante_id: string | null
          frota: string | null
          frota_id: string | null
          id: string | null
          imagem_url: string | null
          informacoes_complementares: string | null
          latitude: number | null
          linha_operacional_id: string | null
          localizacao_data_registro: string | null
          localizacao_origem:
            | Database["public"]["Enums"]["origem_localizacao_enum"]
            | null
          longitude: number | null
          modelo_id: string | null
          modificado_por: string | null
          motor: string | null
          nome_centro_custo: string | null
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
          status_operacional:
            | Database["public"]["Enums"]["status_operacional_enum"]
            | null
          subcategoria_ativo_id: string | null
          tipo_ativo: string | null
          tipo_combustivel: string | null
          tipo_equipamento_id: string | null
          updated_at: string | null
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
            foreignKeyName: "bd_caminhoes_equipamentos_catalogo_equipamento_id_fkey"
            columns: ["catalogo_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_portfolio_tecnico_seguro"
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
        ]
      }
      vw_ativos_operacional: {
        Row: {
          categoria_ativo_id: string | null
          centro_custo_id: string | null
          fabricante: string | null
          frota: string | null
          id: string | null
          latitude_controlada: number | null
          localizacao_data_registro: string | null
          localizacao_origem:
            | Database["public"]["Enums"]["origem_localizacao_enum"]
            | null
          longitude_controlada: number | null
          nome_centro_custo: string | null
          numero_frota: string | null
          placa: string | null
          situacao: string | null
          status_disponibilidade: string | null
          status_operacional:
            | Database["public"]["Enums"]["status_operacional_enum"]
            | null
          subcategoria_ativo_id: string | null
          tipo_ativo: string | null
          tipo_equipamento_id: string | null
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_disponibilidade_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
        ]
      }
      vw_auditoria_log_completo: {
        Row: {
          arquivado: boolean | null
          campos_alterados: string[] | null
          created_at: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string | null
          operacao: string | null
          registro_id: string | null
          tabela: string | null
          usuario_id: string | null
        }
        Relationships: []
      }
      vw_auditoria_sistema: {
        Row: {
          categoria: string | null
          created_at: string | null
          funcionario_id: string | null
          funcionario_nome: string | null
          hash_anterior: string | null
          hash_novo: string | null
          id: string | null
          ip: string | null
          is_suspeito: boolean | null
          metadata: Json | null
          motivos_risco: Json | null
          nivel_risco: string | null
          origem: string | null
          tipo_evento: string | null
          user_agent: string | null
          usuario_email: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Relationships: []
      }
      vw_bi_diarias_financeiro_indicadores: {
        Row: {
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          competencia: string | null
          nome_centro_custo: string | null
          total_diarias: number | null
          total_funcionarios_pagamento: number | null
          total_presencas: number | null
          total_refeicoes: number | null
        }
        Relationships: []
      }
      vw_bi_diarias_gerencial_indicadores: {
        Row: {
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          competencia: string | null
          nome_centro_custo: string | null
          total_diarias: number | null
          total_funcionarios: number | null
          total_presencas: number | null
          total_refeicoes: number | null
        }
        Relationships: []
      }
      vw_bi_diarias_operacional_indicadores: {
        Row: {
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          competencia: string | null
          nome_centro_custo: string | null
          status_solicitacao: string | null
          total_funcionarios: number | null
          total_presencas: number | null
          total_solicitacoes: number | null
        }
        Relationships: []
      }
      vw_bi_licitacoes_indicadores: {
        Row: {
          competencia: string | null
          modalidade_contratacao: string | null
          status_analise: string | null
          total_licitacoes: number | null
          uf: string | null
          valor_estimado_total: number | null
        }
        Relationships: []
      }
      vw_bi_maquinas_estrategico_indicadores: {
        Row: {
          departamento_id: string | null
          proprietario_tipo: string | null
          status_cadastro: string | null
          status_disponibilidade: string | null
          tipo_ativo: string | null
          total_ativos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_caminhoes_equipamentos_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "bd_departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_bi_maquinas_operacional_indicadores: {
        Row: {
          departamento_id: string | null
          status_disponibilidade: string | null
          tipo_ativo: string | null
          total_ativos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_caminhoes_equipamentos_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "bd_departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_bi_os_estrategico_indicadores: {
        Row: {
          centro_custo_id: string | null
          competencia: string | null
          status: string | null
          total_linhas_mao_obra: number | null
          total_linhas_materiais: number | null
          total_os: number | null
          valor_servico_total: number | null
        }
        Relationships: [
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
        ]
      }
      vw_bi_os_operacional_indicadores: {
        Row: {
          centro_custo_id: string | null
          competencia: string | null
          status: string | null
          tipo_manutencao: string | null
          total_abertas: number | null
          total_os: number | null
        }
        Relationships: [
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
        ]
      }
      vw_bi_rh_estrategico_indicadores: {
        Row: {
          centro_custo_id: string | null
          departamento_id: string | null
          diarias_total: number | null
          refeicao_total: number | null
          salario_base_medio: number | null
          salario_base_total: number | null
          total_ativos: number | null
          total_funcionarios: number | null
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
        ]
      }
      vw_bi_rh_operacional_indicadores: {
        Row: {
          centro_custo_id: string | null
          departamento_id: string | null
          status: string | null
          total_ativos: number | null
          total_funcionarios: number | null
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
        ]
      }
      vw_bi_sso_indicadores: {
        Row: {
          competencia: string | null
          nota_media: number | null
          obra_id: string | null
          resultado_avaliacao: string | null
          total_aplicaveis: number | null
          total_checklists: number | null
          total_conformes: number | null
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_sso_checklists_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_sso_checklists_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_sso_checklists_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_sso_checklists_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_sso_checklists_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
      vw_chamados_os_operacional_seguro: {
        Row: {
          caminhao_equipamento_id: string | null
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          created_at: string | null
          data_solicitacao: string | null
          descricao_problema: string | null
          fotos_avarias: string[] | null
          hora_solicitacao: string | null
          id: string | null
          nome_centro_custo: string | null
          numero_chamado: string | null
          placa: string | null
          prioridade: string | null
          solicitante_id: string | null
          solicitante_nome: string | null
          status: string | null
          tipo_falha: string | null
          updated_at: string | null
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
            foreignKeyName: "bd_chamados_os_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_chamados_os_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_chamados_os_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
          {
            foreignKeyName: "bd_chamados_os_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_chamados_os_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_cotacoes_segura: {
        Row: {
          centro_custo_id: string | null
          created_at: string | null
          data_abertura: string | null
          id: string | null
          itens: Json | null
          nome_centro_custo: string | null
          propostas: Json | null
          solicitacao_id: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_cotacoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_solicitacoes_equipamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_cotacoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_cotacoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vw_solicitacoes_equipamento_operacional"
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
        ]
      }
      vw_custos_equipamentos_seguro: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          equipamento_id: string | null
          frota: string | null
          id: string | null
          numero_frota: string | null
          tipo_equipamento_descricao: string | null
          tipo_equipamento_id: string | null
          updated_at: string | null
          valor_diaria: number | null
          valor_hora: number | null
          valor_mensal: number | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
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
            foreignKeyName: "bd_custos_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_custos_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
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
      vw_diaria_aprovacoes_efetivas: {
        Row: {
          data: string | null
          funcao_id: string | null
          funcionario_id: string | null
          lote_id: string | null
          solicitacao_id: string | null
          usar_diaria_exclusiva: boolean | null
          valor_diaria: number | null
          valor_diaria_exclusiva: number | null
          valor_refeicao: number | null
        }
        Insert: {
          data?: string | null
          funcao_id?: string | null
          funcionario_id?: string | null
          lote_id?: string | null
          solicitacao_id?: string | null
          usar_diaria_exclusiva?: boolean | null
          valor_diaria?: number | null
          valor_diaria_exclusiva?: number | null
          valor_refeicao?: number | null
        }
        Update: {
          data?: string | null
          funcao_id?: string | null
          funcionario_id?: string | null
          lote_id?: string | null
          solicitacao_id?: string | null
          usar_diaria_exclusiva?: boolean | null
          valor_diaria?: number | null
          valor_diaria_exclusiva?: number | null
          valor_refeicao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_diaria_lote_funcionarios_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_lotes_convocacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_lote_funcionarios_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_diaria_relatorio_financeiro: {
        Row: {
          classificacao_financeira: string | null
          confirmado_em: string | null
          confirmado_por: string | null
          conflito_solicitacao_id: string | null
          created_at: string | null
          data: string | null
          excecao_aprovada_em: string | null
          excecao_aprovada_por: string | null
          funcao_id: string | null
          funcionario_id: string | null
          hora_entrada: string | null
          hora_saida: string | null
          id: string | null
          intervalo_fim: string | null
          intervalo_inicio: string | null
          is_excecao: boolean | null
          justificativa_excecao: string | null
          modificado_por: string | null
          observacoes: string | null
          presente: boolean | null
          recebe_refeicao: boolean | null
          solicitacao_id: string | null
          tem_presenca_real: boolean | null
          tipo_apontamento: string | null
          tipo_diaria: string | null
          turno: string | null
          updated_at: string | null
          usar_diaria_exclusiva: boolean | null
          valor_diaria_aplicada: number | null
          valor_diaria_bruto_historico: number | null
          valor_diaria_suspeito_sem_presenca: number | null
          valor_financeiro_efetivo: number | null
          valor_refeicao_aplicado: number | null
          valor_refeicao_efetivo: number | null
        }
        Insert: {
          classificacao_financeira?: never
          confirmado_em?: string | null
          confirmado_por?: string | null
          conflito_solicitacao_id?: string | null
          created_at?: string | null
          data?: string | null
          excecao_aprovada_em?: string | null
          excecao_aprovada_por?: string | null
          funcao_id?: string | null
          funcionario_id?: string | null
          hora_entrada?: string | null
          hora_saida?: string | null
          id?: string | null
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          is_excecao?: boolean | null
          justificativa_excecao?: string | null
          modificado_por?: string | null
          observacoes?: string | null
          presente?: boolean | null
          recebe_refeicao?: boolean | null
          solicitacao_id?: string | null
          tem_presenca_real?: never
          tipo_apontamento?: string | null
          tipo_diaria?: string | null
          turno?: string | null
          updated_at?: string | null
          usar_diaria_exclusiva?: boolean | null
          valor_diaria_aplicada?: number | null
          valor_diaria_bruto_historico?: never
          valor_diaria_suspeito_sem_presenca?: never
          valor_financeiro_efetivo?: never
          valor_refeicao_aplicado?: number | null
          valor_refeicao_efetivo?: never
        }
        Update: {
          classificacao_financeira?: never
          confirmado_em?: string | null
          confirmado_por?: string | null
          conflito_solicitacao_id?: string | null
          created_at?: string | null
          data?: string | null
          excecao_aprovada_em?: string | null
          excecao_aprovada_por?: string | null
          funcao_id?: string | null
          funcionario_id?: string | null
          hora_entrada?: string | null
          hora_saida?: string | null
          id?: string | null
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          is_excecao?: boolean | null
          justificativa_excecao?: string | null
          modificado_por?: string | null
          observacoes?: string | null
          presente?: boolean | null
          recebe_refeicao?: boolean | null
          solicitacao_id?: string | null
          tem_presenca_real?: never
          tipo_apontamento?: string | null
          tipo_diaria?: string | null
          turno?: string | null
          updated_at?: string | null
          usar_diaria_exclusiva?: boolean | null
          valor_diaria_aplicada?: number | null
          valor_diaria_bruto_historico?: never
          valor_diaria_suspeito_sem_presenca?: never
          valor_financeiro_efetivo?: never
          valor_refeicao_aplicado?: number | null
          valor_refeicao_efetivo?: never
        }
        Relationships: [
          {
            foreignKeyName: "bd_diaria_presencas_conflito_solicitacao_id_fkey"
            columns: ["conflito_solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
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
            foreignKeyName: "bd_diaria_presencas_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "vw_funcoes_publicas"
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
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
      vw_diarias_aprovacao_gerencial: {
        Row: {
          apontador_id: string | null
          apontador_nome: string | null
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          confirmado_em: string | null
          confirmado_por: string | null
          cpf_mascarado: string | null
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
          tem_presenca_real: boolean | null
          tipo_diaria: string | null
          usar_diaria_exclusiva: boolean | null
          usar_diaria_exclusiva_calendario: boolean | null
          valor_diaria_aplicada: number | null
          valor_diaria_bruto_historico: number | null
          valor_diaria_suspeito_sem_presenca: number | null
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
            foreignKeyName: "bd_diaria_apontamentos_responsavel_campo_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_apontamentos_responsavel_campo_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_diaria_presencas_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "vw_funcoes_publicas"
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
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_diaria_solicitacoes_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
      vw_diarias_financeiro_dp: {
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
          tem_presenca_real: boolean | null
          tipo_diaria: string | null
          usar_diaria_exclusiva: boolean | null
          usar_diaria_exclusiva_calendario: boolean | null
          valor_diaria_aplicada: number | null
          valor_diaria_bruto_historico: number | null
          valor_diaria_suspeito_sem_presenca: number | null
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
            foreignKeyName: "bd_diaria_apontamentos_responsavel_campo_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_apontamentos_responsavel_campo_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_diaria_presencas_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "vw_funcoes_publicas"
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
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_diaria_solicitacoes_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
      vw_diarias_operacional_campo: {
        Row: {
          apontador_id: string | null
          apontador_nome: string | null
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          confirmado_em: string | null
          confirmado_por: string | null
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
          presenca_id: string | null
          presenca_status: string | null
          solicitacao_data_fim: string | null
          solicitacao_data_inicio: string | null
          solicitacao_id: string | null
          solicitante_id: string | null
          solicitante_nome: string | null
          status_funcionario: string | null
          status_solicitacao: string | null
          tipo_diaria: string | null
          usar_diaria_exclusiva: boolean | null
          usar_diaria_exclusiva_calendario: boolean | null
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
            foreignKeyName: "bd_diaria_apontamentos_responsavel_campo_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_apontamentos_responsavel_campo_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_diaria_presencas_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "vw_funcoes_publicas"
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
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_diaria_solicitacoes_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
      vw_documentos_fluxo_diarias_seguro: {
        Row: {
          adm_sede_funcionario_id: string | null
          aprovador_diarias_id: string | null
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          criado_em: string | null
          criado_por: string | null
          etapa_origem: number | null
          id: string | null
          nome_centro_custo: string | null
          numero_solicitacao: string | null
          responsavel_campo_id: string | null
          solicitacao_id: string | null
          solicitante_id: string | null
          tipo_documento: string | null
          url_arquivo: string | null
          versao: number | null
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
            foreignKeyName: "bd_centros_custo_adm_sede_funcionario_id_fkey"
            columns: ["adm_sede_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_centros_custo_adm_sede_funcionario_id_fkey"
            columns: ["adm_sede_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_centros_custo_aprovador_diarias_id_fkey"
            columns: ["aprovador_diarias_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_centros_custo_aprovador_diarias_id_fkey"
            columns: ["aprovador_diarias_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_responsavel_campo_id_fkey"
            columns: ["responsavel_campo_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_responsavel_campo_id_fkey"
            columns: ["responsavel_campo_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_responsavel_campo_id_fkey"
            columns: ["responsavel_campo_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_documentos_fluxo_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "bd_diaria_solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_funcionarios_operacional: {
        Row: {
          centro_custo_id: string | null
          cpf: string | null
          data_admissao: string | null
          departamento_id: string | null
          email: string | null
          empresa_id: string | null
          equipe_id: string | null
          funcao_id: string | null
          id: string | null
          imagem: string | null
          matricula: string | null
          nome_centro_custo: string | null
          nome_completo: string | null
          nome_departamento: string | null
          nome_empresa: string | null
          nome_funcao: string | null
          status: string | null
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
          {
            foreignKeyName: "bd_funcionarios_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "vw_funcoes_publicas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_funcionarios_rh: {
        Row: {
          adicional_noturno: number | null
          agencia: string | null
          banco: string | null
          centro_custo_id: string | null
          chave_pix: string | null
          codigo_centro_custo: string | null
          conta_corrente: string | null
          cpf: string | null
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
          id: string | null
          imagem: string | null
          insalubridade: number | null
          matricula: string | null
          nome_centro_custo: string | null
          nome_completo: string | null
          nome_departamento: string | null
          nome_empresa: string | null
          nome_equipe: string | null
          nome_funcao: string | null
          observacoes: string | null
          periculosidade: number | null
          refeicao: number | null
          salario_base: number | null
          status: string | null
          tipo_escala: string | null
          updated_at: string | null
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
          {
            foreignKeyName: "bd_funcionarios_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "vw_funcoes_publicas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_funcoes_publicas: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string | null
          nome_funcao: string | null
          situacao: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string | null
          nome_funcao?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string | null
          nome_funcao?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vw_lista_programacao_entrega_segura: {
        Row: {
          apontador_id: string | null
          apontador_nome: string | null
          caminhao_id: string | null
          created_at: string | null
          data_entrega: string | null
          equipe_id: string | null
          id: string | null
          logradouro: string | null
          nome_equipe: string | null
          programacao_entrega_id: string | null
          quantidade_massa: number | null
          requisicao_id: string | null
          requisicao_numero: string | null
          status: string | null
          tipo_lancamento: string | null
          updated_at: string | null
          usina_id: string | null
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
            foreignKeyName: "bd_lista_programacao_entrega_apontador_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_lista_programacao_entrega_apontador_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_lista_programacao_entrega_caminhao_id_fkey"
            columns: ["caminhao_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_lista_programacao_entrega_caminhao_id_fkey"
            columns: ["caminhao_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
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
            foreignKeyName: "bd_lista_programacao_entrega_programacao_entrega_id_fkey"
            columns: ["programacao_entrega_id"]
            isOneToOne: false
            referencedRelation: "vw_programacao_entrega_segura"
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
            foreignKeyName: "bd_lista_programacao_entrega_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "vw_requisicoes_operacional_segura"
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
      vw_localizacao_equipamentos_controlada: {
        Row: {
          centro_custo_id: string | null
          data_registro: string | null
          equipamento_id: string | null
          id: string | null
          latitude_controlada: number | null
          longitude_controlada: number | null
          origem: Database["public"]["Enums"]["origem_localizacao_enum"] | null
        }
        Insert: {
          centro_custo_id?: string | null
          data_registro?: string | null
          equipamento_id?: string | null
          id?: string | null
          latitude_controlada?: never
          longitude_controlada?: never
          origem?: Database["public"]["Enums"]["origem_localizacao_enum"] | null
        }
        Update: {
          centro_custo_id?: string | null
          data_registro?: string | null
          equipamento_id?: string | null
          id?: string | null
          latitude_controlada?: never
          longitude_controlada?: never
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_localizacao_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_localizacao_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_localizacao_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_localizacao_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_localizacao_equipamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
          {
            foreignKeyName: "bd_localizacao_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_localizacao_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_logistica_relatorio_gerencial_seguro: {
        Row: {
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          data_entrega: string | null
          nome_centro_custo: string | null
          total_aplicacoes: number | null
          total_cargas: number | null
          total_entregas: number | null
          total_tonelada_aplicada: number | null
          total_tonelada_real: number | null
          total_tonelada_saida: number | null
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_programacao_entrega_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_programacao_entrega_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_programacao_entrega_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_programacao_entrega_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_programacao_entrega_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_programacao_entrega_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
        ]
      }
      vw_ordem_diaria_item_ultimo_apontamento: {
        Row: {
          apontamento_id: string | null
          centro_custo_id: string | null
          data_referencia: string | null
          item_id: string | null
          meta_dia_origem: string | null
          meta_dia_snapshot: number | null
          motivo_impedimento: string | null
          observacao: string | null
          ordem_id: string | null
          percentual_realizado: number | null
          quantidade_executada: number | null
          registrado_em: string | null
          registrado_por: string | null
          registrado_por_nome_snapshot: string | null
          status_execucao: string | null
          unidade_snapshot: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_ordens_diarias_obra_apontamentos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "bd_ordens_diarias_obra_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_apontamentos_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "bd_ordens_diarias_obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_apontamentos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_apontamentos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_diarias_obra_apontamentos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_ordens_servico_admin_seguro: {
        Row: {
          caminhao_equipamento_id: string | null
          chamado_id: string | null
          created_at: string | null
          data_abertura: string | null
          descricao_servico: string | null
          duracao_total: string | null
          encerrado_por_id: string | null
          executado_por_id: string | null
          horimetro_odometro_final: string | null
          horimetro_odometro_inicial: string | null
          id: string | null
          mecanico_id: string | null
          mecanico_nome: string | null
          numero_os: string | null
          obra_patio: string | null
          placa: string | null
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
        Relationships: [
          {
            foreignKeyName: "bd_ordens_servico_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "bd_caminhoes_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_servico_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_servico_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
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
            foreignKeyName: "bd_ordens_servico_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "vw_chamados_os_operacional_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_servico_mecanico_id_fkey"
            columns: ["mecanico_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_servico_mecanico_id_fkey"
            columns: ["mecanico_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_servico_mecanico_id_fkey"
            columns: ["mecanico_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_ordens_servico_operacional_seguro: {
        Row: {
          caminhao_equipamento_id: string | null
          chamado_id: string | null
          created_at: string | null
          data_abertura: string | null
          data_encerramento_atendimento: string | null
          data_inicio_atendimento: string | null
          descricao_servico: string | null
          encerrado_por_id: string | null
          executado_por_id: string | null
          hora_encerramento_atendimento: string | null
          hora_inicio_atendimento: string | null
          id: string | null
          mecanico_id: string | null
          mecanico_nome: string | null
          numero_os: string | null
          placa: string | null
          status: string | null
          tipo_manutencao: string | null
          tipo_servico: string | null
          updated_at: string | null
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
            foreignKeyName: "bd_ordens_servico_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_logistica_manutencao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_servico_caminhao_equipamento_id_fkey"
            columns: ["caminhao_equipamento_id"]
            isOneToOne: false
            referencedRelation: "vw_ativos_operacional"
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
            foreignKeyName: "bd_ordens_servico_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "vw_chamados_os_operacional_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_servico_mecanico_id_fkey"
            columns: ["mecanico_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_servico_mecanico_id_fkey"
            columns: ["mecanico_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ordens_servico_mecanico_id_fkey"
            columns: ["mecanico_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_os_custos_resumido_seguro: {
        Row: {
          numero_os: string | null
          os_id: string | null
          total_itens_mao_obra: number | null
          total_itens_materiais: number | null
          valor_servico: number | null
        }
        Relationships: []
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
      vw_pncp_contratacoes_estrategico: {
        Row: {
          created_at: string | null
          data_fim_propostas: string | null
          data_inicio_propostas: string | null
          data_marcacao_participando: string | null
          data_publicacao: string | null
          descartada: boolean | null
          grupos_match: string[] | null
          id: string | null
          link_origem_pncp: string | null
          match_termos: string[] | null
          modalidade_contratacao: string | null
          municipio_ibge: string | null
          municipio_nome: string | null
          numero_controle_pncp: string | null
          objeto: string | null
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
          id?: string | null
          link_origem_pncp?: string | null
          match_termos?: string[] | null
          modalidade_contratacao?: string | null
          municipio_ibge?: string | null
          municipio_nome?: string | null
          numero_controle_pncp?: string | null
          objeto?: string | null
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
          id?: string | null
          link_origem_pncp?: string | null
          match_termos?: string[] | null
          modalidade_contratacao?: string | null
          municipio_ibge?: string | null
          municipio_nome?: string | null
          numero_controle_pncp?: string | null
          objeto?: string | null
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
      vw_pncp_contratacoes_operacional: {
        Row: {
          created_at: string | null
          data_fim_propostas: string | null
          data_inicio_propostas: string | null
          data_marcacao_participando: string | null
          data_publicacao: string | null
          descartada: boolean | null
          id: string | null
          link_origem_pncp: string | null
          modalidade_contratacao: string | null
          municipio_ibge: string | null
          municipio_nome: string | null
          numero_controle_pncp: string | null
          objeto: string | null
          orgao_cnpj: string | null
          orgao_id: string | null
          orgao_nome: string | null
          orgao_sigla: string | null
          participando: boolean | null
          status_resultado: string | null
          uf: string | null
          unidade_nome: string | null
          updated_at: string | null
          valor_total_estimado: number | null
        }
        Insert: {
          created_at?: string | null
          data_fim_propostas?: string | null
          data_inicio_propostas?: string | null
          data_marcacao_participando?: string | null
          data_publicacao?: string | null
          descartada?: boolean | null
          id?: string | null
          link_origem_pncp?: string | null
          modalidade_contratacao?: string | null
          municipio_ibge?: string | null
          municipio_nome?: string | null
          numero_controle_pncp?: string | null
          objeto?: string | null
          orgao_cnpj?: string | null
          orgao_id?: string | null
          orgao_nome?: string | null
          orgao_sigla?: string | null
          participando?: boolean | null
          status_resultado?: string | null
          uf?: string | null
          unidade_nome?: string | null
          updated_at?: string | null
          valor_total_estimado?: number | null
        }
        Update: {
          created_at?: string | null
          data_fim_propostas?: string | null
          data_inicio_propostas?: string | null
          data_marcacao_participando?: string | null
          data_publicacao?: string | null
          descartada?: boolean | null
          id?: string | null
          link_origem_pncp?: string | null
          modalidade_contratacao?: string | null
          municipio_ibge?: string | null
          municipio_nome?: string | null
          numero_controle_pncp?: string | null
          objeto?: string | null
          orgao_cnpj?: string | null
          orgao_id?: string | null
          orgao_nome?: string | null
          orgao_sigla?: string | null
          participando?: boolean | null
          status_resultado?: string | null
          uf?: string | null
          unidade_nome?: string | null
          updated_at?: string | null
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
        ]
      }
      vw_ponto_batidas_gestao: {
        Row: {
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          created_at: string | null
          data_hora_considerada: string | null
          data_operacional: string | null
          dentro_raio: boolean | null
          distancia_centro_metros: number | null
          funcionario_id: string | null
          funcionario_matricula: string | null
          funcionario_nome: string | null
          id: string | null
          justificativa: string | null
          latitude_controlada: number | null
          longitude_controlada: number | null
          modo_registro:
            | Database["public"]["Enums"]["ponto_modo_registro"]
            | null
          nome_centro_custo: string | null
          score_risco: number | null
          status_sync: Database["public"]["Enums"]["ponto_status_sync"] | null
          status_validacao:
            | Database["public"]["Enums"]["ponto_status_validacao"]
            | null
          tipo_batida: Database["public"]["Enums"]["ponto_tipo_batida"] | null
          tipo_registro: string | null
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_funcionarios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_ponto_batidas_pessoal: {
        Row: {
          centro_custo_id: string | null
          created_at: string | null
          data_hora_considerada: string | null
          data_hora_dispositivo: string | null
          data_hora_servidor: string | null
          data_operacional: string | null
          dentro_raio: boolean | null
          dispositivo_id: string | null
          funcionario_id: string | null
          id: string | null
          justificativa: string | null
          latitude_aproximada: number | null
          longitude_aproximada: number | null
          modo_registro:
            | Database["public"]["Enums"]["ponto_modo_registro"]
            | null
          score_risco: number | null
          status_sync: Database["public"]["Enums"]["ponto_status_sync"] | null
          status_validacao:
            | Database["public"]["Enums"]["ponto_status_validacao"]
            | null
          tipo_batida: Database["public"]["Enums"]["ponto_tipo_batida"] | null
          tipo_registro: string | null
          updated_at: string | null
        }
        Insert: {
          centro_custo_id?: string | null
          created_at?: string | null
          data_hora_considerada?: string | null
          data_hora_dispositivo?: string | null
          data_hora_servidor?: string | null
          data_operacional?: string | null
          dentro_raio?: boolean | null
          dispositivo_id?: string | null
          funcionario_id?: string | null
          id?: string | null
          justificativa?: string | null
          latitude_aproximada?: never
          longitude_aproximada?: never
          modo_registro?:
            | Database["public"]["Enums"]["ponto_modo_registro"]
            | null
          score_risco?: number | null
          status_sync?: Database["public"]["Enums"]["ponto_status_sync"] | null
          status_validacao?:
            | Database["public"]["Enums"]["ponto_status_validacao"]
            | null
          tipo_batida?: Database["public"]["Enums"]["ponto_tipo_batida"] | null
          tipo_registro?: string | null
          updated_at?: string | null
        }
        Update: {
          centro_custo_id?: string | null
          created_at?: string | null
          data_hora_considerada?: string | null
          data_hora_dispositivo?: string | null
          data_hora_servidor?: string | null
          data_operacional?: string | null
          dentro_raio?: boolean | null
          dispositivo_id?: string | null
          funcionario_id?: string | null
          id?: string | null
          justificativa?: string | null
          latitude_aproximada?: never
          longitude_aproximada?: never
          modo_registro?:
            | Database["public"]["Enums"]["ponto_modo_registro"]
            | null
          score_risco?: number | null
          status_sync?: Database["public"]["Enums"]["ponto_status_sync"] | null
          status_validacao?:
            | Database["public"]["Enums"]["ponto_status_validacao"]
            | null
          tipo_batida?: Database["public"]["Enums"]["ponto_tipo_batida"] | null
          tipo_registro?: string | null
          updated_at?: string | null
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
            foreignKeyName: "bd_ponto_batidas_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_dispositivos_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_dispositivos_seguro"
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
            foreignKeyName: "bd_ponto_batidas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_ponto_batidas_rh: {
        Row: {
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          codigo_dispositivo: string | null
          created_at: string | null
          data_hora_considerada: string | null
          data_hora_dispositivo: string | null
          data_hora_servidor: string | null
          data_operacional: string | null
          dentro_raio: boolean | null
          device_fingerprint: string | null
          dispositivo_id: string | null
          dispositivo_nome: string | null
          dispositivo_obra_id: string | null
          distancia_centro_metros: number | null
          foto_hash: string | null
          foto_url: string | null
          funcionario_cpf: string | null
          funcionario_id: string | null
          funcionario_matricula: string | null
          funcionario_nome: string | null
          id: string | null
          ip_address: string | null
          justificativa: string | null
          latitude: number | null
          longitude: number | null
          modificado_por: string | null
          modo_registro:
            | Database["public"]["Enums"]["ponto_modo_registro"]
            | null
          nome_centro_custo: string | null
          offline_uuid: string | null
          operador_id: string | null
          origem_dados: string | null
          precisao_gps_metros: number | null
          score_risco: number | null
          status_sync: Database["public"]["Enums"]["ponto_status_sync"] | null
          status_validacao:
            | Database["public"]["Enums"]["ponto_status_validacao"]
            | null
          tipo_batida: Database["public"]["Enums"]["ponto_tipo_batida"] | null
          tipo_registro: string | null
          updated_at: string | null
          user_agent: string | null
          validado_em: string | null
          validado_por: string | null
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
            foreignKeyName: "bd_ponto_batidas_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_dispositivos_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_dispositivos_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_dispositivo_obra_id_fkey"
            columns: ["dispositivo_obra_id"]
            isOneToOne: false
            referencedRelation: "bd_ponto_dispositivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_dispositivo_obra_id_fkey"
            columns: ["dispositivo_obra_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_dispositivos_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_dispositivo_obra_id_fkey"
            columns: ["dispositivo_obra_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_dispositivos_seguro"
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
            foreignKeyName: "bd_ponto_batidas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_ponto_diaria_shadow: {
        Row: {
          batida_id: string | null
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          created_at: string | null
          data_operacional: string | null
          detalhes: Json | null
          funcionario_id: string | null
          funcionario_nome: string | null
          id: string | null
          motivo: string | null
          nome_centro_custo: string | null
          solicitacao_id: string | null
          status: string | null
          tipo_batida: string | null
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
            foreignKeyName: "bd_ponto_diaria_integracao_batida_id_fkey"
            columns: ["batida_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_batidas_gestao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_batida_id_fkey"
            columns: ["batida_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_batidas_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_batida_id_fkey"
            columns: ["batida_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_batidas_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_batida_id_fkey"
            columns: ["batida_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_logs_antifraude_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "bd_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_diaria_integracao_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
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
      vw_ponto_dispositivos_admin: {
        Row: {
          ativo: boolean | null
          centro_custo_id: string | null
          codigo_dispositivo: string | null
          created_at: string | null
          device_fingerprint: string | null
          id: string | null
          modo_operacao: string | null
          nome: string | null
          tem_senha: boolean | null
          tipo: string | null
          ultimo_heartbeat: string | null
          ultimo_login_at: string | null
          ultimo_login_ip: unknown
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          centro_custo_id?: string | null
          codigo_dispositivo?: string | null
          created_at?: string | null
          device_fingerprint?: string | null
          id?: string | null
          modo_operacao?: string | null
          nome?: string | null
          tem_senha?: never
          tipo?: string | null
          ultimo_heartbeat?: string | null
          ultimo_login_at?: string | null
          ultimo_login_ip?: unknown
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          centro_custo_id?: string | null
          codigo_dispositivo?: string | null
          created_at?: string | null
          device_fingerprint?: string | null
          id?: string | null
          modo_operacao?: string | null
          nome?: string | null
          tem_senha?: never
          tipo?: string | null
          ultimo_heartbeat?: string | null
          ultimo_login_at?: string | null
          ultimo_login_ip?: unknown
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
        ]
      }
      vw_ponto_dispositivos_seguro: {
        Row: {
          ativo: boolean | null
          centro_custo_id: string | null
          codigo_dispositivo: string | null
          created_at: string | null
          device_fingerprint: string | null
          device_secret_hash_masked: string | null
          id: string | null
          modo_operacao: string | null
          nome: string | null
          tem_senha: boolean | null
          tipo: string | null
          ultimo_heartbeat: string | null
          ultimo_login_at: string | null
          ultimo_login_ip: unknown
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          centro_custo_id?: string | null
          codigo_dispositivo?: string | null
          created_at?: string | null
          device_fingerprint?: never
          device_secret_hash_masked?: never
          id?: string | null
          modo_operacao?: string | null
          nome?: string | null
          tem_senha?: never
          tipo?: string | null
          ultimo_heartbeat?: string | null
          ultimo_login_at?: string | null
          ultimo_login_ip?: unknown
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          centro_custo_id?: string | null
          codigo_dispositivo?: string | null
          created_at?: string | null
          device_fingerprint?: never
          device_secret_hash_masked?: never
          id?: string | null
          modo_operacao?: string | null
          nome?: string | null
          tem_senha?: never
          tipo?: string | null
          ultimo_heartbeat?: string | null
          ultimo_login_at?: string | null
          ultimo_login_ip?: unknown
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_dispositivos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
          },
        ]
      }
      vw_ponto_logs_antifraude_seguro: {
        Row: {
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          codigo_dispositivo: string | null
          created_at: string | null
          data_hora_considerada: string | null
          dentro_raio: boolean | null
          device_fingerprint: string | null
          dispositivo_id: string | null
          dispositivo_nome: string | null
          distancia_centro_metros: number | null
          foto_hash: string | null
          funcionario_id: string | null
          funcionario_matricula: string | null
          funcionario_nome: string | null
          id: string | null
          ip_address: string | null
          justificativa: string | null
          latitude: number | null
          longitude: number | null
          modo_registro:
            | Database["public"]["Enums"]["ponto_modo_registro"]
            | null
          nome_centro_custo: string | null
          offline_uuid: string | null
          origem_dados: string | null
          precisao_gps_metros: number | null
          score_risco: number | null
          status_sync: Database["public"]["Enums"]["ponto_status_sync"] | null
          status_validacao:
            | Database["public"]["Enums"]["ponto_status_validacao"]
            | null
          tipo_batida: Database["public"]["Enums"]["ponto_tipo_batida"] | null
          updated_at: string | null
          user_agent: string | null
          validado_em: string | null
          validado_por: string | null
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
            foreignKeyName: "bd_ponto_batidas_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_dispositivos_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "vw_ponto_dispositivos_seguro"
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
            foreignKeyName: "bd_ponto_batidas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_ponto_batidas_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_portfolio_tecnico_seguro: {
        Row: {
          ano_fabricacao_padrao: number | null
          ativo: boolean | null
          capacidade: string | null
          cor_padrao: string | null
          descricao_padrao: string | null
          fabricante_nome: string | null
          id: string | null
          imagem_url: string | null
          motor_padrao: string | null
          nome_modelo: string | null
          nome_subcategoria: string | null
          potencia: string | null
          tipo_equipamento_descricao: string | null
        }
        Relationships: []
      }
      vw_profile_self_safe: {
        Row: {
          acesso_global: boolean | null
          email: string | null
          funcao_sistema: string | null
          funcionario_id: string | null
          id: string | null
          imagem_url: string | null
          nome_completo: string | null
          updated_at: string | null
        }
        Insert: {
          acesso_global?: boolean | null
          email?: string | null
          funcao_sistema?: string | null
          funcionario_id?: string | null
          id?: string | null
          imagem_url?: string | null
          nome_completo?: string | null
          updated_at?: string | null
        }
        Update: {
          acesso_global?: boolean | null
          email?: string | null
          funcao_sistema?: string | null
          funcionario_id?: string | null
          id?: string | null
          imagem_url?: string | null
          nome_completo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_profiles_admin_safe: {
        Row: {
          acesso_global: boolean | null
          created_at: string | null
          email: string | null
          funcao_sistema: string | null
          funcionario_id: string | null
          id: string | null
          imagem_url: string | null
          nome_completo: string | null
          updated_at: string | null
        }
        Insert: {
          acesso_global?: boolean | null
          created_at?: string | null
          email?: string | null
          funcao_sistema?: string | null
          funcionario_id?: string | null
          id?: string | null
          imagem_url?: string | null
          nome_completo?: string | null
          updated_at?: string | null
        }
        Update: {
          acesso_global?: boolean | null
          created_at?: string | null
          email?: string | null
          funcao_sistema?: string | null
          funcionario_id?: string | null
          id?: string | null
          imagem_url?: string | null
          nome_completo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "bd_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_programacao_entrega_segura: {
        Row: {
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          created_at: string | null
          data_entrega: string | null
          data_programacao: string | null
          id: string | null
          nome_centro_custo: string | null
          observacoes: string | null
          requisicao_id: string | null
          requisicao_numero: string | null
          status: string | null
          updated_at: string | null
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_programacao_entrega_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_programacao_entrega_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_programacao_entrega_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_programacao_entrega_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_programacao_entrega_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
          {
            foreignKeyName: "bd_programacao_entrega_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "vw_requisicoes_operacional_segura"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_rbac_legacy_map_drift: {
        Row: {
          action_padrao: string | null
          detalhe: string | null
          drift_kind: string | null
          legacy_nome: string | null
          new_codigo: string | null
          status: string | null
        }
        Relationships: []
      }
      vw_rbac_permissions_safe: {
        Row: {
          ativo: boolean | null
          codigo: string | null
          created_at: string | null
          descricao: string | null
          id: string | null
          modulo: string | null
          nome: string | null
          rota: string | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string | null
          modulo?: string | null
          nome?: string | null
          rota?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string | null
          modulo?: string | null
          nome?: string | null
          rota?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vw_rbac_roles_safe: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string | null
          nome: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string | null
          nome?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string | null
          nome?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vw_rbac_standard_funcao_permissoes: {
        Row: {
          descricao: string | null
          nome_funcao: string | null
          nome_permissao: string | null
          permissao_padrao: string | null
          rota: string | null
        }
        Relationships: []
      }
      vw_rbac_standard_permission_gaps: {
        Row: {
          nome_funcao: string | null
          permissao_faltante: string | null
        }
        Relationships: []
      }
      vw_registro_aplicacao_seguro: {
        Row: {
          created_at: string | null
          data_aplicacao: string | null
          hora_aplicacao: string | null
          hora_chegada_local: string | null
          id: string | null
          lista_entrega_id: string | null
          logradouro_aplicado: string | null
          percentual_aplicado: number | null
          registro_carga_id: string | null
          requisicao_id: string | null
          requisicao_numero: string | null
          status_aplicacao: string | null
          temperatura_aplicacao: number | null
          temperatura_chegada: number | null
          tonelada_aplicada: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_lista_programacao_entrega_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "bd_requisicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_lista_programacao_entrega_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "vw_requisicoes_operacional_segura"
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
            foreignKeyName: "bd_registro_apontamento_aplicacao_lista_entrega_id_fkey"
            columns: ["lista_entrega_id"]
            isOneToOne: false
            referencedRelation: "vw_lista_programacao_entrega_segura"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_aplicacao_registro_carga_id_fkey"
            columns: ["registro_carga_id"]
            isOneToOne: false
            referencedRelation: "bd_registro_cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_apontamento_aplicacao_registro_carga_id_fkey"
            columns: ["registro_carga_id"]
            isOneToOne: false
            referencedRelation: "vw_registro_cargas_seguro"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_registro_cargas_seguro: {
        Row: {
          apontador_id: string | null
          created_at: string | null
          data_saida: string | null
          equipe_id: string | null
          hora_saida: string | null
          id: string | null
          imagem_ticket_retorno: string | null
          imagem_ticket_saida: string | null
          lista_entrega_id: string | null
          programacao_id: string | null
          requisicao_id: string | null
          requisicao_numero: string | null
          status_registro: string | null
          temperatura_saida: number | null
          tonelada_real: number | null
          tonelada_retorno: number | null
          tonelada_saida: number | null
          updated_at: string | null
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
            foreignKeyName: "bd_lista_programacao_entrega_apontador_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_lista_programacao_entrega_apontador_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_lista_programacao_entrega_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "bd_requisicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_lista_programacao_entrega_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "vw_requisicoes_operacional_segura"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_cargas_lista_entrega_id_fkey"
            columns: ["lista_entrega_id"]
            isOneToOne: false
            referencedRelation: "bd_lista_programacao_entrega"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_registro_cargas_lista_entrega_id_fkey"
            columns: ["lista_entrega_id"]
            isOneToOne: false
            referencedRelation: "vw_lista_programacao_entrega_segura"
            referencedColumns: ["id"]
          },
        ]
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
          tem_presenca_real: boolean | null
          tipo_diaria: string | null
          usar_diaria_exclusiva: boolean | null
          usar_diaria_exclusiva_calendario: boolean | null
          valor_diaria_aplicada: number | null
          valor_diaria_bruto_historico: number | null
          valor_diaria_suspeito_sem_presenca: number | null
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
            foreignKeyName: "bd_diaria_apontamentos_responsavel_campo_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_apontamentos_responsavel_campo_id_fkey"
            columns: ["apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_diaria_presencas_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "vw_funcoes_publicas"
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
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_presencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
            foreignKeyName: "bd_diaria_solicitacoes_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_diaria_solicitacoes_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
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
      vw_requisicoes_operacional_segura: {
        Row: {
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          created_at: string | null
          data_requisicao: string | null
          diretoria: string | null
          engenheiro_id: string | null
          engenheiro_nome: string | null
          gerencia: string | null
          id: string | null
          nome_centro_custo: string | null
          numero: string | null
          updated_at: string | null
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_requisicoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_requisicoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_requisicoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_requisicoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_requisicoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
          {
            foreignKeyName: "bd_requisicoes_engenheiro_id_fkey"
            columns: ["engenheiro_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_requisicoes_engenheiro_id_fkey"
            columns: ["engenheiro_id"]
            isOneToOne: false
            referencedRelation: "vw_funcionarios_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_solicitacoes_equipamento_financeiro: {
        Row: {
          apontador_responsavel_id: string | null
          aprovador_centro_custo_id: string | null
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          com_operador: boolean | null
          created_at: string | null
          data_inicio: string | null
          engenheiro_solicitante_id: string | null
          id: string | null
          justificativa: string | null
          nome_centro_custo: string | null
          possui_disponibilidade_interna: boolean | null
          prioridade:
            | Database["public"]["Enums"]["prioridade_solicitacao_enum"]
            | null
          quantidade: number | null
          quantidade_disponivel_encontrada: number | null
          regime_trabalho: string | null
          resultado_matching: string | null
          solicitante_id: string | null
          status:
            | Database["public"]["Enums"]["status_solicitacao_equip_enum"]
            | null
          status_fluxo: string | null
          sugestao_acao: string | null
          tempo_previsto_dias: number | null
          tipo_equipamento_descricao: string | null
          tipo_equipamento_id: string | null
          updated_at: string | null
          valor_diaria_referencia: number | null
          valor_hora_referencia: number | null
          valor_mensal_referencia: number | null
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
            foreignKeyName: "bd_solicitacoes_equipamento_apontador_responsavel_id_fkey"
            columns: ["apontador_responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_apontador_responsavel_id_fkey"
            columns: ["apontador_responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
            foreignKeyName: "bd_solicitacoes_equipamento_aprovador_centro_custo_id_fkey"
            columns: ["aprovador_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_aprovador_centro_custo_id_fkey"
            columns: ["aprovador_centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
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
            foreignKeyName: "bd_solicitacoes_equipamento_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_profile_self_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_engenheiro_solicitante_id_fkey"
            columns: ["engenheiro_solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_profiles_admin_safe"
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
      vw_solicitacoes_equipamento_operacional: {
        Row: {
          centro_custo_id: string | null
          codigo_centro_custo: string | null
          com_operador: boolean | null
          created_at: string | null
          data_inicio: string | null
          id: string | null
          justificativa: string | null
          nome_centro_custo: string | null
          prioridade:
            | Database["public"]["Enums"]["prioridade_solicitacao_enum"]
            | null
          quantidade: number | null
          regime_trabalho: string | null
          solicitante_id: string | null
          status:
            | Database["public"]["Enums"]["status_solicitacao_equip_enum"]
            | null
          tempo_previsto_dias: number | null
          tipo_equipamento_descricao: string | null
          tipo_equipamento_id: string | null
          updated_at: string | null
        }
        Relationships: [
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
            referencedRelation: "vw_bi_diarias_financeiro_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_gerencial_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_bi_diarias_operacional_indicadores"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_aprovacao_gerencial"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_financeiro_dp"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_diarias_operacional_campo"
            referencedColumns: ["centro_custo_id"]
          },
          {
            foreignKeyName: "bd_solicitacoes_equipamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "vw_relatorio_diarias_folha"
            referencedColumns: ["centro_custo_id"]
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
    }
    Functions: {
      __test_2d3e: { Args: { p_case: string }; Returns: Json }
      _aps_carimbo_assert_acao: { Args: { _acao: string }; Returns: string }
      _map_tipo_aprovador_to_role: { Args: { p_tipo: string }; Returns: string }
      _map_tipo_aprovador_to_status: {
        Args: { p_tipo: string }
        Returns: string
      }
      _validar_gps: { Args: { g: Json }; Returns: Json }
      adicionar_item_lote: {
        Args: {
          p_data: string
          p_extras?: Json
          p_funcao_id?: string
          p_funcionario_id: string
          p_lote_id: string
          p_usar_diaria_exclusiva?: boolean
          p_valor_diaria?: number
          p_valor_diaria_exclusiva?: number
          p_valor_refeicao?: number
        }
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
      aprovar_aditivo: {
        Args: { p_aditivo_id: string; p_observacao?: string }
        Returns: Json
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
      aprovar_lote_diaria: {
        Args: { p_assinatura_png?: string; p_lote_id: string }
        Returns: undefined
      }
      atualizar_item_lote: {
        Args: {
          p_data?: string
          p_extras?: Json
          p_funcao_id?: string
          p_item_id: string
          p_usar_diaria_exclusiva?: boolean
          p_valor_diaria?: number
          p_valor_diaria_exclusiva?: number
          p_valor_refeicao?: number
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
      buscar_funcionario_dispositivo_obra: {
        Args: { p_dispositivo_id: string; p_identificador: string }
        Returns: {
          cpf: string
          funcao_nome: string
          id: string
          matricula: string
          nome_completo: string
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
      calcular_valor_diaria: {
        Args: {
          p_data: string
          p_funcionario_id: string
          p_tipo_diaria?: string
          p_usar_exclusiva_manual?: boolean
        }
        Returns: number
      }
      can_delete_agendamento_exame: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      cancelar_aditivo: {
        Args: { p_aditivo_id: string; p_motivo?: string }
        Returns: undefined
      }
      cancelar_lote_diaria: {
        Args: { p_lote_id: string; p_motivo: string }
        Returns: undefined
      }
      check_email_duplicate_normalized: {
        Args: { p_email: string; p_exclude_id?: string }
        Returns: boolean
      }
      check_is_admsso: { Args: { user_id?: string }; Returns: boolean }
      check_is_super_admin: { Args: { user_id?: string }; Returns: boolean }
      check_is_super_admin_hybrid: {
        Args: { user_id?: string }
        Returns: boolean
      }
      check_is_super_admin_new: { Args: { user_id?: string }; Returns: boolean }
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
      create_funcionario: {
        Args: { p_dados: Json }
        Returns: {
          adicional_noturno: number | null
          agencia: string | null
          assinatura_hash: string | null
          assinatura_updated_at: string | null
          assinatura_url: string | null
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
          endereco_normalizado: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          equipe_id: string | null
          escolaridade: string | null
          funcao_id: string | null
          genero: string | null
          geocoding_relevance: number | null
          geocoding_source: string | null
          geocoding_status: string | null
          geocoding_updated_at: string | null
          gratificacao: number | null
          id: string
          imagem: string | null
          insalubridade: number | null
          latitude: number | null
          longitude: number | null
          mapbox_place_name: string | null
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
        SetofOptions: {
          from: "*"
          to: "bd_funcionarios"
          isOneToOne: true
          isSetofReturn: false
        }
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
      criar_lote_diaria: {
        Args: { p_metadata?: Json; p_nome?: string; p_solicitacao_id: string }
        Returns: string
      }
      enviar_lote_para_aprovacao: {
        Args: { p_lote_id: string }
        Returns: undefined
      }
      finalizar_carga_aplicacao: {
        Args: { aplicacao_id: string }
        Returns: Json
      }
      finalizar_carga_manual: { Args: { carga_id: string }; Returns: Json }
      fn_actor_can_assign_role: {
        Args: {
          p_actor_user_id: string
          p_role_id: string
          p_target_user_id: string
        }
        Returns: boolean
      }
      fn_actor_can_manage_user_target: {
        Args: { p_actor_user_id: string; p_target_user_id: string }
        Returns: boolean
      }
      fn_actor_can_override_permission: {
        Args: {
          p_actor_user_id: string
          p_permission_id: string
          p_target_user_id: string
        }
        Returns: boolean
      }
      fn_adicionar_funcionario_no_dia: {
        Args: {
          p_classificacao?: Json
          p_data: string
          p_funcao_id?: string
          p_funcionario_id: string
          p_solicitacao_id: string
        }
        Returns: {
          confirmado_em: string | null
          confirmado_por: string | null
          conflito_solicitacao_id: string | null
          created_at: string | null
          data: string
          excecao_aprovada_em: string | null
          excecao_aprovada_por: string | null
          funcao_id: string | null
          funcionario_id: string
          hora_entrada: string | null
          hora_saida: string | null
          id: string
          intervalo_fim: string | null
          intervalo_inicio: string | null
          is_excecao: boolean
          justificativa_excecao: string | null
          modificado_por: string | null
          observacoes: string | null
          origem: string
          origem_batida_id: string | null
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
        SetofOptions: {
          from: "*"
          to: "bd_diaria_presencas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_aplicar_centro_custo_atual_equipamento: {
        Args: {
          p_centro_custo_id: string
          p_equipamento_id: string
          p_evento_em: string
          p_forcar?: boolean
          p_origem: string
          p_usuario_id?: string
        }
        Returns: boolean
      }
      fn_aplicar_saneamento_auto: {
        Args: {
          p_aprovador_formal_id: string
          p_dry_run?: boolean
          p_filtro_solicitacao_ids?: string[]
          p_limite_solicitacoes?: number
          p_motivo_execucao: string
        }
        Returns: {
          aplicado: boolean
          confianca: string
          criterio_match: string
          diff: Json
          dry_run: boolean
          execution_id: string
          fonte_sugestao: string
          item_idx_jsonb: number
          motivo_correcao: string
          payload_proposto: Json
          solicitacao_id: string
          tipo_correcao: string
          valor_anterior: Json
          valor_novo: Json
          warnings: Json
        }[]
      }
      fn_apontamento_ce_definir_turno: {
        Args: { p_apontamento_id: string; p_turno: string }
        Returns: undefined
      }
      fn_apontar_manutencao_ativo_dia: {
        Args: { p_actor?: string; p_data?: string; p_equipamento_id: string }
        Returns: number
      }
      fn_apontar_manutencao_diario: {
        Args: { p_actor?: string; p_data?: string }
        Returns: number
      }
      fn_aprovar_classificacao_solicitacao: {
        Args: { p_id: string }
        Returns: undefined
      }
      fn_arquivar_auditoria_log: { Args: { p_lote?: number }; Returns: number }
      fn_assign_user_role_secure: {
        Args: { p_role_id: string; p_target_user_id: string }
        Returns: undefined
      }
      fn_atestado_marcar_lido: {
        Args: { p_atestado_id: string; p_lido: boolean }
        Returns: {
          id: string
          lido: boolean
          lido_em: string
          lido_por: string
          lido_por_nome: string
        }[]
      }
      fn_ativos_can_access_centro_custo: {
        Args: { p_centro_custo_id: string; p_user_id?: string }
        Returns: boolean
      }
      fn_ativos_can_access_equipamento: {
        Args: { p_equipamento_id: string; p_user_id?: string }
        Returns: boolean
      }
      fn_ativos_can_access_solicitacao: {
        Args: { p_solicitacao_id: string; p_user_id?: string }
        Returns: boolean
      }
      fn_ativos_has_financial_access: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      fn_ativos_has_logistics_access: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      fn_ativos_has_operational_access: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      fn_ativos_has_precise_location_access: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      fn_ativos_profile_funcionario_id: {
        Args: { p_user_id?: string }
        Returns: string
      }
      fn_ativos_user_centros_custo: {
        Args: { p_user_id?: string }
        Returns: {
          centro_custo_id: string
        }[]
      }
      fn_ativos_user_centros_custo_responsavel: {
        Args: { p_user_id?: string }
        Returns: {
          centro_custo_id: string
        }[]
      }
      fn_atualizar_designacao_equipe: {
        Args: {
          p_dias?: number
          p_funcao_id?: string
          p_horas?: number
          p_id: string
          p_observacao?: string
          p_papel?: Database["public"]["Enums"]["papel_equipe_tarefa"]
          p_set_dias?: boolean
          p_set_funcao?: boolean
          p_set_horas?: boolean
          p_set_observacao?: boolean
        }
        Returns: {
          atividade_id: string
          centro_custo_id: string
          centro_custo_origem_id: string
          created_at: string
          criado_por: string | null
          dias_previstos: number | null
          funcao_id: string | null
          funcionario_id: string
          horas_previstas: number | null
          id: string
          modificado_por: string | null
          observacao: string | null
          papel_na_tarefa: Database["public"]["Enums"]["papel_equipe_tarefa"]
          planejamento_id: string
          semana_fim: string
          semana_inicio: string
          status: Database["public"]["Enums"]["status_equipe_designada"]
          tipo_alocacao: Database["public"]["Enums"]["tipo_alocacao_equipe"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bd_planejamento_atividade_equipe"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_atualizar_ordem_diaria_rascunho: {
        Args: {
          p_atividade_ids: string[]
          p_observacao_geral: string
          p_observacao_por_item: Json
          p_ordem_id: string
          p_responsaveis_por_item?: Json
          p_responsavel_funcionario_id: string
          p_responsavel_profile_id: string
        }
        Returns: undefined
      }
      fn_atualizar_progresso_manual_atividade: {
        Args: {
          p_atividade_id: string
          p_observacao: string
          p_percentual: number
        }
        Returns: {
          arquivo_origem_nome: string | null
          codigo_wbs: string | null
          created_at: string
          criado_por: string | null
          data_fim: string
          data_inicio: string
          descricao: string | null
          duracao_horas: number | null
          fonte_progresso: string | null
          frente_servico: string | null
          id: string
          id_externo: string | null
          is_critica: boolean
          is_marco: boolean
          is_resumo: boolean
          nome: string
          nome_resumo: string | null
          ordem_execucao: number | null
          outline_level: number | null
          outline_number: string | null
          percentual_concluido_importado: number | null
          percentual_manual: number | null
          percentual_manual_atualizado_em: string | null
          percentual_manual_atualizado_por: string | null
          percentual_manual_observacao: string | null
          planejamento_id: string
          prioridade: string | null
          producao_prevista: number | null
          quantidade_origem: string | null
          quantidade_prevista: number | null
          status: string
          trabalho_previsto_horas: number | null
          uid_externo: string | null
          unidade: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bd_planejamento_atividades"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_audit_sensitive_read: {
        Args: {
          p_campos?: string[]
          p_funcionario_id: string
          p_metadata?: Json
          p_origem: string
        }
        Returns: boolean
      }
      fn_auditar_ativos: {
        Args: {
          p_acao: string
          p_contexto?: string
          p_detalhes?: Json
          p_filtros?: Json
          p_recurso_id?: string
          p_recurso_tipo: string
        }
        Returns: undefined
      }
      fn_auditar_bi_relatorio: {
        Args: {
          _acao: string
          _filtros?: Json
          _formato: string
          _modulo: string
          _nivel_dado: string
          _quantidade_registros?: number
          _visao_origem?: string
        }
        Returns: string
      }
      fn_auditar_relatorio_diarias: {
        Args: {
          p_acao: string
          p_arquivo_nome?: string
          p_centro_custo_id?: string
          p_contexto: string
          p_filtros?: Json
          p_formato?: string
          p_periodo_fim?: string
          p_periodo_inicio?: string
          p_quantidade_registros?: number
          p_solicitacao_id?: string
        }
        Returns: string
      }
      fn_auditar_relatorio_ponto: {
        Args: {
          _contexto: string
          _detalhes?: Json
          _filtros?: Json
          _funcionario_id?: string
          _origem?: string
          _quantidade_registros?: number
          _recurso: string
          _tipo_acesso: string
        }
        Returns: string
      }
      fn_auth_user_id: { Args: never; Returns: string }
      fn_backend_audit_event: {
        Args: {
          p_acao?: string
          p_actor_user_id?: string
          p_auth_email?: string
          p_auth_mode?: string
          p_auth_subject?: string
          p_backend_tipo?: string
          p_contexto?: string
          p_erro_resumo?: string
          p_nivel_risco?: string
          p_origem_ip?: unknown
          p_payload_resumo?: Json
          p_permitido?: boolean
          p_recurso?: string
          p_request_id?: string
          p_resultado_resumo?: Json
          p_status_http?: number
          p_sucesso?: boolean
        }
        Returns: string
      }
      fn_backend_can_invoke: {
        Args: { p_context?: string; p_resource: string; p_user_id: string }
        Returns: boolean
      }
      fn_backend_has_permission:
        | {
            Args: { p_permission_codes: string[]; p_user_id: string }
            Returns: boolean
          }
        | {
            Args: {
              p_acao: string
              p_permission_codes: string[]
              p_user_id: string
            }
            Returns: boolean
          }
      fn_backfill_lotes_dry_run: {
        Args: { p_limit?: number; p_solicitacao_id?: string }
        Returns: {
          centro_custo_id: string
          convocados_pre_qtd: number
          dias_periodo: number
          inconsistencias_bloqueantes: Json
          itens_apontamento_dia_qtd: number
          itens_legado_sem_data_qtd: number
          itens_simulados: number
          lotes_simulados: number
          numero_solicitacao: string
          periodo_fim: string
          periodo_inicio: string
          pode_migrar: boolean
          solicitacao_id: string
          status_simulado: string
          valor_total_simulado_diaria: number
          valor_total_simulado_refeicao: number
          warnings: Json
        }[]
      }
      fn_bi_can_export: {
        Args: {
          _formato: string
          _modulo: string
          _nivel_dado: string
          _user_id?: string
        }
        Returns: boolean
      }
      fn_bi_can_view_dashboard: {
        Args: { _modulo: string; _user_id?: string }
        Returns: boolean
      }
      fn_calcular_diaria_aplicada: {
        Args: {
          p_hora_entrada: string
          p_hora_saida: string
          p_valor_base: number
        }
        Returns: {
          excede_12h: boolean
          horas_liquidas: number
          tipo_diaria: string
          valor_diaria_aplicada: number
        }[]
      }
      fn_calcular_distancia_haversine: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      fn_calcular_hash_lote: { Args: { p_lote_id: string }; Returns: string }
      fn_calcular_nota_checklist: {
        Args: { p_checklist_id: string }
        Returns: Json
      }
      fn_can_access_diarias_financeiro: {
        Args: { _user_id: string }
        Returns: boolean
      }
      fn_can_access_diarias_gerencial: {
        Args: { _user_id: string }
        Returns: boolean
      }
      fn_can_access_diarias_operacional: {
        Args: { _user_id: string }
        Returns: boolean
      }
      fn_can_access_funcionario_operacional: {
        Args: {
          p_centro_custo_id: string
          p_departamento_id: string
          p_funcionario_id: string
        }
        Returns: boolean
      }
      fn_can_access_funcionario_sensitive: {
        Args: { p_funcionario_id?: string }
        Returns: boolean
      }
      fn_can_manage_diaria_calendario: {
        Args: { _user_id: string }
        Returns: boolean
      }
      fn_can_manage_permission_catalog: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      fn_can_manage_user_access: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      fn_can_read_permission_row: {
        Args: { p_permission_id: string; p_user_id?: string }
        Returns: boolean
      }
      fn_can_view_ordem_diaria_item_campo: {
        Args: { _item: string; _user: string }
        Returns: boolean
      }
      fn_can_view_permission_admin: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      fn_cancelar_classificacao_solicitacao: {
        Args: { p_id: string }
        Returns: undefined
      }
      fn_cancelar_ordem_diaria: {
        Args: { p_motivo: string; p_ordem_id: string }
        Returns: undefined
      }
      fn_chamado_interno_abrir: {
        Args: {
          p_categoria_id: string
          p_centro_custo_id: string
          p_descricao: string
          p_solicitante_funcionario_id: string
          p_titulo: string
        }
        Returns: {
          chamado_id: string
          numero: number
          protocolo: string
        }[]
      }
      fn_chamado_interno_adicionar_nota_interna: {
        Args: { p_chamado_id: string; p_mensagem: string }
        Returns: undefined
      }
      fn_chamado_interno_anexos_registrar: {
        Args: { p_anexos: Json; p_chamado_id: string; p_evento_id: string }
        Returns: number
      }
      fn_chamado_interno_assumir: {
        Args: { p_chamado_id: string }
        Returns: undefined
      }
      fn_chamado_interno_atendente_desativar: {
        Args: { p_vinculo_id: string }
        Returns: undefined
      }
      fn_chamado_interno_atendente_vincular: {
        Args: {
          p_profile_id: string
          p_setor: Database["public"]["Enums"]["chamado_interno_setor"]
        }
        Returns: string
      }
      fn_chamado_interno_atendentes_listar: {
        Args: { p_setor?: Database["public"]["Enums"]["chamado_interno_setor"] }
        Returns: {
          atendente_profile_id: string
          ativo: boolean
          created_at: string
          funcionario_nome_completo: string
          id: string
          profile_nome: string
          setor: Database["public"]["Enums"]["chamado_interno_setor"]
          updated_at: string
        }[]
      }
      fn_chamado_interno_can_attend: {
        Args: { p_setor: Database["public"]["Enums"]["chamado_interno_setor"] }
        Returns: boolean
      }
      fn_chamado_interno_can_open_cc: {
        Args: { p_cc_id: string }
        Returns: boolean
      }
      fn_chamado_interno_can_operate: {
        Args: { p_chamado_id: string }
        Returns: boolean
      }
      fn_chamado_interno_can_read: {
        Args: { p_chamado_id: string }
        Returns: boolean
      }
      fn_chamado_interno_cancelar: {
        Args: { p_chamado_id: string; p_motivo: string }
        Returns: undefined
      }
      fn_chamado_interno_confirmar_encerramento:
        | { Args: { p_chamado_id: string }; Returns: undefined }
        | {
            Args: {
              p_chamado_id: string
              p_comentario?: string
              p_nota: number
            }
            Returns: undefined
          }
      fn_chamado_interno_dash_atendentes: {
        Args: {
          p_ate: string
          p_centro_custo?: string
          p_de: string
          p_prioridade?: Database["public"]["Enums"]["chamado_interno_prioridade"][]
          p_responsavel?: string
          p_setor?: Database["public"]["Enums"]["chamado_interno_setor"][]
          p_sla?: string
        }
        Returns: {
          atendente_nome: string
          atendente_profile_id: string
          atribuidos: number
          frt_minutos: number
          mttr_minutos: number
          resolvidos: number
        }[]
      }
      fn_chamado_interno_dash_escopo: {
        Args: never
        Returns: {
          chamado_id: string
        }[]
      }
      fn_chamado_interno_dash_fila_risco: {
        Args: {
          p_ate?: string
          p_centro_custo?: string
          p_de?: string
          p_limite?: number
          p_prioridade?: Database["public"]["Enums"]["chamado_interno_prioridade"][]
          p_responsavel?: string
          p_setor?: Database["public"]["Enums"]["chamado_interno_setor"][]
          p_sla?: string
          p_somente_em_andamento?: boolean
        }
        Returns: {
          centro_custo_codigo: string
          created_at: string
          id: string
          is_critico: boolean
          minutos_restantes: number
          prioridade: Database["public"]["Enums"]["chamado_interno_prioridade"]
          protocolo: string
          responsavel_nome: string
          setor: Database["public"]["Enums"]["chamado_interno_setor"]
          sla_prazo: string
          solicitante_nome: string
          status: Database["public"]["Enums"]["chamado_interno_status"]
          titulo: string
        }[]
      }
      fn_chamado_interno_dash_kpis: {
        Args: {
          p_ate: string
          p_centro_custo?: string
          p_de: string
          p_prioridade?: Database["public"]["Enums"]["chamado_interno_prioridade"][]
          p_responsavel?: string
          p_setor?: Database["public"]["Enums"]["chamado_interno_setor"][]
          p_sla?: string
        }
        Returns: Json
      }
      fn_chamado_interno_dash_pode_ver: { Args: never; Returns: boolean }
      fn_chamado_interno_dash_series: {
        Args: {
          p_ate: string
          p_centro_custo?: string
          p_de: string
          p_prioridade?: Database["public"]["Enums"]["chamado_interno_prioridade"][]
          p_responsavel?: string
          p_setor?: Database["public"]["Enums"]["chamado_interno_setor"][]
        }
        Returns: Json
      }
      fn_chamado_interno_dash_solicitantes: {
        Args: {
          p_ate: string
          p_centro_custo?: string
          p_de: string
          p_prioridade?: Database["public"]["Enums"]["chamado_interno_prioridade"][]
          p_responsavel?: string
          p_setor?: Database["public"]["Enums"]["chamado_interno_setor"][]
          p_sla?: string
        }
        Returns: {
          adm_sede_funcionario_id: string
          centros_custo: number
          em_aberto: number
          encerrados: number
          frt_minutos: number
          nome: string
          respondidos: number
          sem_resposta: number
          total: number
        }[]
      }
      fn_chamado_interno_detalhe_pessoas: {
        Args: { p_chamado_id: string }
        Returns: {
          aberto_por_nome: string
          responsavel_nome: string
          solicitante_nome: string
        }[]
      }
      fn_chamado_interno_enriquecer_lista: {
        Args: { p_ids: string[] }
        Returns: {
          aberto_por_nome: string
          centro_custo_codigo: string
          centro_custo_nome: string
          chamado_id: string
          solicitante_funcionario_id: string
          solicitante_nome: string
        }[]
      }
      fn_chamado_interno_eventos_listar: {
        Args: { p_chamado_id: string }
        Returns: {
          autor_nome: string
          autor_profile_id: string
          chamado_id: string
          created_at: string
          id: string
          mensagem: string
          payload: Json
          status_anterior: Database["public"]["Enums"]["chamado_interno_status"]
          status_novo: Database["public"]["Enums"]["chamado_interno_status"]
          tipo: Database["public"]["Enums"]["chamado_interno_evento_tipo"]
          visivel_solicitante: boolean
        }[]
      }
      fn_chamado_interno_listar_ccs_abertura: {
        Args: never
        Returns: {
          centro_custo_id: string
          codigo_centro_custo: string
          nome_centro_custo: string
        }[]
      }
      fn_chamado_interno_listar_fila_atendimento: {
        Args: {
          p_setor?: Database["public"]["Enums"]["chamado_interno_setor"]
          p_status?: Database["public"]["Enums"]["chamado_interno_status"][]
        }
        Returns: {
          categoria_id: string
          categoria_nome: string
          centro_custo_codigo: string
          centro_custo_id: string
          centro_custo_nome: string
          created_at: string
          fonte_autorizacao: string
          id: string
          is_critico: boolean
          prioridade: Database["public"]["Enums"]["chamado_interno_prioridade"]
          protocolo: string
          responsavel_atual_profile_id: string
          setor: Database["public"]["Enums"]["chamado_interno_setor"]
          sla_prazo: string
          solicitante_funcionario_id: string
          solicitante_nome: string
          status: Database["public"]["Enums"]["chamado_interno_status"]
          titulo: string
          updated_at: string
        }[]
      }
      fn_chamado_interno_listar_solicitantes_cc: {
        Args: { p_cc_id: string }
        Returns: {
          id: string
          nome_completo: string
        }[]
      }
      fn_chamado_interno_reabrir: {
        Args: { p_chamado_id: string; p_mensagem: string }
        Returns: undefined
      }
      fn_chamado_interno_resolver: {
        Args: { p_chamado_id: string; p_mensagem: string }
        Returns: undefined
      }
      fn_chamado_interno_responder: {
        Args: { p_chamado_id: string; p_mensagem: string }
        Returns: undefined
      }
      fn_chamado_interno_responder_solicitante: {
        Args: { p_chamado_id: string; p_mensagem: string }
        Returns: undefined
      }
      fn_chamado_interno_solicitar_informacao: {
        Args: { p_chamado_id: string; p_mensagem: string }
        Returns: undefined
      }
      fn_chamado_interno_ultimo_evento_proprio: {
        Args: { p_chamado_id: string }
        Returns: string
      }
      fn_check_email_autorizado: {
        Args: { _email: string }
        Returns: {
          autorizado: boolean
          motivo: string
        }[]
      }
      fn_check_funcionario_email_status: {
        Args: { p_email: string }
        Returns: {
          exists_in_funcionarios: boolean
          funcionario_id: string
          nome_completo: string
          status: string
        }[]
      }
      fn_checklist_ce_catalog_flat: {
        Args: { p_codigo: string }
        Returns: {
          criticidade: string
          exige_foto_nao_ok: boolean
          grupo_codigo: string
          grupo_icone: string
          grupo_ordem: number
          grupo_titulo: string
          item_codigo: string
          item_descricao: string
          item_ordem: number
          obrigatorio: boolean
          template_nome: string
          template_versao: number
        }[]
      }
      fn_checklist_ce_catalog_raw: { Args: never; Returns: Json }
      fn_checklist_ce_template_por_subcategoria: {
        Args: { p_subcat: string }
        Returns: string
      }
      fn_clear_user_admin_roles_secure: {
        Args: { p_target_user_id: string }
        Returns: undefined
      }
      fn_corrigir_quantitativo_atividade: {
        Args: {
          p_atividade_id: string
          p_observacao?: string
          p_quantidade_prevista: number
          p_unidade: string
        }
        Returns: {
          arquivo_origem_nome: string | null
          codigo_wbs: string | null
          created_at: string
          criado_por: string | null
          data_fim: string
          data_inicio: string
          descricao: string | null
          duracao_horas: number | null
          fonte_progresso: string | null
          frente_servico: string | null
          id: string
          id_externo: string | null
          is_critica: boolean
          is_marco: boolean
          is_resumo: boolean
          nome: string
          nome_resumo: string | null
          ordem_execucao: number | null
          outline_level: number | null
          outline_number: string | null
          percentual_concluido_importado: number | null
          percentual_manual: number | null
          percentual_manual_atualizado_em: string | null
          percentual_manual_atualizado_por: string | null
          percentual_manual_observacao: string | null
          planejamento_id: string
          prioridade: string | null
          producao_prevista: number | null
          quantidade_origem: string | null
          quantidade_prevista: number | null
          status: string
          trabalho_previsto_horas: number | null
          uid_externo: string | null
          unidade: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bd_planejamento_atividades"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_criar_registro_aplicacao_manual: {
        Args: { p_cabecalho: Json; p_detalhes: Json }
        Returns: string
      }
      fn_criar_registro_aplicacao_manual_v2: {
        Args: { p_payload: Json }
        Returns: Json
      }
      fn_ct_atendimento_atribuir: {
        Args: {
          p_equipamento_id: string
          p_justificativa_override?: string
          p_modalidade: string
          p_periodo_fim?: string
          p_periodo_inicio?: string
          p_request_id: string
          p_solicitacao_item_id: string
        }
        Returns: Json
      }
      fn_ct_atendimento_encerrar: {
        Args: {
          p_atendimento_id: string
          p_motivo: string
          p_novo_status: string
          p_request_id: string
        }
        Returns: Json
      }
      fn_ct_atendimento_json: {
        Args: { p_atendimento_id: string }
        Returns: Json
      }
      fn_ct_atendimento_listar: {
        Args: { p_solicitacao_id: string }
        Returns: Json
      }
      fn_ct_atendimento_substituir: {
        Args: {
          p_atendimento_id: string
          p_justificativa_override?: string
          p_modalidade: string
          p_motivo: string
          p_novo_equipamento_id: string
          p_request_id: string
        }
        Returns: Json
      }
      fn_ct_ativo_edicao_permitida: {
        Args: { p_equipamento_id: string }
        Returns: Json
      }
      fn_ct_ativos_movimentacao_listar: {
        Args: { p_limit?: number; p_termo?: string }
        Returns: Json
      }
      fn_ct_avaliar_disponibilidade: {
        Args: {
          p_equipamento_id: string
          p_modalidade: string
          p_periodo_inicio: string
        }
        Returns: Json
      }
      fn_ct_avaliar_match: {
        Args: { p_equipamento_id: string; p_item_id: string }
        Returns: Json
      }
      fn_ct_cap: { Args: { p_acao: string; p_user: string }; Returns: boolean }
      fn_ct_cap_admin: { Args: { p_user: string }; Returns: boolean }
      fn_ct_checklist_saida_salvar: {
        Args: { p_payload: Json; p_request_id: string; p_viagem_id: string }
        Returns: Json
      }
      fn_ct_contadores_item: { Args: { p_item_id: string }; Returns: Json }
      fn_ct_disponibilidade_upsert:
        | {
            Args: {
              p_centro_custo_id?: string
              p_confiabilidade?: string
              p_data_inicio?: string
              p_equipamento_id: string
              p_motivo_risco?: string
              p_observacao?: string
              p_previsao_liberacao?: string
              p_status_operacional: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_centro_custo_id?: string
              p_confiabilidade?: string
              p_data_inicio?: string
              p_equipamento_id: string
              p_justificativa_excecao?: string
              p_motivo_risco?: string
              p_observacao?: string
              p_previsao_liberacao?: string
              p_status_operacional: string
            }
            Returns: Json
          }
      fn_ct_distancia_operacional: { Args: { p_km: number }; Returns: number }
      fn_ct_distancia_regra: { Args: { p_km: number }; Returns: string }
      fn_ct_estado_efetivo_lote: {
        Args: {
          p_centro_custo_ids?: string[]
          p_equipamento_ids: string[]
          p_periodo_fim?: string
          p_periodo_inicio?: string
        }
        Returns: Json
      }
      fn_ct_funcionarios_com_usuario: { Args: never; Returns: Json }
      fn_ct_item_resumo_json: {
        Args: { p_solicitacao_item_id: string }
        Returns: Json
      }
      fn_ct_mob_command_hash: {
        Args: {
          p_motivo: string
          p_operacao: string
          p_payload: Json
          p_planejamento_id: string
          p_solicitacao_id: string
          p_versao_esperada: number
        }
        Returns: string
      }
      fn_ct_mob_content_hash: { Args: { p_payload: Json }; Returns: string }
      fn_ct_mob_norm_texto: { Args: { p: string }; Returns: string }
      fn_ct_mob_plan_json: {
        Args: {
          p_plan: Database["public"]["Tables"]["bd_solicitacoes_planejamento"]["Row"]
        }
        Returns: Json
      }
      fn_ct_mob_validar_viagem: {
        Args: { p_viagem_id: string }
        Returns: undefined
      }
      fn_ct_mob_viagens_json: {
        Args: { p_planejamento_id: string }
        Returns: Json
      }
      fn_ct_mobilizacao_cancelar: {
        Args: {
          p_motivo: string
          p_planejamento_id: string
          p_request_id: string
          p_versao_esperada: number
        }
        Returns: Json
      }
      fn_ct_mobilizacao_estado: {
        Args: { p_solicitacao_id: string }
        Returns: Json
      }
      fn_ct_mobilizacao_nova_revisao: {
        Args: { p_planejamento_id: string; p_request_id: string }
        Returns: Json
      }
      fn_ct_mobilizacao_programar: {
        Args: {
          p_planejamento_id: string
          p_request_id: string
          p_versao_esperada: number
        }
        Returns: Json
      }
      fn_ct_mobilizacao_salvar_rascunho: {
        Args: {
          p_payload: Json
          p_planejamento_id: string
          p_request_id: string
          p_solicitacao_id: string
          p_versao_esperada: number
        }
        Returns: Json
      }
      fn_ct_motorista_ordem_detalhe: {
        Args: { p_viagem_id: string }
        Returns: Json
      }
      fn_ct_motorista_ordens_listar: {
        Args: { p_data_fim?: string; p_data_inicio?: string }
        Returns: Json
      }
      fn_ct_mov_direta_cancelar: {
        Args: { p_motivo: string; p_request_id: string; p_viagem_id: string }
        Returns: Json
      }
      fn_ct_mov_direta_estado: { Args: { p_viagem_id: string }; Returns: Json }
      fn_ct_mov_direta_listar: { Args: { p_status?: string }; Returns: Json }
      fn_ct_mov_direta_programar: {
        Args: { p_request_id: string; p_viagem_id: string }
        Returns: Json
      }
      fn_ct_mov_direta_salvar_rascunho: {
        Args: { p_payload: Json; p_request_id: string; p_viagem_id: string }
        Returns: Json
      }
      fn_ct_operacao_ordens_listar: {
        Args: { p_data_fim?: string; p_data_inicio?: string; p_status?: string }
        Returns: Json
      }
      fn_ct_parada_registrar_chegada: {
        Args: { p_parada_id: string; p_request_id: string }
        Returns: Json
      }
      fn_ct_pode_ver_puxada: {
        Args: { p_puxada_id: string; p_user?: string }
        Returns: boolean
      }
      fn_ct_pode_ver_viagem: {
        Args: { p_user?: string; p_viagem_id: string }
        Returns: boolean
      }
      fn_ct_puxada_cancelar: {
        Args: { p_motivo: string; p_puxada_id: string; p_request_id: string }
        Returns: Json
      }
      fn_ct_puxada_estado: { Args: { p_puxada_id: string }; Returns: Json }
      fn_ct_puxada_json: { Args: { p_puxada_id: string }; Returns: Json }
      fn_ct_puxada_listar: {
        Args: {
          p_centro_custo_id?: string
          p_data_fim?: string
          p_data_inicio?: string
          p_status?: string
        }
        Returns: Json
      }
      fn_ct_puxada_programar: {
        Args: { p_puxada_id: string; p_request_id: string }
        Returns: Json
      }
      fn_ct_puxada_salvar_rascunho: {
        Args: { p_payload: Json; p_puxada_id: string; p_request_id: string }
        Returns: Json
      }
      fn_ct_recalcular_status_item: {
        Args: { p_solicitacao_item_id: string }
        Returns: string
      }
      fn_ct_recebimento_finalizar: {
        Args: { p_payload: Json; p_request_id: string; p_viagem_id: string }
        Returns: Json
      }
      fn_ct_recebimentos_pendentes_listar: { Args: never; Returns: Json }
      fn_ct_registrar_assinatura: {
        Args: { p_solicitacao_id: string; p_tipo: string; p_user: string }
        Returns: string
      }
      fn_ct_solicitacao_timeline: {
        Args: { p_solicitacao_id: string }
        Returns: Json
      }
      fn_ct_viagem_iniciar: {
        Args: { p_request_id: string; p_viagem_id: string }
        Returns: Json
      }
      fn_ct_viagem_json: { Args: { p_viagem_id: string }; Returns: Json }
      fn_ct_viagem_operacao_detalhe: {
        Args: { p_viagem_id: string }
        Returns: Json
      }
      fn_ct_viagem_paradas_json: {
        Args: { p_viagem_id: string }
        Returns: Json
      }
      fn_ct_viagem_registrar_chegada: {
        Args: { p_request_id: string; p_viagem_id: string }
        Returns: Json
      }
      fn_ct4_proximo_codigo_mov: { Args: never; Returns: string }
      fn_ct5_proximo_codigo_puxada: { Args: never; Returns: string }
      fn_designar_equipe_atividade: {
        Args: {
          p_atividade_id: string
          p_dias?: number
          p_funcao_id: string
          p_funcionario_id: string
          p_horas?: number
          p_observacao?: string
          p_papel: Database["public"]["Enums"]["papel_equipe_tarefa"]
          p_semana_fim: string
          p_semana_inicio: string
        }
        Returns: string
      }
      fn_desmob_aplicar_previsao: {
        Args: { p_equipamento_id: string; p_motivo: string; p_previsao: string }
        Returns: undefined
      }
      fn_desmobilizacao_cancelar: {
        Args: { p_id: string; p_motivo?: string }
        Returns: Json
      }
      fn_desmobilizacao_concluir: { Args: { p_id: string }; Returns: Json }
      fn_desmobilizacao_decidir: {
        Args: { p_decisao: string; p_id: string; p_motivo?: string }
        Returns: Json
      }
      fn_desmobilizacao_solicitar: {
        Args: {
          p_data_retirada: string
          p_engenheiro_responsavel_id: string
          p_engenheiro_solicitante_id: string
          p_equipamento_id: string
          p_hora_retirada?: string
          p_observacoes?: string
        }
        Returns: Json
      }
      fn_desvio_can_select_row: {
        Args: { p_criado_por: string; p_obra_id: string }
        Returns: boolean
      }
      fn_detectar_conflito_designacao: {
        Args: {
          p_cc_atividade?: string
          p_funcionario_id: string
          p_ignorar_id?: string
          p_semana_fim: string
          p_semana_inicio: string
        }
        Returns: {
          atividade_id: string
          centro_custo_id: string
          id: string
          motivo: string
          semana_fim: string
          semana_inicio: string
          tem_escopo: boolean
          tipo_conflito: string
        }[]
      }
      fn_diaria_aditivos_pendentes_escopo: {
        Args: { p_solicitacao_ids: string[] }
        Returns: {
          data_ajustada: string
          decidido_por: string
          funcionario_id: string
          funcionarios_adicionados: Json
          funcionarios_removidos: Json
          id: string
          impacto_financeiro: Json
          justificativa: string
          motivo_reprovacao: string
          retroativo: boolean
          snapshot_funcionario: Json
          solicitacao_id: string
          solicitado_em: string
          solicitado_por: string
          status: string
          tipo: string
        }[]
      }
      fn_diaria_can_create: { Args: { p_user_id?: string }; Returns: boolean }
      fn_diaria_can_manage_row: {
        Args: { p_solicitacao_id: string; p_user_id?: string }
        Returns: boolean
      }
      fn_diaria_can_select_row: {
        Args: { p_solicitacao_id: string; p_user_id?: string }
        Returns: boolean
      }
      fn_diaria_can_update_row: {
        Args: { p_solicitacao_id: string; p_user_id?: string }
        Returns: boolean
      }
      fn_diaria_capacidades_aprovacao: {
        Args: { p_solicitacao_ids: string[] }
        Returns: {
          actionable_stage_count: number
          actionable_stage_ids: string[]
          approval_requires_signature: boolean
          approve_block_reason: string
          authorization_source: string
          can_approve: boolean
          can_reject: boolean
          can_view: boolean
          current_stage_code: string
          current_stage_exec_id: string
          current_stage_label: string
          has_parallel_stages: boolean
          has_signature: boolean
          is_in_scope: boolean
          is_requester: boolean
          reject_block_reason: string
          solicitacao_id: string
        }[]
      }
      fn_diaria_funcionario_elegibilidade: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_funcionario_id: string
          p_solicitacao_id?: string
        }
        Returns: {
          alerta_mensagem: string
          conflito_centro_custo: string
          conflito_data: string
          conflito_solicitacao: string
          conflito_solicitacao_id: string
          elegivel: boolean
          motivo_bloqueio: string
          status: string
        }[]
      }
      fn_diaria_get_funcionarios_disponiveis: {
        Args: {
          p_centro_custo_solicitacao_id?: string
          p_data_fim: string
          p_data_inicio: string
          p_solicitacao_id?: string
        }
        Returns: {
          centro_custo_id: string
          cpf: string
          elegivel: boolean
          email: string
          fora_centro_custo_solicitacao: boolean
          funcao_id: string
          funcao_nome: string
          id: string
          matricula: string
          motivo_bloqueio: string
          nome_completo: string
          status_funcionario: string
          valor_diaria: number
          valor_diaria_exclusiva: number
          valor_refeicao: number
        }[]
      }
      fn_diaria_has_global_access: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      fn_diaria_nomes_minimos: {
        Args: { p_ids: string[] }
        Returns: {
          id: string
          nome_completo: string
          origem: string
        }[]
      }
      fn_diaria_scope_centros_custo: {
        Args: { p_user_id?: string }
        Returns: string[]
      }
      fn_efetivar_classificacao: {
        Args: { p_id: string; p_salario_atual?: number; p_salario_novo: number }
        Returns: string
      }
      fn_emitir_ordem_diaria: {
        Args: { p_ordem_id: string }
        Returns: undefined
      }
      fn_equipamento_definir_cc_manual: {
        Args: { p_centro_custo_id: string; p_equipamento_id: string }
        Returns: Json
      }
      fn_excluir_apontamento_ce_com_inspecao: {
        Args: { p_apontamento_id: string }
        Returns: {
          apontamento_id: string
          fotos_paths: string[]
          inspecoes_removidas: number
        }[]
      }
      fn_funcionarios_can_select_row: {
        Args: { p_funcionario_id: string; p_user_id: string }
        Returns: boolean
      }
      fn_gerar_ordem_diaria_rascunho: {
        Args: {
          p_atividade_ids: string[]
          p_data_ordem: string
          p_observacao_geral: string
          p_planejamento_id: string
          p_responsaveis_por_item?: Json
          p_responsavel_funcionario_id: string
          p_responsavel_profile_id: string
        }
        Returns: string
      }
      fn_gerar_protocolo_atestado: { Args: never; Returns: string }
      fn_get_classificacao_reimpressao_payload: {
        Args: { p_solicitacao_id: string }
        Returns: {
          cargo_atual_nome: string
          cargo_novo_nome: string
          centro_custo_formatado: string
          created_at: string
          data_admissao: string
          data_efetivacao_desejada: string
          funcionario_id: string
          matricula: string
          motivo: string
          nome_completo: string
          novo_salario: number
          precisa_exame: boolean
          protocolo: string
          salario_atual: number
          solicitacao_id: string
          solicitante_email: string
          solicitante_nome: string
          status: string
          ultima_classificacao: string
        }[]
      }
      fn_get_funcionario_sensitive: {
        Args: { p_funcionario_id: string; p_origem?: string }
        Returns: Json
      }
      fn_get_manageable_permission_profiles: {
        Args: never
        Returns: {
          acesso_global: boolean
          created_at: string
          departamento_id: string
          departamento_nome: string
          email: string
          funcao_sistema: string
          funcionario_id: string
          funcoes: string[]
          id: string
          imagem_url: string
          nome_completo: string
          primary_role: string
          role_names: string[]
          updated_at: string
        }[]
      }
      fn_get_my_permission_snapshot: {
        Args: never
        Returns: {
          allowed_routes: string[]
          is_super_admin: boolean
          permission_codes: string[]
          permission_names: string[]
          role_names: string[]
          user_id: string
        }[]
      }
      fn_has_action: {
        Args: { p_acoes: string[]; p_codigo: string; p_user_id: string }
        Returns: boolean
      }
      fn_has_ordem_diaria_campo_access: {
        Args: { _user: string }
        Returns: boolean
      }
      fn_has_permission: {
        Args: { p_nome_permissao: string; p_user_id?: string }
        Returns: boolean
      }
      fn_has_role: {
        Args: { p_role: string; p_user_id?: string }
        Returns: boolean
      }
      fn_hash_sensitive_value: { Args: { p_value: string }; Returns: string }
      fn_importador_ativos_atualizar: {
        Args: {
          p_arquivo_sha256: string
          p_execucao_anterior_id: string
          p_execution_id: string
          p_linha_excel: number
          p_payload: Json
          p_tentativa: number
        }
        Returns: Json
      }
      fn_importador_ativos_inserir: {
        Args: {
          p_arquivo_sha256: string
          p_execucao_anterior_id: string
          p_execution_id: string
          p_linha_excel: number
          p_payload: Json
          p_tentativa: number
        }
        Returns: Json
      }
      fn_importador_v2_abrir_execucao: {
        Args: {
          p_arquivo_nome: string
          p_arquivo_sha256: string
          p_execucao_anterior_id?: string
        }
        Returns: string
      }
      fn_importador_v2_encerrar_execucao: {
        Args: { p_execution_id: string; p_resumo: Json }
        Returns: undefined
      }
      fn_importador_v2_inserir_novo_ativo: {
        Args: {
          p_arquivo_sha256: string
          p_codigo_canonico: string
          p_execution_id: string
          p_linha_excel: number
          p_payload: Json
        }
        Returns: Json
      }
      fn_importador_v2_status_arquivo: {
        Args: { p_arquivo_sha256: string }
        Returns: {
          codigo_ativo_canonico: string
          created_at: string
          equipamento_id: string
          execution_id: string
          linha_excel: number
          mensagem: string
          numero_tentativas: number
          status: string
        }[]
      }
      fn_is_responsavel_item_ordem_diaria: {
        Args: { _ordem: string; _user: string }
        Returns: boolean
      }
      fn_is_responsavel_ordem_diaria: {
        Args: { _ordem: string; _user: string }
        Returns: boolean
      }
      fn_is_super_admin: { Args: { p_user_id?: string }; Returns: boolean }
      fn_listar_funcionarios_disponiveis_designacao: {
        Args: {
          p_atividade_id: string
          p_busca?: string
          p_incluir_outros_cc?: boolean
          p_semana_fim?: string
          p_semana_inicio?: string
        }
        Returns: {
          centro_custo_id: string
          codigo_centro_custo: string
          cpf_mascarado: string
          funcao_id: string
          funcionario_id: string
          matricula: string
          motivo_conflito: string
          nome_centro_custo: string
          nome_completo: string
          nome_funcao: string
          status: string
          tem_conflito_diaria_outro_cc: boolean
          tem_conflito_diaria_previsto: boolean
          tem_conflito_equipe: boolean
        }[]
      }
      fn_log_sensitive_read: {
        Args: {
          p_contexto?: Json
          p_event_type: string
          p_ip?: string
          p_rpc_name?: string
          p_table_name?: string
          p_target_id?: string
          p_user_agent?: string
          p_view_name?: string
        }
        Returns: undefined
      }
      fn_logistica_can_access_apontamento_cam: {
        Args: { _registro_id: string }
        Returns: boolean
      }
      fn_logistica_can_access_centro_custo: {
        Args: { _centro_custo_id: string }
        Returns: boolean
      }
      fn_logistica_can_access_entrega: {
        Args: { _lista_entrega_id: string }
        Returns: boolean
      }
      fn_logistica_can_access_programacao: {
        Args: { _programacao_id: string }
        Returns: boolean
      }
      fn_logistica_can_access_requisicao: {
        Args: { _requisicao_id: string }
        Returns: boolean
      }
      fn_logistica_can_manage_entrega: {
        Args: { _lista_entrega_id: string }
        Returns: boolean
      }
      fn_logistica_can_view_sensitive_exports: { Args: never; Returns: boolean }
      fn_logistica_current_funcionario_id: { Args: never; Returns: string }
      fn_logistica_is_privileged_user: { Args: never; Returns: boolean }
      fn_mapa_operacional_ultimas_localizacoes: {
        Args: { p_filtros?: Json }
        Returns: Json
      }
      fn_motoristas_operacional_lookup: {
        Args: never
        Returns: {
          funcao_nome: string
          id: string
          matricula: string
          nome_completo: string
        }[]
      }
      fn_normalizar_chave_rua: {
        Args: {
          p_bairro: string
          p_cidade: string
          p_logradouro: string
          p_uf: string
        }
        Returns: string
      }
      fn_normalize_role_name: { Args: { p_nome: string }; Returns: string }
      fn_notificacao_ct_viagem_evento: {
        Args: {
          p_actor: string
          p_request_id: string
          p_tipo: string
          p_titulo: string
          p_viagem_id: string
        }
        Returns: undefined
      }
      fn_notificacao_dest_centros_custo: {
        Args: { p_ccs: string[] }
        Returns: string[]
      }
      fn_notificacao_dest_profiles: {
        Args: { p_ids: string[] }
        Returns: string[]
      }
      fn_notificacao_emitir_core: {
        Args: {
          p_created_by?: string
          p_dedup_key?: string
          p_destinatarios?: string[]
          p_link?: string
          p_mensagem: string
          p_metadata?: Json
          p_tipo: string
          p_titulo: string
        }
        Returns: Json
      }
      fn_ordem_diaria_build_item_snapshot: {
        Args: { p_atividade_id: string }
        Returns: Json
      }
      fn_ordem_diaria_resolver_responsavel: {
        Args: { p_funcionario_id: string; p_profile_id: string }
        Returns: {
          funcao: string
          nome: string
        }[]
      }
      fn_os_can_access_chamado: {
        Args: { _chamado_id: string }
        Returns: boolean
      }
      fn_os_can_access_ordem: { Args: { _os_id: string }; Returns: boolean }
      fn_os_can_manage_chamado: {
        Args: { _chamado_id: string }
        Returns: boolean
      }
      fn_os_can_manage_ordem: { Args: { _os_id: string }; Returns: boolean }
      fn_os_current_funcionario_id: { Args: never; Returns: string }
      fn_os_has_financial_access: { Args: never; Returns: boolean }
      fn_os_has_maintenance_access: { Args: never; Returns: boolean }
      fn_os_has_operational_access: {
        Args: { _centro_custo_id: string; _equipamento_id: string }
        Returns: boolean
      }
      fn_os_is_admin_user: { Args: never; Returns: boolean }
      fn_os_storage_object_allowed: {
        Args: { _name: string }
        Returns: boolean
      }
      fn_permission_aliases: {
        Args: { p_nome_permissao: string }
        Returns: string[]
      }
      fn_permission_is_protected: {
        Args: { p_permission_id: string }
        Returns: boolean
      }
      fn_planejamento_scope_centros_custo: {
        Args: { p_user_id?: string }
        Returns: string[]
      }
      fn_planejamento_tornar_vigente: {
        Args: { p_planejamento_id: string }
        Returns: {
          aprovado_em: string | null
          aprovado_por: string | null
          centro_custo_id: string
          created_at: string
          criado_por: string | null
          id: string
          observacao: string | null
          origem: string
          periodo_fim: string
          periodo_inicio: string
          status: string
          updated_at: string
          versao: number
        }
        SetofOptions: {
          from: "*"
          to: "bd_planejamentos_obra"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_pncp_can_access_sync_log_row: {
        Args: { p_row_user_id: string; p_user_id?: string }
        Returns: boolean
      }
      fn_pncp_can_manage: { Args: { p_user_id?: string }; Returns: boolean }
      fn_pncp_can_manage_orgaos: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      fn_pncp_can_view: { Args: { p_user_id?: string }; Returns: boolean }
      fn_pncp_can_view_strategic: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      fn_pode_ver_agendamento_exame_por_cc: {
        Args: { p_contrato: string }
        Returns: boolean
      }
      fn_ponto_can_access_batida: {
        Args: { _batida_id: string }
        Returns: boolean
      }
      fn_ponto_can_manage_config: { Args: never; Returns: boolean }
      fn_ponto_can_manage_devices: { Args: never; Returns: boolean }
      fn_ponto_can_manage_vinculos: { Args: never; Returns: boolean }
      fn_ponto_can_view_antifraude_logs: { Args: never; Returns: boolean }
      fn_ponto_can_view_gestao: { Args: never; Returns: boolean }
      fn_ponto_can_view_rh: { Args: never; Returns: boolean }
      fn_ponto_diaria_integrar_batida: {
        Args: { p_batida_id: string }
        Returns: string
      }
      fn_ponto_diaria_integrar_lote: {
        Args: { p_batida_ids: string[] }
        Returns: {
          batida_id: string
          erro: string
          status: string
        }[]
      }
      fn_ponto_diaria_simular_batida: {
        Args: { p_batida_id: string }
        Returns: string
      }
      fn_ponto_diaria_simular_lote: {
        Args: { p_ate: string; p_desde: string; p_limit?: number }
        Returns: Json
      }
      fn_ponto_get_funcionario_id: { Args: never; Returns: string }
      fn_ponto_has_permission: { Args: { _codigo: string }; Returns: boolean }
      fn_ponto_is_superadmin: { Args: never; Returns: boolean }
      fn_ponto_user_can_access_cc: {
        Args: { _centro_custo_id: string }
        Returns: boolean
      }
      fn_ponto_user_can_access_funcionario: {
        Args: { _funcionario_id: string }
        Returns: boolean
      }
      fn_pop_anexar_arquivo_rascunho: {
        Args: {
          p_ator: string
          p_mime: string
          p_nome_original: string
          p_path: string
          p_pop_id: string
          p_sha256: string
          p_tamanho: number
        }
        Returns: Json
      }
      fn_pop_atualizar_rascunho: {
        Args: {
          p_categoria?: string
          p_codigo?: string
          p_elaborado_por_id?: string
          p_motivo?: string
          p_pop_id: string
          p_setor_id?: string
          p_tipo_incremento?: string
          p_titulo?: string
        }
        Returns: string
      }
      fn_pop_criar: {
        Args: {
          p_categoria?: string
          p_codigo: string
          p_elaborado_por_id?: string
          p_setor_id: string
          p_titulo: string
        }
        Returns: string
      }
      fn_pop_descartar_rascunho: {
        Args: { p_motivo: string; p_pop_id: string }
        Returns: Json
      }
      fn_pop_excluir: {
        Args: { p_motivo: string; p_pop_id: string }
        Returns: Json
      }
      fn_pop_gate_homologacao: { Args: never; Returns: boolean }
      fn_pop_gate_homologacao_ator: {
        Args: { p_ator: string }
        Returns: boolean
      }
      fn_pop_iniciar_revisao: {
        Args: {
          p_elaborado_por_id?: string
          p_motivo: string
          p_pop_id: string
          p_tipo_incremento: string
        }
        Returns: string
      }
      fn_pop_publicar_rascunho: { Args: { p_pop_id: string }; Returns: Json }
      fn_pop_reativar: { Args: { p_pop_id: string }; Returns: string }
      fn_pop_tornar_obsoleto: {
        Args: { p_motivo: string; p_pop_id: string }
        Returns: string
      }
      fn_rate_limit_check: {
        Args: {
          p_bloqueio_segundos: number
          p_chave_tipo: string
          p_chave_valor: string
          p_escopo: string
          p_janela_segundos: number
          p_max_tentativas: number
        }
        Returns: {
          bloqueado_ate: string
          permitido: boolean
          tentativas: number
        }[]
      }
      fn_rate_limit_reset: {
        Args: { p_chave_tipo: string; p_chave_valor: string; p_escopo: string }
        Returns: undefined
      }
      fn_recalcula_total_os: { Args: { p_os_id: string }; Returns: undefined }
      fn_reconciliar_estado_manutencao_ativo: {
        Args: { p_equipamento_id: string }
        Returns: undefined
      }
      fn_registrar_apontamento_item_ordem_diaria: {
        Args: {
          p_equipe_presente?: string[]
          p_item_id: string
          p_meta_dia_informada?: number
          p_motivo_impedimento?: string
          p_observacao?: string
          p_quantidade_executada?: number
          p_status_execucao: string
        }
        Returns: string
      }
      fn_registrar_leitura_os_sensivel: {
        Args: {
          _metadata?: Json
          _origem: string
          _recurso_id: string
          _recurso_tipo: string
        }
        Returns: undefined
      }
      fn_registrar_nonce_atestado: {
        Args: { p_funcionario_id: string; p_ip: unknown; p_nonce: string }
        Returns: boolean
      }
      fn_registrar_permissao: {
        Args: {
          p_acoes_padrao?: string[]
          p_codigo: string
          p_descricao?: string
          p_modulo?: string
          p_nome: string
          p_rota?: string
          p_tipo?: string
        }
        Returns: string
      }
      fn_relatorio_aps_atualizar_carimbo: {
        Args: {
          p_bairro: string
          p_carimbo_id: string
          p_cliente: string
          p_empresa: string
          p_nome: string
          p_obra: string
          p_observacoes: string
          p_revisao: string
          p_updated_at_esperado: string
        }
        Returns: {
          ativo: boolean
          bairro: string | null
          centro_custo_id: string | null
          cliente: string | null
          created_at: string
          created_by: string
          empresa: string | null
          id: string
          nome: string
          obra: string | null
          observacoes: string | null
          padrao_centro_custo: boolean
          revisao: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "bd_relatorio_aps_carimbos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_relatorio_aps_criar_carimbo: {
        Args: {
          p_bairro: string
          p_centro_custo_id: string
          p_cliente: string
          p_definir_padrao?: boolean
          p_empresa: string
          p_nome: string
          p_obra: string
          p_observacoes: string
          p_revisao: string
        }
        Returns: {
          ativo: boolean
          bairro: string | null
          centro_custo_id: string | null
          cliente: string | null
          created_at: string
          created_by: string
          empresa: string | null
          id: string
          nome: string
          obra: string | null
          observacoes: string | null
          padrao_centro_custo: boolean
          revisao: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "bd_relatorio_aps_carimbos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_relatorio_aps_definir_carimbo_padrao: {
        Args: { p_carimbo_id: string; p_centro_custo_id: string }
        Returns: {
          ativo: boolean
          bairro: string | null
          centro_custo_id: string | null
          cliente: string | null
          created_at: string
          created_by: string
          empresa: string | null
          id: string
          nome: string
          obra: string | null
          observacoes: string | null
          padrao_centro_custo: boolean
          revisao: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "bd_relatorio_aps_carimbos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_relatorio_aps_desvincular_padrao: {
        Args: { p_centro_custo_id: string }
        Returns: {
          ativo: boolean
          bairro: string | null
          centro_custo_id: string | null
          cliente: string | null
          created_at: string
          created_by: string
          empresa: string | null
          id: string
          nome: string
          obra: string | null
          observacoes: string | null
          padrao_centro_custo: boolean
          revisao: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "bd_relatorio_aps_carimbos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_relatorio_aps_inativar_carimbo: {
        Args: { p_carimbo_id: string; p_updated_at_esperado: string }
        Returns: {
          ativo: boolean
          bairro: string | null
          centro_custo_id: string | null
          cliente: string | null
          created_at: string
          created_by: string
          empresa: string | null
          id: string
          nome: string
          obra: string | null
          observacoes: string | null
          padrao_centro_custo: boolean
          revisao: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "bd_relatorio_aps_carimbos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_remove_user_role_secure: {
        Args: { p_role_id: string; p_target_user_id: string }
        Returns: undefined
      }
      fn_remover_designacao_equipe: { Args: { p_id: string }; Returns: string }
      fn_reprovar_classificacao_solicitacao: {
        Args: { p_id: string; p_motivo: string }
        Returns: undefined
      }
      fn_resolver_base_diaria: {
        Args: {
          p_data: string
          p_funcionario_id: string
          p_solicitacao_id: string
        }
        Returns: {
          funcao_id: string
          recebe_refeicao: boolean
          usar_exclusiva: boolean
          valor_base: number
          valor_refeicao: number
        }[]
      }
      fn_reverter_saneamento_auto: {
        Args: {
          p_aprovador_formal_id: string
          p_dry_run?: boolean
          p_execution_id: string
          p_motivo_reversao: string
        }
        Returns: {
          dry_run: boolean
          item_idx_jsonb: number
          revertido: boolean
          solicitacao_id: string
          tipo_correcao: string
          valor_revertido_de: Json
          valor_revertido_para: Json
        }[]
      }
      fn_rh_funcionarios_listar: {
        Args: {
          p_centro_custo_id?: string
          p_cpf?: string
          p_data_admissao_fim?: string
          p_data_admissao_inicio?: string
          p_departamento_id?: string
          p_empresa_id?: string
          p_equipe_id?: string
          p_funcao_id?: string
          p_matricula?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          rows: Json
          total_count: number
        }[]
      }
      fn_role_is_protected: { Args: { p_role_id: string }; Returns: boolean }
      fn_salvar_apontamento_ce_com_inspecao: {
        Args: { p_apontamento_id: string; p_cabecalho: Json; p_inspecao: Json }
        Returns: {
          apontamento_id: string
          inspecao_id: string
        }[]
      }
      fn_server_now_brt: { Args: never; Returns: string }
      fn_solic_equip_capacidades_aprovacao: {
        Args: { p_ids: string[] }
        Returns: {
          authorization_source: string
          auto_approval: boolean
          block_reason: string
          can_approve: boolean
          can_reject: boolean
          exists_visible: boolean
          solicitacao_id: string
        }[]
      }
      fn_solic_equip_criar: {
        Args: {
          p_apontador_responsavel_id: string
          p_centro_custo_id: string
          p_com_operador: boolean
          p_data_inicio: string
          p_engenheiro_solicitante_id: string
          p_itens: Json
          p_justificativa: string
          p_prioridade: string
          p_regime_trabalho: string
          p_solicitacao_id: string
          p_tempo_previsto_dias: number
          p_tipo_equipamento_id: string
        }
        Returns: Json
      }
      fn_solic_equip_decidir: {
        Args: {
          p_comentario: string
          p_decisao: string
          p_solicitacao_id: string
        }
        Returns: Json
      }
      fn_solic_equip_detalhe_central: {
        Args: { p_solicitacao_id: string }
        Returns: Json
      }
      fn_solic_equip_indicadores_central: { Args: never; Returns: Json }
      fn_solic_equip_listar_central:
        | {
            Args: {
              p_apenas_minha_acao?: boolean
              p_busca?: string
              p_centro_custo_ids?: string[]
              p_limit?: number
              p_offset?: number
              p_periodo_fim?: string
              p_periodo_inicio?: string
              p_solicitante_id?: string
              p_status_fluxo?: string[]
            }
            Returns: {
              aprovador_centro_custo_id: string
              authorization_source: string
              auto_approval: boolean
              block_reason: string
              can_approve: boolean
              can_reject: boolean
              centro_custo_id: string
              codigo_cc: string
              created_at: string
              data_inicio: string
              itens_resumo: string
              nome_cc: string
              prioridade: string
              qtd_itens: number
              quantidade: number
              solicitacao_id: string
              solicitante_id: string
              solicitante_nome: string
              status: string
              status_fluxo: string
              total_count: number
              updated_at: string
            }[]
          }
        | {
            Args: {
              p_apenas_minha_acao?: boolean
              p_busca?: string
              p_centro_custo_ids?: string[]
              p_limit?: number
              p_minhas_decisoes?: boolean
              p_offset?: number
              p_periodo_fim?: string
              p_periodo_inicio?: string
              p_solicitante_id?: string
              p_status_fluxo?: string[]
            }
            Returns: {
              aprovador_centro_custo_id: string
              authorization_source: string
              auto_approval: boolean
              block_reason: string
              can_approve: boolean
              can_reject: boolean
              centro_custo_id: string
              codigo_cc: string
              created_at: string
              data_inicio: string
              itens_resumo: string
              nome_cc: string
              prioridade: string
              qtd_itens: number
              quantidade: number
              solicitacao_id: string
              solicitante_id: string
              solicitante_nome: string
              status: string
              status_fluxo: string
              total_count: number
              updated_at: string
            }[]
          }
      fn_solic_equip_pos_decisao: {
        Args: {
          p_acao: string
          p_comentario?: string
          p_solicitacao_id: string
        }
        Returns: Json
      }
      fn_solicitacao_tem_lote_pendente: {
        Args: { p_solicitacao_id: string }
        Returns: boolean
      }
      fn_storage_audit_access: {
        Args: {
          _acao: string
          _bucket: string
          _metadata?: Json
          _name: string
        }
        Returns: string
      }
      fn_storage_can_access: {
        Args: { _bucket: string; _name: string; _user_id?: string }
        Returns: boolean
      }
      fn_storage_can_upload: {
        Args: { _bucket: string; _name: string; _user_id?: string }
        Returns: boolean
      }
      fn_storage_entity_id: {
        Args: { _index: number; _name: string }
        Returns: string
      }
      fn_storage_entity_type: {
        Args: { _bucket: string; _name: string }
        Returns: string
      }
      fn_storage_extract_uuid: { Args: { _value: string }; Returns: string }
      fn_target_user_has_protected_access: {
        Args: { p_target_user_id: string }
        Returns: boolean
      }
      fn_ultima_classificacao_data: {
        Args: { p_funcionario_id: string }
        Returns: string
      }
      fn_update_managed_profile_access_scope: {
        Args: { p_acesso_global: boolean; p_target_user_id: string }
        Returns: undefined
      }
      fn_user_can_access_diaria_financial: {
        Args: { _solicitacao_id: string; _user_id: string }
        Returns: boolean
      }
      fn_user_can_access_diaria_solicitacao: {
        Args: { _solicitacao_id: string; _user_id: string }
        Returns: boolean
      }
      fn_user_has_any_named_role: {
        Args: { _roles: string[]; _user_id: string }
        Returns: boolean
      }
      fn_veiculos_alocacao_atual: {
        Args: { p_equipamento_ids?: string[] }
        Returns: {
          centro_custo_atual_codigo: string
          centro_custo_atual_id: string
          centro_custo_atual_nome: string
          centro_custo_atualizado_em: string
          centro_custo_origem: string
          equipamento_id: string
          ultimo_apontamento_id: string
        }[]
      }
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
      gerenciar_convocado_diaria_no_dia: {
        Args: {
          p_acao: string
          p_data_apontamento: string
          p_funcionario_data: Json
          p_solicitacao_id: string
        }
        Returns: undefined
      }
      get_admsede_centros_custo: {
        Args: { p_user_id?: string }
        Returns: string[]
      }
      get_apontadores_por_cc: {
        Args: { p_centro_custo_id: string; p_user_id: string }
        Returns: {
          centro_custo_id: string
          funcao_id: string
          id: string
          matricula: string
          nome_completo: string
          nome_funcao: string
          status: string
          valor_diaria: number
          valor_diaria_exclusiva: number
          valor_refeicao: number
        }[]
      }
      get_auditoria_alertas_24h: { Args: never; Returns: Json }
      get_auditoria_sistema: {
        Args: {
          p_apenas_suspeitos?: boolean
          p_categorias?: string[]
          p_data_fim?: string
          p_data_inicio?: string
          p_funcionario_id?: string
          p_nivel_risco?: string[]
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_usuario_id?: string
        }
        Returns: Json
      }
      get_configuracao_sistema: { Args: { p_chave: string }; Returns: string }
      get_data_operacional_atual: { Args: never; Returns: string }
      get_engenheiros: {
        Args: never
        Returns: {
          centro_custo_id: string
          funcao_id: string
          id: string
          matricula: string
          nome_completo: string
          nome_funcao: string
          status: string
          valor_diaria: number
          valor_diaria_exclusiva: number
          valor_refeicao: number
        }[]
      }
      get_etapas_utilizadas: {
        Args: { p_checklist_id?: string; p_obra_id: string }
        Returns: string[]
      }
      get_funcionario_id_for_auth: { Args: never; Returns: string }
      get_funcionarios_ativos_global: {
        Args: {
          p_centro_custo?: string
          p_ids?: string[]
          p_limit?: number
          p_search?: string
        }
        Returns: {
          centro_custo_id: string
          cpf: string
          email: string
          funcao_id: string
          id: string
          matricula: string
          nome_completo: string
          nome_funcao: string
          status: string
          valor_diaria: number
          valor_diaria_exclusiva: number
          valor_refeicao: number
        }[]
      }
      get_funcionarios_para_diarias: {
        Args: { p_centro_custo_id?: string; p_user_id?: string }
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
      get_relatorio_diarias: {
        Args: {
          p_centro_custo_ids?: string[]
          p_data_fim: string
          p_data_inicio: string
          p_funcionario_ids?: string[]
          p_limit?: number
          p_offset?: number
        }
        Returns: Json
      }
      get_relatorio_diarias_full: {
        Args: {
          p_centro_custo_ids?: string[]
          p_data_fim: string
          p_data_inicio: string
          p_funcionario_ids?: string[]
        }
        Returns: Json
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
      has_role: {
        Args: { p_role: string; p_user_id?: string }
        Returns: boolean
      }
      has_sso_full_access: { Args: { p_user_id?: string }; Returns: boolean }
      has_sso_permission: { Args: { p_user_id?: string }; Returns: boolean }
      identificar_funcionario_por_descriptor: {
        Args: {
          p_descriptor: string
          p_dispositivo_id: string
          p_threshold?: number
        }
        Returns: {
          centro_custo: string
          confianca: number
          cpf: string
          foto_url: string
          funcao: string
          funcionario_id: string
          matricula: string
          nome: string
        }[]
      }
      identificar_funcionario_por_descriptor_v2: {
        Args: { p_descriptor: string; p_dispositivo_id: string }
        Returns: {
          centro_custo: string
          cpf: string
          delta_confidence: number
          foto_url: string
          funcao: string
          margem_euclid: number
          matricula: string
          nome: string
          top1_confidence: number
          top1_distancia_euclid: number
          top1_funcionario_id: string
          top2_confidence: number
          top2_distancia_euclid: number
          top2_funcionario_id: string
        }[]
      }
      iniciar_fluxo_dinamico: {
        Args: { p_solicitacao_id: string }
        Returns: undefined
      }
      integrar_ponto_com_diaria: {
        Args: { p_batida_id: string }
        Returns: Json
      }
      is_admsede_for_cc: {
        Args: { p_cc_id: string; p_user_id: string }
        Returns: boolean
      }
      is_departmental_super_admin: { Args: never; Returns: boolean }
      is_ponto_superadmin: { Args: never; Returns: boolean }
      is_super_admin: { Args: { p_user_id: string }; Returns: boolean }
      is_superadm_or_rh: { Args: { _user_id: string }; Returns: boolean }
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
      normalize_text_immutable: {
        Args: { input_text: string }
        Returns: string
      }
      rbac_auto_migrate_user: { Args: { p_user_id: string }; Returns: Json }
      refresh_relatorio_diarias: { Args: { p_force?: boolean }; Returns: Json }
      registrar_evento_auditoria_biometria: {
        Args: {
          p_funcionario_id: string
          p_hash_anterior: string
          p_hash_novo: string
          p_ip?: string
          p_metadata?: Json
          p_origem?: Database["public"]["Enums"]["origem_auditoria_biometria"]
          p_tipo_evento: Database["public"]["Enums"]["tipo_evento_auditoria_biometria"]
          p_user_agent?: string
        }
        Returns: string
      }
      rejeitar_etapa_dinamica: {
        Args: {
          p_etapa_exec_id: string
          p_observacao?: string
          p_solicitacao_id: string
        }
        Returns: undefined
      }
      rejeitar_lote_diaria: {
        Args: { p_lote_id: string; p_motivo: string }
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
      remover_item_lote: { Args: { p_item_id: string }; Returns: undefined }
      reprovar_aditivo: {
        Args: { p_aditivo_id: string; p_motivo: string }
        Returns: undefined
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
      rpc_create_gestor_role: {
        Args: { p_descricao?: string; p_role_name: string }
        Returns: string
      }
      salvar_assinatura_funcionario:
        | {
            Args: {
              p_assinatura_hash?: string
              p_assinatura_url: string
              p_funcionario_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_assinatura_hash?: string
              p_assinatura_url: string
              p_funcionario_id: string
              p_ip?: string
              p_origem?: Database["public"]["Enums"]["origem_auditoria_biometria"]
              p_user_agent?: string
            }
            Returns: Json
          }
      sincronizar_hora_saida_aplicacao: {
        Args: { p_registro_aplicacao_id: string }
        Returns: undefined
      }
      solicitar_aditivo_dia: {
        Args: {
          p_data_ajustada: string
          p_funcionarios: Json
          p_impacto?: Json
          p_justificativa: string
          p_solicitacao_id: string
          p_tipo: string
        }
        Returns: string
      }
      solicitar_aditivo_funcionario: {
        Args: {
          p_data_ajustada: string
          p_funcionario_id: string
          p_impacto?: Json
          p_justificativa: string
          p_snapshot: Json
          p_solicitacao_id: string
        }
        Returns: string
      }
      sync_convocados_pre_valores: { Args: never; Returns: number }
      sync_presencas_valores_funcao: { Args: never; Returns: Json }
      sync_profile_funcao_sistema: {
        Args: { _profile_id: string }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
      unaccent_immutable: { Args: { input_text: string }; Returns: string }
      update_configuracao_sistema: {
        Args: { p_chave: string; p_valor: string }
        Returns: undefined
      }
      update_profile_funcionario_id: {
        Args: { _funcionario_id: string; _profile_id: string }
        Returns: undefined
      }
      user_has_permission: {
        Args: { permission_name: string; user_id: string }
        Returns: boolean
      }
      user_has_permission_action: {
        Args: { _acao: string; _codigo: string; _user_id: string }
        Returns: boolean
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
      chamado_interno_evento_tipo:
        | "abertura"
        | "roteamento"
        | "atribuicao"
        | "resposta_atendente"
        | "resposta_solicitante"
        | "solicitacao_informacao"
        | "nota_interna"
        | "mudanca_status"
        | "resolucao"
        | "confirmacao_encerramento"
        | "reabertura"
        | "cancelamento"
      chamado_interno_prioridade: "baixa" | "normal" | "alta" | "critico"
      chamado_interno_setor:
        | "administracao"
        | "financeiro"
        | "ti"
        | "manutencao"
        | "eletrica"
        | "sso"
      chamado_interno_status:
        | "aberto"
        | "em_triagem"
        | "em_analise"
        | "aguardando_solicitante"
        | "respondido"
        | "resolvido"
        | "encerrado"
        | "reaberto"
        | "cancelado"
      confiabilidade_previsao_enum: "ALTA" | "MEDIA" | "BAIXA"
      diaria_lote_item_status:
        | "rascunho"
        | "pendente_aprovacao"
        | "aprovado"
        | "rejeitado"
        | "cancelado"
      diaria_lote_origem: "legado" | "explicito" | "apontamento_dia"
      diaria_lote_status:
        | "rascunho"
        | "pendente_aprovacao"
        | "aprovado"
        | "rejeitado"
        | "cancelado"
      origem_auditoria_biometria:
        | "admin_web"
        | "pwa_mobile"
        | "totem_device"
        | "api_interna"
        | "trigger_db"
      origem_localizacao_enum:
        | "CENTRO_CUSTO"
        | "MANUAL"
        | "TELEMETRIA"
        | "APONTAMENTO_CE"
      papel_equipe_tarefa:
        | "execucao"
        | "apoio"
        | "encarregado"
        | "mestre"
        | "responsavel_tecnico"
        | "apontador"
      ponto_modo_registro: "pwa_pessoal" | "totem" | "dispositivo_obra"
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
      status_equipe_designada:
        | "rascunho"
        | "confirmado"
        | "substituido"
        | "cancelado"
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
      tipo_alocacao_equipe: "proprio_cc" | "emprestado_outra_obra"
      tipo_evento_auditoria_biometria:
        | "biometria_cadastrada"
        | "biometria_substituida"
        | "biometria_desativada"
        | "assinatura_cadastrada"
        | "assinatura_substituida"
        | "cpf_alterado"
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
      chamado_interno_evento_tipo: [
        "abertura",
        "roteamento",
        "atribuicao",
        "resposta_atendente",
        "resposta_solicitante",
        "solicitacao_informacao",
        "nota_interna",
        "mudanca_status",
        "resolucao",
        "confirmacao_encerramento",
        "reabertura",
        "cancelamento",
      ],
      chamado_interno_prioridade: ["baixa", "normal", "alta", "critico"],
      chamado_interno_setor: [
        "administracao",
        "financeiro",
        "ti",
        "manutencao",
        "eletrica",
        "sso",
      ],
      chamado_interno_status: [
        "aberto",
        "em_triagem",
        "em_analise",
        "aguardando_solicitante",
        "respondido",
        "resolvido",
        "encerrado",
        "reaberto",
        "cancelado",
      ],
      confiabilidade_previsao_enum: ["ALTA", "MEDIA", "BAIXA"],
      diaria_lote_item_status: [
        "rascunho",
        "pendente_aprovacao",
        "aprovado",
        "rejeitado",
        "cancelado",
      ],
      diaria_lote_origem: ["legado", "explicito", "apontamento_dia"],
      diaria_lote_status: [
        "rascunho",
        "pendente_aprovacao",
        "aprovado",
        "rejeitado",
        "cancelado",
      ],
      origem_auditoria_biometria: [
        "admin_web",
        "pwa_mobile",
        "totem_device",
        "api_interna",
        "trigger_db",
      ],
      origem_localizacao_enum: [
        "CENTRO_CUSTO",
        "MANUAL",
        "TELEMETRIA",
        "APONTAMENTO_CE",
      ],
      papel_equipe_tarefa: [
        "execucao",
        "apoio",
        "encarregado",
        "mestre",
        "responsavel_tecnico",
        "apontador",
      ],
      ponto_modo_registro: ["pwa_pessoal", "totem", "dispositivo_obra"],
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
      status_equipe_designada: [
        "rascunho",
        "confirmado",
        "substituido",
        "cancelado",
      ],
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
      tipo_alocacao_equipe: ["proprio_cc", "emprestado_outra_obra"],
      tipo_evento_auditoria_biometria: [
        "biometria_cadastrada",
        "biometria_substituida",
        "biometria_desativada",
        "assinatura_cadastrada",
        "assinatura_substituida",
        "cpf_alterado",
      ],
    },
  },
} as const
