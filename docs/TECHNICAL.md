
# Documentação Técnica - Sistema de Gestão Integrada 🔧

## Índice

1. [Arquitetura Geral](#arquitetura-geral)
2. [**Arquitetura Offline e Sincronização**](#arquitetura-offline-e-sincronização) 🔄 **NOVO**
3. [Tecnologias Utilizadas](#tecnologias-utilizadas)
4. [Estrutura do Projeto](#estrutura-do-projeto)
5. [Padrões de Desenvolvimento](#padrões-de-desenvolvimento)
6. [Sistema de Autenticação](#sistema-de-autenticação)
7. [Gestão de Estado](#gestão-de-estado)
8. [API e Banco de Dados](#api-e-banco-de-dados)
9. [Componentes UI](#componentes-ui)
10. [Performance e Otimizações](#performance-e-otimizações)
11. [Segurança](#segurança)
12. [Monitoramento](#monitoramento)

## Arquitetura Geral

### Visão Geral
O sistema é uma **Single Page Application (SPA)** construída com React, TypeScript e Vite, conectada ao Supabase como backend. A partir da versão 3.0, inclui **capacidade offline completa** com sincronização automática.

### Stack Principal
```
Frontend:  React 18 + TypeScript + Vite + Tailwind CSS
Backend:   Supabase (PostgreSQL + Auth + Storage + Realtime)
UI:        Shadcn/UI + Radix UI + Lucide Icons
State:     TanStack Query + React Hook Form + Zustand
Offline:   localStorage + Service Worker + Background Sync ⭐ NOVO
```

### Fluxo de Dados
```
User Input → React Hook Form → Validation → 
→ Connection Check → [Online: Supabase | Offline: localStorage] →
→ TanStack Query Cache → UI Update → Background Sync (if offline)
```

## Arquitetura Offline e Sincronização 🔄

### Visão Geral da Arquitetura Offline
O sistema implementa uma **arquitetura híbrida online/offline** que permite operação contínua independente da conectividade, com sincronização automática e transparente para o usuário.

### Componentes Principais

#### 1. **Connection Status Manager**
```typescript
// src/hooks/useConnectionStatus.ts
interface ConnectionStatus {
  isOnline: boolean;           // Status do navegador
  isSupabaseConnected: boolean; // Conexão real com Supabase
  lastCheck: Date;             // Última verificação
}

// Arquitetura:
Navigator.onLine → Basic Check → Supabase Ping → Real Status
```

#### 2. **Offline Storage Layer**
```typescript
// src/utils/salvarOffline.ts
LocalStorage Schema:
{
  "offline_apontamento_equipe": [
    {
      id: "temp_uuid",           // ID temporário único
      timestamp: "ISO_DATE",     // Momento da criação
      data: { /* form data */ }, // Dados do formulário
      tentativas: 0,             // Contador de tentativas
      erro: null,                // Último erro
      usuario_id: "uuid"         // Usuário criador
    }
  ]
}
```

#### 3. **Synchronization Engine**
```typescript
// src/hooks/useOfflineSync.ts
Sync Flow:
[Connection Detected] → [Enumerate Pending] → [Process Each Type] →
→ [Validate Data] → [Send to Supabase] → [Handle Response] →
→ [Update Status] → [Clean Cache] → [Notify User]
```

### Padrões de Implementação

#### Hook Pattern para Módulos Offline
```typescript
// Padrão para hooks offline (ex: useApontamentoEquipeOffline)
export const useModuleOffline = () => {
  const { isSupabaseConnected } = useConnectionStatus();
  const { toast } = useToast();
  const { userId } = useAuth();

  const submitData = async (formData, onSuccess) => {
    if (isSupabaseConnected) {
      // Online: Direct to Supabase
      await createService(formData);
      toast({ title: "Registrado", variant: "default" });
    } else {
      // Offline: Save to localStorage
      salvarApontamentoOffline(type, formData, userId);
      toast({ title: "Salvo offline", variant: "default" });
    }
    onSuccess?.();
  };

  return { submitData, isOffline: !isSupabaseConnected };
};
```

#### Component Pattern para Forms Offline
```typescript
// Padrão para componentes com suporte offline
const OfflineAwareForm = () => {
  const { isSupabaseConnected } = useConnectionStatus();
  const { submitData, isOffline } = useModuleOffline();

  return (
    <Dialog>
      <DialogTitle className="flex items-center gap-2">
        Formulário
        {isOffline && <WifiOff className="h-4 w-4 text-orange-600" />}
        {isSupabaseConnected && <Wifi className="h-4 w-4 text-green-600" />}
      </DialogTitle>
      
      {isOffline && (
        <Alert>
          <AlertTitle>Modo Offline</AlertTitle>
          <AlertDescription>
            Dados serão sincronizados automaticamente
          </AlertDescription>
        </Alert>
      )}
      
      <Button type="submit">
        Salvar {isOffline && "(Offline)"}
      </Button>
    </Dialog>
  );
};
```

### Sincronização - Algoritmos e Estratégias

#### 1. **Connection Detection Algorithm**
```typescript
// Verificação em camadas para máxima confiabilidade
const checkConnection = async () => {
  // Layer 1: Browser API (instant)
  const browserOnline = navigator.onLine;
  
  if (!browserOnline) return { isOnline: false, isSupabaseConnected: false };
  
  // Layer 2: Supabase Connectivity (real check)
  try {
    const { error } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });
    
    return {
      isOnline: true,
      isSupabaseConnected: !error
    };
  } catch {
    return { isOnline: true, isSupabaseConnected: false };
  }
};
```

#### 2. **Retry Strategy**
```typescript
// Estratégia de tentativas com backoff exponencial
const syncWithRetry = async (data, maxTentativas = 3) => {
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      await sendToSupabase(data);
      return { success: true };
    } catch (error) {
      if (tentativa === maxTentativas) {
        return { success: false, error: error.message };
      }
      
      // Backoff: 1s, 2s, 4s
      const delay = Math.pow(2, tentativa - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};
```

#### 3. **Conflict Resolution**
```typescript
// Prevenção de conflitos com IDs únicos temporários
const generateTempId = () => `temp_${uuidv4()}_${Date.now()}`;

// Validação antes da inserção
const validateBeforeInsert = (data) => {
  // Remove campos que podem conflitar
  const { id, created_at, updated_at, ...cleanData } = data;
  
  return {
    ...cleanData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
};
```

### Data Flow Architecture

#### 1. **Online Mode Flow**
```
User Input → Form Validation → Direct Supabase Call →
→ Success/Error Response → TanStack Query Invalidation →
→ UI Update → User Feedback (Toast)
```

#### 2. **Offline Mode Flow**
```
User Input → Form Validation → localStorage Write →
→ Success Response → UI Update → User Feedback (Toast "Offline") →
→ Background: Add to Sync Queue
```

#### 3. **Synchronization Flow**
```
Connection Detected → Enumerate localStorage → For Each Pending Item:
→ Validate Data → Transform for API → Send to Supabase →
→ Handle Response → [Success: Remove from localStorage | Error: Increment Attempts] →
→ Update UI Counters → User Notification
```

### Storage Architecture

#### 1. **localStorage Schema Design**
```typescript
// Estrutura padronizada para todos os tipos
interface DadosOffline {
  id: string;           // temp_uuid_timestamp
  timestamp: string;    // ISO date de criação
  data: any;           // Dados do formulário original
  tentativas: number;   // 0-3 tentativas de sync
  erro?: string;       // Último erro encontrado
  usuario_id?: string; // ID do usuário para auditoria
}

// Mapeamento de tipos para configurações
const TIPOS_APONTAMENTO = {
  apontamento_equipe: {
    tabela: 'bd_apontamento_equipe',
    chaveLocalStorage: 'offline_apontamento_equipe',
    nomeExibicao: 'Apontamento de Equipe'
  },
  // ... outros tipos
};
```

#### 2. **Cache Management Strategy**
```typescript
// Limpeza automática após sincronização
const cleanupAfterSync = (tipo: TipoApontamento, successIds: string[]) => {
  const existing = obterDadosOffline(tipo);
  const remaining = existing.filter(item => !successIds.includes(item.id));
  
  if (remaining.length === 0) {
    localStorage.removeItem(TIPOS_APONTAMENTO[tipo].chaveLocalStorage);
  } else {
    localStorage.setItem(
      TIPOS_APONTAMENTO[tipo].chaveLocalStorage,
      JSON.stringify(remaining)
    );
  }
};

// Limite de tamanho e limpeza preventiva
const preventOverflow = () => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  let currentSize = 0;
  
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('offline_')) {
      currentSize += localStorage.getItem(key).length;
    }
  });
  
  if (currentSize > maxSize) {
    // Limpar dados mais antigos primeiro
    cleanupOldestEntries();
  }
};
```

### Error Handling & Recovery

#### 1. **Error Classification**
```typescript
enum SyncErrorType {
  NETWORK_ERROR = 'network',      // Problema de conectividade
  AUTH_ERROR = 'auth',           // Token expirado/permissão
  VALIDATION_ERROR = 'validation', // Dados inválidos
  SERVER_ERROR = 'server',       // Erro interno do Supabase
  QUOTA_ERROR = 'quota'          // Limite de localStorage
}

const classifyError = (error: any): SyncErrorType => {
  if (error.message.includes('Permission denied')) return SyncErrorType.AUTH_ERROR;
  if (error.message.includes('Network')) return SyncErrorType.NETWORK_ERROR;
  if (error.message.includes('Quota')) return SyncErrorType.QUOTA_ERROR;
  // ... outras classificações
};
```

#### 2. **Recovery Strategies**
```typescript
const recoveryStrategies = {
  [SyncErrorType.AUTH_ERROR]: async () => {
    // Renovar token de autenticação
    await supabase.auth.refreshSession();
    return true; // Pode tentar novamente
  },
  
  [SyncErrorType.NETWORK_ERROR]: async () => {
    // Aguardar reconexão
    return false; // Não tentar agora
  },
  
  [SyncErrorType.VALIDATION_ERROR]: async (data) => {
    // Tentar corrigir dados automaticamente
    const correctedData = autoCorrectData(data);
    return !!correctedData;
  },
  
  [SyncErrorType.QUOTA_ERROR]: async () => {
    // Forçar limpeza de cache
    await forceCleanupCache();
    return true;
  }
};
```

### Performance Optimizations

#### 1. **Batching Strategy**
```typescript
// Processar em lotes para melhor performance
const batchSyncData = async (items: DadosOffline[], batchSize = 10) => {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  
  for (const batch of batches) {
    await Promise.allSettled(
      batch.map(item => syncSingleItem(item))
    );
    
    // Pequena pausa entre lotes
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};
```

#### 2. **Debounced Connection Checking**
```typescript
import { debounce } from 'lodash';

// Evitar verificações excessivas de conectividade
const debouncedConnectionCheck = debounce(
  checkConnection,
  1000, // 1 segundo
  { leading: true, trailing: true }
);
```

#### 3. **Memoized UI Components**
```typescript
// Evitar re-renders desnecessários do indicador de status
const OfflineStatusIndicator = React.memo(() => {
  const { isOnline, isSupabaseConnected } = useConnectionStatus();
  const { syncStatus } = useOfflineSync();
  
  // Só renderizar se há algo importante para mostrar
  if (isOnline && isSupabaseConnected && syncStatus.pendingCount === 0) {
    return null;
  }
  
  return <StatusCard />;
});
```

### Monitoring & Analytics

#### 1. **Sync Metrics Collection**
```typescript
interface SyncMetrics {
  totalAttempts: number;
  successfulSyncs: number;
  failedSyncs: number;
  averageSyncTime: number;
  errorsByType: Record<SyncErrorType, number>;
  largestBatchSize: number;
  oldestPendingItem: Date;
}

const collectSyncMetrics = () => {
  // Coletar métricas para análise e otimização
  const metrics = calculateMetrics();
  console.log('Sync Metrics:', metrics);
  
  // Enviar para analytics (quando online)
  if (isSupabaseConnected) {
    sendMetricsToAnalytics(metrics);
  }
};
```

#### 2. **User Behavior Analytics**
```typescript
// Rastrear padrões de uso offline
const trackOfflineUsage = {
  sessionStartOffline: () => track('offline_session_start'),
  formSubmittedOffline: (type: string) => track('offline_form_submit', { type }),
  syncCompleted: (itemCount: number) => track('sync_completed', { itemCount }),
  syncFailed: (errorType: string) => track('sync_failed', { errorType }),
};
```

### Security Considerations

#### 1. **Data Sanitization**
```typescript
// Sanitizar dados antes de armazenar offline
const sanitizeForOfflineStorage = (data: any) => {
  const sensitiveFields = ['password', 'token', 'secret'];
  const cleaned = { ...data };
  
  sensitiveFields.forEach(field => {
    if (cleaned[field]) {
      delete cleaned[field];
    }
  });
  
  return cleaned;
};
```

#### 2. **Encryption (Future Enhancement)**
```typescript
// Placeholder para criptografia futura
const encryptOfflineData = (data: string): string => {
  // TODO: Implementar criptografia AES para dados sensíveis
  return data; // Por enquanto, sem criptografia
};
```

### Testing Strategy

#### 1. **Connection Simulation**
```typescript
// Utilities para testes de conectividade
export const mockOfflineMode = () => {
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: false
  });
  
  // Mock Supabase calls to fail
  jest.spyOn(supabase, 'from').mockImplementation(() => {
    throw new Error('Network error');
  });
};

export const mockOnlineMode = () => {
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: true
  });
  
  // Restore Supabase functionality
  jest.restoreAllMocks();
};
```

#### 2. **Offline Data Testing**
```typescript
describe('Offline Functionality', () => {
  beforeEach(() => {
    localStorage.clear();
    mockOfflineMode();
  });

  test('should save data offline when no connection', async () => {
    const formData = { nome: 'Test', equipe_id: 'uuid' };
    
    await submitApontamento(formData);
    
    const offlineData = localStorage.getItem('offline_apontamento_equipe');
    expect(JSON.parse(offlineData)).toHaveLength(1);
  });

  test('should sync data when connection restored', async () => {
    // Setup offline data
    const offlineData = [{ id: 'temp_1', data: { nome: 'Test' } }];
    localStorage.setItem('offline_apontamento_equipe', JSON.stringify(offlineData));
    
    // Restore connection
    mockOnlineMode();
    
    // Trigger sync
    await sincronizarTodos();
    
    // Verify data was sent and cleaned
    expect(mockSupabaseInsert).toHaveBeenCalled();
    expect(localStorage.getItem('offline_apontamento_equipe')).toBeNull();
  });
});
```

## Tecnologias Utilizadas

### Frontend Core
- **React 18**: Framework principal com Concurrent Features
- **TypeScript**: Tipagem estática e developer experience
- **Vite**: Build tool e dev server
- **React Router DOM**: Roteamento client-side

### UI & Styling
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/UI**: Componentes pré-construídos
- **Radix UI**: Primitivos acessíveis
- **Lucide React**: Ícones SVG

### Estado e Dados
- **TanStack Query**: Cache e sincronização de dados server-side
- **React Hook Form**: Gerenciamento de formulários
- **Zod**: Validação de schemas
- **Zustand**: Estado global leve (para UI state)

### Backend & Database
- **Supabase**: Backend-as-a-Service
  - PostgreSQL database
  - Authentication & Authorization
  - Real-time subscriptions
  - File storage
  - Row Level Security (RLS)

### Utilities
- **Date-fns**: Manipulação de datas
- **React Perfect Scrollbar**: Scrollbars customizadas
- **Recharts**: Gráficos e visualizações
- **XLSX**: Exportação Excel
- **jsPDF**: Geração de PDFs

## Estrutura do Projeto

```
src/
├── components/          # Componentes reutilizáveis
│   ├── ui/             # Componentes base (shadcn/ui)
│   ├── layout/         # Layout components
│   ├── offline/        # Componentes offline ⭐ NOVO
│   └── [modules]/      # Componentes específicos por módulo
├── hooks/              # Custom hooks
│   ├── offline/        # Hooks offline ⭐ NOVO
│   └── [domain]/       # Hooks agrupados por domínio
├── pages/              # Páginas da aplicação
├── services/           # Serviços de API
├── utils/              # Utilitários
│   ├── salvarOffline.ts ⭐ NOVO
│   └── [other-utils]
├── types/              # Definições TypeScript
├── contexts/           # React Contexts
└── integrations/       # Configurações de terceiros
    └── supabase/       # Cliente e tipos Supabase
```

### Componentes Offline ⭐ NOVO
```
src/components/offline/
├── OfflineStatusIndicator.tsx    # Indicador visual principal
├── ConnectionMonitor.tsx         # Monitor de conectividade
└── SyncProgressModal.tsx        # Modal de progresso de sync
```

### Hooks Offline ⭐ NOVO
```
src/hooks/
├── useConnectionStatus.ts        # Status de conectividade
├── useOfflineSync.ts            # Engine de sincronização
├── useApontamentoEquipeOffline.ts
├── useApontamentoCaminhoesOffline.ts
├── useRegistroAplicacaoOffline.ts
└── [outros-modulos]Offline.ts
```

## Padrões de Desenvolvimento

### Organização de Componentes
```typescript
// Estrutura padrão de componente
interface ComponentProps {
  // Props tipadas
}

const Component: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  // 1. Hooks de estado
  // 2. Hooks de data fetching
  // 3. Hooks customizados
  // 4. Event handlers
  // 5. Derived state/computed values
  // 6. Effects
  
  return (
    // JSX
  );
};

export default Component;
```

### Custom Hooks Pattern
```typescript
// Hook para operações CRUD
export const useEntityOperations = () => {
  const queryClient = useQueryClient();
  
  const createMutation = useMutation({
    mutationFn: createEntity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
    },
  });
  
  return {
    create: createMutation.mutate,
    isCreating: createMutation.isPending,
    // ... outras operações
  };
};
```

### Service Layer Pattern
```typescript
// Serviços de API centralizados
export const entityService = {
  async getAll(filters?: EntityFilters): Promise<Entity[]> {
    const { data, error } = await supabase
      .from('entities')
      .select('*')
      .match(filters || {});
    
    if (error) throw error;
    return data;
  },
  
  async create(entity: CreateEntityData): Promise<Entity> {
    const { data, error } = await supabase
      .from('entities')
      .insert(entity)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // ... outras operações
};
```

## Sistema de Autenticação

### Configuração Supabase Auth
```typescript
// Cliente Supabase configurado
export const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

// Hook de autenticação
export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );
    
    return () => subscription.unsubscribe();
  }, []);
  
  return {
    session,
    user: session?.user || null,
    isAuthenticated: !!session,
  };
};
```

### Proteção de Rotas
```typescript
// HOC para proteção de rotas
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <LoadingSpinner />;
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};
```

### Row Level Security (RLS)
```sql
-- Exemplo de política RLS
CREATE POLICY "Users can view own company data" 
ON funcionarios 
FOR SELECT 
USING (
  empresa_id IN (
    SELECT empresa_id 
    FROM profiles 
    WHERE id = auth.uid()
  )
);
```

## Gestão de Estado

### TanStack Query para Server State
```typescript
// Configuração do Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive",
        });
      },
    },
  },
});

// Hook de query tipado
export const useFuncionarios = (filters?: FuncionarioFilters) => {
  return useQuery({
    queryKey: ['funcionarios', filters],
    queryFn: () => funcionarioService.getAll(filters),
    enabled: !!filters, // Só executa se filtros estão definidos
  });
};
```

### React Hook Form para Form State
```typescript
// Schema de validação com Zod
const funcionarioSchema = z.object({
  nome_completo: z.string().min(1, "Nome é obrigatório"),
  cpf: z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos"),
  email: z.string().email("Email inválido").optional(),
});

type FuncionarioFormValues = z.infer<typeof funcionarioSchema>;

// Uso no componente
const FuncionarioForm = () => {
  const form = useForm<FuncionarioFormValues>({
    resolver: zodResolver(funcionarioSchema),
    defaultValues: {
      nome_completo: "",
      cpf: "",
      email: "",
    },
  });
  
  const onSubmit = (data: FuncionarioFormValues) => {
    // Submit logic
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Form fields */}
      </form>
    </Form>
  );
};
```

### Zustand para UI State
```typescript
// Store para estado da UI
interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: 'light',
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setTheme: (theme) => set({ theme }),
}));
```

## API e Banco de Dados

### Database Schema
```sql
-- Estrutura base das tabelas
CREATE TABLE bd_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_empresa VARCHAR NOT NULL,
  cnpj VARCHAR UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bd_funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES bd_empresas(id),
  nome_completo VARCHAR NOT NULL,
  cpf VARCHAR UNIQUE,
  email VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS habilitado
ALTER TABLE bd_funcionarios ENABLE ROW LEVEL SECURITY;
```

### Query Patterns
```typescript
// Pattern para queries complexas
export const getFuncionariosWithDetails = async (filters: any) => {
  const query = supabase
    .from('bd_funcionarios')
    .select(`
      *,
      empresa:bd_empresas(nome_empresa),
      departamento:bd_departamentos(nome_departamento),
      funcao:bd_funcoes(nome_funcao)
    `);
  
  // Aplicar filtros condicionalmente
  if (filters.empresa_id) {
    query.eq('empresa_id', filters.empresa_id);
  }
  
  if (filters.search) {
    query.ilike('nome_completo', `%${filters.search}%`);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data;
};
```

### Real-time Subscriptions
```typescript
// Subscrições para updates em tempo real
export const useRealtimeFuncionarios = () => {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const channel = supabase
      .channel('funcionarios-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bd_funcionarios' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};
```

## Componentes UI

### Design System
```typescript
// Tema base usando CSS Variables
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --muted: 210 40% 96%;
  --muted-foreground: 215.4 16.3% 46.9%;
  // ... outras variáveis
}

// Componentes base tipados
interface ButtonProps 
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
```

### Compound Components Pattern
```typescript
// Pattern para componentes complexos
const DataTable = {
  Root: ({ children, ...props }) => (
    <div className="rounded-md border" {...props}>
      {children}
    </div>
  ),
  
  Header: ({ children }) => (
    <div className="border-b px-4 py-3">
      {children}
    </div>
  ),
  
  Body: ({ children }) => (
    <div className="divide-y">
      {children}
    </div>
  ),
  
  Row: ({ children, ...props }) => (
    <div className="flex items-center px-4 py-3" {...props}>
      {children}
    </div>
  ),
};

// Uso
<DataTable.Root>
  <DataTable.Header>
    <h3>Funcionários</h3>
  </DataTable.Header>
  <DataTable.Body>
    {funcionarios.map(func => (
      <DataTable.Row key={func.id}>
        {func.nome_completo}
      </DataTable.Row>
    ))}
  </DataTable.Body>
</DataTable.Root>
```

## Performance e Otimizações

### Code Splitting
```typescript
// Lazy loading de páginas
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Funcionarios = lazy(() => import('./pages/Funcionarios'));

// Wrapper com Suspense
const App = () => (
  <Suspense fallback={<LoadingSpinner />}>
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/funcionarios" element={<Funcionarios />} />
    </Routes>
  </Suspense>
);
```

### Memoization
```typescript
// Componentes memoizados
const FuncionarioCard = React.memo(({ funcionario }) => {
  return (
    <Card>
      <h3>{funcionario.nome_completo}</h3>
      <p>{funcionario.email}</p>
    </Card>
  );
});

// Values memoizados
const ExpensiveComponent = () => {
  const expensiveValue = useMemo(() => {
    return heavyCalculation(data);
  }, [data]);
  
  const handleClick = useCallback((id: string) => {
    // Event handler logic
  }, [dependency]);
  
  return <div>{expensiveValue}</div>;
};
```

### Virtual Scrolling
```typescript
// Para listas grandes
import { FixedSizeList as List } from 'react-window';

const VirtualizedTable = ({ items }) => (
  <List
    height={600}
    itemCount={items.length}
    itemSize={50}
    width="100%"
  >
    {({ index, style }) => (
      <div style={style}>
        <FuncionarioRow funcionario={items[index]} />
      </div>
    )}
  </List>
);
```

## Segurança

### Input Sanitization
```typescript
// Sanitização de inputs
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '');
};

// Validação rigorosa com Zod
const userInputSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-zA-ZÀ-ÿ\s]+$/),
  email: z.string().email().max(255),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/),
});
```

### CSRF Protection
```typescript
// Headers de segurança
const secureHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};
```

### Environment Variables
```bash
# Variáveis de ambiente seguras
VITE_SUPABASE_URL=https://project.supabase.co
VITE_SUPABASE_ANON_KEY=public_key_only
# Nunca expor service_role_key no frontend
```

## Monitoramento

### Error Tracking
```typescript
// Error boundaries para captura de erros
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Enviar para serviço de monitoramento
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    
    return this.props.children;
  }
}
```

### Performance Monitoring
```typescript
// Métricas de performance
export const trackPerformance = (name: string, fn: () => void) => {
  const start = performance.now();
  fn();
  const end = performance.now();
  
  console.log(`${name} took ${end - start} milliseconds`);
  
  // Enviar métricas se necessário
  if (end - start > 1000) {
    console.warn(`Slow operation detected: ${name}`);
  }
};
```

### User Analytics
```typescript
// Tracking de eventos de usuário
export const trackEvent = (event: string, properties?: any) => {
  // Implementação básica
  console.log('Event:', event, properties);
  
  // Em produção, integrar com serviço de analytics
  // analytics.track(event, properties);
};

// Uso nos componentes
const handleFormSubmit = () => {
  trackEvent('form_submitted', { form_type: 'funcionario' });
  // ... lógica do submit
};
```

---

**Versão da Documentação**: 3.0  
**Última Atualização**: Janeiro 2025  
**Novidades**: Arquitetura offline completa, sincronização automática e otimizações de performance

