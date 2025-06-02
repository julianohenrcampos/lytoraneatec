
# Guia de Desenvolvimento 🚀

## Configuração do Ambiente

### Pré-requisitos

#### Software Necessário
- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** 9+ ou **yarn** 1.22+
- **Git** ([Download](https://git-scm.com/))
- **VS Code** ou editor de sua preferência
- **Conta no Supabase** ([Criar conta](https://supabase.com/))

#### Extensões Recomendadas para VS Code
```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "ms-vscode.vscode-eslint",
    "formulahendry.auto-rename-tag",
    "ms-vscode.vscode-json",
    "yzhang.markdown-all-in-one"
  ]
}
```

### Configuração Inicial

#### 1. Clone do Repositório
```bash
# Clone o repositório
git clone <repository-url>
cd sistema-asfalto

# Instale as dependências
npm install

# Ou usando yarn
yarn install
```

#### 2. Configuração do Ambiente
```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite o arquivo .env com suas configurações
nano .env
```

#### 3. Variáveis de Ambiente
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Development Settings
VITE_APP_ENV=development
VITE_APP_VERSION=1.0.0

# Optional: External APIs
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key
```

#### 4. Configuração do Supabase

**Criar Projeto no Supabase:**
1. Acesse [supabase.com](https://supabase.com/)
2. Clique em "New Project"
3. Escolha organização e nome do projeto
4. Defina senha do banco de dados
5. Selecione região (preferencialmente São Paulo)

**Configurar Autenticação:**
```sql
-- Criar tabela de perfis
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  nome_completo TEXT,
  imagem_url TEXT,
  funcoes TEXT[] DEFAULT ARRAY['user'::TEXT],
  funcao_permissao UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política de acesso
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);
```

**Função para Criar Perfil:**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome_completo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

#### 5. Executar Migrations
```bash
# Se estiver usando migrations locais
npm run migrate

# Ou execute diretamente no Supabase Dashboard
```

#### 6. Iniciar Desenvolvimento
```bash
# Iniciar servidor de desenvolvimento
npm run dev

# Ou com yarn
yarn dev

# Acesse http://localhost:5173
```

## Estrutura do Projeto

### Organização de Pastas

```
src/
├── components/           # Componentes React
│   ├── ui/              # Componentes base (shadcn/ui)
│   ├── layout/          # Componentes de layout
│   ├── dashboard/       # Componentes do dashboard
│   ├── funcionarios/    # Módulo de RH
│   ├── veiculos/        # Módulo de máquinas
│   ├── requisicoes/     # Módulo de requisições
│   ├── programacao/     # Módulo de programação
│   ├── registro-cargas/ # Módulo de cargas
│   └── registro-aplicacao/ # Módulo de aplicação
├── hooks/               # Hooks personalizados
│   ├── useAuth.ts       # Hook de autenticação
│   ├── useForm*.ts      # Hooks de formulários
│   └── use*.ts          # Hooks específicos
├── services/            # Serviços e APIs
│   ├── *Service.ts      # Serviços por entidade
│   └── api/             # Configurações de API
├── types/               # Definições TypeScript
│   ├── *.ts             # Tipos por entidade
│   └── index.ts         # Exports centralizados
├── utils/               # Funções utilitárias
│   ├── calculations.ts  # Cálculos matemáticos
│   ├── formatters.ts    # Formatação de dados
│   └── validators.ts    # Validações
├── validations/         # Schemas Zod
│   └── *Schema.ts       # Schemas por entidade
├── lib/                 # Configurações de bibliotecas
│   ├── utils.ts         # Utilitários gerais
│   └── auth.ts          # Configuração de auth
├── pages/               # Páginas da aplicação
│   ├── Dashboard.tsx    # Dashboard principal
│   ├── Login.tsx        # Página de login
│   └── *.tsx            # Outras páginas
└── constants/           # Constantes da aplicação
    └── *.ts             # Constantes agrupadas
```

### Convenções de Nomenclatura

#### Arquivos e Pastas
```bash
# Componentes React - PascalCase
ComponentName.tsx
FuncionarioForm.tsx

# Hooks - camelCase com prefixo 'use'
useAuth.ts
useFuncionarioForm.ts

# Serviços - camelCase com sufixo 'Service'
funcionarioService.ts
authService.ts

# Tipos - PascalCase
FuncionarioType.ts
ApiResponse.ts

# Utilitários - camelCase
dateUtils.ts
mathUtils.ts

# Constantes - camelCase ou SCREAMING_SNAKE_CASE
apiEndpoints.ts
API_ENDPOINTS.ts
```

#### Variáveis e Funções
```typescript
// Variáveis - camelCase
const userName = 'João';
const isLoggedIn = true;
const userPreferences = {};

// Funções - camelCase
function calculateArea(width: number, height: number) {}
const handleSubmit = () => {};

// Constantes - SCREAMING_SNAKE_CASE
const API_BASE_URL = 'https://api.exemplo.com';
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

// Tipos/Interfaces - PascalCase
interface UserProfile {}
type ApiResponse<T> = {};

// Enums - PascalCase
enum UserRole {
  ADMIN = 'admin',
  USER = 'user'
}
```

## Padrões de Desenvolvimento

### Componentes React

#### Estrutura Base
```typescript
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// Types
interface ComponentProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  data?: SomeDataType;
}

// Schema de validação
const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
});

type FormData = z.infer<typeof schema>;

// Componente
export const Component: React.FC<ComponentProps> = ({
  title,
  isOpen,
  onClose,
  data
}) => {
  // Estados
  const [isLoading, setIsLoading] = useState(false);
  
  // Hooks
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: data?.name || '',
      email: data?.email || '',
    },
  });

  // Effects
  useEffect(() => {
    if (data) {
      form.reset(data);
    }
  }, [data, form]);

  // Handlers
  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true);
    try {
      // Lógica de submissão
      await saveData(formData);
      onClose();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Early returns
  if (!isOpen) return null;

  // Render
  return (
    <div className="component-container">
      <h2>{title}</h2>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        {/* Form fields */}
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </div>
  );
};
```

### Hooks Personalizados

#### Hook de Formulário
```typescript
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';

export const useEntityForm = <T>(
  schema: ZodSchema<T>,
  onSuccess?: (data: T) => void,
  initialData?: Partial<T>
) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues: initialData as T,
  });

  const onSubmit = async (data: T) => {
    setIsLoading(true);
    try {
      // Lógica de submissão
      await submitData(data);
      
      toast({
        title: 'Sucesso',
        description: 'Dados salvos com sucesso',
      });
      
      onSuccess?.(data);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar dados',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    form,
    isLoading,
    onSubmit: form.handleSubmit(onSubmit),
  };
};
```

#### Hook de API
```typescript
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const useEntityAPI = () => {
  const queryClient = useQueryClient();

  // Query para buscar dados
  const {
    data: entities,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['entities'],
    queryFn: () => fetchEntities(),
  });

  // Mutation para criar
  const createMutation = useMutation({
    mutationFn: (data: EntityFormData) => createEntity(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
    },
  });

  // Mutation para atualizar
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EntityFormData }) => 
      updateEntity(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
    },
  });

  // Mutation para deletar
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEntity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
    },
  });

  return {
    entities,
    isLoading,
    error,
    refetch,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
```

### Serviços

#### Serviço Base
```typescript
import { supabase } from '@/integrations/supabase/client';

export class BaseService<T> {
  constructor(private tableName: string) {}

  async findAll(filters?: Record<string, any>): Promise<T[]> {
    let query = supabase.from(this.tableName).select('*');
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.eq(key, value);
        }
      });
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as T[];
  }

  async findById(id: string): Promise<T | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    return data as T | null;
  }

  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    const { data: result, error } = await supabase
      .from(this.tableName)
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return result as T;
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const { data: result, error } = await supabase
      .from(this.tableName)
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return result as T;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
}

// Uso específico
export class FuncionarioService extends BaseService<Funcionario> {
  constructor() {
    super('bd_funcionarios');
  }

  async findByEmpresa(empresaId: string): Promise<Funcionario[]> {
    const { data, error } = await supabase
      .from('bd_funcionarios')
      .select(`
        *,
        empresa:empresa_id(*),
        departamento:departamento_id(*),
        funcao:funcao_id(*)
      `)
      .eq('empresa_id', empresaId);
    
    if (error) throw error;
    return data as Funcionario[];
  }
}

export const funcionarioService = new FuncionarioService();
```

### Validações com Zod

#### Schemas Comuns
```typescript
import * as z from 'zod';

// Schema base para entidades
const baseEntitySchema = z.object({
  id: z.string().uuid().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

// Schema para funcionário
export const funcionarioSchema = baseEntitySchema.extend({
  nome_completo: z.string()
    .min(2, 'Nome deve ter ao menos 2 caracteres')
    .max(100, 'Nome muito longo'),
  
  cpf: z.string()
    .regex(/^\d{11}$/, 'CPF deve ter 11 dígitos')
    .refine(isValidCPF, 'CPF inválido'),
  
  email: z.string()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),
  
  data_nascimento: z.string()
    .datetime()
    .optional()
    .refine((date) => {
      if (!date) return true;
      const birth = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - birth.getFullYear();
      return age >= 16 && age <= 80;
    }, 'Idade deve estar entre 16 e 80 anos'),
  
  salario_base: z.number()
    .min(0, 'Salário não pode ser negativo')
    .optional(),
  
  empresa_id: z.string().uuid('Empresa é obrigatória'),
  departamento_id: z.string().uuid().optional(),
  funcao_id: z.string().uuid().optional(),
});

export type FuncionarioFormData = z.infer<typeof funcionarioSchema>;

// Schema para aplicação de asfalto
export const aplicacaoSchema = z.object({
  data_aplicacao: z.string().min(1, 'Data é obrigatória'),
  hora_chegada_local: z.string().min(1, 'Hora de chegada é obrigatória'),
  comprimento: z.number()
    .min(0.1, 'Comprimento deve ser maior que 0'),
  largura_media: z.number()
    .min(0.1, 'Largura deve ser maior que 0'),
  tonelada_aplicada: z.number()
    .min(0.001, 'Massa deve ser maior que 0'),
}).refine((data) => {
  const area = data.comprimento * data.largura_media;
  const espessura = (data.tonelada_aplicada / area) / 2.4 * 100;
  return espessura >= 3 && espessura <= 15;
}, {
  message: 'Espessura calculada deve estar entre 3cm e 15cm',
  path: ['tonelada_aplicada']
});
```

#### Validações Customizadas
```typescript
// Validador de CPF
export const isValidCPF = (cpf: string): boolean => {
  if (cpf.length !== 11) return false;
  
  // Elimina CPFs conhecidos como inválidos
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  
  // Valida dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(10))) return false;
  
  return true;
};

// Validador de CNPJ
export const isValidCNPJ = (cnpj: string): boolean => {
  if (cnpj.length !== 14) return false;
  
  // Algoritmo de validação do CNPJ
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  const calc = (weights: number[]) => {
    const sum = weights.reduce((acc, weight, index) => {
      return acc + parseInt(cnpj.charAt(index)) * weight;
    }, 0);
    
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  
  const digit1 = calc(weights1);
  const digit2 = calc(weights2);
  
  return digit1 === parseInt(cnpj.charAt(12)) && 
         digit2 === parseInt(cnpj.charAt(13));
};
```

## Configuração de Ferramentas

### ESLint
```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "plugins": ["@typescript-eslint", "react", "react-hooks"],
  "rules": {
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

### Prettier
```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "jsxSingleQuote": false,
  "bracketSpacing": true,
  "jsxBracketSameLine": false,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

### TypeScript
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Vite
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-select'],
          utils: ['date-fns', 'lodash'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});
```

## Processo de Desenvolvimento

### Git Workflow

#### Branches
```bash
# Branch principal
main

# Branches de desenvolvimento
develop

# Feature branches
feature/nome-da-funcionalidade
feature/adicionar-modulo-estoque

# Hotfix branches
hotfix/corrigir-bug-critico

# Release branches
release/v1.2.0
```

#### Comandos Comuns
```bash
# Criar nova feature
git checkout develop
git pull origin develop
git checkout -b feature/nova-funcionalidade

# Trabalhar na feature
git add .
git commit -m "feat: adicionar nova funcionalidade"
git push origin feature/nova-funcionalidade

# Merge para develop
git checkout develop
git merge feature/nova-funcionalidade
git push origin develop

# Delete feature branch
git branch -d feature/nova-funcionalidade
git push origin --delete feature/nova-funcionalidade
```

### Convenções de Commit

#### Formato
```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

#### Tipos
- **feat**: Nova funcionalidade
- **fix**: Correção de bug
- **docs**: Mudanças na documentação
- **style**: Mudanças de formatação (não afetam código)
- **refactor**: Refatoração de código
- **test**: Adição ou correção de testes
- **chore**: Mudanças de build, configuração, etc.

#### Exemplos
```bash
feat(funcionarios): adicionar validação de CPF

fix(dashboard): corrigir cálculo de estatísticas

docs(readme): atualizar instruções de instalação

style(components): ajustar formatação do código

refactor(services): simplificar lógica de autenticação

test(utils): adicionar testes para formatadores

chore(deps): atualizar dependências do projeto
```

### Code Review

#### Checklist para PRs
- [ ] Código segue as convenções estabelecidas
- [ ] Testes passando
- [ ] Documentação atualizada
- [ ] Sem console.logs desnecessários
- [ ] Variáveis com nomes descritivos
- [ ] Funções pequenas e focadas
- [ ] Tratamento adequado de erros
- [ ] Performance adequada
- [ ] Responsividade testada
- [ ] Acessibilidade considerada

#### Template de PR
```markdown
## Descrição
Breve descrição das mudanças realizadas.

## Tipo de Mudança
- [ ] Bug fix (mudança que corrige um problema)
- [ ] Nova funcionalidade (mudança que adiciona funcionalidade)
- [ ] Breaking change (correção/funcionalidade que quebra compatibilidade)
- [ ] Mudança de documentação

## Como Testar
1. Vá para '...'
2. Clique em '....'
3. Role para baixo até '....'
4. Veja erro

## Checklist
- [ ] Meu código segue as convenções do projeto
- [ ] Revisei meu próprio código
- [ ] Comentei código complexo
- [ ] Fiz mudanças correspondentes na documentação
- [ ] Minhas mudanças não geram novos warnings
- [ ] Adicionei testes que provam que a correção é efetiva
- [ ] Testes novos e existentes passam localmente
```

### Testing

#### Configuração do Jest
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

#### Testes de Componentes
```typescript
// src/components/__tests__/FuncionarioForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FuncionarioForm } from '../FuncionarioForm';

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('FuncionarioForm', () => {
  it('should render form fields', () => {
    renderWithProviders(
      <FuncionarioForm 
        isOpen={true} 
        onClose={jest.fn()} 
        onSuccess={jest.fn()} 
      />
    );

    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cpf/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    const onSubmit = jest.fn();
    
    renderWithProviders(
      <FuncionarioForm 
        isOpen={true} 
        onClose={jest.fn()} 
        onSuccess={onSubmit} 
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => {
      expect(screen.getByText(/nome é obrigatório/i)).toBeInTheDocument();
      expect(screen.getByText(/cpf é obrigatório/i)).toBeInTheDocument();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should submit form with valid data', async () => {
    const onSuccess = jest.fn();
    
    renderWithProviders(
      <FuncionarioForm 
        isOpen={true} 
        onClose={jest.fn()} 
        onSuccess={onSuccess} 
      />
    );

    fireEvent.change(screen.getByLabelText(/nome completo/i), {
      target: { value: 'João Silva' }
    });
    
    fireEvent.change(screen.getByLabelText(/cpf/i), {
      target: { value: '12345678901' }
    });

    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
```

#### Testes de Hooks
```typescript
// src/hooks/__tests__/useFuncionarioForm.test.ts
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFuncionarioForm } from '../useFuncionarioForm';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useFuncionarioForm', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useFuncionarioForm(), { wrapper });

    expect(result.current.form.getValues()).toEqual({
      nome_completo: '',
      cpf: '',
      email: '',
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle form submission', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useFuncionarioForm(onSuccess), { wrapper });

    act(() => {
      result.current.form.setValue('nome_completo', 'João Silva');
      result.current.form.setValue('cpf', '12345678901');
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(onSuccess).toHaveBeenCalled();
  });
});
```

#### Testes de Serviços
```typescript
// src/services/__tests__/funcionarioService.test.ts
import { funcionarioService } from '../funcionarioService';
import { supabase } from '@/integrations/supabase/client';

// Mock do Supabase
jest.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => ({
          data: [],
          error: null,
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: { id: '1', nome_completo: 'João Silva' },
            error: null,
          })),
        })),
      })),
    })),
  },
}));

describe('funcionarioService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch all funcionarios', async () => {
    const mockData = [
      { id: '1', nome_completo: 'João Silva' },
      { id: '2', nome_completo: 'Maria Santos' },
    ];

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: mockData,
          error: null,
        }),
      }),
    });

    const result = await funcionarioService.findAll();

    expect(result).toEqual(mockData);
    expect(supabase.from).toHaveBeenCalledWith('bd_funcionarios');
  });

  it('should create funcionario', async () => {
    const newFuncionario = {
      nome_completo: 'João Silva',
      cpf: '12345678901',
    };

    const mockResponse = {
      id: '1',
      ...newFuncionario,
    };

    (supabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockResponse,
            error: null,
          }),
        }),
      }),
    });

    const result = await funcionarioService.create(newFuncionario);

    expect(result).toEqual(mockResponse);
  });
});
```

## Performance e Otimização

### Otimizações React

#### Memoização
```typescript
import React, { memo, useMemo, useCallback } from 'react';

// Memoizar componentes pesados
const ExpensiveComponent = memo<Props>(({ data, onUpdate }) => {
  // Memoizar cálculos pesados
  const expensiveValue = useMemo(() => {
    return data.reduce((acc, item) => acc + item.value, 0);
  }, [data]);

  // Memoizar funções
  const handleClick = useCallback((id: string) => {
    onUpdate(id);
  }, [onUpdate]);

  return (
    <div>
      <span>{expensiveValue}</span>
      <button onClick={() => handleClick('1')}>
        Update
      </button>
    </div>
  );
});
```

#### Lazy Loading
```typescript
import { lazy, Suspense } from 'react';

// Componentes lazy
const FuncionariosPage = lazy(() => import('@/pages/FuncionariosPage'));
const VeiculosPage = lazy(() => import('@/pages/VeiculosPage'));

// Uso com suspense
function App() {
  return (
    <Router>
      <Routes>
        <Route 
          path="/funcionarios" 
          element={
            <Suspense fallback={<div>Carregando...</div>}>
              <FuncionariosPage />
            </Suspense>
          } 
        />
        <Route 
          path="/veiculos" 
          element={
            <Suspense fallback={<div>Carregando...</div>}>
              <VeiculosPage />
            </Suspense>
          } 
        />
      </Routes>
    </Router>
  );
}
```

#### Virtualização
```typescript
import { FixedSizeList as List } from 'react-window';

const VirtualizedTable = ({ items }: { items: any[] }) => {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      {items[index].name}
    </div>
  );

  return (
    <List
      height={600}
      itemCount={items.length}
      itemSize={50}
      width="100%"
    >
      {Row}
    </List>
  );
};
```

### Otimizações de Bundle

#### Code Splitting
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-select',
            '@radix-ui/react-form'
          ],
          'utils-vendor': ['date-fns', 'lodash', 'zod'],
          
          // Feature chunks
          'funcionarios': [
            './src/pages/FuncionariosPage',
            './src/components/funcionarios'
          ],
          'veiculos': [
            './src/pages/VeiculosPage',
            './src/components/veiculos'
          ],
        },
      },
    },
  },
});
```

#### Tree Shaking
```typescript
// Importações específicas
import { format, parseISO } from 'date-fns'; // ✅ Bom
import { debounce } from 'lodash'; // ✅ Bom

// Evitar importações completas
import * as dateFns from 'date-fns'; // ❌ Ruim
import _ from 'lodash'; // ❌ Ruim
```

### Otimizações de Supabase

#### Consultas Eficientes
```typescript
// Selecionar apenas campos necessários
const { data } = await supabase
  .from('bd_funcionarios')
  .select('id, nome_completo, email') // ✅ Específico
  .eq('empresa_id', empresaId);

// Evitar select *
const { data } = await supabase
  .from('bd_funcionarios')
  .select('*'); // ❌ Ineficiente
```

#### Paginação
```typescript
const fetchFuncionarios = async (page: number, limit: number = 20) => {
  const start = (page - 1) * limit;
  const end = start + limit - 1;

  const { data, error, count } = await supabase
    .from('bd_funcionarios')
    .select('*', { count: 'exact' })
    .range(start, end)
    .order('nome_completo');

  return {
    data,
    error,
    totalPages: Math.ceil((count || 0) / limit),
    currentPage: page,
  };
};
```

#### Índices de Banco
```sql
-- Criar índices para consultas frequentes
CREATE INDEX idx_funcionarios_empresa ON bd_funcionarios(empresa_id);
CREATE INDEX idx_funcionarios_status ON bd_funcionarios(status);
CREATE INDEX idx_aplicacao_data ON bd_registro_apontamento_aplicacao(data_aplicacao);

-- Índices compostos
CREATE INDEX idx_funcionarios_empresa_status 
ON bd_funcionarios(empresa_id, status);
```

## Deploy e CI/CD

### GitHub Actions

#### Workflow de CI
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: 18
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linter
      run: npm run lint
    
    - name: Run type check
      run: npm run type-check
    
    - name: Run tests
      run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
```

#### Workflow de Deploy
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: 18
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build
      run: npm run build
      env:
        VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
        VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
    
    - name: Deploy to Netlify
      uses: nwtgck/actions-netlify@v2.0
      with:
        publish-dir: './dist'
        production-branch: main
        github-token: ${{ secrets.GITHUB_TOKEN }}
        deploy-message: "Deploy from GitHub Actions"
      env:
        NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
        NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

### Scripts de Package.json
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint . --ext ts,tsx --fix",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "prepare": "husky install"
  }
}
```

### Husky e Lint-staged
```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,css,md}": [
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
npm run type-check
```

## Troubleshooting

### Problemas Comuns

#### Erro de CORS
```typescript
// Configurar no Supabase Dashboard
// Authentication > Settings > Site URL
// Adicionar: http://localhost:5173

// Se persistir, verificar configuração do projeto
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
if (!supabaseUrl.includes('supabase.co')) {
  console.error('URL do Supabase incorreta');
}
```

#### Problemas de Autenticação
```typescript
// Verificar se o usuário está logado
const checkAuth = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.log('Usuário não logado');
    // Redirecionar para login
  }
};

// Renovar token automaticamente
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token renovado');
  }
  
  if (event === 'SIGNED_OUT') {
    // Limpar estado local
    queryClient.clear();
  }
});
```

#### Problemas de Performance
```typescript
// Debug de re-renders
import { whyDidYouUpdate } from '@welldone-software/why-did-you-render';

if (process.env.NODE_ENV === 'development') {
  whyDidYouUpdate(React, {
    trackAllPureComponents: true,
  });
}

// Profiler React
import { Profiler } from 'react';

const onRenderCallback = (id, phase, actualDuration) => {
  console.log('Render:', { id, phase, actualDuration });
};

<Profiler id="App" onRender={onRenderCallback}>
  <App />
</Profiler>
```

### Debug

#### Console Logs Estruturados
```typescript
// Wrapper para logs
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data);
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error);
  },
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, data);
    }
  },
};

// Uso
logger.info('Usuário logado', { userId: user.id });
logger.error('Erro ao salvar', error);
```

#### React Developer Tools
```bash
# Instalar extensão do navegador
# Chrome: React Developer Tools
# Firefox: React Developer Tools

# Usar Profiler para performance
# Components tree para hierarquia
# Props e state em tempo real
```

## Recursos Úteis

### Documentação
- [React](https://reactjs.org/docs)
- [TypeScript](https://www.typescriptlang.org/docs)
- [Vite](https://vitejs.dev/guide)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Supabase](https://supabase.com/docs)
- [React Hook Form](https://react-hook-form.com)
- [Zod](https://zod.dev)
- [Tanstack Query](https://tanstack.com/query/latest)

### Ferramentas
- [VS Code](https://code.visualstudio.com)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools)
- [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools)
- [Supabase Dashboard](https://supabase.com/dashboard)

### Bibliotecas Úteis
- [date-fns](https://date-fns.org) - Manipulação de datas
- [lodash](https://lodash.com) - Utilitários JavaScript
- [recharts](https://recharts.org) - Gráficos React
- [react-window](https://github.com/bvaughn/react-window) - Virtualização
- [react-perfect-scrollbar](https://github.com/goldenyz/react-perfect-scrollbar) - Scroll customizado

---

**Mantenha este guia atualizado conforme o projeto evolui!**
