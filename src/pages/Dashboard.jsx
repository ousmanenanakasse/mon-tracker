import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const MONTHS = ['Jan','Fév','Mars','Avr','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc']
const MFULL = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const CATS = ['Loyer mensuel','Aidat','Eau et Gaz','Internet','Électricité','Nourriture','Transport','Santé','Shopping','Loisirs','Autre']
const CURS = [
  {code:'EUR',sym:'€',flag:'🇪🇺',label:'Euro'},
  {code:'USD',sym:'$',flag:'🇺🇸',label:'Dollar'},
  {code:'TRY',sym:'₺',flag:'🇹🇷',label:'Livre turque'},
  {code:'XOF',sym:'Fr',flag:'🌍',label:'Franc CFA'},
]
const COLORS = ['#1a6b3c','#2196f3','#ff9800','#9c27b0','#e53935','#00bcd4','#8bc34a','#ff5722','#795548','#607d8b','#f06292']

export default function Dashboard() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [expenses, setExpenses] = useState([])
  const [allYearExpenses, setAllYearExpenses] = useState([])
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
  const [newCat, setNewCat] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newAmt, setNewAmt] = useState('')
  const [newCur, setNewCur] = useState('EUR')
  const [editId, setEditId] = useState(null)
  const [editDesc, setEditDesc] = useState('')
  const [editAmt, setEditAmt] = useState('')
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [reportYear, setReportYear] = useState(now.getFullYear())
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (dark) { document.documentElement.classList.add('dark'); localStorage.setItem('theme','dark') }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme','light') }
  }, [dark])

  useEffect(() => {
    loadAll()
    fetchRates()
    const t = setInterval(() => setTime(new Date()), 1000)
    const r = setInterval(fetchRates, 60000)
    return () => { clearInterval(t); clearInterval(r) }
  }, [])

  useEffect(() => { loadExpenses() }, [month, year])
  useEffect(() => { loadYearExpenses() }, [reportYear])

  async function loadAll() {
    loadExpenses()
    loadYearExpenses()
    const { data: b } = await supabase.from('budgets').select('*')
    if (b) setBudgets(b)
    const { data: r } = await supabase.from('recurring').select('*')
    if (r) setRecurring(r)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: s } = await supabase.from('settings').select('*').eq('user_id', user.id).single()
    if (s) {
      setName1(s.name1||''); setName2(s.name2||'')
      setShare(s.share||50); setBaseCur(s.base_cur||'EUR')
      setDispCur(s.base_cur||'EUR'); setNewCur(s.base_cur||'EUR')
    }
  }

  async function loadExpenses() {
    const { data } = await supabase.from('expenses').select('*')
      .eq('month', month).eq('year', year)
      .order('created_at', { ascending: false })
    if (data) setExpenses(data)
  }

  async function loadYearExpenses() {
    const { data } = await supabase.from('expenses').select('*').eq('year', reportYear)
    if (data) setAllYearExpenses(data)
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
      user_id: user.id, name1, name2, share, base_cur: baseCur
    }, { onConflict: 'user_id' })
    setSaveMsg('✅ Sauvegardé!')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  function conv(amount, from) {
    const inEur = amount / (rates[from||baseCur]||1)
    const out = inEur * (rates[dispCur]||1)
    const c = CURS.find(x=>x.code===dispCur)||CURS[0]
    return c.sym+' '+out.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})
  }

  function convRaw(amount, from) {
    return (amount/(rates[from||baseCur]||1))*(rates[dispCur]||1)
  }

  function convNum(amount, from) {
    return parseFloat(convRaw(amount, from).toFixed(2))
  }

  async function addExpense() {
    const amt = parseFloat(newAmt)
    if (!newCat||isNaN(amt)||amt<=0) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('expenses').insert({
      user_id:user.id, category:newCat, description:newDesc,
      amount:amt, month, year, is_recurring:false, currency:newCur
    })
    setNewDesc(''); setNewAmt(''); setNewCat(''); setShowAdd(false)
    loadExpenses()
  }

  async function deleteExpense(id) {
    if (!confirm('Supprimer cette dépense ?')) return
    await supabase.from('expenses').delete().eq('id', id)
    loadExpenses()
  }

  function startEdit(e) {
    setEditId(e.id); setEditDesc(e.description||''); setEditAmt(e.amount.toString())
  }

  async function saveEdit(id) {
    const amt = parseFloat(editAmt)
    if (isNaN(amt)||amt<=0) return
    await supabase.from('expenses').update({description:editDesc, amount:amt}).eq('id',id)
    setEditId(null); loadExpenses()
  }

  async function applyRecurring() {
    const { data: { user } } = await supabase.auth.getUser()
    let added = 0
    for (const r of recurring) {
      const exists = expenses.find(e=>e.category===r.category&&e.description===r.description&&e.is_recurring)
      if (!exists) {
        await supabase.from('expenses').insert({
          user_id:user.id, category:r.category, description:r.description,
          amount:r.amount, month, year, is_recurring:true, currency:baseCur
        })
        added++
      }
    }
    if (added===0) alert('Récurrents déjà chargés!')
    else loadExpenses()
  }

  async function addRecurring() {
    const cat = prompt('Catégorie:'); if (!cat) return
    const desc = prompt('Description (optionnel):')||''
    const amt = parseFloat(prompt('Montant mensuel:'))
    if (isNaN(amt)||amt<=0) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('recurring').insert({user_id:user.id, category:cat, description:desc, amount:amt})
    const { data: r } = await supabase.from('recurring').select('*')
    if (r) setRecurring(r)
  }

  async function deleteRecurring(id) {
    await supabase.from('recurring').delete().eq('id',id)
    const { data: r } = await supabase.from('recurring').select('*')
    if (r) setRecurring(r)
  }

  async function logout() { await supabase.auth.signOut() }

  // PDF Export
  function exportPDF(type) {
    const doc = new jsPDF()
    const curSym = (CURS.find(x=>x.code===dispCur)||CURS[0]).sym
    const fmtAmt = (amt, from) => curSym+' '+convRaw(amt,from).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})

    if (type === 'monthly') {
      // Header
      doc.setFillColor(26, 107, 60)
      doc.rect(0, 0, 220, 30, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.text('BudgetMate 🤝', 14, 12)
      doc.setFontSize(11)
      doc.text(`Rapport mensuel — ${MFULL[month]} ${year}`, 14, 22)
      doc.setTextColor(0, 0, 0)

      // Summary
      doc.setFontSize(10)
      doc.text(`Total: ${fmtAmt(total)}`, 14, 40)
      doc.text(`${n1} (${share}%): ${fmtAmt(s1)}`, 14, 48)
      doc.text(`${n2} (${100-share}%): ${fmtAmt(s2)}`, 14, 56)
      doc.text(`Nombre de dépenses: ${expenses.length}`, 14, 64)

      // Table
      const rows = []
      Object.entries(byCat).forEach(([cat, catRows]) => {
        catRows.forEach(e => {
          rows.push([
            cat,
            e.description || cat,
            fmtAmt(e.amount, e.currency),
            fmtAmt(e.amount*share/100, e.currency),
            fmtAmt(e.amount*(100-share)/100, e.currency),
          ])
        })
        const catTotal = catRows.reduce((s,e)=>s+e.amount,0)
        rows.push(['', `Sous-total ${cat}`, fmtAmt(catTotal), fmtAmt(catTotal*share/100), fmtAmt(catTotal*(100-share)/100)])
      })

      autoTable(doc, {
        startY: 72,
        head: [['Catégorie', 'Description', 'Montant', n1, n2]],
        body: rows,
        headStyles: { fillColor: [26, 107, 60], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 250, 245] },
        styles: { fontSize: 9 },
        didParseCell: (data) => {
          if (data.row.raw[1]?.startsWith('Sous-total')) {
            data.cell.styles.fillColor = [212, 237, 218]
            data.cell.styles.fontStyle = 'bold'
          }
        }
      })

      // Total row
      const finalY = doc.lastAutoTable.finalY + 8
      doc.setFillColor(26, 107, 60)
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(10)
      doc.roundedRect(14, finalY, 182, 10, 2, 2, 'F')
      doc.text(`TOTAL: ${fmtAmt(total)}`, 16, finalY+7)
      doc.text(`${n1}: ${fmtAmt(s1)}`, 80, finalY+7)
      doc.text(`${n2}: ${fmtAmt(s2)}`, 140, finalY+7)

      doc.save(`BudgetMate_${MFULL[month]}_${year}.pdf`)

    } else {
      // Annual PDF
      doc.setFillColor(26, 107, 60)
      doc.rect(0, 0, 220, 30, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.text('BudgetMate 🤝', 14, 12)
      doc.setFontSize(11)
      doc.text(`Rapport annuel — ${reportYear}`, 14, 22)
      doc.setTextColor(0, 0, 0)

      doc.setFontSize(10)
      doc.text(`Total ${reportYear}: ${fmtAmt(yearTotal)}`, 14, 40)
      doc.text(`${n1} (${share}%): ${fmtAmt(yearS1)}`, 14, 48)
      doc.text(`${n2} (${100-share}%): ${fmtAmt(yearS2)}`, 14, 56)

      // Monthly table
      const monthRows = MONTHS.map((m,i) => {
        const mTotal = allYearExpenses.filter(e=>e.month===i).reduce((s,e)=>s+(e.amount||0),0)
        return [MFULL[i], mTotal>0?fmtAmt(mTotal):'—', mTotal>0?fmtAmt(mTotal*share/100):'—', mTotal>0?fmtAmt(mTotal*(100-share)/100):'—']
      })

      autoTable(doc, {
        startY: 64,
        head: [['Mois', 'Total', n1, n2]],
        body: monthRows,
        headStyles: { fillColor: [26, 107, 60], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 250, 245] },
        styles: { fontSize: 9 },
      })

      // Category table
      doc.addPage()
      doc.setFontSize(13)
      doc.setTextColor(26, 107, 60)
      doc.text(`Total par catégorie — ${reportYear}`, 14, 20)
      doc.setTextColor(0,0,0)

      const catRows = yearCatData.map(d => [
        d.name,
        fmtAmt(yearByCat[d.name]),
        fmtAmt(yearByCat[d.name]*share/100),
        fmtAmt(yearByCat[d.name]*(100-share)/100),
        yearTotal>0?(yearByCat[d.name]/yearTotal*100).toFixed(1)+'%':'—'
      ])

      autoTable(doc, {
        startY: 28,
        head: [['Catégorie', 'Total', n1, n2, '% du total']],
        body: catRows,
        headStyles: { fillColor: [26, 107, 60], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 250, 245] },
        styles: { fontSize: 9 },
      })

      doc.save(`BudgetMate_Annuel_${reportYear}.pdf`)
    }
  }

  const total = expenses.reduce((s,e)=>s+(e.amount||0),0)
  const s1 = total*share/100
  const s2 = total*(100-share)/100

  // Search filter
  const filteredExpenses = search.trim()===''
    ? expenses
    : expenses.filter(e=>
        e.category.toLowerCase().includes(search.toLowerCase()) ||
        (e.description||'').toLowerCase().includes(search.toLowerCase())
      )

  const byCat = filteredExpenses.reduce((acc,e)=>{
    if (!acc[e.category]) acc[e.category]=[]
    acc[e.category].push(e)
    return acc
  },{})

  const allCats = [...new Set([...CATS,...expenses.map(e=>e.category)])]
  const n1 = name1||'Personne 1'
  const n2 = name2||'Personne 2'
  const pieData = Object.entries(expenses.reduce((acc,e)=>{
    if (!acc[e.category]) acc[e.category]=0
    acc[e.category]+=e.amount||0
    return acc
  },{})).map(([cat,amt])=>({name:cat,value:parseFloat(convRaw(amt).toFixed(2))}))

  const curSym = (CURS.find(x=>x.code===dispCur)||CURS[0]).sym
  const years = Array.from({length:11},(_,i)=>2024+i)

  const yearTotal = allYearExpenses.reduce((s,e)=>s+(e.amount||0),0)
  const yearS1 = yearTotal*share/100
  const yearS2 = yearTotal*(100-share)/100

  const monthlyData = MONTHS.map((m,i)=>{
    const mExp = allYearExpenses.filter(e=>e.month===i)
    const mTotal = mExp.reduce((s,e)=>s+(e.amount||0),0)
    return {
      name:m,
      total:convNum(mTotal),
      [n1]:convNum(mTotal*share/100),
      [n2]:convNum(mTotal*(100-share)/100),
    }
  })

  const yearByCat = allYearExpenses.reduce((acc,e)=>{
    if (!acc[e.category]) acc[e.category]=0
    acc[e.category]+=e.amount||0
    return acc
  },{})

  const yearCatData = Object.entries(yearByCat)
    .map(([cat,amt])=>({name:cat,value:convNum(amt)}))
    .sort((a,b)=>b.value-a.value)

  // Dark mode
  const card = dark?'bg-gray-800 border-gray-700':'bg-white border-gray-100'
  const cardBorder = dark?'bg-gray-800 border-gray-700':'bg-white border-gray-200'
  const input = dark?'bg-gray-700 border-gray-600 text-white placeholder-gray-400':'bg-white border-gray-200 text-gray-900'
  const select = dark?'bg-gray-700 border-gray-600 text-white':'bg-white border-gray-200 text-gray-900'
  const textPrimary = dark?'text-gray-100':'text-gray-800'
  const textSecondary = dark?'text-gray-400':'text-gray-500'
  const rowEven = dark?'bg-gray-800':'bg-white'
  const rowOdd = dark?'bg-gray-900':'bg-gray-50'
  const sectionRow = dark?'bg-gray-700 text-green-400':'bg-green-50 text-green-800'
  const subtotalRow = dark?'bg-gray-700 text-green-400':'bg-green-100 text-green-800'
  const tabActive = 'bg-green-700 text-white'
  const tabInactive = dark?'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700':'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
  const tooltipStyle = {background:dark?'#1f2937':'#fff',border:'none',borderRadius:'8px',color:dark?'#f9fafb':'#111'}

  return (
    <div className={`min-h-screen ${dark?'bg-gray-900':'bg-gray-50'}`}>
      {/* NAVBAR */}
      <nav className="bg-green-700 text-white px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-lg font-semibold">🤝 BudgetMate</div>
          <div className="text-xs opacity-75">
            {time.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} · {time.toLocaleTimeString('fr-FR')}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {CURS.map(c=>(
              <button key={c.code} onClick={()=>setDispCur(c.code)}
                className={`px-2 py-1 rounded text-xs font-medium ${dispCur===c.code?'bg-white text-green-700':'bg-green-800 hover:bg-green-600'}`}>
                {c.flag} {c.code}
              </button>
            ))}
          </div>
          <button onClick={()=>setDark(!dark)} className="bg-green-800 hover:bg-green-600 px-3 py-1 rounded text-sm">
            {dark?'☀️':'🌙'}
          </button>
          <button onClick={logout} className="bg-green-800 hover:bg-green-900 px-3 py-1 rounded text-xs">
            Déconnexion
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-4">
        {/* SUMMARY */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            {label:`Total ${MONTHS[month]}`,val:conv(total),color:textPrimary},
            {label:`${n1} (${share}%)`,val:conv(s1),color:'text-green-600'},
            {label:`${n2} (${100-share}%)`,val:conv(s2),color:'text-blue-500'},
            {label:'Entrées',val:expenses.length+' dépenses',color:textSecondary},
          ].map((c,i)=>(
            <div key={i} className={`${card} rounded-xl p-4 shadow-sm border`}>
              <div className={`text-xs ${textSecondary} mb-1`}>{c.label}</div>
              <div className={`text-base font-semibold ${c.color}`}>{c.val}</div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            {id:'depenses',label:'📋 Dépenses'},
            {id:'graphiques',label:'📊 Graphiques'},
            {id:'rapport',label:'📅 Rapport Annuel'},
            {id:'budget',label:'🎯 Budget'},
            {id:'recurrents',label:'↺ Récurrents'},
            {id:'historique',label:'👥 Historique'},
            {id:'reglages',label:'⚙️ Réglages'},
          ].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${tab===t.id?tabActive:tabInactive}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* DEPENSES */}
        {tab==='depenses' && (
          <div>
            <div className="flex gap-2 mb-4 flex-wrap items-center">
              <select value={month} onChange={e=>setMonth(parseInt(e.target.value))}
                className={`${select} border rounded-lg px-3 py-2 text-sm`}>
                {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
              </select>
              <select value={year} onChange={e=>setYear(parseInt(e.target.value))}
                className={`${select} border rounded-lg px-3 py-2 text-sm`}>
                {years.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={()=>setShowAdd(!showAdd)}
                className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800">
                + Ajouter
              </button>
              <button onClick={applyRecurring}
                className={`${cardBorder} border px-4 py-2 rounded-lg text-sm ${textSecondary}`}>
                ↺ Récurrents
              </button>
              <button onClick={()=>exportPDF('monthly')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                📤 PDF
              </button>
              <div className={`flex items-center gap-2 ${cardBorder} border rounded-lg px-3 py-2`}>
                <span className={`text-xs ${textSecondary}`}>{n1}</span>
                <input type="range" min="0" max="100" step="5" value={share}
                  onChange={e=>setShare(parseInt(e.target.value))} className="w-20"/>
                <span className={`text-xs ${textSecondary}`}>{n2}</span>
                <span className={`text-xs ${textSecondary}`}>{share}%/{100-share}%</span>
              </div>
            </div>

            {/* SEARCH BAR */}
            <div className="mb-4 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder="Rechercher une dépense ou catégorie..."
                value={search}
                onChange={e=>setSearch(e.target.value)}
                className={`w-full ${input} border rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500`}
              />
              {search && (
                <button onClick={()=>setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">
                  ×
                </button>
              )}
            </div>

            {search && (
              <div className={`mb-3 text-xs ${textSecondary}`}>
                {filteredExpenses.length} résultat{filteredExpenses.length!==1?'s':''} pour "<span className="font-medium text-green-600">{search}</span>"
              </div>
            )}

            {showAdd && (
              <div className={`${cardBorder} border rounded-xl p-4 mb-4 shadow-sm`}>
                <h3 className={`text-sm font-medium ${textPrimary} mb-3`}>Nouvelle dépense</h3>
                <div className="flex gap-2 flex-wrap">
                  <div className="flex-1 min-w-32">
                    <input type="text" placeholder="Catégorie..." value={newCat}
                      onChange={e=>setNewCat(e.target.value)} list="cat-suggestions"
                      className={`w-full ${input} border rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500`}/>
                    <datalist id="cat-suggestions">
                      {allCats.map(c=><option key={c} value={c}/>)}
                    </datalist>
                  </div>
                  <input type="text" placeholder="Description (optionnel)" value={newDesc}
                    onChange={e=>setNewDesc(e.target.value)}
                    className={`${input} border rounded-lg px-3 py-2 text-sm flex-1 min-w-32 outline-none focus:border-green-500`}/>
                  <div className={`flex rounded-lg border ${dark?'border-gray-600':'border-gray-200'} overflow-hidden`}>
                    <select value={newCur} onChange={e=>setNewCur(e.target.value)}
                      className={`${dark?'bg-gray-600 text-white':'bg-gray-50 text-gray-600'} border-r ${dark?'border-gray-500':'border-gray-200'} px-2 py-2 text-sm outline-none`}>
                      {CURS.map(c=><option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                    </select>
                    <input type="number" placeholder="Montant" value={newAmt}
                      onChange={e=>setNewAmt(e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&addExpense()}
                      className={`${dark?'bg-gray-700 text-white':'bg-white'} px-3 py-2 text-sm outline-none w-28`}/>
                  </div>
                  <button onClick={addExpense}
                    className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800">
                    Ajouter
                  </button>
                  <button onClick={()=>setShowAdd(false)}
                    className={`${dark?'bg-gray-700 text-gray-300':'bg-gray-100 text-gray-600'} px-4 py-2 rounded-lg text-sm`}>
                    Annuler
                  </button>
                </div>
              </div>
            )}

            <div className={`${cardBorder} border rounded-xl overflow-hidden shadow-sm`}>
              {filteredExpenses.length===0 ? (
                <div className={`p-8 text-center ${textSecondary} text-sm`}>
                  {search ? `Aucun résultat pour "${search}"` : `Aucune dépense pour ${MFULL[month]} ${year}. Cliquez "+ Ajouter" !`}
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
                      {Object.entries(byCat).map(([cat,rows])=>(
                        <>
                          <tr key={cat} className={sectionRow}>
                            <td colSpan="5" className="px-4 py-2 text-xs font-semibold uppercase tracking-wide">{cat}</td>
                          </tr>
                          {rows.map((e,i)=>(
                            <tr key={e.id} className={i%2===0?rowEven:rowOdd}>
                              <td className={`px-4 py-2 ${textPrimary}`}>
                                {editId===e.id ? (
                                  <input type="text" value={editDesc} onChange={ev=>setEditDesc(ev.target.value)}
                                    className={`${input} border rounded px-2 py-1 text-sm outline-none w-full`}/>
                                ) : (
                                  <>{e.description||cat}{e.is_recurring&&<span className="ml-2 text-xs bg-green-100 text-green-700 px-1 rounded">↺</span>}</>
                                )}
                              </td>
                              <td className={`px-4 py-2 text-right ${textPrimary}`}>
                                {editId===e.id ? (
                                  <input type="number" value={editAmt}
                                    onChange={ev=>setEditAmt(ev.target.value)}
                                    onKeyDown={ev=>ev.key==='Enter'&&saveEdit(e.id)}
                                    className={`${input} border rounded px-2 py-1 text-sm outline-none w-28 text-right`}/>
                                ) : conv(e.amount,e.currency)}
                              </td>
                              <td className="px-4 py-2 text-right text-green-600">
                                {editId===e.id?'—':conv(e.amount*share/100,e.currency)}
                              </td>
                              <td className="px-4 py-2 text-right text-blue-500">
                                {editId===e.id?'—':conv(e.amount*(100-share)/100,e.currency)}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {editId===e.id ? (
                                  <div className="flex gap-1 justify-end">
                                    <button onClick={()=>saveEdit(e.id)} className="text-xs bg-green-700 text-white px-2 py-1 rounded">✓</button>
                                    <button onClick={()=>setEditId(null)} className={`text-xs ${dark?'bg-gray-600 text-gray-300':'bg-gray-200 text-gray-600'} px-2 py-1 rounded`}>✗</button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1 justify-end">
                                    <button onClick={()=>startEdit(e)} className="text-gray-400 hover:text-green-600 px-1">✏️</button>
                                    <button onClick={()=>deleteExpense(e.id)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                          <tr className={subtotalRow}>
                            <td className="px-4 py-2 text-xs font-medium">Sous-total {cat}</td>
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

        {/* GRAPHIQUES */}
        {tab==='graphiques' && (
          <div className="space-y-6">
            {expenses.length===0 ? (
              <div className={`${cardBorder} border rounded-xl p-8 text-center ${textSecondary} text-sm`}>
                Ajoutez des dépenses pour voir les graphiques !
              </div>
            ) : (
              <>
                <div className={`${cardBorder} border rounded-xl p-6 shadow-sm`}>
                  <h2 className={`text-base font-semibold ${textPrimary} mb-1`}>🥧 Répartition par catégorie</h2>
                  <p className={`text-xs ${textSecondary} mb-4`}>{MFULL[month]} {year}</p>
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" outerRadius={110} dataKey="value"
                          label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}>
                          {pieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                        </Pie>
                        <Tooltip formatter={val=>`${curSym} ${val.toLocaleString('fr-FR')}`} contentStyle={tooltipStyle}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2 min-w-48">
                      {pieData.map((d,i)=>(
                        <div key={d.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{background:COLORS[i%COLORS.length]}}></div>
                          <span className={`text-xs ${textSecondary} flex-1`}>{d.name}</span>
                          <span className={`text-xs font-medium ${textPrimary}`}>{curSym} {d.value.toLocaleString('fr-FR')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={`${cardBorder} border rounded-xl p-6 shadow-sm`}>
                  <h2 className={`text-base font-semibold ${textPrimary} mb-1`}>📊 Dépenses par catégorie</h2>
                  <p className={`text-xs ${textSecondary} mb-4`}>{MFULL[month]} {year}</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={pieData} margin={{top:5,right:20,left:10,bottom:60}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark?'#374151':'#f0f0f0'}/>
                      <XAxis dataKey="name" tick={{fontSize:11,fill:dark?'#9ca3af':'#6b7280'}} angle={-35} textAnchor="end"/>
                      <YAxis tick={{fontSize:11,fill:dark?'#9ca3af':'#6b7280'}} tickFormatter={v=>`${curSym}${v.toLocaleString('fr-FR')}`}/>
                      <Tooltip formatter={val=>[`${curSym} ${val.toLocaleString('fr-FR')}`,'Montant']} contentStyle={tooltipStyle}/>
                      <Bar dataKey="value" radius={[4,4,0,0]}>
                        {pieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className={`${cardBorder} border rounded-xl p-6 shadow-sm`}>
                  <h2 className={`text-base font-semibold ${textPrimary} mb-1`}>👥 Partage {n1} vs {n2}</h2>
                  <p className={`text-xs ${textSecondary} mb-4`}>{share}% / {100-share}%</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={[
                      {name:n1,montant:convNum(s1)},
                      {name:n2,montant:convNum(s2)},
                    ]} margin={{top:5,right:20,left:10,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark?'#374151':'#f0f0f0'}/>
                      <XAxis dataKey="name" tick={{fontSize:13,fontWeight:500,fill:dark?'#9ca3af':'#6b7280'}}/>
                      <YAxis tick={{fontSize:11,fill:dark?'#9ca3af':'#6b7280'}} tickFormatter={v=>`${curSym}${v.toLocaleString('fr-FR')}`}/>
                      <Tooltip formatter={val=>[`${curSym} ${val.toLocaleString('fr-FR')}`,'Montant']} contentStyle={tooltipStyle}/>
                      <Bar dataKey="montant" radius={[6,6,0,0]}>
                        <Cell fill="#1a6b3c"/><Cell fill="#2196f3"/>
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex justify-around mt-3">
                    <div className="text-center">
                      <div className={`text-xs ${textSecondary}`}>{n1}</div>
                      <div className="text-base font-semibold text-green-600">{conv(s1)}</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-xs ${textSecondary}`}>{n2}</div>
                      <div className="text-base font-semibold text-blue-500">{conv(s2)}</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* RAPPORT ANNUEL */}
        {tab==='rapport' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 flex-wrap">
              <label className={`text-sm font-medium ${textPrimary}`}>Année :</label>
              <select value={reportYear} onChange={e=>setReportYear(parseInt(e.target.value))}
                className={`${select} border rounded-lg px-3 py-2 text-sm`}>
                {years.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={()=>exportPDF('annual')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                📤 Exporter PDF annuel
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {label:`Total ${reportYear}`,val:conv(yearTotal),color:textPrimary},
                {label:`${n1} (${share}%)`,val:conv(yearS1),color:'text-green-600'},
                {label:`${n2} (${100-share}%)`,val:conv(yearS2),color:'text-blue-500'},
                {label:'Mois actifs',val:MONTHS.filter((_,i)=>allYearExpenses.some(e=>e.month===i)).length+' / 12',color:textSecondary},
              ].map((c,i)=>(
                <div key={i} className={`${card} rounded-xl p-4 shadow-sm border`}>
                  <div className={`text-xs ${textSecondary} mb-1`}>{c.label}</div>
                  <div className={`text-base font-semibold ${c.color}`}>{c.val}</div>
                </div>
              ))}
            </div>

            {allYearExpenses.length===0 ? (
              <div className={`${cardBorder} border rounded-xl p-8 text-center ${textSecondary} text-sm`}>
                Aucune dépense pour {reportYear}.
              </div>
            ) : (
              <>
                <div className={`${cardBorder} border rounded-xl p-6 shadow-sm`}>
                  <h2 className={`text-base font-semibold ${textPrimary} mb-1`}>📈 Évolution mensuelle {reportYear}</h2>
                  <p className={`text-xs ${textSecondary} mb-4`}>Total des dépenses mois par mois</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={monthlyData} margin={{top:5,right:20,left:10,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark?'#374151':'#f0f0f0'}/>
                      <XAxis dataKey="name" tick={{fontSize:11,fill:dark?'#9ca3af':'#6b7280'}}/>
                      <YAxis tick={{fontSize:11,fill:dark?'#9ca3af':'#6b7280'}} tickFormatter={v=>`${curSym}${v.toLocaleString('fr-FR')}`}/>
                      <Tooltip formatter={val=>[`${curSym} ${parseFloat(val).toLocaleString('fr-FR')}`]} contentStyle={tooltipStyle}/>
                      <Legend/>
                      <Line type="monotone" dataKey="total" stroke="#1a6b3c" strokeWidth={2} dot={{r:4}} name="Total"/>
                      <Line type="monotone" dataKey={n1} stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" dot={{r:3}}/>
                      <Line type="monotone" dataKey={n2} stroke="#2196f3" strokeWidth={2} strokeDasharray="5 5" dot={{r:3}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className={`${cardBorder} border rounded-xl p-6 shadow-sm`}>
                  <h2 className={`text-base font-semibold ${textPrimary} mb-1`}>📊 Dépenses par mois {reportYear}</h2>
                  <p className={`text-xs ${textSecondary} mb-4`}>{n1} vs {n2}</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthlyData} margin={{top:5,right:20,left:10,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark?'#374151':'#f0f0f0'}/>
                      <XAxis dataKey="name" tick={{fontSize:11,fill:dark?'#9ca3af':'#6b7280'}}/>
                      <YAxis tick={{fontSize:11,fill:dark?'#9ca3af':'#6b7280'}} tickFormatter={v=>`${curSym}${v.toLocaleString('fr-FR')}`}/>
                      <Tooltip formatter={val=>[`${curSym} ${parseFloat(val).toLocaleString('fr-FR')}`]} contentStyle={tooltipStyle}/>
                      <Legend/>
                      <Bar dataKey={n1} fill="#1a6b3c" radius={[3,3,0,0]}/>
                      <Bar dataKey={n2} fill="#2196f3" radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className={`${cardBorder} border rounded-xl overflow-hidden shadow-sm`}>
                  <div className="px-6 py-4">
                    <h2 className={`text-base font-semibold ${textPrimary}`}>📅 Tous les mois — {reportYear}</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-green-700 text-white">
                        <tr>
                          <th className="text-left px-4 py-3">Mois</th>
                          <th className="text-right px-4 py-3">Total</th>
                          <th className="text-right px-4 py-3">{n1}</th>
                          <th className="text-right px-4 py-3">{n2}</th>
                          <th className="text-right px-4 py-3">Entrées</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MONTHS.map((m,i)=>{
                          const mExp = allYearExpenses.filter(e=>e.month===i)
                          const mTotal = mExp.reduce((s,e)=>s+(e.amount||0),0)
                          return (
                            <tr key={i} className={i%2===0?rowEven:rowOdd}>
                              <td className={`px-4 py-3 font-medium ${textPrimary}`}>
                                {MFULL[i]}
                                {i===now.getMonth()&&reportYear===now.getFullYear()&&
                                  <span className="ml-2 text-xs bg-green-100 text-green-700 px-1 rounded">En cours</span>}
                              </td>
                              <td className={`px-4 py-3 text-right ${mTotal>0?textPrimary:textSecondary}`}>
                                {mTotal>0?conv(mTotal):'—'}
                              </td>
                              <td className={`px-4 py-3 text-right ${mTotal>0?'text-green-600':textSecondary}`}>
                                {mTotal>0?conv(mTotal*share/100):'—'}
                              </td>
                              <td className={`px-4 py-3 text-right ${mTotal>0?'text-blue-500':textSecondary}`}>
                                {mTotal>0?conv(mTotal*(100-share)/100):'—'}
                              </td>
                              <td className={`px-4 py-3 text-right ${textSecondary}`}>
                                {mExp.length>0?mExp.length+' dép.':'—'}
                              </td>
                            </tr>
                          )
                        })}
                        <tr className="bg-green-700 text-white font-semibold">
                          <td className="px-4 py-3">TOTAL {reportYear}</td>
                          <td className="px-4 py-3 text-right">{conv(yearTotal)}</td>
                          <td className="px-4 py-3 text-right">{conv(yearS1)}</td>
                          <td className="px-4 py-3 text-right">{conv(yearS2)}</td>
                          <td className="px-4 py-3 text-right">{allYearExpenses.length} dép.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className={`${cardBorder} border rounded-xl overflow-hidden shadow-sm`}>
                  <div className="px-6 py-4">
                    <h2 className={`text-base font-semibold ${textPrimary}`}>🗂️ Total par catégorie — {reportYear}</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-green-700 text-white">
                        <tr>
                          <th className="text-left px-4 py-3">Catégorie</th>
                          <th className="text-right px-4 py-3">Total annuel</th>
                          <th className="text-right px-4 py-3">{n1}</th>
                          <th className="text-right px-4 py-3">{n2}</th>
                          <th className="text-right px-4 py-3">% du total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yearCatData.map((d,i)=>(
                          <tr key={d.name} className={i%2===0?rowEven:rowOdd}>
                            <td className={`px-4 py-3 font-medium ${textPrimary}`}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{background:COLORS[i%COLORS.length]}}></div>
                                {d.name}
                              </div>
                            </td>
                            <td className={`px-4 py-3 text-right ${textPrimary}`}>{conv(yearByCat[d.name])}</td>
                            <td className="px-4 py-3 text-right text-green-600">{conv(yearByCat[d.name]*share/100)}</td>
                            <td className="px-4 py-3 text-right text-blue-500">{conv(yearByCat[d.name]*(100-share)/100)}</td>
                            <td className={`px-4 py-3 text-right ${textSecondary}`}>
                              {yearTotal>0?(yearByCat[d.name]/yearTotal*100).toFixed(1)+'%':'—'}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-green-700 text-white font-semibold">
                          <td className="px-4 py-3">TOTAL</td>
                          <td className="px-4 py-3 text-right">{conv(yearTotal)}</td>
                          <td className="px-4 py-3 text-right">{conv(yearS1)}</td>
                          <td className="px-4 py-3 text-right">{conv(yearS2)}</td>
                          <td className="px-4 py-3 text-right">100%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* BUDGET */}
        {tab==='budget' && (
          <div className={`${cardBorder} border rounded-xl p-6 shadow-sm`}>
            <h2 className={`text-base font-semibold ${textPrimary} mb-2`}>🎯 Limites de budget</h2>
            <p className={`text-xs ${textSecondary} mb-5`}>Tapez une limite pour chaque catégorie.</p>
            {allCats.map(cat=>{
              const spent = expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0)
              const bud = budgets.find(b=>b.category===cat)
              const limit = bud?.limit_amount||0
              const pct = limit?Math.min(spent/limit*100,100):0
              const color = pct>=100?'bg-red-500':pct>=75?'bg-orange-400':'bg-green-500'
              return (
                <div key={cat} className="mb-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${textPrimary}`}>{cat}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${textSecondary}`}>{conv(spent)}</span>
                      <span className={`text-xs ${textSecondary}`}>/</span>
                      <input type="number" placeholder="Limite" defaultValue={limit||''}
                        onBlur={async e=>{
                          const val = parseFloat(e.target.value)
                          if (isNaN(val)) return
                          const { data:{user} } = await supabase.auth.getUser()
                          if (bud) { await supabase.from('budgets').update({limit_amount:val}).eq('id',bud.id) }
                          else { await supabase.from('budgets').insert({user_id:user.id,category:cat,limit_amount:val}) }
                          const {data:b} = await supabase.from('budgets').select('*')
                          if(b) setBudgets(b)
                        }}
                        className={`${input} border rounded px-2 py-1 text-xs w-24 text-right outline-none`}/>
                    </div>
                  </div>
                  {limit>0&&(
                    <>
                      <div className={`h-2 ${dark?'bg-gray-700':'bg-gray-100'} rounded-full overflow-hidden`}>
                        <div className={`h-full rounded-full transition-all ${color}`} style={{width:`${pct}%`}}></div>
                      </div>
                      <p className={`text-xs mt-1 ${pct>=100?'text-red-500':textSecondary}`}>
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
        {tab==='recurrents' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-base font-semibold ${textPrimary}`}>↺ Dépenses récurrentes</h2>
              <button onClick={addRecurring} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800">
                + Ajouter récurrent
              </button>
            </div>
            <div className="bg-blue-900 bg-opacity-20 rounded-lg p-3 mb-4 text-xs text-blue-400">
              Ces dépenses se répètent chaque mois. Cliquez "↺ Récurrents" pour les charger automatiquement.
            </div>
            {recurring.length===0 ? (
              <div className={`${cardBorder} border rounded-xl p-8 text-center ${textSecondary} text-sm`}>
                Aucun récurrent. Ajoutez votre loyer, internet, électricité...
              </div>
            ) : (
              <div className={`${cardBorder} border rounded-xl overflow-hidden shadow-sm`}>
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
                    {recurring.map((r,i)=>(
                      <tr key={r.id} className={i%2===0?rowEven:rowOdd}>
                        <td className={`px-4 py-3 font-medium ${textPrimary}`}>{r.category}</td>
                        <td className={`px-4 py-3 ${textSecondary}`}>{r.description||'—'}</td>
                        <td className="px-4 py-3 text-right text-green-600">{conv(r.amount)}</td>
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
        {tab==='historique' && (
          <div>
            <h2 className={`text-base font-semibold ${textPrimary} mb-4`}>👥 Historique des partages</h2>
            <div className={`${cardBorder} border rounded-xl overflow-hidden shadow-sm`}>
              <table className="w-full text-sm">
                <thead className="bg-green-700 text-white">
                  <tr>
                    <th className="text-left px-4 py-3">Mois</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-right px-4 py-3">{n1}</th>
                    <th className="text-right px-4 py-3">{n2}</th>
                  </tr>
                </thead>
                <tbody>
                  {MONTHS.map((m,i)=>{
                    const mTotal = expenses.filter(e=>e.month===i).reduce((s,e)=>s+e.amount,0)
                    if (mTotal===0) return null
                    return (
                      <tr key={i} className={i%2===0?rowEven:rowOdd}>
                        <td className={`px-4 py-3 font-medium ${textPrimary}`}>{MFULL[i]} {year}</td>
                        <td className={`px-4 py-3 text-right ${textPrimary}`}>{conv(mTotal)}</td>
                        <td className="px-4 py-3 text-right text-green-600">{conv(mTotal*share/100)}</td>
                        <td className="px-4 py-3 text-right text-blue-500">{conv(mTotal*(100-share)/100)}</td>
                      </tr>
                    )
                  })}
                  {expenses.length===0&&(
                    <tr><td colSpan="4" className={`px-4 py-8 text-center ${textSecondary} text-sm`}>
                      L'historique apparaîtra ici au fur et à mesure.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REGLAGES */}
        {tab==='reglages' && (
          <div className={`${cardBorder} border rounded-xl p-6 shadow-sm max-w-md`}>
            <h2 className={`text-base font-semibold ${textPrimary} mb-5`}>⚙️ Réglages</h2>
            {[
              {label:'Nom personne 1',val:name1,set:setName1,ph:'Ex: Ousmane'},
              {label:'Nom personne 2',val:name2,set:setName2,ph:'Ex: Doucoure'},
            ].map(f=>(
              <div key={f.label} className="mb-4">
                <label className={`text-xs ${textSecondary} block mb-1`}>{f.label}</label>
                <input type="text" value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph}
                  className={`w-full ${input} border rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500`}/>
              </div>
            ))}
            <div className="mb-4">
              <label className={`text-xs ${textSecondary} block mb-1`}>Partage par défaut</label>
              <div className="flex items-center gap-3">
                <span className={`text-xs ${textSecondary}`}>{n1}</span>
                <input type="range" min="0" max="100" step="5" value={share}
                  onChange={e=>setShare(parseInt(e.target.value))} className="flex-1"/>
                <span className={`text-xs ${textSecondary}`}>{n2}</span>
                <span className={`text-xs font-medium ${textPrimary}`}>{share}%/{100-share}%</span>
              </div>
            </div>
            <div className="mb-4">
              <label className={`text-xs ${textSecondary} block mb-1`}>Devise de base</label>
              <select value={baseCur} onChange={e=>setBaseCur(e.target.value)}
                className={`w-full ${select} border rounded-lg px-3 py-2 text-sm outline-none`}>
                {CURS.map(c=><option key={c.code} value={c.code}>{c.flag} {c.label} ({c.sym})</option>)}
              </select>
            </div>
            <div className="mb-5">
              <label className={`text-xs ${textSecondary} block mb-1`}>Thème</label>
              <button onClick={()=>setDark(!dark)}
                className={`w-full ${dark?'bg-gray-700 text-yellow-300':'bg-gray-100 text-gray-700'} border ${dark?'border-gray-600':'border-gray-200'} rounded-lg px-3 py-2 text-sm font-medium`}>
                {dark?'☀️ Passer en mode clair':'🌙 Passer en mode sombre'}
              </button>
            </div>
            <button onClick={saveSettings}
              className="w-full bg-green-700 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-800">
              💾 Sauvegarder les réglages
            </button>
            {saveMsg&&<p className="text-xs text-green-500 mt-2 text-center">{saveMsg}</p>}
          </div>
        )}
      </div>
    </div>
  )
}