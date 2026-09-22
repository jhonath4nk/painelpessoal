import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrations = join(root, 'supabase', 'migrations')
const files = readdirSync(migrations).filter(name => /^\d+.*\.sql$/.test(name)).sort()
const header = `-- EVOLUÇÃO PESSOAL — INSTALAÇÃO INICIAL
-- Cole TODO este arquivo no SQL Editor do seu projeto Supabase e clique Run.
-- Uma transação aplica modelo, segurança e integridade juntos.
-- Não modifica auth.users nem cria senhas. Contas existentes recebem um perfil.
-- Não execute em projeto com instalação parcial: o bloqueio abaixo evita sobrescritas.
begin;
do $$
begin
  if to_regclass('public.profiles') is not null
     or to_regtype('public.item_status') is not null then
    raise exception 'Instalação já iniciada ou concluída. Execute verificar_instalacao.sql antes de continuar. Nenhum dado foi alterado.';
  end if;
end;
$$;
`
const body = files.map(name => `\n-- ===== ${name} =====\n` + readFileSync(join(migrations, name), 'utf8')
  .replace(/^\s*(begin|commit);\s*$/gim, '')).join('\n')
writeFileSync(join(root, 'supabase', 'instalar.sql'), header + body + '\ncommit;\n', 'utf8')
console.log(`Instalador preparado com ${files.length} migrações; nenhuma conexão ao banco foi feita.`)
