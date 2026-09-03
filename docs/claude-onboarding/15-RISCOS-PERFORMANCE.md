# 15 — RISCOS DE PERFORMANCE

> Auditoria READ-ONLY, **estática**. Sem acesso ao banco, portanto **sem `EXPLAIN`, sem `pg_stat_statements`, sem volume real de dados**.
> Nada foi otimizado. Cada item traz a consulta de confirmação.

---

## 1. Panorama quantitativo

| Métrica | Valor |
|---|---:|
| LOC em `src/` | ~358.400 |
| Chamadas `supabase.from(` no frontend | 180 |
| Chamadas `.rpc(` no frontend | 217 |
| `.select('*')` no frontend | **148** |
| Arquivos com `.select('*')` **e sem** `.limit(`/`.range(` | **57** |
| Usos de `.limit(` | 71 |
| Usos de `.range(` (paginação) | 29 |
| `setInterval(` | 14 (em 11 arquivos) |
| `refetchInterval` (React Query) | 12 |
| Canais Realtime (`postgres_changes`) | 2 hooks |
| Índices criados nas migrations | 434 distintos |
| Materialized views | 1 ativa (`mv_relatorio_diarias`) |

---

## 2. Configuração do React Query

`src/App.tsx`:
```ts
new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } } })
```
- `staleTime` de 5 min é conservador e adequado para um ERP.
- `retry: 1` evita tempestade de retentativas.
- **`gcTime` não configurado** → padrão de 5 min.
- **Não há `refetchOnWindowFocus: false`** → o padrão do React Query v5 é `true`; combinado com `useAuth`, que também revalida em `focus`/`visibilitychange`/`pageshow`, cada retorno de aba dispara refetch de todas as queries montadas. Em telas com muitas queries (dashboards), isso multiplica requisições.

**`[VERIFICAR]`**: abrir um dashboard, alternar de aba e voltar, observando a aba Network. Se houver rajada de requisições ao PostgREST, o achado se confirma.

---

## 3. `SELECT *` sem limite — 57 arquivos

Concentração por arquivo:

| Ocorrências | Arquivo |
|---:|---|
| 7 | `src/services/pncpService.ts` |
| 6 | `src/services/fluxoAprovacaoConfigService.ts` |
| 5 | `src/hooks/dashboard/useRhDashboardData.ts` |
| 4 | `src/utils/offlineQueries.ts`, `src/services/rh/solicitacoesClassificacaoLoteService.ts`, `src/services/ordemServicoService.ts`, `src/services/movimentacaoService.ts`, `src/services/alterdataImportService.ts`, `src/components/dashboard/RequisicaoSection.tsx` |
| 3 | `src/services/ssoAgendamentoExames/locaisAtendimentoService.ts`, `src/services/rh/solicitacaoTransferenciaService.ts`, `src/services/rh/solicitacaoDesligamentoService.ts` |

**Dois problemas distintos:**

1. **Tráfego e memória** — `select('*')` em `bd_funcionarios` traz 53 colunas, incluindo `imagem` (string, possivelmente base64 ou URL longa) e 8 colunas de endereço. Em `bd_pncp_todas_licitacoes` o volume tende a crescer indefinidamente com a sincronização diária.

2. **🔴 Exposição de colunas sensíveis** — `select('*')` em `bd_funcionarios` retorna `cpf`, `salario_base`, `chave_pix`, `conta_corrente`, `banco`, `agencia`. Como o RLS **não filtra colunas**, esses dados chegam ao browser de qualquer usuário que passe pelo filtro de linha. Isso conecta performance com `14-RISCOS-SEGURANCA.md` SEC-01/SEC-10 — a solução correta (`select` explícito de colunas ou uso das views `vw_funcionarios_operacional`) resolve os dois.

> O projeto **já possui a infraestrutura correta**: as 30+ views `vw_*_seguro`/`_segura` existem exatamente para projetar colunas por perfil. O problema é que nem todos os caminhos de leitura as utilizam.

**`[VERIFICAR NO BANCO]`** — o custo real depende do volume:
```sql
select relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) as tamanho
from pg_stat_user_tables where schemaname='public'
order by n_live_tup desc limit 30;
```

---

## 4. Paginação — cobertura parcial

`.range(` aparece **29 vezes** em ~180 pontos de leitura de tabela. As listagens grandes conhecidas (Funcionários, Central do Transporte, Chamados Internos, Licitações) precisam ser verificadas individualmente.

Existe documento prévio no repositório: **`docs/AUDITORIA_LISTAS_GRANDES.md`** — indica que o tema já foi tratado antes. Recomenda-se lê-lo antes de qualquer trabalho nesta frente (não foi reproduzido aqui para não duplicar informação existente).

---

## 5. Polling e Realtime

### 5.1 `setInterval` (14 ocorrências, 11 arquivos)

| Arquivo | Propósito provável |
|---|---|
| `src/hooks/useAppVersionCheck.ts` | Verifica `/version.json` para detectar novo deploy |
| `src/hooks/useConnectionStatus.ts` + `useConnectionStatusOptimized.ts` (**órfão**) | Status de conexão — **duas implementações** |
| `src/hooks/useOfflineSync.ts` | Drena a fila offline |
| `src/hooks/sso/useClinicasAbertasAgora.ts` | Recalcula clínicas abertas |
| `src/pages/PontoDireto.tsx`, `src/pages/PontoTotem.tsx` | Relógio / heartbeat |
| `src/components/atestados/EtapaValidacaoMatricula.tsx` | Contador |
| `src/components/register/RegistrationSuccess.tsx`, `src/pages/NotFound.tsx`, `src/components/HeroSection.tsx` (**órfão**) | Contadores/carrossel de UI |

Nenhum é polling de dados de negócio em massa. **Risco baixo**, desde que os intervalos façam `clearInterval` no unmount (verificar caso a caso).

### 5.2 `refetchInterval` (12 ocorrências)
Polling via React Query. **`[VERIFICAR]`** os intervalos usados — um `refetchInterval` curto em uma query pesada (ex.: dashboard de chamados) multiplica carga no PostgREST e no RLS.
```bash
grep -rn "refetchInterval" src
```

### 5.3 Realtime — apenas 2 hooks
- `src/hooks/useNotifications.ts`
- `src/hooks/useChamadosInternosRealtime.ts`

**Uso conservador e correto.** Realtime no Supabase avalia RLS por evento e por assinante; escalar o uso indiscriminadamente seria caro. O projeto acertou em manter apenas 2 canais.

**`[VERIFICAR]`** — se as subscrições são canceladas no unmount e se filtram por `filter:` do lado do servidor (e não recebem todos os eventos da tabela para filtrar no cliente).

---

## 6. RLS como custo de query

Este é, potencialmente, **o maior custo de performance do sistema** — e o menos visível.

### 6.1 Funções chamadas por linha
As policies chamam funções `SECURITY DEFINER` dentro de `USING`. As mais frequentes:

| Chamadas em policies | Função | Custo |
|---:|---|---|
| 80 | `check_is_super_admin` → `fn_is_super_admin` | **3 subconsultas `EXISTS`** (`bd_user_roles`+`bd_roles`, `profiles`, `profiles`+`bd_funcoes_permissao`) |
| 67 | `fn_is_super_admin` | idem |
| 39 | `fn_has_role` | 1 join |
| 34 | `has_permission` / 27 `fn_has_permission` | **5 CTEs** com joins em `bd_user_permission_overrides`, `bd_permissoes`, `bd_permissions`, `bd_user_roles`, `bd_roles`, `bd_role_permissions`, `bd_role_permission_actions`, `profiles`, `bd_funcoes_permissao` |
| 30 | `fn_logistica_is_privileged_user` | |
| 18 | `fn_logistica_can_access_centro_custo`, `fn_logistica_current_funcionario_id` | |
| 14 | `fn_diaria_scope_centros_custo` | retorna conjunto de CCs |

**Mitigação já presente:** todas as funções auditadas são declaradas `STABLE` (ex.: `fn_is_super_admin`, `fn_has_permission`, `fn_has_action`, `is_super_admin`). Isso permite ao planner cachear o resultado dentro da mesma query quando os argumentos são constantes (`auth.uid()`). É a otimização correta e **já foi aplicada**.

**Risco residual:** funções cujo argumento varia por linha (ex.: `fn_funcionarios_can_select_row(auth.uid(), id)`, `fn_ativos_can_access_equipamento(id)`, `fn_chamado_interno_can_read(uuid)`) **são avaliadas linha a linha**. Em `bd_funcionarios` a policy `funcionarios_operacional_select` chama **três** funções desse tipo em OR:
```sql
USING (
  public.fn_funcionarios_can_select_row(auth.uid(), id)
  OR public.fn_can_access_funcionario_operacional(id, departamento_id, centro_custo_id)
  OR public.fn_can_access_funcionario_sensitive(id)
)
```
Para uma listagem de N funcionários, isso é até 3N execuções de função — cada uma com seus próprios `EXISTS`.

**`[VERIFICAR NO BANCO]`** — medir de fato:
```sql
-- Habilitar pg_stat_statements se disponível
select query, calls, mean_exec_time, total_exec_time, rows
from pg_stat_statements
where query ilike '%bd_funcionarios%'
order by total_exec_time desc limit 20;

-- Plano real de uma listagem típica (executar como o role authenticated)
explain (analyze, buffers)
select id, nome_completo, matricula, status from public.bd_funcionarios limit 100;
```

> **Nota importante:** enquanto as policies `USING(true)` de SEC-01 existirem, o planner satisfaz a policy pelo ramo mais barato (`true`) e **o custo real do RLS fica mascarado**. Ao corrigir SEC-01, a performance de `bd_funcionarios` **vai piorar** — isso precisa ser medido antes, não depois.

### 6.2 FKs sem índice
```sql
select c.conrelid::regclass as tabela, a.attname as coluna
from pg_constraint c
join unnest(c.conkey) k(attnum) on true
join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum
where c.contype='f' and c.connamespace='public'::regnamespace
  and not exists (select 1 from pg_index i where i.indrelid=c.conrelid and a.attnum = any(i.indkey[0:0]))
order by 1,2;
```
Com **355 FKs** e 434 índices, é provável que existam FKs sem índice de apoio — especialmente nos hubs `bd_funcionarios` (50 FKs de entrada), `profiles` (47) e `bd_centros_custo` (40).

---

## 7. Triggers em cascata

| Tabela | Triggers | Efeito |
|---|---:|---|
| `bd_registro_aplicacao_detalhes` | **9** | cálculo de tonelada, área, espessura, massa remanescente, atualização do registro principal, status de entrega |
| `bd_funcionarios` | **9** | auditoria, geocoding (2 guardas), sincronização com `profiles` |
| `bd_diaria_solicitacoes` | **8** | máquina de estado + `_mark_mv_relatorio_diarias_dirty` |
| `bd_os_materiais_utilizados` / `bd_os_mao_obra` | **7** cada | `fn_recalcula_total_os_from_row` recalcula o total da OS a cada linha |
| `bd_diaria_presencas` | **6** | cálculo de valor + MV |

**Riscos:**
- **Inserção em lote** em `bd_os_materiais_utilizados` recalcula o total da OS **por linha** (7 triggers × N linhas). Um import de 500 itens é O(N) recálculos completos.
- `bd_registro_aplicacao_detalhes` com 9 triggers encadeados: uma correção de volume dispara recálculo em cascata por toda a hierarquia (detalhe → rua → registro principal → carga → entrega).
- `_mark_mv_relatorio_diarias_dirty` (4 triggers) sinaliza a MV como suja; o custo real depende de com que frequência `refresh_relatorio_diarias(p_force)` é chamado.

**`[VERIFICAR NO BANCO]`**
```sql
-- Tempo de refresh da MV
select schemaname, matviewname, ispopulated,
       pg_size_pretty(pg_total_relation_size((schemaname||'.'||matviewname)::regclass)) as tamanho
from pg_matviews where schemaname='public';

select count(*) from public._mv_relatorio_diarias_dirty;
```

---

## 8. Bundle e carregamento do frontend

### Positivo
- **Code splitting agressivo**: apenas 6 imports síncronos em `App.tsx` (`SimpleAuthGuard`, `SimplePermissionGuard`, `SecureRouteGuard`, `OrdemDiariaCampoGuard`, `SimpleLogin`, `Portal`, `NotFound`); todo o resto é `React.lazy`.
- **10 `manualChunks`** configurados em `vite.config.ts` (`vendor`, `ui`, `charts`, `supabase`, `xlsx`, `react-query`, `date-utils`, `forms`, `routing`, `lucide`).
- `assetsInlineLimit: 4096`, `target: 'esnext'`, `sourcemap: false`.
- Splash screen inline no `index.html` → percepção de carga rápida.
- Service Worker com `cache-first` para `/assets/` versionados.

### Atenção
1. **`build:dev` exige 6 GB de heap** (`NODE_OPTIONS=--max-old-space-size=6144`) — sintoma direto do tamanho do projeto (358k LOC + `types.ts` de 976 KB).
2. **`src/integrations/supabase/types.ts` tem 27.140 linhas / 976 KB.** É só tipo (apagado em runtime), mas custa em cada `tsc` e em cada rebuild do IDE.
3. **Dois motores de gráfico**: `recharts` (chunk `charts`) **e** `apexcharts` + `react-apexcharts` (sem chunk dedicado). Duplicação de ~300 KB de dependência.
4. **Bibliotecas pesadas de documento**: `xlsx`, `exceljs`, `pdf-lib`, `@react-pdf/renderer`, `jspdf` + `jspdf-autotable`, `pdfjs-dist`, `pptxgenjs`, `jszip`, `html2canvas`, `face-api.js`. É preciso confirmar que **todas** são carregadas por `import()` dinâmico e nunca entram no chunk inicial.
5. **Arquivos-componente muito grandes** (custo de parse, re-render e manutenção):
   - `ApontamentoDiariasModal.tsx` — **4.602 linhas**
   - `NovoRegistroManualModal.tsx` — 3.001
   - `SolicitacaoFormModal.tsx` — 2.637
   - `BiometriaFacial.tsx` — 2.045
   - `PontoTotem.tsx` — 1.938
   - `ApontamentoCaminhoesForm.tsx` — 1.873
   - `PontoDireto.tsx` — 1.423
   - `CompleteOsForm.tsx` — 1.381
   - `solicitacoesService.ts` — 1.348
6. **161 arquivos órfãos** — não entram no bundle (tree-shaking), mas pesam no `tsc`, no lint e na navegação do repositório.

**`[VERIFICAR]`** — medir o bundle real:
```bash
npx vite build --mode production
# depois inspecionar dist/assets/*.js por tamanho
```
_(requer `node_modules` instalado — ver `16-LEGADO-DUPLICIDADES.md` §"Verificações não executadas")_

---

## 9. Cache de permissões

`usePermission` mantém `_cache` em **variável de módulo** com TTL de 60 s.

**Positivo:** todos os 116 importadores compartilham o mesmo cache — uma única sequência de queries de RBAC por minuto, independentemente de quantos componentes chamam o hook.

**Atenção:**
- Cada componente ainda mantém seu próprio `useState`, então há N re-renders quando o cache é preenchido.
- A carga completa do RBAC envolve até **7 queries sequenciais/paralelas** (`getUser`, `getSession`, `profiles` ×2, `bd_user_roles`+`bd_roles`, `bd_role_permission_actions`+`bd_permissions`, `bd_user_permission_overrides`) com timeout de 7 s cada (3 s no bypass). No pior caso de instabilidade, o usuário espera vários segundos na tela "Verificando permissões...".
- Para SuperAdm, a query `SELECT codigo, rota FROM bd_permissions` traz **o catálogo inteiro** a cada expiração de cache.

---

## 10. Consultas potencialmente pesadas (identificadas por natureza)

| Origem | Motivo |
|---|---|
| `get_relatorio_diarias` / `get_relatorio_diarias_full` | Relatório de folha — agrega solicitações, presenças, aditivos e aprovações |
| `mv_relatorio_diarias` | MV existe justamente porque a consulta direta é cara |
| `vw_bi_*_indicadores` (11 views) | Views de BI agregadas, com gate `fn_bi_can_view_dashboard` |
| `vw_auditoria_log_completo` / `get_auditoria_sistema` | Consolida múltiplas tabelas de auditoria |
| `fn_qualidade_cadastral_pendencias` + `vw_qc_pendencias_raw` | Varre a base inteira procurando inconsistências |
| `fn_mapa_operacional_ultimas_localizacoes` | Última localização por ativo (padrão `DISTINCT ON`/window) |
| `fn_chamado_interno_dash_*` (kpis, series, fila_risco) | Dashboards com séries temporais |
| `identificar_funcionario_por_descriptor` (v1/v2) | Busca vetorial (`pgvector`) sobre `bd_funcionarios_biometria_facial` — **`[VERIFICAR]`** se existe índice `ivfflat`/`hnsw` |
| `force_update_all_delivery_statuses` | Atualiza **todas** as entregas |
| `merge_duplicate_funcionarios*`, `consolidar_funcionarios_duplicados` | Varreduras com normalização de texto |

**`[VERIFICAR NO BANCO]`** — índice vetorial da biometria (crítico para o totem):
```sql
select indexname, indexdef from pg_indexes
where schemaname='public' and tablename='bd_funcionarios_biometria_facial';
```
Sem índice vetorial, cada identificação facial faz *full scan* com cálculo de distância — o totem fica lento proporcionalmente ao número de funcionários cadastrados.

---

## 11. Roteiro de medição recomendado (nada executado)

```sql
-- 1. Extensão de estatísticas
select * from pg_extension where extname = 'pg_stat_statements';

-- 2. Top 20 queries por tempo total
select substr(query,1,120) as query, calls, round(mean_exec_time::numeric,2) as media_ms,
       round(total_exec_time::numeric,2) as total_ms, rows
from pg_stat_statements order by total_exec_time desc limit 20;

-- 3. Sequential scans em tabelas grandes (falta de índice)
select relname, seq_scan, seq_tup_read, idx_scan, n_live_tup
from pg_stat_user_tables
where schemaname='public' and n_live_tup > 1000
order by seq_tup_read desc limit 25;

-- 4. Índices nunca usados (custo de escrita sem benefício)
select relname, indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
from pg_stat_user_indexes
where schemaname='public' and idx_scan = 0
order by pg_relation_size(indexrelid) desc limit 25;

-- 5. Tabelas com bloat / autovacuum atrasado
select relname, n_dead_tup, n_live_tup,
       round(100.0*n_dead_tup/nullif(n_live_tup,0),1) as pct_dead,
       last_autovacuum, last_autoanalyze
from pg_stat_user_tables where schemaname='public' and n_dead_tup > 1000
order by n_dead_tup desc limit 25;
```

E no Supabase Dashboard: **Reports → Query Performance** e **Database → Advisors (Performance)**.

---

## 12. Conclusão

Não é possível afirmar que existe problema de performance em produção sem os dados de `pg_stat_statements` e do volume real. O que a análise estática permite afirmar:

**Decisões acertadas já tomadas:** code splitting, `manualChunks`, `staleTime` de 5 min, funções de RLS `STABLE`, materialized view para o relatório mais pesado, uso conservador de Realtime, 434 índices, Service Worker com cache-first para assets.

**Pontos que merecem medição antes de qualquer otimização:**
1. Custo real do RLS em `bd_funcionarios` (hoje mascarado pelas policies `USING(true)`).
2. Índice vetorial da biometria facial.
3. `select('*')` nos 57 arquivos sem paginação, especialmente sobre `bd_funcionarios` e `bd_pncp_todas_licitacoes`.
4. `refetchOnWindowFocus` combinado com a revalidação própria de `useAuth`.
5. Recálculo de total de OS por linha em importações em lote.

**Nada foi otimizado.** Qualquer intervenção deve ser precedida de medição e aprovação explícita.
