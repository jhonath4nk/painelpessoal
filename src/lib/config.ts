export function validateConfig(url: string | undefined, key: string | undefined) {
  if (!url || !key) return 'Configure a URL e a chave pública do Supabase para conectar sua conta.'
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
      return 'A URL do Supabase deve usar HTTPS.'
    }
  } catch { return 'A URL do Supabase é inválida.' }
  if (key.startsWith('sb_secret_')) return 'Use somente a chave pública/publicável do Supabase.'
  if (key.split('.').length === 3) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (payload.role !== 'anon') return 'Use somente a chave anon ou publicável do Supabase.'
    } catch { return 'A chave pública do Supabase é inválida.' }
  } else if (!key.startsWith('sb_publishable_')) {
    return 'Use uma chave publicável (sb_publishable_) ou a chave anon legada.'
  }
  return null
}
