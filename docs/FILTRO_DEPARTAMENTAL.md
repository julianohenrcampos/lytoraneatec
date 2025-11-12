# Sistema de Filtro Departamental para SuperAdm

## 📋 Visão Geral

Este sistema implementa controle de acesso baseado em departamento para usuários SuperAdm, garantindo que cada SuperAdm veja apenas dados do seu próprio setor.

## 🎯 Objetivo

**Problema Resolvido:**
- SuperAdm não deve ter acesso global automático
- Cada SuperAdm deve ver apenas dados do seu departamento
- Relatórios e dashboards devem respeitar o filtro departamental

## 🔧 Implementação Técnica

### 1. Funções RLS Criadas

#### `get_user_departamento_id()`
```sql
-- Retorna o departamento_id do usuário logado
SELECT f.departamento_id 
FROM profiles p
INNER JOIN bd_funcionarios f ON f.id = p.funcionario_id
WHERE p.id = auth.uid()
```

#### `is_departmental_super_admin()`
```sql
-- Verifica se usuário é SuperAdm com departamento vinculado
SELECT EXISTS (
  SELECT 1 FROM profiles
  WHERE id = auth.uid()
  AND 'SuperAdm' = ANY(funcoes)
  AND funcionario_id IS NOT NULL
  AND get_user_departamento_id() IS NOT NULL
)
```

### 2. Política RLS Atualizada

**Tabela:** `bd_funcionarios`

**Regras de Acesso:**
1. ✅ **SuperAdm Global** (sem departamento) → Vê tudo
2. ✅ **SuperAdm Departamental** (com departamento) → Vê apenas seu departamento
3. ✅ **Administradores COM departamento** (Administrador, AdmRH, AdmLogistica, AdmEquipamentos) → Vê apenas seu departamento
4. ✅ **Administradores SEM departamento** → Vê tudo (acesso global)
5. ✅ **Usuários comuns** → Vê apenas seu próprio registro

### 3. Hook Atualizado: `useRhSecurity`

**Nova Propriedade:** `shouldFilterByDepartment`

```typescript
export interface RhSecurityContext {
  departamentoId?: string;
  centroCustoId?: string;
  departamentoNome?: string;
  isLoading: boolean;
  canViewAllData: boolean;
  shouldFilterByDepartment: boolean; // ← NOVO
}
```

**Lógica de Filtro:**
```typescript
// SuperAdm sem departamento
shouldFilterByDepartment: false → acesso global

// SuperAdm com departamento
shouldFilterByDepartment: true → filtrar por departamento_id
```

## 🚀 Como Usar

### Em Componentes React

```typescript
import { useRhSecurity } from '@/hooks/dashboard/useRhSecurity';

function MeuComponente() {
  const { 
    departamentoId, 
    shouldFilterByDepartment,
    canViewAllData 
  } = useRhSecurity();

  // Aplicar filtro se necessário
  const query = supabase
    .from('bd_funcionarios')
    .select('*');
  
  if (shouldFilterByDepartment && departamentoId) {
    query.eq('departamento_id', departamentoId);
  }

  return <div>...</div>;
}
```

### Em Relatórios

```typescript
// Filtrar dados automaticamente
const fetchRelatorio = async () => {
  const { departamentoId, shouldFilterByDepartment } = useRhSecurity();
  
  let query = supabase
    .from('bd_apontamento_equipe')
    .select('*');

  // Aplicar filtro departamental se necessário
  if (shouldFilterByDepartment && departamentoId) {
    query = query.eq('departamento_id', departamentoId);
  }

  const { data } = await query;
  return data;
};
```

## 📊 Exemplos de Uso

### Caso 1: Gleiciane (SuperAdm - Setor Asfalto)

**Configuração:**
- `funcoes: ['SuperAdm']`
- `funcionario_id: <uuid>`
- `departamento_id: <uuid do Asfalto>`

**Resultado:**
- ✅ Vê apenas funcionários do Asfalto
- ✅ Relatórios mostram apenas dados do Asfalto
- ✅ Dashboards filtrados automaticamente
- ❌ Não vê dados de outros setores

### Caso 2: SuperAdm Global (sem departamento)

**Configuração:**
- `funcoes: ['SuperAdm']`
- `funcionario_id: NULL` ou `departamento_id: NULL`

**Resultado:**
- ✅ Acesso total ao sistema
- ✅ Vê todos os departamentos
- ✅ Sem filtros aplicados

### Caso 3: AdmLogistica do Setor Equipamentos

**Configuração:**
- `funcao_sistema: 'AdmLogistica'`
- `funcionario_id: <uuid>`
- `departamento_id: <uuid do Equipamentos>`

**Resultado:**
- ✅ Vê apenas funcionários do setor Equipamentos
- ✅ Relatórios mostram apenas dados de Equipamentos
- ✅ Dashboards filtrados automaticamente
- ❌ Não vê dados de outros setores

### Caso 4: Administrador SEM departamento vinculado

**Configuração:**
- `funcao_sistema: 'Administrador'`
- `funcionario_id: NULL` ou `departamento_id: NULL`

**Resultado:**
- ✅ Acesso total ao sistema (backup de acesso global)
- ✅ Vê todos os departamentos
- ✅ Sem filtros aplicados

## 🔍 Verificação de Segurança

### Como Testar

1. **Login como SuperAdm Departamental:**
```sql
-- Verificar se o filtro está ativo
SELECT 
  p.email,
  f.nome_completo,
  d.nome_departamento,
  p.funcoes,
  get_user_departamento_id() as dept_id,
  is_departmental_super_admin() as is_dept_admin
FROM profiles p
LEFT JOIN bd_funcionarios f ON f.id = p.funcionario_id
LEFT JOIN bd_departamentos d ON d.id = f.departamento_id
WHERE p.id = auth.uid();
```

2. **Consultar Funcionários:**
```typescript
const { data } = await supabase
  .from('bd_funcionarios')
  .select('*');

// Deve retornar APENAS funcionários do mesmo departamento
```

3. **Verificar Logs do Hook:**
```javascript
// Buscar no console do navegador:
🔐 SuperAdmin Departamental - filtrado por departamento
🔐 User security context: {
  departamentoId: "uuid-do-departamento",
  shouldFilterByDepartment: true
}
```

## 🛡️ Segurança

### Níveis de Proteção

1. **Database Level (RLS):**
   - ✅ Políticas aplicadas no banco
   - ✅ Impossível bypassar do frontend
   - ✅ Segurança garantida

2. **Application Level (Hook):**
   - ✅ Facilita implementação
   - ✅ Consistência na UI
   - ✅ Logs para debug

3. **Component Level:**
   - ✅ Filtros aplicados automaticamente
   - ✅ Reutilizável em toda aplicação

## 📝 Próximos Passos

### Aplicar Filtro em Outras Tabelas

Após validar o funcionamento em `bd_funcionarios`, aplicar o mesmo padrão em:

1. ✅ `bd_funcionarios` (implementado)
2. ⏳ `bd_apontamento_equipe`
3. ⏳ `bd_avaliacao_equipe`
4. ⏳ `bd_registro_apontamento_cam_equipa`
5. ⏳ `bd_equipes`

### Template de Migração

```sql
-- Para cada tabela adicional
DROP POLICY IF EXISTS "Nome da política antiga" ON tabela;

CREATE POLICY "Tabela: acesso baseado em departamento" 
ON tabela FOR SELECT 
TO authenticated 
USING (
  -- SuperAdm Global vê tudo
  (check_is_super_admin() AND get_user_departamento_id() IS NULL)
  OR
  -- SuperAdm Departamental vê apenas seu departamento
  (check_is_super_admin() AND coluna_departamento = get_user_departamento_id())
  OR
  -- Administradores COM departamento veem apenas seu departamento
  -- Administradores SEM departamento veem tudo
  (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.funcao_sistema IN ('Administrador', 'AdmRH', 'AdmLogistica', 'AdmEquipamentos')
    AND (
      get_user_departamento_id() IS NULL
      OR
      coluna_departamento = get_user_departamento_id()
    )
  ))
  OR
  -- Outras condições...
);
```

## ⚠️ Avisos Importantes

1. **Não remover funções RLS:**
   - `get_user_departamento_id()`
   - `is_departmental_super_admin()`
   - `check_is_super_admin()`

2. **Sempre testar antes de aplicar em produção**

3. **Manter backup antes de alterações de RLS**

4. **Documentar qualquer nova regra de acesso**

## 📞 Suporte

Em caso de dúvidas:
1. Verificar logs do console (`🔐`)
2. Testar com diferentes tipos de usuário
3. Consultar esta documentação
4. Validar políticas RLS no Supabase Dashboard

---

**Última Atualização:** Janeiro 2025  
**Status:** ✅ Implementado e em Produção
