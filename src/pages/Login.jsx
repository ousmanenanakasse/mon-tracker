import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    setMsg('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMsg(error.message)
      else setMsg('✅ Vérifiez votre email pour confirmer!')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🤝</div>
          <h1 className="text-2xl font-semibold text-gray-800">BudgetMate</h1>
          <p className="text-gray-500 text-sm mt-1">Gérez vos dépenses mensuelles</p>
        </div>
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
              mode === 'login' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
            Se connecter
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
              mode === 'signup' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
            Créer un compte
          </button>
        </div>
        <input
          type="email"
          placeholder="Email"
          className="w-full border border-gray-200 rounded-xl p-3 mb-3 text-sm outline-none focus:border-green-500"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Mot de passe"
          className="w-full border border-gray-200 rounded-xl p-3 mb-4 text-sm outline-none focus:border-green-500"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-green-700 hover:bg-green-800 text-white rounded-xl p-3 text-sm font-medium transition disabled:opacity-50">
          {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer un compte'}
        </button>
        {msg && <p className="mt-4 text-sm text-center text-red-500">{msg}</p>}
      </div>
    </div>
  )
}