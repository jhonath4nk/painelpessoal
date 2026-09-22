# Evolução pessoal

Aplicação pessoal para acompanhar **consistência diária** e **evolução de objetivos**, separadamente. React, Vite, TypeScript, CSS e Supabase. Hospedagem futura no GitHub Pages, sem backend separado.

## Estado atual — fase 2

Implementado localmente:

- Tela de login, recuperação de senha e sessão persistente com Supabase Auth.
- Rotas protegidas e leitura do perfil do usuário autenticado.
- Tratamento dos links de autenticação antes do HashRouter.
- Três migrações SQL: modelo, RLS e integridade dos registros diários.
- Testes executáveis do PostgreSQL/RLS com dois usuários em PGlite (apenas desenvolvimento).
- Workflow preparado para validar e publicar no GitHub Pages no futuro.

Ainda não implementado: dashboard, criação da ofensiva na interface, Hoje, CRUD da hierarquia, sincronização retroativa das recorrências, progresso hierárquico, hábitos, histórico, revisão e exportação. Essas funções serão construídas nas fases 3–6. O modelo do banco está preparado; isso não significa que todas as regras dessas fases já estejam implementadas.

**Nesta entrega não houve push nem publicação. As migrações ainda precisam ser aplicadas ao Supabase real.**

## Requisitos

- Node.js 22.12+ (recomendado Node 24 LTS).
- npm.
- Projeto Supabase para autenticação e persistência reais.

Não é necessário Docker, Supabase local, servidor próprio ou Firebase.

## Executar localmente

Enquanto o projeto não estiver no GitHub, abra esta pasta diretamente. Depois da publicação do código, será possível clonar o repositório e executar os mesmos passos.

```sh
npm ci
```

Copie `.env.example` para `.env.local` e configure:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA-CHAVE-PUBLICAVEL
VITE_BASE_PATH=/
```

```sh
npm run dev
```

Abra o endereço informado pelo Vite. O servidor escuta somente em `127.0.0.1`. Os valores `VITE_*` são públicos e incorporados ao build. Nunca use `service_role`, `sb_secret_*`, senha do banco ou token administrativo. `.env.local` não é versionado; `.env.example` não contém valores reais.

Sem configuração válida, a aplicação apresenta instruções de configuração, sem dados fictícios nem autenticação simulada. Com URL/chave válidas, apresenta login; é necessário preparar o banco e a conta para entrar.

## Preparar Supabase

Para a instalação inicial, abra `supabase/instalar.sql`, copie todo o conteúdo para o SQL Editor do projeto e clique **Run**. O arquivo reúne as três migrações em uma única transação: tabelas e políticas ficam prontas juntas. Ele cria o perfil das contas já cadastradas em Authentication, sem alterar login ou senha. Se detectar instalação anterior, interrompe sem sobrescrever dados.

Depois, execute `supabase/verificar_instalacao.sql`. A primeira consulta deve mostrar 16 tabelas com `existe`, `rls_ativa` e `anon_sem_acesso` verdadeiros. A segunda deve mostrar as três funções privadas com `frontend_pode_executar` falso.

O instalador é gerado por `node scripts/prepare-database.mjs`. Os arquivos individuais continuam sendo a fonte versionada:

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_security.sql`
3. `supabase/migrations/003_integrity.sql`

Use o instalador reunido **ou** os arquivos individuais em ordem; nunca os dois. Se falhar, corrija a causa antes de continuar. Não reaplique uma migração bem-sucedida: futuras alterações terão novos arquivos. Para inspecionar um projeto existente, confira primeiro as tabelas e funções antes de aplicar estes scripts. A configuração administrativa e migrações nunca são feitas usando a chave pública no navegador.

As tabelas são criadas na primeira migração; as políticas e permissões na segunda. Aplique as três em sequência antes de disponibilizar o aplicativo a qualquer usuário.

Em Authentication:

1. Mantenha o provedor de e-mail/senha habilitado.
2. Desative novos cadastros públicos para uso pessoal.
3. Crie sua conta em Users pelo painel administrativo. A senha é definida por você, fora do código e do chat. O trigger cria `profiles` automaticamente.
4. Configure Site URL e Redirect URLs para `http://localhost:5173/` durante desenvolvimento.
5. Depois do deploy, configure também `https://jhonath4nk.github.io/painelpessoal/`. Use a URL base, sem `#/login`, para callbacks de autenticação.
6. Verifique o envio real de recuperação por e-mail. Limites e destinatários permitidos dependem da configuração do serviço de e-mail do projeto; um teste unitário não substitui esse teste.

Os links de recuperação usam o fluxo implícito do Supabase no navegador. A aplicação registra o evento `PASSWORD_RECOVERY` e consome o fragmento de autenticação antes de iniciar o HashRouter. Não há cadastro público na interface.

## Banco e segurança

Tabelas: profiles, offensives, cycles, journeys, objectives, tasks, subtasks, daily_activities, activity_schedules, daily_activity_logs, daily_summaries, habits, daily_notes, weekly_reviews, backlog_items e activity_events.

- RLS em todas as 16 tabelas; `anon` não lê nem modifica dados pessoais.
- Todas as políticas usam o usuário autenticado como proprietário.
- Chaves estrangeiras compostas impedem relações entre proprietários diferentes.
- Identidade e proprietário de registros são imutáveis.
- Apenas uma ofensiva em andamento por usuário.
- Funções privilegiadas estão no schema privado, com `search_path` fixo e sem execução direta pelo frontend.
- Registros de alteração e resumos não aceitam escrita direta de usuários autenticados.
- Triggers mantêm datas de status e resumos diários dentro da mesma transação.
- Remover item do planejamento usa `skipped`; sua contribuição é excluída do denominador. `planned` não executado representa 0%. Sem peso planejado, percentual é `NULL`.
- Dias sem qualquer ocorrência ainda serão materializados pela sincronização da fase 3. Não interpretar a ausência atual de resumo como regra de calendário implementada.
- Recorrências usam dias ISO (segunda=1, domingo=7) e intervalos inclusivos sem sobreposição. `weekly_target` exige tantos dias planejados quanto a meta semanal.
- Hábitos reutilizam atividade e histórico, sem tabela duplicada de execuções.
- Exclusões com dependências são bloqueadas por foreign keys; arquivamento preserva dados.
- Alterações no banco devem continuar em migrações versionadas.

O log retém versões de registros alterados/excluídos; excluir um item na interface futuramente não deve prometer apagar seu histórico de auditoria. A remoção da conta no Supabase remove os dados associados.

## Verificações

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Ou `npm run check` para executar a sequência. `npm run preview` serve o build local.

Os testes PGlite executam as mesmas migrações SQL em PostgreSQL embarcado e simulam o schema mínimo de Auth e os papéis do Supabase. Não usam banco remoto, não gravam dados reais e não fazem parte do bundle de produção. Cobrem isolamento de usuários, permissões, relacionamentos, restrições, recorrências e percentuais diários. Os testes de autenticação usam um cliente simulado para validar eventos e ordem de inicialização.

Antes de considerar a fase 2 concluída no ambiente real: aplicar migrações, criar a conta, testar login, atualização de página, logout e recuperação por e-mail; verificar isolamento usando duas contas de teste autorizadas. Nunca usar dados pessoais reais nesses testes.

## GitHub Pages — somente quando solicitado

O destino previsto é `jhonath4nk/painelpessoal`. Não é necessário configurar um remote para trabalhar localmente.

1. Envie o projeto ao repositório quando decidir publicá-lo.
2. Em Settings → Pages, escolha GitHub Actions como fonte.
3. Em Settings → Secrets and variables → Actions → Variables, configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Configure `PAGES_ENABLED=true` para habilitar o job de publicação. Sem essa variável, o workflow apenas valida e produz o artefato.
5. Faça push em `main` ou execute manualmente o workflow.

O workflow calcula `/painelpessoal/` automaticamente, executa lint, TypeScript, testes e build e só então publica `dist`. Pull requests executam validação, sem deploy. O repositório informado é privado; confirme que o plano do GitHub permite Pages para repositórios privados antes de habilitar. Não altere a visibilidade do repositório sem decisão explícita.

Migrations SQL não são executadas por esse workflow. Nenhum segredo administrativo é necessário para publicar o frontend.

## Estrutura

```text
src/app/                 composição e rotas
src/features/auth/       login, sessão e perfil
src/lib/                 configuração e cliente Supabase
src/styles/              CSS responsivo
supabase/migrations/     SQL versionado
tests/                   segurança, integridade e autenticação
.github/workflows/       validação e publicação futura
```

As pastas das próximas funcionalidades serão criadas quando houver código correspondente.

## Próximas fases

- Fase 3: ofensiva, layout, dashboard, Hoje e sincronização de recorrências com preservação histórica.
- Fase 4: hierarquia e progresso de jornadas, objetivos, tarefas e subtarefas.
- Fase 5: hábitos, histórico, revisão e comparações.
- Fase 6: backlog, ajustes completos e exportações JSON/CSV.

O GitHub versiona o código, não os registros pessoais. Exportação e backup dos dados serão documentados separadamente.

