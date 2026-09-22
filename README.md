# Evolução pessoal

Aplicação pessoal para acompanhar **consistência diária** e **evolução de objetivos**, separadamente. React, Vite, TypeScript, CSS e Supabase. Hospedagem futura no GitHub Pages, sem backend separado.

## Estado atual — fase 3 (local)

Implementado localmente:

- Tela de login, recuperação de senha e sessão persistente com Supabase Auth.
- Rotas protegidas e leitura do perfil do usuário autenticado.
- Tratamento dos links de autenticação antes do HashRouter.
- Quatro migrações SQL: modelo, RLS, integridade dos registros diários e sincronização da rotina.
- Layout responsivo com Dashboard, Hoje, Atividades, Ofensiva e Minha conta.
- Criação e edição de ofensivas, incluindo arquivamento e consulta aos períodos anteriores.
- Recorrências diárias, dias da semana, meta semanal com dias planejados, pontuais e manuais.
- Edição da rotina com vigência futura e snapshots que preservam os nomes e pesos históricos.
- Marcação, remoção/restauração e edição apenas no planejamento de Hoje.
- Notas diárias, energia e humor opcionais.
- Sincronização idempotente de dias sem acesso e resumos persistidos, inclusive sem planejamento.
- Métricas de tempo e execução separadas, médias semanais/mensais, sequências e gráfico diário.
- Testes executáveis do PostgreSQL/RLS com dois usuários em PGlite (apenas desenvolvimento).
- Workflow preparado para validar e publicar no GitHub Pages no futuro.

Ainda não implementado: CRUD da hierarquia de jornadas/objetivos/tarefas, gestão específica de hábitos, página de histórico com filtros e notas passadas, revisão semanal, backlog e exportação. O dashboard calcula progresso hierárquico de registros existentes, mas a interface para gerenciá-los pertence à fase 4. Essas próximas funcionalidades continuam nas fases 4–6.

**Não houve push nem publicação.** O usuário confirmou a instalação inicial e o login com leitura do perfil no Supabase real. Para habilitar a fase 3 no mesmo projeto, execute somente `supabase/migrations/004_daily_tracking.sql`, uma vez. A atualização não apaga dados. Não execute novamente o instalador inicial. A confirmação da atualização e o fluxo completo da fase 3 na conta real ainda dependem da aplicação desse SQL; os testes locais não equivalem a essa validação remota.

## Jornadas

Jornadas acompanham metas de médio e longo prazo e são separadas da rotina diária. Cada jornada contém apenas etapas ordenadas. O progresso é `etapas concluídas ÷ total de etapas`; ele nunca altera percentual diário, sequência, médias ou ofensiva.

Para habilitá-las em um projeto já instalado, execute uma vez [005_journey_steps.sql](supabase/migrations/005_journey_steps.sql) no SQL Editor do Supabase. A migração reutiliza a tabela `journeys` existente e cria somente `journey_steps`, com RLS, índices e conclusão automática da jornada. Não reaplique as migrações anteriores.

## Usar a fase 3

1. Após aplicar a migração 004, atualize a aplicação local. Se aparecer o aviso de banco pendente, clique em **Verificar atualização**.
2. Em **Ofensiva**, crie o período, informando nome, data inicial e duração. Apenas uma ofensiva pode ficar em andamento. A interface aceita de 1 a 36.500 dias.
3. Em **Atividades**, cadastre sua rotina. Novas rotinas começam hoje ou em data futura; não criam falhas retroativas. Para meta semanal, selecione os dias e a quantidade de dias será a meta.
4. Em **Hoje**, marque as atividades. Você também pode adicionar algo pontual, editar o nome apenas naquele dia, remover e restaurar um item do planejamento.
5. No **Dashboard**, confira os números. Hoje é parcial; médias consolidadas excluem o dia atual e dias sem planejamento.

Editar a rotina vale a partir de amanhã ou da data futura selecionada. Para mudar apenas hoje, use Hoje. Arquivar interrompe datas futuras e preserva o planejamento de hoje e o histórico. A sincronização considera os períodos de vigência salvos, inclusive se você não tiver aberto o aplicativo por vários dias. A página verifica a virada do dia no fuso do perfil a cada 30 segundos e ao retornar à janela.

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

Para uma instalação inicial em projeto novo, abra `supabase/instalar.sql`, copie todo o conteúdo para o SQL Editor e clique **Run**. O arquivo reúne as quatro migrações em uma única transação: tabelas e políticas ficam prontas juntas. Ele cria o perfil das contas já cadastradas em Authentication, sem alterar login ou senha. Se detectar instalação anterior, interrompe sem sobrescrever dados.

Depois, execute `supabase/verificar_instalacao.sql`. A primeira consulta deve mostrar 16 tabelas com `existe`, `rls_ativa` e `anon_sem_acesso` verdadeiros. A segunda deve mostrar as três funções privadas com `frontend_pode_executar` falso.

O instalador é gerado por `node scripts/prepare-database.mjs`. Os arquivos individuais continuam sendo a fonte versionada:

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_security.sql`
3. `supabase/migrations/003_integrity.sql`
4. `supabase/migrations/004_daily_tracking.sql`

Use o instalador reunido **ou** os arquivos individuais em ordem; nunca os dois. Se falhar, corrija a causa antes de continuar. Não reaplique uma migração bem-sucedida: futuras alterações terão novos arquivos. Para inspecionar um projeto existente, confira primeiro as tabelas e funções antes de aplicar estes scripts. A configuração administrativa e migrações nunca são feitas usando a chave pública no navegador.

Em um projeto novo, prefira o instalador atômico. Em projetos existentes, aplique apenas as novas migrações, sem repetir as já executadas.

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
- Dias sem qualquer ocorrência recebem resumo com percentual nulo, excluído das médias. Dias planejados sem execução recebem zero.
- `sync_tracking` sincroniza períodos de até 366 dias por chamada, sempre limitados ao dia atual no fuso do perfil. A interface divide períodos maiores em blocos, sem truncar o histórico.
- RPCs de criação/edição da rotina são transacionais e validam o proprietário a partir de `auth.uid()`, sem aceitar um usuário arbitrário informado pelo cliente.
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

O usuário confirmou login e leitura do perfil reais. Recuperação por e-mail e isolamento real entre duas contas ainda devem ser conferidos com contas de teste autorizadas. Na fase 3, testar criação de ofensiva, atividade, conclusão, recarga e persistência das notas após aplicar a migração 004. Os testes de PostgreSQL cobrem os RPCs sem gravar dados pessoais reais.

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
src/features/tracking/   dashboard, rotina, ofensivas e Hoje
src/domain/              datas, execução, sequências e progresso
src/lib/                 configuração e cliente Supabase
src/styles/              CSS responsivo
supabase/migrations/     SQL versionado
tests/                   segurança, integridade e autenticação
.github/workflows/       validação e publicação futura
```

As pastas das próximas funcionalidades serão criadas quando houver código correspondente.

## Próximas fases

- Fase 3 implementada localmente: aguarda validação final na conta real após aplicar a atualização SQL.
- Fase 4: hierarquia e progresso de jornadas, objetivos, tarefas e subtarefas.
- Fase 5: hábitos, histórico, revisão e comparações.
- Fase 6: backlog, ajustes completos e exportações JSON/CSV.

O GitHub versiona o código, não os registros pessoais. Exportação e backup dos dados serão documentados separadamente.

