import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const MONTHS = ['Jan','Fév','Mars','Avr','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc']
const MFULL = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const CATS = ['Loyer mensuel','Aidat','Eau et Gaz','Internet','Électricité','Nourriture','Transport','Autre']
const CURS = [
  {code:'EUR',sym:'€',flag:'🇪🇺',label:'Euro'},
  {code:'USD',sym:'$',flag:'🇺🇸',label:'Dollar'},
  {code:'TRY',sym:'₺',flag:'🇹🇷',label:'Livre turque'},
  {code:'XOF',sym:'Fr',flag:'🌍',label:'Franc CFA'},
]

export default function Dashboard() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [expenses, setExpenses] = useState([])
  const [budgets, setBudgets] = useState([])
  const [recurring, setRecurring] = useState([])
  const [rates, setRates] = useState({EUR:1,USD:1.08,TRY:35,XOF:655})
  const [dispCur, setDispCur] = useState('EUR')
  const [baseCur, setBaseCur] = useState('EUR')
  const [share, setShare] = useState(50)
  const [name1, setName1] = useState('')
  const [name2, setName2] = useState('')
  const [tab, setTab] = useState('depenses')
  const [time, setTime] = useState(new Date())
  const [showAdd, setShowAdd] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [newCat, setNewCat] = useState(CATS[0])
  const [newDesc, setNewDesc] = useState('')
  const [newAmt, setNewAmt] = useState('')
  const [newCur, setNewCur] = useState('EUR')

  useEffect(() => {
    loadAll()
    fetchRates()
    const t = setInterval(() => setTime(new Date()), 1000)
    const r = setInterval(fetchRates, 60000)
    return () => { clearInterval(t); clearInterval(r) }
  }, [])

  useEffect(() => { loadExpenses() }, [month, year])

  async function loadAll() {
    loadExpenses()
    const { data: b } = await supabase.from('budgets').select('*')
    if (b) setBudgets(b)
    const { data: r } = await supabase.from('recurring').select('*')
    if (r) setRecurring(r)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: s } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .single()
    if (s) {
      setName1(s.name1 || '')
      setName2(s.name2 || '')
      setShare(s.share || 50)
      setBaseCur(s.base_cur || 'EUR')
      setDispCur(s.base_cur || 'EUR')
      setNewCur(s.base_cur || 'EUR')
    }
  }

  async function loadExpenses() {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('month', month)
      .eq('year', year)
      .order('created_at', { ascending: false })
    if (data) setExpenses(data)
  }

  async function fetchRates() {
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/EUR')
      const d = await r.json()
      if (d.rates) setRates({EUR:1,USD:d.rates.USD,TRY:d.rates.TRY,XOF:d.rates.XOF})
    } catch(e) {}
  }

  async function saveSettings() {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('settings').upsert({
      user_id: user.id,
      name1, name2, share,
      base_cur: baseCur
    }, { onConflict: 'user_id' })
    setSaveMsg('✅ Sauvegardé!')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  function conv(amount, from) {
    const fromCur = from || baseCur
    const inEur = amount / (rates[fromCur] || 1)
    const out = inEur * (rates[dispCur] || 1)
    const c = CURS.find(x => x.code === dispCur) || CURS[0]
    return c.sym + ' ' + out.toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2})
  }

  async function addExpense() {
    const amt = parseFloat(newAmt)
    if (!newCat || isNaN(amt) || amt <= 0) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('expenses').insert({
      user_id: user.id, category: newCat,
      description: newDesc, amount: amt,
      month, year, is_recurring: false,
      currency: newCur
    })
    setNewDesc(''); setNewAmt(''); setShowAdd(false)
    loadExpenses()
  }

  async function deleteExpense(id) {
    if (!confirm('Supprimer cette dépense ?')) return
    await supabase.from('expenses').delete().eq('id', id)
    loadExpenses()
  }

  async function applyRecurring() {
    const { data: { user } } = await supabase.auth.getUser()
    let added = 0
    for (const r of recurring) {
      const exists = expenses.find(e =>
        e.category === r.category &&
        e.description === r.description &&
        e.is_recurring
      )
      if (!exists) {
        await supabase.from('expenses').insert({
          user_id: user.id, category: r.category,
          description: r.description, amount: r.amount,
          month, year, is_recurring: true
        })
        added++
      }
    }
    if (added === 0) alert('Récurrents déjà chargés pour ce mois!')
    else loadExpenses()
  }

  async function addRecurring() {
    const cat = prompt('Catégorie:')
    if (!cat) return
    const desc = prompt('Description (optionnel):') || ''
    const amt = parseFloat(prompt('Montant mensuel:'))
    if (isNaN(amt) || amt <= 0) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('recurring').insert({
      user_id: user.id, category: cat,
      description: desc, amount: amt
    })
    const { data: r } = await supabase.from('recurring').select('*')
    if (r) setRecurring(r)
  }

  async function deleteRecurring(id) {
    await supabase.from('recurring').delete().eq('id', id)
    const { data: r } = await supabase.from('recurring').select('*')
    if (r) setRecurring(r)
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const s1 = total * share / 100
  const s2 = total * (100 - share) / 100
  const byCat = expenses.reduce((acc, e) => {
    if (!acc[e.category]) acc[e.category] = []
    acc[e.category].push(e)
    return acc
  }, {})

  const n1 = name1 || 'Personne 1'
  const n2 = name2 || 'Personne 2'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAVBAR */}
      <nav className="bg-green-700 text-white px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-lg font-semibold">💰 Mon Tracker</div>
          <div className="text-xs opacity-75">
            {time.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} · {time.toLocaleTimeString('fr-FR')}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {CURS.map(c => (
              <button key={c.code} onClick={() => setDispCur(c.code)}
                className={`px-2 py-1 rounded text-xs font-medium ${dispCur===c.code?'bg-white text-green-700':'bg-green-800 hover:bg-green-600'}`}>
                {c.flag} {c.code}
              </button>
            ))}
          </div>
          <button onClick={logout}
            className="bg-green-800 hover:bg-green-900 px-3 py-1 rounded text-xs">
            Déconnexion
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-4">
        {/* SUMMARY */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            {label:`Total ${MONTHS[month]}`,val:conv(total),color:'text-gray-800'},
            {label:`${n1} (${share}%)`,val:conv(s1),color:'text-green-700'},
            {label:`${n2} (${100-share}%)`,val:conv(s2),color:'text-blue-600'},
            {label:'Entrées',val:expenses.length+' dépenses',color:'text-gray-600'},
          ].map((c,i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="text-xs text-gray-500 mb-1">{c.label}</div>
              <div className={`text-base font-semibold ${c.color}`}>{c.val}</div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            {id:'depenses',label:'📋 Dépenses'},
            {id:'budget',label:'🎯 Budget'},
            {id:'recurrents',label:'↺ Récurrents'},
            {id:'historique',label:'👥 Historique'},
            {id:'reglages',label:'⚙️ Réglages'},
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab===t.id?'bg-green-700 text-white':'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* DEPENSES */}
        {tab === 'depenses' && (
          <div>
            <div className="flex gap-2 mb-4 flex-wrap items-center">
              <select value={month} onChange={e=>setMonth(parseInt(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
              </select>
              <select value={year} onChange={e=>setYear(parseInt(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={() => setShowAdd(!showAdd)}
                className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800">
                + Ajouter
              </button>
              <button onClick={applyRecurring}
                className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                ↺ Récurrents
              </button>
              <div className="flex items-center gap-2 text-sm bg-white border border-gray-200 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-500">{n1}</span>
                <input type="range" min="0" max="100" step="5" value={share}
                  onChange={e=>setShare(parseInt(e.target.value))} className="w-20"/>
                <span className="text-xs text-gray-500">{n2}</span>
                <span className="text-xs text-gray-400">{share}%/{100-share}%</span>
              </div>
            </div>

            {showAdd && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 shadow-sm">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Nouvelle dépense</h3>
                <div className="flex gap-2 flex-wrap">
                  <select value={newCat} onChange={e=>setNewCat(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-32">
                    {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="text" placeholder="Description" value={newDesc}
                    onChange={e=>setNewDesc(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-32 outline-none focus:border-green-500"/>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                    <select value={newCur} onChange={e=>setNewCur(e.target.value)}
                      className="bg-gray-50 border-r border-gray-200 px-2 py-2 text-sm outline-none text-gray-600">
                      {CURS.map(c=><option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                    </select>
                    <input type="number" placeholder="Montant" value={newAmt}
                      onChange={e=>setNewAmt(e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&addExpense()}
                      className="px-3 py-2 text-sm outline-none w-28"/>
                  </div>
                  <button onClick={addExpense}
                    className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800">
                    Ajouter
                  </button>
                  <button onClick={()=>setShowAdd(false)}
                    className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-200">
                    Annuler
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              {expenses.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  Aucune dépense pour {MFULL[month]} {year}. Cliquez "+ Ajouter" !
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-green-700 text-white">
                      <tr>
                        <th className="text-left px-4 py-3">Description</th>
                        <th className="text-right px-4 py-3">Montant</th>
                        <th className="text-right px-4 py-3">{n1}</th>
                        <th className="text-right px-4 py-3">{n2}</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(byCat).map(([cat, rows]) => (
                        <>
                          <tr key={cat} className="bg-green-50">
                            <td colSpan="5" className="px-4 py-2 text-xs font-semibold text-green-800 uppercase tracking-wide">
                              {cat}
                            </td>
                          </tr>
                          {rows.map((e,i) => (
                            <tr key={e.id} className={i%2===0?'bg-white':'bg-gray-50'}>
                              <td className="px-4 py-2 text-gray-700">
                                {e.description || cat}
                                {e.is_recurring && <span className="ml-2 text-xs bg-green-100 text-green-700 px-1 rounded">↺</span>}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-700">{conv(e.amount, e.currency)}</td>
                              <td className="px-4 py-2 text-right text-green-700">{conv(e.amount*share/100, e.currency)}</td>
                              <td className="px-4 py-2 text-right text-blue-600">{conv(e.amount*(100-share)/100, e.currency)}</td>
                              <td className="px-4 py-2 text-right">
                                <button onClick={()=>deleteExpense(e.id)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-green-100 font-medium text-green-800">
                            <td className="px-4 py-2 text-xs">Sous-total {cat}</td>
                            <td className="px-4 py-2 text-right text-xs">{conv(rows.reduce((s,e)=>s+e.amount,0))}</td>
                            <td className="px-4 py-2 text-right text-xs">{conv(rows.reduce((s,e)=>s+e.amount,0)*share/100)}</td>
                            <td className="px-4 py-2 text-right text-xs">{conv(rows.reduce((s,e)=>s+e.amount,0)*(100-share)/100)}</td>
                            <td></td>
                          </tr>
                        </>
                      ))}
                      <tr className="bg-green-700 text-white font-semibold">
                        <td className="px-4 py-3">TOTAL</td>
                        <td className="px-4 py-3 text-right">{conv(total)}</td>
                        <td className="px-4 py-3 text-right">{conv(s1)}</td>
                        <td className="px-4 py-3 text-right">{conv(s2)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BUDGET */}
        {tab === 'budget' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4">🎯 Limites de budget</h2>
            {CATS.map(cat => {
              const spent = expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0)
              const bud = budgets.find(b=>b.category===cat)
              const limit = bud?.limit_amount || 0
              const pct = limit ? Math.min(spent/limit*100,100) : 0
              const color = pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-orange-400' : 'bg-green-500'
              return (
                <div key={cat} className="mb-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{cat}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{conv(spent)}</span>
                      <span className="text-xs text-gray-400">/</span>
                      <input type="number" placeholder="Limite" defaultValue={limit||''}
                        onBlur={async e => {
                          const val = parseFloat(e.target.value)
                          if (isNaN(val)) return
                          const { data:{user} } = await supabase.auth.getUser()
                          if (bud) {
                            await supabase.from('budgets').update({limit_amount:val}).eq('id',bud.id)
                          } else {
                            await supabase.from('budgets').insert({user_id:user.id,category:cat,limit_amount:val})
                          }
                          const {data:b} = await supabase.from('budgets').select('*')
                          if(b) setBudgets(b)
                        }}
                        className="border border-gray-200 rounded px-2 py-1 text-xs w-24 text-right outline-none focus:border-green-500"/>
                    </div>
                  </div>
                  {limit > 0 && (
                    <>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${color}`} style={{width:`${pct}%`}}></div>
                      </div>
                      <p className={`text-xs mt-1 ${pct>=100?'text-red-500':'text-gray-400'}`}>
                        {Math.round(pct)}% utilisé {pct>=100?'⚠️ Dépassé!':pct>=75?'· Attention':''}
                      </p>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* RECURRENTS */}
        {tab === 'recurrents' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold text-gray-800">↺ Dépenses récurrentes</h2>
              <button onClick={addRecurring}
                className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800">
                + Ajouter récurrent
              </button>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 mb-4 text-xs text-blue-700">
              Ces dépenses se répètent chaque mois. Cliquez "↺ Récurrents" dans l'onglet Dépenses pour les charger automatiquement.
            </div>
            {recurring.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
                Aucun récurrent. Ajoutez votre loyer, internet, etc.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-green-700 text-white">
                    <tr>
                      <th className="text-left px-4 py-3">Catégorie</th>
                      <th className="text-left px-4 py-3">Description</th>
                      <th className="text-right px-4 py-3">Montant/mois</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurring.map((r,i) => (
                      <tr key={r.id} className={i%2===0?'bg-white':'bg-gray-50'}>
                        <td className="px-4 py-3 font-medium text-gray-700">{r.category}</td>
                        <td className="px-4 py-3 text-gray-500">{r.description||'—'}</td>
                        <td className="px-4 py-3 text-right text-green-700">{conv(r.amount)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={()=>deleteRecurring(r.id)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* HISTORIQUE */}
        {tab === 'historique' && (
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-4">👥 Historique des partages</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {[2024,2025,2026,2027].map(y => {
                const yTotal = expenses.filter(e=>e.year===y).reduce((s,e)=>s+e.amount,0)
                return yTotal > 0 ? (
                  <div key={y} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">Total {y}</div>
                    <div className="text-base font-semibold text-gray-800">{conv(yTotal)}</div>
                    <div className="text-xs text-green-700 mt-1">{n1}: {conv(yTotal*share/100)}</div>
                    <div className="text-xs text-blue-600">{n2}: {conv(yTotal*(100-share)/100)}</div>
                  </div>
                ) : null
              })}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
              L'historique complet apparaîtra ici au fur et à mesure que vous ajoutez des dépenses chaque mois.
            </div>
          </div>
        )}

        {/* REGLAGES */}
        {tab === 'reglages' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm max-w-md">
            <h2 className="text-base font-semibold text-gray-800 mb-5">⚙️ Réglages</h2>
            <div className="mb-4">
              <label className="text-xs text-gray-500 block mb-1">Nom personne 1</label>
              <input type="text" value={name1} onChange={e=>setName1(e.target.value)}
                placeholder="Ex: Ousmane"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500"/>
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-500 block mb-1">Nom personne 2</label>
              <input type="text" value={name2} onChange={e=>setName2(e.target.value)}
                placeholder="Ex: Doucoure"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500"/>
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-500 block mb-1">Partage par défaut</label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{name1||'P1'}</span>
                <input type="range" min="0" max="100" step="5" value={share}
                  onChange={e=>setShare(parseInt(e.target.value))} className="flex-1"/>
                <span className="text-xs text-gray-500">{name2||'P2'}</span>
                <span className="text-xs font-medium text-gray-700">{share}%/{100-share}%</span>
              </div>
            </div>
            <div className="mb-5">
              <label className="text-xs text-gray-500 block mb-1">Devise de base</label>
              <select value={baseCur} onChange={e=>setBaseCur(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500">
                {CURS.map(c=><option key={c.code} value={c.code}>{c.flag} {c.label} ({c.sym})</option>)}
              </select>
            </div>
            <button onClick={saveSettings}
              className="w-full bg-green-700 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-800">
              💾 Sauvegarder les réglages
            </button>
            {saveMsg && <p className="text-xs text-green-600 mt-2 text-center">{saveMsg}</p>}
          </div>
        )}
      </div>
    </div>
  )
}