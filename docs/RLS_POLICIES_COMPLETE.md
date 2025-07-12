
# Documentação Completa das Políticas RLS (Row Level Security)

## Índice
- [Visão Geral](#visão-geral)
- [Funções de Segurança](#funções-de-segurança)
- [Políticas por Tabela](#políticas-por-tabela)
- [Análise de Problemas](#análise-de-problemas)
- [Recomendações](#recomendações)

## Visão Geral

Este documento contém a documentação completa de todas as políticas RLS implementadas no sistema de gestão integrada. O objetivo é mapear todas as políticas existentes, identificar conflitos e fornecer um guia para futuras modificações sem quebrar funcionalidades existentes.

**Total de Tabelas com RLS:** 15 tabelas
**Total de Políticas:** 42+ políticas ativas

## Funções de Segurança

### Funções Auxiliares Implementadas

#### `check_is_super_admin(user_id uuid) -> boolean`
```sql
-- Função SECURITY DEFINER para verificar SuperAdmin
-- Evita recursão infinita nas políticas RLS
SELECT EXISTS (
  SELECT 1 FROM profiles 
  WHERE id = user_id 
  AND 'SuperAdm' = ANY(funcoes)
);
```

#### `get_current_user_role() -> text`
```sql
-- Retorna a função hierárquica do usuário atual
-- Hierarquia: SuperAdm > AdmRH > Administrador > Apontador > Encarregado > Operador > user
```

#### `get_user_allowed_teams() -> uuid[]`
```sql
-- Retorna array de IDs das equipes que o usuário pode acessar
-- SuperAdm/AdmRH: todas as equipes
-- Outros: apenas equipes onde é apontador ou encarregado
```

## Políticas por Tabela

### 1. **profiles** (4 políticas)

#### ✅ `Allow profile creation`
- **Comando:** INSERT
- **Usuários:** authenticated
- **Condição:** `true`
- **Propósito:** Permite criação de perfis durante registro
- **Status:** ✅ Funcionando corretamente

#### ✅ `SuperAdmin can access all profiles`
- **Comando:** ALL
- **Condição:** `(id = auth.uid()) OR check_is_super_admin(auth.uid())`
- **Propósito:** SuperAdmin acessa todos os perfis, usuários acessam apenas próprio perfil
- **Status:** ✅ Funcionando corretamente

#### ✅ `Users can update own profile`
- **Comando:** UPDATE
- **Condição:** `id = auth.uid()`
- **Propósito:** Usuários podem atualizar apenas próprio perfil
- **Status:** ✅ Funcionando corretamente

#### ✅ `Users can view own profile`
- **Comando:** SELECT
- **Condição:** `id = auth.uid()`
- **Propósito:** Usuários podem ver apenas próprio perfil
- **Status:** ✅ Funcionando corretamente

### 2. **bd_funcionarios** (5 políticas)

#### ✅ `Admin roles can modify employees`
- **Comando:** ALL
- **Condição:** SuperAdm, AdmRH ou Administrador
- **Propósito:** Apenas administradores podem gerenciar funcionários
- **Status:** ✅ Funcionando corretamente

#### ✅ `Admin roles can view all employees`
- **Comando:** SELECT
- **Condição:** SuperAdm, AdmRH ou Administrador
- **Status:** ✅ Funcionando corretamente

#### ✅ `Allow anonymous email verification for registration`
- **Comando:** SELECT
- **Condição:** `true` (para usuários anônimos)
- **Propósito:** Permite verificação de email durante registro
- **Status:** ✅ Funcionando corretamente

#### ✅ `Allow email verification for registration`
- **Comando:** SELECT
- **Condição:** `true` (para usuários autenticados)
- **Status:** ✅ Funcionando corretamente

#### ✅ `Users can view own employee record`
- **Comando:** SELECT
- **Condição:** `email = (SELECT email FROM profiles WHERE id = auth.uid())`
- **Propósito:** Usuários podem ver apenas seu próprio registro de funcionário
- **Status:** ✅ Funcionando corretamente

### 3. **bd_equipes** (7 políticas)

#### ✅ `Admin roles can access all teams`
- **Comando:** ALL
- **Condição:** AdmRH ou Administrador
- **Status:** ✅ Funcionando corretamente

#### ⚠️ `Everyone can delete teams`
- **Comando:** DELETE
- **Condição:** `true`
- **Status:** ⚠️ POTENCIAL PROBLEMA - Qualquer usuário pode deletar equipes

#### ⚠️ `Everyone can insert teams`
- **Comando:** INSERT
- **Condição:** `true`
- **Status:** ⚠️ POTENCIAL PROBLEMA - Qualquer usuário pode criar equipes

#### ⚠️ `Everyone can update teams`
- **Comando:** UPDATE
- **Condição:** `true`
- **Status:** ⚠️ POTENCIAL PROBLEMA - Qualquer usuário pode editar equipes

#### ✅ `SuperAdmin full access to teams`
- **Comando:** ALL
- **Condição:** SuperAdm
- **Status:** ✅ Funcionando corretamente

#### ✅ `Team leaders can access their teams`
- **Comando:** ALL
- **Condição:** Apontador ou Encarregado da equipe
- **Status:** ✅ Funcionando corretamente

#### ✅ `Team members can view their teams`
- **Comando:** SELECT
- **Condição:** Operador membro da equipe
- **Status:** ✅ Funcionando corretamente

### 4. **bd_apontamento_equipe** (3 políticas)

#### ✅ `Admin roles can access all appointments`
- **Comando:** ALL
- **Condição:** SuperAdm, AdmRH ou Administrador
- **Status:** ✅ Funcionando corretamente

#### ✅ `Operador can only see own appointments`
- **Comando:** SELECT
- **Condição:** Operador vê apenas seus próprios apontamentos
- **Status:** ✅ Funcionando corretamente

#### ✅ `Team members can access their team appointments`
- **Comando:** ALL
- **Condição:** Apontador ou Encarregado pode acessar apontamentos de sua equipe
- **Status:** ✅ Funcionando corretamente

### 5. **bd_avaliacao_equipe** (3 políticas)

#### ✅ `Admin roles can access all evaluations`
- **Comando:** ALL
- **Condição:** SuperAdm, AdmRH ou Administrador
- **Status:** ✅ Funcionando corretamente

#### ✅ `Operador can only see own evaluations`
- **Comando:** SELECT
- **Condição:** Operador vê apenas suas próprias avaliações
- **Status:** ✅ Funcionando corretamente

#### ✅ `Team members can access their team evaluations`
- **Comando:** ALL
- **Condição:** Apontador ou Encarregado pode acessar avaliações de sua equipe
- **Status:** ✅ Funcionando corretamente

### 6. **bd_registro_apontamento_cam_equipa** (7 políticas) 🚨 **TABELA PROBLEMÁTICA**

#### ✅ `Admins can view all vehicle appointments`
- **Comando:** SELECT
- **Condição:** Administrador, AdmRH ou Encarregado
- **Status:** ✅ Funcionando corretamente

#### ⚠️ `Apontadores can access team vehicle data`
- **Comando:** ALL
- **Condição:** Complexa - verifica se é apontador da equipe do operador
- **Status:** ⚠️ PODE ESTAR CAUSANDO CONFLITOS

#### ✅ `Authenticated users can create vehicle appointments`
- **Comando:** INSERT
- **Condição:** `auth.uid() IS NOT NULL`
- **Status:** ✅ Funcionando corretamente

#### ⚠️ `Encarregados can access team vehicle data`
- **Comando:** ALL
- **Condição:** Complexa - verifica se é encarregado da equipe do operador
- **Status:** ⚠️ PODE ESTAR CAUSANDO CONFLITOS

#### ✅ `Operators can manage own vehicle appointments`
- **Comando:** ALL
- **Condição:** Operador pode gerenciar apenas seus próprios apontamentos
- **Status:** ✅ Funcionando corretamente

#### ✅ `SuperAdmin can access all vehicle appointments`
- **Comando:** ALL
- **Condição:** SuperAdm
- **Status:** ✅ Funcionando corretamente

#### 🚨 `Team leaders can read horimeters for calculation`
- **Comando:** SELECT
- **Condição:** `'Apontador' = ANY(p.funcoes) OR 'Encarregado' = ANY(p.funcoes)`
- **Status:** 🚨 **PROBLEMA IDENTIFICADO** - Esta política permite que qualquer Apontador ou Encarregado veja TODOS os apontamentos, não apenas de sua equipe!

### 7. **bd_caminhoes_equipamentos** (1 política)

#### ✅ `Allow SuperAdmin access to caminhoes`
- **Comando:** ALL
- **Condição:** SuperAdm
- **Status:** ✅ Funcionando corretamente

### 8. **bd_empresas** (4 políticas)

#### ✅ `Authenticated users can insert companies`
- **Comando:** INSERT
- **Condição:** `true`
- **Status:** ✅ Funcionando corretamente

#### ✅ `Authenticated users can update companies`
- **Comando:** UPDATE
- **Condição:** `true`
- **Status:** ✅ Funcionando corretamente

#### ✅ `Authenticated users can view all companies`
- **Comando:** SELECT
- **Condição:** `true`
- **Status:** ✅ Funcionando corretamente

#### ✅ `Only admins can delete companies`
- **Comando:** DELETE
- **Condição:** 'admin' = ANY(funcoes)
- **Status:** ✅ Funcionando corretamente

### 9. **bd_funcoes** (1 política)

#### ✅ `Allow all operations for authenticated users`
- **Comando:** ALL
- **Condição:** `true`
- **Status:** ✅ Funcionando corretamente

### 10. **bd_lista_programacao_entrega** (1 política)

#### ✅ `SuperAdmin can access all deliveries`
- **Comando:** ALL
- **Condição:** SuperAdm
- **Status:** ✅ Funcionando corretamente

### 11. **bd_registro_apontamento_aplicacao** (1 política)

#### ✅ `SuperAdmin can access all application records`
- **Comando:** ALL
- **Condição:** SuperAdm
- **Status:** ✅ Funcionando corretamente

### 12. **bd_registro_cargas** (1 política)

#### ✅ `SuperAdmin can access all cargo records`
- **Comando:** ALL
- **Condição:** SuperAdm
- **Status:** ✅ Funcionando corretamente

### 13. **bd_requisicoes** (2 políticas)

#### ✅ `Allow SuperAdmin access to requisicoes`
- **Comando:** ALL
- **Condição:** SuperAdm
- **Status:** ✅ Funcionando corretamente

#### ✅ `Allow all access to requisitions`
- **Comando:** ALL
- **Condição:** `true`
- **Status:** ✅ Funcionando corretamente

### 14. **bd_ruas_requisicao** (1 política)

#### ✅ `Allow all access to requisition streets`
- **Comando:** ALL
- **Condição:** `true`
- **Status:** ✅ Funcionando corretamente

### 15. **bd_usinas** (1 política)

#### ✅ `Allow SuperAdmin access to usinas`
- **Comando:** ALL
- **Condição:** SuperAdm
- **Status:** ✅ Funcionando corretamente

## Análise de Problemas

### 🚨 PROBLEMA PRINCIPAL IDENTIFICADO

**Política Problemática:** `Team leaders can read horimeters for calculation` na tabela `bd_registro_apontamento_cam_equipa`

**Problema:** Esta política permite que qualquer usuário com função 'Apontador' ou 'Encarregado' veja TODOS os apontamentos de veículos do sistema, independentemente da equipe.

**Condição Atual:**
```sql
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND ('Apontador' = ANY(p.funcoes) OR 'Encarregado' = ANY(p.funcoes))
  )
)
```

**Problema:** Não verifica se o apontador/encarregado tem relação com a equipe do operador que fez o apontamento.

### ⚠️ PROBLEMAS SECUNDÁRIOS

1. **bd_equipes** - Políticas muito permissivas:
   - `Everyone can delete teams` - Qualquer usuário pode deletar equipes
   - `Everyone can insert teams` - Qualquer usuário pode criar equipes
   - `Everyone can update teams` - Qualquer usuário pode editar equipes

2. **Funcionários sem equipe_id:**
   - Existem funcionários ativos sem `equipe_id` definido
   - Isso pode causar problemas nas políticas que dependem da relação funcionário-equipe

## Recomendações

### 🎯 CORREÇÃO IMEDIATA NECESSÁRIA

**1. Corrigir política problemática (bd_registro_apontamento_cam_equipa):**

```sql
-- SUBSTITUIR a política "Team leaders can read horimeters for calculation"
DROP POLICY "Team leaders can read horimeters for calculation" ON bd_registro_apontamento_cam_equipa;

CREATE POLICY "Team leaders can read team horimeters only" 
ON bd_registro_apontamento_cam_equipa
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN bd_funcionarios f ON p.email = f.email
    JOIN bd_equipes e ON (e.apontador_id = f.id OR e.encarregado_id = f.id)
    JOIN bd_funcionarios operador ON operador.equipe_id = e.id
    WHERE p.id = auth.uid() 
    AND ('Apontador' = ANY(p.funcoes) OR 'Encarregado' = ANY(p.funcoes))
    AND operador.id = bd_registro_apontamento_cam_equipa.operador_id
  )
);
```

### 🔧 CORREÇÕES COMPLEMENTARES

**2. Identificar e corrigir funcionários sem equipe:**
```sql
-- Identificar funcionários sem equipe
SELECT nome_completo, email, status 
FROM bd_funcionarios 
WHERE equipe_id IS NULL AND status = 'Ativo';
```

**3. Restringir políticas de bd_equipes:**
```sql
-- Remover políticas muito permissivas e criar políticas restritivas
```

### 📋 PLANO DE IMPLEMENTAÇÃO SEGURA

**Fase 1: Backup Atual**
1. Documentar estado atual das políticas
2. Criar script de rollback

**Fase 2: Correção Cirúrgica**
1. Aplicar APENAS a correção da política problemática
2. Testar funcionalidade dos apontamentos de veículos
3. Verificar se apontadores/encarregados ainda conseguem acessar dados de suas equipes

**Fase 3: Validação**
1. Testar com diferentes tipos de usuários
2. Verificar se o problema de "ver todos os apontamentos" foi resolvido
3. Confirmar que funcionalidades existentes continuam funcionando

**Fase 4: Correções Complementares** (opcional)
1. Corrigir funcionários sem equipe
2. Ajustar políticas de bd_equipes se necessário

## Scripts de Backup e Rollback

### Backup das Políticas Atuais
```sql
-- Para criar backup manual das políticas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Script de Rollback
```sql
-- Para restaurar a política original se necessário
DROP POLICY IF EXISTS "Team leaders can read team horimeters only" ON bd_registro_apontamento_cam_equipa;

CREATE POLICY "Team leaders can read horimeters for calculation" 
ON bd_registro_apontamento_cam_equipa
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND ('Apontador' = ANY(p.funcoes) OR 'Encarregado' = ANY(p.funcoes))
  )
);
```

---

## Conclusão

O problema principal está claramente identificado na política `Team leaders can read horimeters for calculation` da tabela `bd_registro_apontamento_cam_equipa`. Uma correção cirúrgica desta política específica deve resolver o problema de visibilidade excessiva de apontamentos sem quebrar outras funcionalidades do sistema.

A abordagem recomendada é fazer apenas esta correção específica primeiro, testar completamente, e só então considerar outras melhorias se necessário.

**Data da Documentação:** 2025-07-10  
**Versão:** 1.0  
**Status:** Problema identificado - Aguardando correção cirúrgica
