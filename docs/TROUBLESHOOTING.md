
# Guia de Troubleshooting 🔧

## Problemas Comuns e Soluções

### 🔐 Autenticação e Login

#### Problema: "Não consigo fazer login"
**Sintomas:**
- Email e senha não funcionam
- Erro "Invalid login credentials"
- Tela fica carregando indefinidamente

**Soluções:**
1. **Verificar credenciais**:
   ```bash
   # Confirme se o email está correto
   # Teste com "esqueci minha senha"
   ```

2. **Verificar configuração do Supabase**:
   ```javascript
   // Verificar se as variáveis estão corretas
   console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
   console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY);
   ```

3. **Limpar cache do navegador**:
   ```bash
   # Chrome: Ctrl+Shift+R (força refresh)
   # Firefox: Ctrl+F5
   # Ou limpar localStorage manualmente
   localStorage.clear();
   ```

4. **Verificar Status do Supabase**:
   - Acesse [status.supabase.com](https://status.supabase.com)
   - Verifique se há interrupções no serviço

#### Problema: "Token expirado" ou "Unauthorized"
**Soluções:**
1. **Renovar sessão**:
   ```typescript
   const { data, error } = await supabase.auth.refreshSession();
   if (error) {
     // Redirecionar para login
     window.location.href = '/login';
   }
   ```

2. **Verificar configuração de token**:
   ```typescript
   // No Supabase Dashboard > Authentication > Settings
   // JWT expiry: 3600 (1 hora é o padrão)
   // Refresh token expiry: 604800 (7 dias)
   ```

#### Problema: "Email não confirmado"
**Soluções:**
1. **Reenviar email de confirmação**:
   ```typescript
   const { error } = await supabase.auth.resend({
     type: 'signup',
     email: 'user@example.com'
   });
   ```

2. **Desabilitar confirmação de email** (apenas desenvolvimento):
   ```sql
   -- No Supabase Dashboard > Authentication > Settings
   -- Enable email confirmations: OFF
   ```

### 🗄️ Banco de Dados

#### Problema: "Cannot read properties of null"
**Sintomas:**
- Erro ao carregar dados
- Componentes não renderizam
- Console mostra null/undefined

**Soluções:**
1. **Verificar RLS (Row Level Security)**:
   ```sql
   -- Verificar se as políticas RLS estão corretas
   SELECT schemaname, tablename, policyname, roles, cmd, qual 
   FROM pg_policies 
   WHERE tablename = 'sua_tabela';
   ```

2. **Adicionar verificações de null**:
   ```typescript
   // ❌ Problemático
   const name = user.profile.name;
   
   // ✅ Seguro
   const name = user?.profile?.name || 'Nome não informado';
   ```

3. **Usar optional chaining**:
   ```typescript
   const equipments = data?.equipments?.map(item => ({
     id: item.id,
     name: item.name || 'Sem nome'
   })) || [];
   ```

#### Problema: "Foreign key violation"
**Sintomas:**
- Erro ao salvar dados
- Violação de chave estrangeira
- "Key (campo_id)=(uuid) is not present in table"

**Soluções:**
1. **Verificar se o registro pai existe**:
   ```typescript
   // Antes de criar funcionário, verificar se empresa existe
   const { data: empresa } = await supabase
     .from('bd_empresas')
     .select('id')
     .eq('id', empresaId)
     .single();
   
   if (!empresa) {
     throw new Error('Empresa não encontrada');
   }
   ```

2. **Usar transações para inserções complexas**:
   ```typescript
   const { error } = await supabase.rpc('create_funcionario_with_validations', {
     funcionario_data: data,
     empresa_id: empresaId
   });
   ```

#### Problema: "Permission denied for table"
**Soluções:**
1. **Verificar políticas RLS**:
   ```sql
   -- Criar política para leitura
   CREATE POLICY "Users can view own company data" 
   ON bd_funcionarios FOR SELECT 
   USING (empresa_id IN (
     SELECT empresa_id 
     FROM profiles 
     WHERE id = auth.uid()
   ));
   ```

2. **Verificar se o usuário está autenticado**:
   ```typescript
   const { data: { user } } = await supabase.auth.getUser();
   if (!user) {
     throw new Error('Usuário não autenticado');
   }
   ```

### 📊 Interface e Componentes

#### Problema: "Formulário não salva"
**Sintomas:**
- Botão salvar não funciona
- Dados não são enviados
- Validações não passam

**Soluções:**
1. **Verificar validações**:
   ```typescript
   // Verificar se há erros de validação
   console.log('Form errors:', form.formState.errors);
   console.log('Form values:', form.getValues());
   console.log('Form valid:', form.formState.isValid);
   ```

2. **Verificar campos obrigatórios**:
   ```typescript
   const schema = z.object({
     nome: z.string().min(1, 'Nome é obrigatório'), // ✅
     email: z.string().email('Email inválido').optional(), // ✅
   });
   ```

3. **Verificar handler de submit**:
   ```typescript
   // ❌ Incorreto
   <form onSubmit={handleSubmit}>
   
   // ✅ Correto
   <form onSubmit={form.handleSubmit(onSubmit)}>
   ```

#### Problema: "Imagens não carregam"
**Sintomas:**
- Fotos não aparecem
- Erro 404 nas imagens
- Upload não funciona

**Soluções:**
1. **Verificar configuração do Storage**:
   ```sql
   -- Verificar bucket existence
   SELECT name, public FROM storage.buckets;
   ```

2. **Configurar políticas do Storage**:
   ```sql
   -- Política para upload
   CREATE POLICY "Users can upload images" 
   ON storage.objects FOR INSERT 
   WITH CHECK (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);
   
   -- Política para visualização
   CREATE POLICY "Images are publicly viewable" 
   ON storage.objects FOR SELECT 
   USING (bucket_id = 'images');
   ```

3. **Verificar formato e tamanho do arquivo**:
   ```typescript
   const validateFile = (file: File) => {
     const maxSize = 5 * 1024 * 1024; // 5MB
     const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
     
     if (file.size > maxSize) {
       throw new Error('Arquivo muito grande (máximo 5MB)');
     }
     
     if (!allowedTypes.includes(file.type)) {
       throw new Error('Formato não suportado');
     }
   };
   ```

#### Problema: "Dados não atualizam em tempo real"
**Soluções:**
1. **Invalidar queries após mutations**:
   ```typescript
   const createMutation = useMutation({
     mutationFn: createFuncionario,
     onSuccess: () => {
       // Invalidar cache para atualizar lista
       queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
     },
   });
   ```

2. **Usar Supabase Realtime**:
   ```typescript
   useEffect(() => {
     const channel = supabase
       .channel('funcionarios-changes')
       .on('postgres_changes', 
         { event: '*', schema: 'public', table: 'bd_funcionarios' },
         (payload) => {
           queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
         }
       )
       .subscribe();

     return () => {
       supabase.removeChannel(channel);
     };
   }, []);
   ```

### 🚛 Módulos Específicos

#### Problema: "Cálculo de espessura incorreto"
**Sintomas:**
- Espessura muito alta ou muito baixa
- Valores negativos
- NaN nos cálculos

**Soluções:**
1. **Verificar fórmula**:
   ```typescript
   // Fórmula correta: espessura = (massa / área) / densidade * 100
   const calculateEspessura = (massa: number, area: number, densidade = 2.4) => {
     if (area <= 0) return 0;
     return (massa / area) / densidade * 100;
   };
   ```

2. **Validar inputs**:
   ```typescript
   const validateInputs = (comprimento: number, largura: number, massa: number) => {
     if (comprimento <= 0) throw new Error('Comprimento deve ser maior que 0');
     if (largura <= 0) throw new Error('Largura deve ser maior que 0');
     if (massa <= 0) throw new Error('Massa deve ser maior que 0');
   };
   ```

3. **Adicionar limites de validação**:
   ```typescript
   const schema = z.object({
     comprimento: z.number().min(0.1).max(1000),
     largura: z.number().min(0.1).max(50),
     massa: z.number().min(0.001).max(50),
   }).refine((data) => {
     const area = data.comprimento * data.largura;
     const espessura = (data.massa / area) / 2.4 * 100;
     return espessura >= 3 && espessura <= 15;
   }, {
     message: 'Espessura deve estar entre 3cm e 15cm',
   });
   ```

#### Problema: "Massa remanescente negativa"
**Soluções:**
1. **Adicionar validação**:
   ```typescript
   const validateMassaAplicada = (massaAplicada: number, massaRemanescente: number) => {
     if (massaAplicada > massaRemanescente) {
       throw new Error(`Massa aplicada (${massaAplicada}t) excede massa remanescente (${massaRemanescente}t)`);
     }
   };
   ```

2. **Usar função do banco para cálculo**:
   ```sql
   CREATE OR REPLACE FUNCTION calcular_massa_remanescente(entrega_id UUID)
   RETURNS NUMERIC AS $$
   -- Implementação da função
   $$;
   ```

#### Problema: "Veículo não aparece na lista"
**Soluções:**
1. **Verificar status do veículo**:
   ```typescript
   const { data: veiculos } = await supabase
     .from('bd_caminhoes_equipamentos')
     .select('*')
     .eq('situacao', 'Disponível') // Filtrar apenas disponíveis
     .order('placa');
   ```

2. **Verificar conflitos de programação**:
   ```typescript
   const checkVeiculoDisponivel = async (veiculoId: string, dataEntrega: string) => {
     const { data: conflitos } = await supabase
       .from('bd_lista_programacao_entrega')
       .select('id')
       .eq('caminhao_id', veiculoId)
       .eq('data_entrega', dataEntrega)
       .neq('status', 'Cancelada');
     
     return conflitos?.length === 0;
   };
   ```

### 📱 Performance e Navegador

#### Problema: "Aplicação lenta"
**Sintomas:**
- Carregamento demorado
- Interface travando
- Scroll pesado

**Soluções:**
1. **Verificar queries desnecessárias**:
   ```typescript
   // ❌ Re-fetch desnecessário
   useEffect(() => {
     fetchData();
   }, [someState]); // someState muda frequentemente
   
   // ✅ Memoizar dependencies
   const memoizedDependency = useMemo(() => someState, [someState.id]);
   useEffect(() => {
     fetchData();
   }, [memoizedDependency]);
   ```

2. **Implementar paginação**:
   ```typescript
   const usePaginatedData = (pageSize = 20) => {
     const [page, setPage] = useState(1);
     
     const { data, isLoading } = useQuery({
       queryKey: ['data', page],
       queryFn: () => fetchData(page, pageSize),
     });
     
     return { data, isLoading, page, setPage };
   };
   ```

3. **Virtualizar listas grandes**:
   ```typescript
   import { FixedSizeList as List } from 'react-window';
   
   const VirtualizedList = ({ items }) => (
     <List
       height={600}
       itemCount={items.length}
       itemSize={50}
     >
       {({ index, style }) => (
         <div style={style}>
           {items[index].name}
         </div>
       )}
     </List>
   );
   ```

#### Problema: "Memory leak" ou "Componente continua executando após unmount"
**Soluções:**
1. **Limpar subscriptions**:
   ```typescript
   useEffect(() => {
     const subscription = supabase
       .channel('changes')
       .on('postgres_changes', handler)
       .subscribe();
     
     return () => {
       supabase.removeChannel(subscription); // ✅ Cleanup
     };
   }, []);
   ```

2. **Cancelar requests pendentes**:
   ```typescript
   useEffect(() => {
     const abortController = new AbortController();
     
     const fetchData = async () => {
       try {
         const response = await fetch('/api/data', {
           signal: abortController.signal
         });
         // Process response
       } catch (error) {
         if (error.name !== 'AbortError') {
           console.error(error);
         }
       }
     };
     
     fetchData();
     
     return () => {
       abortController.abort(); // ✅ Cancel request
     };
   }, []);
   ```

### 🔧 Desenvolvimento

#### Problema: "Hot reload não funciona"
**Soluções:**
1. **Verificar configuração do Vite**:
   ```typescript
   // vite.config.ts
   export default defineConfig({
     server: {
       host: true, // Permite acesso externo
       port: 5173,
       watch: {
         usePolling: true, // Para WSL/Docker
       }
     }
   });
   ```

2. **Verificar extensões do arquivo**:
   ```bash
   # Certificar que arquivos têm extensão correta
   Component.tsx # ✅ React component
   utils.ts      # ✅ TypeScript utility
   ```

#### Problema: "Erros de TypeScript"
**Soluções:**
1. **Verificar imports**:
   ```typescript
   // ❌ Import incorreto
   import { Component } from './Component';
   
   // ✅ Import correto
   import { Component } from './Component.tsx';
   // ou
   import Component from './Component';
   ```

2. **Adicionar types quando necessário**:
   ```typescript
   // Para libraries sem types
   declare module 'library-without-types' {
     export function someFunction(): void;
   }
   ```

#### Problema: "Build falha"
**Soluções:**
1. **Verificar variáveis de ambiente**:
   ```bash
   # .env.production
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-production-key
   ```

2. **Verificar imports dinâmicos**:
   ```typescript
   // ❌ Pode falhar no build
   const module = await import(`./modules/${moduleName}`);
   
   // ✅ Imports explícitos
   const modules = {
     'module1': () => import('./modules/Module1'),
     'module2': () => import('./modules/Module2'),
   };
   const module = await modules[moduleName]();
   ```

## Ferramentas de Debug

### Console do Navegador

#### Verificar Erros JavaScript
```javascript
// Abrir DevTools (F12)
// Aba Console
// Verificar erros vermelhos
console.error('Error details:', error);
```

#### Network Tab
```javascript
// Verificar requests falhas
// Status codes diferentes de 200-299
// Requests muito lentos (>2s)
// Headers incorretos
```

#### Application Tab
```javascript
// Verificar localStorage
localStorage.getItem('supabase.auth.token');

// Verificar sessionStorage
sessionStorage.getItem('app-state');

// Verificar cookies
document.cookie;
```

### Supabase Dashboard

#### Logs de Autenticação
```bash
# Dashboard > Authentication > Users
# Verificar último login
# Verificar email confirmado
# Verificar metadata do usuário
```

#### SQL Editor
```sql
-- Testar queries diretamente
SELECT * FROM bd_funcionarios LIMIT 5;

-- Verificar contadores
SELECT COUNT(*) FROM bd_registro_aplicacao WHERE status = 'Ativa';

-- Verificar relacionamentos
SELECT f.nome_completo, e.nome_empresa 
FROM bd_funcionarios f 
LEFT JOIN bd_empresas e ON f.empresa_id = e.id;
```

#### Logs de API
```bash
# Dashboard > Settings > API
# Verificar logs de requests
# Identificar patterns de erro
# Verificar rate limiting
```

### React Developer Tools

#### Component Tree
```javascript
// Instalar extensão React Developer Tools
// Verificar props passadas
// Verificar state interno
// Identificar re-renders desnecessários
```

#### Profiler
```javascript
// Usar Profiler tab
// Identificar componentes lentos
// Verificar flame graphs
// Otimizar componentes pesados
```

## Scripts de Diagnóstico

### Verificação de Saúde do Sistema

```typescript
// src/utils/healthCheck.ts
export const healthCheck = async () => {
  const checks = {
    supabase: false,
    auth: false,
    database: false,
    storage: false,
  };
  
  try {
    // Verificar conexão Supabase
    const { error: connectionError } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });
    
    checks.supabase = !connectionError;
    
    // Verificar autenticação
    const { data: { session } } = await supabase.auth.getSession();
    checks.auth = !!session;
    
    // Verificar database
    const { error: dbError } = await supabase
      .from('bd_empresas')
      .select('id')
      .limit(1);
    
    checks.database = !dbError;
    
    // Verificar storage
    const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
    checks.storage = !storageError && buckets.length > 0;
    
  } catch (error) {
    console.error('Health check failed:', error);
  }
  
  return checks;
};

// Uso
const runHealthCheck = async () => {
  const health = await healthCheck();
  console.log('System Health:', health);
  
  Object.entries(health).forEach(([service, status]) => {
    console.log(`${service}: ${status ? '✅' : '❌'}`);
  });
};
```

### Verificação de Performance

```typescript
// src/utils/performanceCheck.ts
export const performanceCheck = () => {
  // Timing de carregamento
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  
  const metrics = {
    loadTime: navigation.loadEventEnd - navigation.loadEventStart,
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
    ttfb: navigation.responseStart - navigation.requestStart, // Time to First Byte
    networkTime: navigation.responseEnd - navigation.requestStart,
  };
  
  console.log('Performance Metrics:', metrics);
  
  // Alertas para métricas ruins
  if (metrics.loadTime > 3000) {
    console.warn('⚠️ Load time muito alto:', metrics.loadTime + 'ms');
  }
  
  if (metrics.ttfb > 500) {
    console.warn('⚠️ TTFB muito alto:', metrics.ttfb + 'ms');
  }
  
  return metrics;
};
```

## FAQ - Perguntas Frequentes

### "Por que meus dados não aparecem?"
1. Verificar se há políticas RLS bloqueando
2. Verificar se o usuário está autenticado
3. Verificar se há dados na tabela
4. Verificar filtros aplicados

### "Como resetar o sistema?"
```typescript
// Limpar cache do React Query
queryClient.clear();

// Limpar localStorage
localStorage.clear();

// Fazer logout
await supabase.auth.signOut();

// Recarregar página
window.location.reload();
```

### "Como reportar um bug?"
1. **Reproduzir o problema** consistentemente
2. **Coletar informações**:
   - URL onde ocorreu
   - Ações que levaram ao erro
   - Mensagem de erro exata
   - Screenshots/videos
   - Console logs (F12 → Console)
3. **Informações do ambiente**:
   - Navegador e versão
   - Sistema operacional
   - Tamanho da tela
4. **Enviar para suporte** com todas as informações

### "Como fazer backup dos dados?"
```typescript
// Exportar dados importantes
const exportData = async () => {
  const { data: funcionarios } = await supabase
    .from('bd_funcionarios')
    .select('*');
  
  const { data: veiculos } = await supabase
    .from('bd_caminhoes_equipamentos')
    .select('*');
  
  const backup = {
    timestamp: new Date().toISOString(),
    funcionarios,
    veiculos,
  };
  
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json'
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-${Date.now()}.json`;
  a.click();
};
```

## Contato para Suporte

### Informações para Incluir
Ao entrar em contato com o suporte, sempre inclua:

1. **URL completa** onde o problema ocorre
2. **Usuário logado** (email)
3. **Navegador e versão** (Chrome 120, Firefox 115, etc.)
4. **Sistema operacional** (Windows 11, macOS 14, Ubuntu 22.04)
5. **Passos detalhados** para reproduzir o problema
6. **Screenshots** ou vídeos do problema
7. **Console logs** (F12 → Console → screenshot dos erros)
8. **Horário aproximado** quando o problema ocorreu

### Template para Reportar Problemas

```
**Descrição do Problema:**
[Descreva o que está acontecendo]

**Passos para Reproduzir:**
1. Vá para...
2. Clique em...
3. Preencha...
4. Observe que...

**Comportamento Esperado:**
[O que deveria acontecer]

**Comportamento Atual:**
[O que realmente acontece]

**Ambiente:**
- URL: https://sistema.exemplo.com
- Usuário: usuario@empresa.com
- Navegador: Chrome 120.0.6099.71
- SO: Windows 11
- Timestamp: 2024-01-15 14:30:00

**Screenshots/Logs:**
[Anexar imagens e logs do console]
```

---

**Este guia de troubleshooting será atualizado constantemente com novos problemas e soluções identificados.**
