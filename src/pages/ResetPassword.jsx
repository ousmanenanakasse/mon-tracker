import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('error')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
  }, [])

  async function handleReset() {
    if (password !== confirm) {
      setMsg('Les mots de passe ne correspondent pas!')
      setMsgType('error')
      return
    }
    if (password.length < 6) {
      setMsg('Le mot de passe doit avoir au moins 6 caracteres!')
      setMsgType('error')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setMsg(error.message); setMsgType('error') }
    else {
      setMsg('Mot de passe mis a jour avec succes!')
      setMsgType('success')
      setTimeout(() => window.location.href = '/', 2000)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🔐</div>
          <h1 className="text-2xl font-semibold text-gray-800">Nouveau mot de passe</h1>
          <p className="text-gray-500 text-sm mt-1">Choisissez un nouveau mot de passe</p>
        </div>

        {!ready ? (
          <div className="text-center text-gray-500 text-sm">
            <div className="text-2xl mb-3">⏳</div>
            Verification du lien en cours...
          </div>
        ) : (
          <>
            <input type="password" placeholder="Nouveau mot de passe"
              className="w-full border border-gray-200 rounded-xl p-3 mb-3 text-sm outline-none focus:border-green-500"
              value={password} onChange={e => setPassword(e.target.value)}/>
            <input type="password" placeholder="Confirmer le mot de passe"
              className="w-full border border-gray-200 rounded-xl p-3 mb-4 text-sm outline-none focus:border-green-500"
              value={confirm} onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleReset()}/>
            <button onClick={handleReset} disabled={loading}
              className="w-full bg-green-700 hover:bg-green-800 text-white rounded-xl p-3 text-sm font-medium transition disabled:opacity-50">
              {loading ? 'Chargement...' : 'Mettre a jour le mot de passe'}
            </button>
          </>
        )}

        {msg && (
          <p className={`mt-4 text-sm text-center ${msgType==='success'?'text-green-600':'text-red-500'}`}>
            {msg}
          </p>
        )}
      </div>
    </div>
  )
}