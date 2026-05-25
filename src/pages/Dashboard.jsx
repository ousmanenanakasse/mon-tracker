import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const MONTHS = ['Jan','Fev','Mars','Avr','Mai','Juin','Juil','Aout','Sept','Oct','Nov','Dec']
const MFULL = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre']
const CATS = ['Loyer mensuel','Aidat','Eau et Gaz','Internet','Electricite','Nourriture','Transport','Sante','Shopping','Loisirs','Autre']
const CURS = [
  {code:'EUR',sym:'EUR',flag:'🇪🇺',label:'Euro'},
  {code:'USD',sym:'USD',flag:'🇺🇸',label:'Dollar'},
  {code:'TRY',sym:'TRY',flag:'🇹🇷',label:'Livre turque'},
  {code:'XOF',sym:'XOF',flag:'🌍',label:'Franc CFA'},
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
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [filterCat, setFilterCat] = useState('all')
  const [filterRecurring, setFilterRecurring] = useState('all')
  const [filterMinAmt, setFilterMinAmt] = useState('')
  const [filterMaxAmt, setFilterMaxAmt] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  // Balance states
  const [balance1, setBalance1] = useState(0)
  const [balance2, setBalance2] = useState(0)
  const [balance1Input, setBalance1Input] = useState('')
  const [balance2Input, setBalance2Input] = useState('')
  const [balanceSaved, setBalanceSaved] = useState(false)
  const [lowWarning, setLowWarning] = useState(20)

  useEffect(() => {
    if (dark) { document.documentElement.classList.add('dark'); localStorage.setItem('theme','dark') }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme','light') }
  }, [dark])

  useEffect(() => {
    loadAll(); fetchRates()
    const t = setInterval(() => setTime(new Date()), 1000)
    const r = setInterval(fetchRates, 60000)
    return () => { clearInterval(t); clearInterval(r) }
  }, [])

  useEffect(() => { loadExpenses() }, [month, year])
  useEffect(() => { loadYearExpenses() }, [reportYear])
  useEffect(() => { loadBalances() }, [month, year])

  async function loadAll() {
    loadExpenses(); loadYearExpenses(); loadBalances()
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

  async function loadBalances() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('balances').select('*')
      .eq('user_id', user.id).eq('month', month).eq('year', year)
    if (data) {
      const b1 = data.find(b=>b.person==='person1')
      const b2 = data.find(b=>b.person==='person2')
      if (b1) { setBalance1(b1.amount); setBalance1Input(b1.amount.toString()) }
      else { setBalance1(0); setBalance1Input('') }
      if (b2) { setBalance2(b2.amount); setBalance2Input(b2.amount.toString()) }
      else { setBalance2(0); setBalance2Input('') }
    }
  }

  async function saveBalances() {
    const { data: { user } } = await supabase.auth.getUser()
    const amt1 = parseFloat(balance1Input)||0
    const amt2 = parseFloat(balance2Input)||0
    await supabase.from('balances').upsert({
      user_id:user.id, person:'person1', amount:amt1, month, year
    }, {onConflict:'user_id,person,month,year'})
    await supabase.from('balances').upsert({
      user_id:user.id, person:'person2', amount:amt2, month, year
    }, {onConflict:'user_id,person,month,year'})
    setBalance1(amt1); setBalance2(amt2)
    setBalanceSaved(true)
    setTimeout(()=>setBalanceSaved(false), 2000)
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
    setSaveMsg('Sauvegarde!')
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
    return parseFloat(convRaw(amount,from).toFixed(2))
  }

  function fmtPDF(amt, from) {
    const val = convRaw(amt, from||baseCur)
    const fixed = Math.abs(val).toFixed(2)
    const parts = fixed.split('.')
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return dispCur+' '+intPart+'.'+parts[1]
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
    if (!confirm('Supprimer?')) return
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
    if (added===0) alert('Recurrents deja charges!')
    else loadExpenses()
  }

  async function addRecurring() {
    const cat = prompt('Categorie:'); if (!cat) return
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

  function handleSort(field) {
    if (sortField===field) setSortDir(d=>d==='asc'?'desc':'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function sortIcon(field) {
    if (sortField!==field) return <span className="opacity-30 ml-1">↕</span>
    return <span className="ml-1">{sortDir==='asc'?'↑':'↓'}</span>
  }

  function resetFilters() {
    setSearch(''); setFilterCat('all'); setFilterRecurring('all')
    setFilterMinAmt(''); setFilterMaxAmt(''); setSortField('date'); setSortDir('desc')
  }

  function exportPDF(type) {
    const doc = new jsPDF()
    doc.setFillColor(26,107,60); doc.rect(0,0,220,30,'F')
    doc.setTextColor(255,255,255); doc.setFontSize(18)
    doc.text('BudgetMate', 14, 12); doc.setFontSize(11)

    if (type==='monthly') {
      doc.text('Rapport - '+MONTHS[month]+' '+year, 14, 22)
      const now2 = new Date()
      const dateStr = now2.toLocaleDateString('en-GB').replace(/\//g,'-')
      const timeStr = now2.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})
      doc.text('                                 '+dateStr+' à '+timeStr, 14, 72)
      doc.setTextColor(0,0,0); doc.setFontSize(10)
      doc.text('Total: '+fmtPDF(total), 14, 40)
      doc.text(n1+' ('+share+'%): '+fmtPDF(s1), 14, 48)
      doc.text(n2+' ('+(100-share)+'%): '+fmtPDF(s2), 14, 56)
      const now3 = new Date()
      const dateStr2 = now3.toLocaleDateString('en-GB').replace(/\//g,'-')
      const timeStr2 = now3.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})
      doc.text('                                 '+dateStr2+' à '+timeStr2, 14, 64)
      doc.text('Nb depenses: '+expenses.length, 14, 64)
      if (balance1>0) doc.text('Solde '+n1+': '+fmtPDF(balance1)+' | Restant: '+fmtPDF(balance1-s1), 14, 72)
      if (balance2>0) doc.text('Solde '+n2+': '+fmtPDF(balance2)+' | Restant: '+fmtPDF(balance2-s2), 14, 80)

      const rows = []
      const expByCat = expenses.reduce((acc,e)=>{if(!acc[e.category])acc[e.category]=[];acc[e.category].push(e);return acc},{})
      Object.entries(expByCat).forEach(([cat,catRows])=>{
        catRows.forEach(e=>rows.push([cat,e.description||cat,fmtPDF(e.amount,e.currency),fmtPDF(e.amount*share/100,e.currency),fmtPDF(e.amount*(100-share)/100,e.currency)]))
        const ct=catRows.reduce((s,e)=>s+e.amount,0)
        rows.push(['','Sous-total '+cat,fmtPDF(ct),fmtPDF(ct*share/100),fmtPDF(ct*(100-share)/100)])
      })
      autoTable(doc,{
        startY:balance1>0||balance2>0?88:72,
        head:[['Cat.','Description','Montant',n1,n2]],
        body:rows,
        headStyles:{fillColor:[26,107,60],textColor:255,fontStyle:'bold'},
        alternateRowStyles:{fillColor:[245,250,245]},
        styles:{fontSize:9,font:'helvetica'},
        didParseCell:(data)=>{if(data.row.raw[1]?.startsWith('Sous-total')){data.cell.styles.fillColor=[212,237,218];data.cell.styles.fontStyle='bold'}}
      })
      const fy=doc.lastAutoTable.finalY+8
      doc.setFillColor(26,107,60); doc.setTextColor(255,255,255); doc.setFontSize(10)
      doc.roundedRect(14,fy,182,10,2,2,'F')
      doc.text('TOTAL: '+fmtPDF(total),16,fy+7)
      doc.text(n1+': '+fmtPDF(s1),80,fy+7)
      doc.text(n2+': '+fmtPDF(s2),140,fy+7)
      doc.save('BudgetMate_'+MONTHS[month]+'_'+year+'.pdf')
    } else {
      doc.text('Rapport Annuel - '+reportYear, 14, 22)
      doc.setTextColor(0,0,0); doc.setFontSize(10)
      doc.text('Total '+reportYear+': '+fmtPDF(yearTotal), 14, 40)
      doc.text(n1+' ('+share+'%): '+fmtPDF(yearS1), 14, 48)
      doc.text(n2+' ('+(100-share)+'%): '+fmtPDF(yearS2), 14, 56)
      const monthRows=MONTHS.map((_,i)=>{const mt=allYearExpenses.filter(e=>e.month===i).reduce((s,e)=>s+(e.amount||0),0);return[MONTHS[i],mt>0?fmtPDF(mt):'--',mt>0?fmtPDF(mt*share/100):'--',mt>0?fmtPDF(mt*(100-share)/100):'--']})
      autoTable(doc,{startY:64,head:[['Mois','Total',n1,n2]],body:monthRows,headStyles:{fillColor:[26,107,60],textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[245,250,245]},styles:{fontSize:9,font:'helvetica'}})
      doc.addPage()
      doc.setFontSize(13); doc.setTextColor(26,107,60)
      doc.text('Total par categorie - '+reportYear, 14, 20); doc.setTextColor(0,0,0)
      const catRows=yearCatData.map(d=>[d.name,fmtPDF(yearByCat[d.name]),fmtPDF(yearByCat[d.name]*share/100),fmtPDF(yearByCat[d.name]*(100-share)/100),yearTotal>0?(yearByCat[d.name]/yearTotal*100).toFixed(1)+'%':'--'])
      autoTable(doc,{startY:28,head:[['Categorie','Total',n1,n2,'%']],body:catRows,headStyles:{fillColor:[26,107,60],textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[245,250,245]},styles:{fontSize:9,font:'helvetica'}})
      doc.save('BudgetMate_Annuel_'+reportYear+'.pdf')
    }
  }

  // Filter + Sort
  let processed = [...expenses]
  if (search.trim()) processed = processed.filter(e=>e.category.toLowerCase().includes(search.toLowerCase())||(e.description||'').toLowerCase().includes(search.toLowerCase()))
  if (filterCat!=='all') processed = processed.filter(e=>e.category===filterCat)
  if (filterRecurring==='recurring') processed = processed.filter(e=>e.is_recurring)
  if (filterRecurring==='normal') processed = processed.filter(e=>!e.is_recurring)
  if (filterMinAmt!=='') processed = processed.filter(e=>e.amount>=parseFloat(filterMinAmt))
  if (filterMaxAmt!=='') processed = processed.filter(e=>e.amount<=parseFloat(filterMaxAmt))
  processed.sort((a,b)=>{
    let va,vb
    if (sortField==='amount'){va=a.amount;vb=b.amount}
    else if (sortField==='description'){va=(a.description||a.category).toLowerCase();vb=(b.description||b.category).toLowerCase()}
    else if (sortField==='category'){va=a.category.toLowerCase();vb=b.category.toLowerCase()}
    else{va=new Date(a.created_at);vb=new Date(b.created_at)}
    if(va<vb) return sortDir==='asc'?-1:1
    if(va>vb) return sortDir==='asc'?1:-1
    return 0
  })

  const total = expenses.reduce((s,e)=>s+(e.amount||0),0)
  const s1 = total*share/100
  const s2 = total*(100-share)/100
  const allCats = [...new Set([...CATS,...expenses.map(e=>e.category)])]
  const uniqueCats = [...new Set(expenses.map(e=>e.category))]
  const n1 = name1||'Personne 1'
  const n2 = name2||'Personne 2'
  const pieData = Object.entries(expenses.reduce((acc,e)=>{if(!acc[e.category])acc[e.category]=0;acc[e.category]+=e.amount||0;return acc},{})).map(([cat,amt])=>({name:cat,value:convNum(amt)}))
  const curSym = (CURS.find(x=>x.code===dispCur)||CURS[0]).sym
  const years = Array.from({length:11},(_,i)=>2024+i)
  const yearTotal = allYearExpenses.reduce((s,e)=>s+(e.amount||0),0)
  const yearS1 = yearTotal*share/100
  const yearS2 = yearTotal*(100-share)/100
  const monthlyData = MONTHS.map((m,i)=>{const mExp=allYearExpenses.filter(e=>e.month===i);const mTotal=mExp.reduce((s,e)=>s+(e.amount||0),0);return{name:m,total:convNum(mTotal),[n1]:convNum(mTotal*share/100),[n2]:convNum(mTotal*(100-share)/100)}})
  const yearByCat = allYearExpenses.reduce((acc,e)=>{if(!acc[e.category])acc[e.category]=0;acc[e.category]+=e.amount||0;return acc},{})
  const yearCatData = Object.entries(yearByCat).map(([cat,amt])=>({name:cat,value:convNum(amt)})).sort((a,b)=>b.value-a.value)
  const hasActiveFilters = search||filterCat!=='all'||filterRecurring!=='all'||filterMinAmt||filterMaxAmt

  // Balance calculations
  const remaining1 = balance1 - s1
  const remaining2 = balance2 - s2
  const pct1 = balance1>0 ? Math.min((s1/balance1)*100, 100) : 0
  const pct2 = balance2>0 ? Math.min((s2/balance2)*100, 100) : 0
  const isLow1 = balance1>0 && (remaining1/balance1)*100 < lowWarning
  const isLow2 = balance2>0 && (remaining2/balance2)*100 < lowWarning

  // Dark mode
  const card = dark?'bg-gray-800 border-gray-700':'bg-white border-gray-100'
  const cardBorder = dark?'bg-gray-800 border-gray-700':'bg-white border-gray-200'
  const inp = dark?'bg-gray-700 border-gray-600 text-white placeholder-gray-400':'bg-white border-gray-200 text-gray-900'
  const sel = dark?'bg-gray-700 border-gray-600 text-white':'bg-white border-gray-200 text-gray-900'
  const tp = dark?'text-gray-100':'text-gray-800'
  const ts = dark?'text-gray-400':'text-gray-500'
  const re = dark?'bg-gray-800':'bg-white'
  const ro = dark?'bg-gray-900':'bg-gray-50'
  const ta = 'bg-green-700 text-white'
  const ti = dark?'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700':'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
  const tts = {background:dark?'#1f2937':'#fff',border:'none',borderRadius:'8px',color:dark?'#f9fafb':'#111'}

  return (
    <div className={`min-h-screen ${dark?'bg-gray-900':'bg-gray-50'}`}>
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
          <button onClick={()=>setDark(!dark)} className="bg-green-800 hover:bg-green-600 px-3 py-1 rounded text-sm">{dark?'☀️':'🌙'}</button>
          <button onClick={logout} className="bg-green-800 hover:bg-green-900 px-3 py-1 rounded text-xs">Deconnexion</button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-4">

        {/* BALANCE CARDS */}
        {(balance1>0||balance2>0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {[
              {name:n1,balance:balance1,spent:s1,remaining:remaining1,pct:pct1,isLow:isLow1},
              {name:n2,balance:balance2,spent:s2,remaining:remaining2,pct:pct2,isLow:isLow2},
            ].map((p,i)=>(
              p.balance>0 && (
                <div key={i} className={`${cardBorder} border rounded-xl p-4 shadow-sm ${p.isLow?'border-red-400':''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`text-sm font-semibold ${tp}`}>{p.name}</div>
                    {p.isLow && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">⚠️ Solde bas!</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div>
                      <div className={`text-xs ${ts} mb-0.5`}>Solde</div>
                      <div className={`text-sm font-semibold ${tp}`}>{conv(p.balance)}</div>
                    </div>
                    <div>
                      <div className={`text-xs ${ts} mb-0.5`}>Depense</div>
                      <div className="text-sm font-semibold text-red-500">-{conv(p.spent)}</div>
                    </div>
                    <div>
                      <div className={`text-xs ${ts} mb-0.5`}>Restant</div>
                      <div className={`text-sm font-semibold ${p.remaining<0?'text-red-500':p.isLow?'text-orange-500':'text-green-600'}`}>
                        {p.remaining>=0?'+':''}{conv(p.remaining)}
                      </div>
                    </div>
                  </div>
                  <div className={`h-2 ${dark?'bg-gray-700':'bg-gray-100'} rounded-full overflow-hidden`}>
                    <div className={`h-full rounded-full transition-all ${p.pct>=100?'bg-red-500':p.pct>=80?'bg-orange-400':p.isLow?'bg-yellow-400':'bg-green-500'}`}
                      style={{width:`${p.pct}%`}}></div>
                  </div>
                  <div className={`text-xs mt-1 ${ts}`}>{Math.round(p.pct)}% du solde depense</div>
                </div>
              )
            ))}
          </div>
        )}

        {/* SUMMARY */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            {label:'Total '+MONTHS[month],val:conv(total),color:tp},
            {label:n1+' ('+share+'%)',val:conv(s1),color:'text-green-600'},
            {label:n2+' ('+(100-share)+'%)',val:conv(s2),color:'text-blue-500'},
            {label:'Entrees',val:expenses.length+' depenses',color:ts},
          ].map((c,i)=>(
            <div key={i} className={`${card} rounded-xl p-4 shadow-sm border`}>
              <div className={`text-xs ${ts} mb-1`}>{c.label}</div>
              <div className={`text-base font-semibold ${c.color}`}>{c.val}</div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            {id:'depenses',label:'📋 Depenses'},
            {id:'solde',label:'💰 Solde'},
            {id:'graphiques',label:'📊 Graphiques'},
            {id:'rapport',label:'📅 Rapport Annuel'},
            {id:'budget',label:'🎯 Budget'},
            {id:'recurrents',label:'↺ Recurrents'},
            {id:'historique',label:'👥 Historique'},
            {id:'reglages',label:'⚙️ Reglages'},
          ].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${tab===t.id?ta:ti}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* SOLDE TAB */}
        {tab==='solde' && (
          <div className="space-y-4">
            <div className={`${cardBorder} border rounded-xl p-6 shadow-sm`}>
              <h2 className={`text-base font-semibold ${tp} mb-1`}>💰 Solde du compte</h2>
              <p className={`text-xs ${ts} mb-5`}>Entrez le solde actuel de chaque personne pour {MONTHS[month]} {year}.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
                {[
                  {name:n1,val:balance1Input,set:setBalance1Input,spent:s1,bal:balance1},
                  {name:n2,val:balance2Input,set:setBalance2Input,spent:s2,bal:balance2},
                ].map((p,i)=>(
                  <div key={i} className={`${dark?'bg-gray-700':'bg-gray-50'} rounded-xl p-4`}>
                    <label className={`text-sm font-medium ${tp} block mb-2`}>{p.name}</label>
                    <div className={`flex rounded-lg border ${dark?'border-gray-600':'border-gray-200'} overflow-hidden mb-3`}>
                      <span className={`${dark?'bg-gray-600 text-gray-300':'bg-gray-100 text-gray-500'} px-3 flex items-center text-sm`}>{dispCur}</span>
                      <input type="number" placeholder="Entrez votre solde..." value={p.val}
                        onChange={e=>p.set(e.target.value)}
                        className={`flex-1 ${dark?'bg-gray-700 text-white':'bg-white'} px-3 py-2 text-sm outline-none`}/>
                    </div>
                    {p.bal>0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className={ts}>Solde actuel</span>
                          <span className={`font-medium ${tp}`}>{conv(p.bal)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className={ts}>Part des depenses</span>
                          <span className="font-medium text-red-500">-{conv(p.spent)}</span>
                        </div>
                        <div className={`h-px ${dark?'bg-gray-600':'bg-gray-200'}`}></div>
                        <div className="flex justify-between text-xs">
                          <span className={ts}>Restant</span>
                          <span className={`font-semibold ${p.bal-p.spent<0?'text-red-500':'text-green-600'}`}>
                            {p.bal-p.spent>=0?'+':''}{conv(p.bal-p.spent)}
                          </span>
                        </div>
                        <div className={`h-2 ${dark?'bg-gray-600':'bg-gray-200'} rounded-full overflow-hidden mt-1`}>
                          <div className={`h-full rounded-full ${(p.spent/p.bal)>=1?'bg-red-500':(p.spent/p.bal)>=0.8?'bg-orange-400':'bg-green-500'}`}
                            style={{width:`${Math.min((p.spent/p.bal)*100,100)}%`}}></div>
                        </div>
                        <div className={`text-xs ${ts}`}>{Math.round(Math.min((p.spent/p.bal)*100,100))}% du solde utilise</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Warning threshold */}
              <div className={`${dark?'bg-gray-700':'bg-yellow-50'} rounded-lg p-3 mb-4`}>
                <div className="flex items-center gap-3">
                  <span className="text-sm">⚠️</span>
                  <span className={`text-xs ${tp}`}>Alerte quand il reste moins de</span>
                  <input type="number" value={lowWarning} onChange={e=>setLowWarning(parseInt(e.target.value)||20)}
                    className={`w-16 ${inp} border rounded px-2 py-1 text-sm outline-none text-center`}/>
                  <span className={`text-xs ${tp}`}>% du solde</span>
                </div>
              </div>

              <button onClick={saveBalances}
                className="w-full bg-green-700 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-green-800">
                💾 Sauvegarder les soldes
              </button>
              {balanceSaved && <p className="text-xs text-green-500 mt-2 text-center">✅ Soldes sauvegardes!</p>}
            </div>

            {/* Combined view */}
            {(balance1>0||balance2>0) && (
              <div className={`${cardBorder} border rounded-xl p-6 shadow-sm`}>
                <h2 className={`text-base font-semibold ${tp} mb-4`}>📊 Vue d'ensemble</h2>
                <div className="space-y-4">
                  {[
                    {name:n1,balance:balance1,spent:s1,remaining:remaining1,pct:pct1,isLow:isLow1,color:'#1a6b3c'},
                    {name:n2,balance:balance2,spent:s2,remaining:remaining2,pct:pct2,isLow:isLow2,color:'#2196f3'},
                  ].filter(p=>p.balance>0).map((p,i)=>(
                    <div key={i}>
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm font-medium ${tp}`}>{p.name}</span>
                        <div className="flex items-center gap-3">
                          {p.isLow && <span className="text-xs text-red-500 font-medium">⚠️ Solde bas!</span>}
                          <span className={`text-xs ${ts}`}>{conv(p.spent)} / {conv(p.balance)}</span>
                          <span className={`text-xs font-semibold ${p.remaining<0?'text-red-500':p.isLow?'text-orange-500':'text-green-600'}`}>
                            Restant: {conv(p.remaining)}
                          </span>
                        </div>
                      </div>
                      <div className={`h-3 ${dark?'bg-gray-700':'bg-gray-100'} rounded-full overflow-hidden`}>
                        <div className={`h-full rounded-full transition-all ${p.pct>=100?'bg-red-500':p.pct>=80?'bg-orange-400':p.isLow?'bg-yellow-400':'bg-green-500'}`}
                          style={{width:`${p.pct}%`}}></div>
                      </div>
                      <div className={`text-xs mt-1 ${ts}`}>{Math.round(p.pct)}% utilise</div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className={`mt-4 pt-4 border-t ${dark?'border-gray-700':'border-gray-200'}`}>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className={`text-xs ${ts} mb-1`}>Total soldes</div>
                      <div className={`text-sm font-semibold ${tp}`}>{conv((balance1||0)+(balance2||0))}</div>
                    </div>
                    <div>
                      <div className={`text-xs ${ts} mb-1`}>Total depenses</div>
                      <div className="text-sm font-semibold text-red-500">{conv(total)}</div>
                    </div>
                    <div>
                      <div className={`text-xs ${ts} mb-1`}>Total restant</div>
                      <div className={`text-sm font-semibold ${remaining1+remaining2<0?'text-red-500':'text-green-600'}`}>
                        {conv((balance1||0)+(balance2||0)-total)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DEPENSES */}
        {tab==='depenses' && (
          <div>
            <div className="flex gap-2 mb-3 flex-wrap items-center">
              <select value={month} onChange={e=>setMonth(parseInt(e.target.value))} className={`${sel} border rounded-lg px-3 py-2 text-sm`}>
                {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
              </select>
              <select value={year} onChange={e=>setYear(parseInt(e.target.value))} className={`${sel} border rounded-lg px-3 py-2 text-sm`}>
                {years.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={()=>setShowAdd(!showAdd)} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800">+ Ajouter</button>
              <button onClick={applyRecurring} className={`${cardBorder} border px-4 py-2 rounded-lg text-sm ${ts}`}>↺ Recurrents</button>
              <button onClick={()=>exportPDF('monthly')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">📤 PDF</button>
              <button onClick={()=>setShowFilters(!showFilters)}
                className={`border px-4 py-2 rounded-lg text-sm font-medium ${showFilters?'bg-green-700 text-white border-green-700':`${cardBorder} ${ts}`}`}>
                🔽 Filtres {hasActiveFilters&&<span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">!</span>}
              </button>
              {hasActiveFilters&&<button onClick={resetFilters} className="text-xs text-red-500 hover:text-red-700 underline">Reset</button>}
              <div className={`flex items-center gap-2 ${cardBorder} border rounded-lg px-3 py-2`}>
                <span className={`text-xs ${ts}`}>{n1}</span>
                <input type="range" min="0" max="100" step="5" value={share} onChange={e=>setShare(parseInt(e.target.value))} className="w-20"/>
                <span className={`text-xs ${ts}`}>{n2}</span>
                <span className={`text-xs ${ts}`}>{share}%/{100-share}%</span>
              </div>
            </div>

            <div className="mb-3 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input type="text" placeholder="Rechercher..." value={search} onChange={e=>setSearch(e.target.value)}
                className={`w-full ${inp} border rounded-xl pl-9 pr-8 py-2.5 text-sm outline-none focus:border-green-500`}/>
              {search&&<button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">×</button>}
            </div>

            {showFilters&&(
              <div className={`${cardBorder} border rounded-xl p-4 mb-3 shadow-sm`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><label className={`text-xs ${ts} block mb-1`}>Categorie</label>
                    <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} className={`w-full ${sel} border rounded-lg px-2 py-1.5 text-sm`}>
                      <option value="all">Toutes</option>
                      {uniqueCats.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><label className={`text-xs ${ts} block mb-1`}>Type</label>
                    <select value={filterRecurring} onChange={e=>setFilterRecurring(e.target.value)} className={`w-full ${sel} border rounded-lg px-2 py-1.5 text-sm`}>
                      <option value="all">Tous</option>
                      <option value="recurring">Recurrents</option>
                      <option value="normal">Non-recurrents</option>
                    </select>
                  </div>
                  <div><label className={`text-xs ${ts} block mb-1`}>Montant min</label>
                    <input type="number" placeholder="0" value={filterMinAmt} onChange={e=>setFilterMinAmt(e.target.value)} className={`w-full ${inp} border rounded-lg px-2 py-1.5 text-sm outline-none`}/>
                  </div>
                  <div><label className={`text-xs ${ts} block mb-1`}>Montant max</label>
                    <input type="number" placeholder="Max" value={filterMaxAmt} onChange={e=>setFilterMaxAmt(e.target.value)} className={`w-full ${inp} border rounded-lg px-2 py-1.5 text-sm outline-none`}/>
                  </div>
                  <div><label className={`text-xs ${ts} block mb-1`}>Trier par</label>
                    <select value={sortField} onChange={e=>setSortField(e.target.value)} className={`w-full ${sel} border rounded-lg px-2 py-1.5 text-sm`}>
                      <option value="date">Date</option>
                      <option value="amount">Montant</option>
                      <option value="description">Description</option>
                      <option value="category">Categorie</option>
                    </select>
                  </div>
                  <div><label className={`text-xs ${ts} block mb-1`}>Ordre</label>
                    <select value={sortDir} onChange={e=>setSortDir(e.target.value)} className={`w-full ${sel} border rounded-lg px-2 py-1.5 text-sm`}>
                      <option value="desc">Decroissant</option>
                      <option value="asc">Croissant</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {showAdd&&(
              <div className={`${cardBorder} border rounded-xl p-4 mb-4 shadow-sm`}>
                <h3 className={`text-sm font-medium ${tp} mb-3`}>Nouvelle depense</h3>
                <div className="flex gap-2 flex-wrap">
                  <div className="flex-1 min-w-32">
                    <input type="text" placeholder="Categorie..." value={newCat} onChange={e=>setNewCat(e.target.value)} list="cat-suggestions"
                      className={`w-full ${inp} border rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500`}/>
                    <datalist id="cat-suggestions">{allCats.map(c=><option key={c} value={c}/>)}</datalist>
                  </div>
                  <input type="text" placeholder="Description (optionnel)" value={newDesc} onChange={e=>setNewDesc(e.target.value)}
                    className={`${inp} border rounded-lg px-3 py-2 text-sm flex-1 min-w-32 outline-none focus:border-green-500`}/>
                  <div className={`flex rounded-lg border ${dark?'border-gray-600':'border-gray-200'} overflow-hidden`}>
                    <select value={newCur} onChange={e=>setNewCur(e.target.value)}
                      className={`${dark?'bg-gray-600 text-white':'bg-gray-50 text-gray-600'} border-r ${dark?'border-gray-500':'border-gray-200'} px-2 py-2 text-sm outline-none`}>
                      {CURS.map(c=><option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                    </select>
                    <input type="number" placeholder="Montant" value={newAmt} onChange={e=>setNewAmt(e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&addExpense()}
                      className={`${dark?'bg-gray-700 text-white':'bg-white'} px-3 py-2 text-sm outline-none w-28`}/>
                  </div>
                  <button onClick={addExpense} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800">Ajouter</button>
                  <button onClick={()=>setShowAdd(false)} className={`${dark?'bg-gray-700 text-gray-300':'bg-gray-100 text-gray-600'} px-4 py-2 rounded-lg text-sm`}>Annuler</button>
                </div>
              </div>
            )}

            <div className={`${cardBorder} border rounded-xl overflow-hidden shadow-sm`}>
              {processed.length===0?(
                <div className={`p-8 text-center ${ts} text-sm`}>
                  {hasActiveFilters?'Aucun resultat.':search?`Aucun resultat pour "${search}"`:`Aucune depense pour ${MONTHS[month]} ${year}.`}
                </div>
              ):(
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-green-700 text-white">
                      <tr>
                        <th className="text-left px-4 py-3 cursor-pointer hover:bg-green-600 select-none" onClick={()=>handleSort('description')}>Description {sortIcon('description')}</th>
                        <th className="text-left px-4 py-3 cursor-pointer hover:bg-green-600 select-none" onClick={()=>handleSort('category')}>Categorie {sortIcon('category')}</th>
                        <th className="text-right px-4 py-3 cursor-pointer hover:bg-green-600 select-none" onClick={()=>handleSort('amount')}>Montant {sortIcon('amount')}</th>
                        <th className="text-right px-4 py-3">{n1}</th>
                        <th className="text-right px-4 py-3">{n2}</th>
                        <th className="px-4 py-3 cursor-pointer hover:bg-green-600 select-none text-center" onClick={()=>handleSort('date')}>Date {sortIcon('date')}</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {processed.map((e,i)=>(
                        <tr key={e.id} className={i%2===0?re:ro}>
                          <td className={`px-4 py-2 ${tp}`}>
                            {editId===e.id?(
                              <input type="text" value={editDesc} onChange={ev=>setEditDesc(ev.target.value)}
                                className={`${inp} border rounded px-2 py-1 text-sm outline-none w-full`}/>
                            ):(
                              <>{e.description||e.category}{e.is_recurring&&<span className="ml-2 text-xs bg-green-100 text-green-700 px-1 rounded">↺</span>}</>
                            )}
                          </td>
                          <td className={`px-4 py-2 ${ts} text-xs`}>
                            <span className={`px-2 py-0.5 rounded-full ${dark?'bg-gray-700':'bg-gray-100'}`}>{e.category}</span>
                          </td>
                          <td className={`px-4 py-2 text-right ${tp}`}>
                            {editId===e.id?(
                              <input type="number" value={editAmt} onChange={ev=>setEditAmt(ev.target.value)}
                                onKeyDown={ev=>ev.key==='Enter'&&saveEdit(e.id)}
                                className={`${inp} border rounded px-2 py-1 text-sm outline-none w-28 text-right`}/>
                            ):conv(e.amount,e.currency)}
                          </td>
                          <td className="px-4 py-2 text-right text-green-600">{editId===e.id?'--':conv(e.amount*share/100,e.currency)}</td>
                          <td className="px-4 py-2 text-right text-blue-500">{editId===e.id?'--':conv(e.amount*(100-share)/100,e.currency)}</td>
                          <td className={`px-4 py-2 text-center text-xs ${ts}`}>
                            {new Date(e.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {editId===e.id?(
                              <div className="flex gap-1 justify-end">
                                <button onClick={()=>saveEdit(e.id)} className="text-xs bg-green-700 text-white px-2 py-1 rounded">✓</button>
                                <button onClick={()=>setEditId(null)} className={`text-xs ${dark?'bg-gray-600 text-gray-300':'bg-gray-200 text-gray-600'} px-2 py-1 rounded`}>✗</button>
                              </div>
                            ):(
                              <div className="flex gap-1 justify-end">
                                <button onClick={()=>startEdit(e)} className="text-gray-400 hover:text-green-600 px-1">✏️</button>
                                <button onClick={()=>deleteExpense(e.id)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-green-700 text-white font-semibold">
                        <td className="px-4 py-3" colSpan="2">TOTAL ({processed.length})</td>
                        <td className="px-4 py-3 text-right">{conv(processed.reduce((s,e)=>s+e.amount,0))}</td>
                        <td className="px-4 py-3 text-right">{conv(processed.reduce((s,e)=>s+e.amount,0)*share/100)}</td>
                        <td className="px-4 py-3 text-right">{conv(processed.reduce((s,e)=>s+e.amount,0)*(100-share)/100)}</td>
                        <td colSpan="2"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab==='graphiques'&&(
          <div className="space-y-6">
            {expenses.length===0?(
              <div className={`${cardBorder} border rounded-xl p-8 text-center ${ts} text-sm`}>Ajoutez des depenses pour voir les graphiques!</div>
            ):(
              <>
                <div className={`${cardBorder} border rounded-xl p-6 shadow-sm`}>
                  <h2 className={`text-base font-semibold ${tp} mb-1`}>🥧 Repartition par categorie</h2>
                  <p className={`text-xs ${ts} mb-4`}>{MONTHS[month]} {year}</p>
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" outerRadius={110} dataKey="value"
                          label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}>
                          {pieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                        </Pie>
                        <Tooltip formatter={val=>`${curSym} ${val.toLocaleString('fr-FR')}`} contentStyle={tts}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2 min-w-48">
                      {pieData.map((d,i)=>(
                        <div key={d.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{background:COLORS[i%COLORS.length]}}></div>
                          <span className={`text-xs ${ts} flex-1`}>{d.name}</span>
                          <span className={`text-xs font-medium ${tp}`}>{curSym} {d.value.toLocaleString('fr-FR')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={`${cardBorder} border rounded-xl p-6 shadow-sm`}>
                  <h2 className={`text-base font-semibold ${tp} mb-1`}>📊 Depenses par categorie</h2>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={pieData} margin={{top:5,right:20,left:10,bottom:60}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark?'#374151':'#f0f0f0'}/>
                      <XAxis dataKey="name" tick={{fontSize:11,fill:dark?'#9ca3af':'#6b7280'}} angle={-35} textAnchor="end"/>
                      <YAxis tick={{fontSize:11,fill:dark?'#9ca3af':'#6b7280'}} tickFormatter={v=>`${curSym} ${v.toLocaleString('fr-FR')}`}/>
                      <Tooltip formatter={val=>[`${curSym} ${val.toLocaleString('fr-FR')}`,'Montant']} contentStyle={tts}/>
                      <Bar dataKey="value" radius={[4,4,0,0]}>{pieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className={`${cardBorder} border rounded-xl p-6 shadow-sm`}>
                  <h2 className={`text-base font-semibold ${tp} mb-1`}>👥 Partage {n1} vs {n2}</h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={[{name:n1,montant:convNum(s1)},{name:n2,montant:convNum(s2)}]} margin={{top:5,right:20,left:10,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark?'#374151':'#f0f0f0'}/>
                      <XAxis dataKey="name" tick={{fontSize:13,fontWeight:500,fill:dark?'#9ca3af':'#6b7280'}}/>
                      <YAxis tick={{fontSize:11,fill:dark?'#9ca3af':'#6b7280'}} tickFormatter={v=>`${curSym} ${v.toLocaleString('fr-FR')}`}/>
                      <Tooltip formatter={val=>[`${curSym} ${val.toLocaleString('fr-FR')}`,'Montant']} contentStyle={tts}/>
                      <Bar dataKey="montant" radius={[6,6,0,0]}><Cell fill="#1a6b3c"/><Cell fill="#2196f3"/></Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex justify-around mt-3">
                    <div className="text-center"><div className={`text-xs ${ts}`}>{n1}</div><div className="text-base font-semibold text-green-600">{conv(s1)}</div></div>
                    <div className="text-center"><div className={`text-xs ${ts}`}>{n2}</div><div className="text-base font-semibold text-blue-500">{conv(s2)}</div></div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab==='rapport'&&(
          <div className="space-y-6">
            <div className="flex items-center gap-3 flex-wrap">
              <label className={`text-sm font-medium ${tp}`}>Annee:</label>
              <select value={reportYear} onChange={e=>setReportYear(parseInt(e.target.value))} className={`${sel} border rounded-lg px-3 py-2 text-sm`}>
                {years.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={()=>exportPDF('annual')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">📤 Exporter PDF annuel</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {label:'Total '+reportYear,val:conv(yearTotal),color:tp},
                {label:n1+' ('+share+'%)',val:conv(yearS1),color:'text-green-600'},
                {label:n2+' ('+(100-share)+'%)',val:conv(yearS2),color:'text-blue-500'},
                {label:'Mois actifs',val:MONTHS.filter((_,i)=>allYearExpenses.some(e=>e.month===i)).length+' / 12',color:ts},
              ].map((c,i)=>(
                <div key={i} className={`${card} rounded-xl p-4 shadow-sm border`}>
                  <div className={`text-xs ${ts} mb-1`}>{c.label}</div>
                  <div className={`text-base font-semibold ${c.color}`}>{c.val}</div>
                </div>
              ))}
            </div>
            {allYearExpenses.length===0?(
              <div className={`${cardBorder} border rounded-xl p-8 text-center ${ts} text-sm`}>Aucune depense pour {reportYear}.</div>
            ):(
              <>
                <div className={`${cardBorder} border rounded-xl p-6 shadow-sm`}>
                  <h2 className={`text-base font-semibold ${tp} mb-1`}>📈 Evolution mensuelle {reportYear}</h2>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={monthlyData} margin={{top:5,right:20,left:10,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark?'#374151':'#f0f0f0'}/>
                      <XAxis dataKey="name" tick={{fontSize:11,fill:dark?'#9ca3af':'#6b7280'}}/>
                      <YAxis tick={{fontSize:11,fill:dark?'#9ca3af':'#6b7280'}} tickFormatter={v=>`${curSym} ${v.toLocaleString('fr-FR')}`}/>
                      <Tooltip formatter={val=>[`${curSym} ${parseFloat(val).toLocaleString('fr-FR')}`]} contentStyle={tts}/>
                      <Legend/>
                      <Line type="monotone" dataKey="total" stroke="#1a6b3c" strokeWidth={2} dot={{r:4}} name="Total"/>
                      <Line type="monotone" dataKey={n1} stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" dot={{r:3}}/>
                      <Line type="monotone" dataKey={n2} stroke="#2196f3" strokeWidth={2} strokeDasharray="5 5" dot={{r:3}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className={`${cardBorder} border rounded-xl p-6 shadow-sm`}>
                  <h2 className={`text-base font-semibold ${tp} mb-1`}>📊 Depenses par mois {reportYear}</h2>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthlyData} margin={{top:5,right:20,left:10,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark?'#374151':'#f0f0f0'}/>
                      <XAxis dataKey="name" tick={{fontSize:11,fill:dark?'#9ca3af':'#6b7280'}}/>
                      <YAxis tick={{fontSize:11,fill:dark?'#9ca3af':'#6b7280'}} tickFormatter={v=>`${curSym} ${v.toLocaleString('fr-FR')}`}/>
                      <Tooltip formatter={val=>[`${curSym} ${parseFloat(val).toLocaleString('fr-FR')}`]} contentStyle={tts}/>
                      <Legend/>
                      <Bar dataKey={n1} fill="#1a6b3c" radius={[3,3,0,0]}/>
                      <Bar dataKey={n2} fill="#2196f3" radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className={`${cardBorder} border rounded-xl overflow-hidden shadow-sm`}>
                  <div className="px-6 py-4"><h2 className={`text-base font-semibold ${tp}`}>📅 Tous les mois - {reportYear}</h2></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-green-700 text-white">
                        <tr>
                          <th className="text-left px-4 py-3">Mois</th>
                          <th className="text-right px-4 py-3">Total</th>
                          <th className="text-right px-4 py-3">{n1}</th>
                          <th className="text-right px-4 py-3">{n2}</th>
                          <th className="text-right px-4 py-3">Entrees</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MONTHS.map((m,i)=>{
                          const mExp=allYearExpenses.filter(e=>e.month===i)
                          const mTotal=mExp.reduce((s,e)=>s+(e.amount||0),0)
                          return(
                            <tr key={i} className={i%2===0?re:ro}>
                              <td className={`px-4 py-3 font-medium ${tp}`}>
                                {MFULL[i]}{i===now.getMonth()&&reportYear===now.getFullYear()&&<span className="ml-2 text-xs bg-green-100 text-green-700 px-1 rounded">En cours</span>}
                              </td>
                              <td className={`px-4 py-3 text-right ${mTotal>0?tp:ts}`}>{mTotal>0?conv(mTotal):'--'}</td>
                              <td className={`px-4 py-3 text-right ${mTotal>0?'text-green-600':ts}`}>{mTotal>0?conv(mTotal*share/100):'--'}</td>
                              <td className={`px-4 py-3 text-right ${mTotal>0?'text-blue-500':ts}`}>{mTotal>0?conv(mTotal*(100-share)/100):'--'}</td>
                              <td className={`px-4 py-3 text-right ${ts}`}>{mExp.length>0?mExp.length+' dep.':'--'}</td>
                            </tr>
                          )
                        })}
                        <tr className="bg-green-700 text-white font-semibold">
                          <td className="px-4 py-3">TOTAL {reportYear}</td>
                          <td className="px-4 py-3 text-right">{conv(yearTotal)}</td>
                          <td className="px-4 py-3 text-right">{conv(yearS1)}</td>
                          <td className="px-4 py-3 text-right">{conv(yearS2)}</td>
                          <td className="px-4 py-3 text-right">{allYearExpenses.length} dep.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className={`${cardBorder} border rounded-xl overflow-hidden shadow-sm`}>
                  <div className="px-6 py-4"><h2 className={`text-base font-semibold ${tp}`}>🗂️ Total par categorie - {reportYear}</h2></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-green-700 text-white">
                        <tr>
                          <th className="text-left px-4 py-3">Categorie</th>
                          <th className="text-right px-4 py-3">Total annuel</th>
                          <th className="text-right px-4 py-3">{n1}</th>
                          <th className="text-right px-4 py-3">{n2}</th>
                          <th className="text-right px-4 py-3">% du total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yearCatData.map((d,i)=>(
                          <tr key={d.name} className={i%2===0?re:ro}>
                            <td className={`px-4 py-3 font-medium ${tp}`}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{background:COLORS[i%COLORS.length]}}></div>
                                {d.name}
                              </div>
                            </td>
                            <td className={`px-4 py-3 text-right ${tp}`}>{conv(yearByCat[d.name])}</td>
                            <td className="px-4 py-3 text-right text-green-600">{conv(yearByCat[d.name]*share/100)}</td>
                            <td className="px-4 py-3 text-right text-blue-500">{conv(yearByCat[d.name]*(100-share)/100)}</td>
                            <td className={`px-4 py-3 text-right ${ts}`}>{yearTotal>0?(yearByCat[d.name]/yearTotal*100).toFixed(1)+'%':'--'}</td>
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

        {tab==='budget'&&(
          <div className={`${cardBorder} border rounded-xl p-6 shadow-sm`}>
            <h2 className={`text-base font-semibold ${tp} mb-2`}>🎯 Limites de budget</h2>
            <p className={`text-xs ${ts} mb-5`}>Tapez une limite pour chaque categorie.</p>
            {allCats.map(cat=>{
              const spent=expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0)
              const bud=budgets.find(b=>b.category===cat)
              const limit=bud?.limit_amount||0
              const pct=limit?Math.min(spent/limit*100,100):0
              const color=pct>=100?'bg-red-500':pct>=75?'bg-orange-400':'bg-green-500'
              return(
                <div key={cat} className="mb-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${tp}`}>{cat}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${ts}`}>{conv(spent)}</span>
                      <span className={`text-xs ${ts}`}>/</span>
                      <input type="number" placeholder="Limite" defaultValue={limit||''}
                        onBlur={async e=>{
                          const val=parseFloat(e.target.value); if(isNaN(val)) return
                          const{data:{user}}=await supabase.auth.getUser()
                          if(bud){await supabase.from('budgets').update({limit_amount:val}).eq('id',bud.id)}
                          else{await supabase.from('budgets').insert({user_id:user.id,category:cat,limit_amount:val})}
                          const{data:b}=await supabase.from('budgets').select('*'); if(b) setBudgets(b)
                        }}
                        className={`${inp} border rounded px-2 py-1 text-xs w-24 text-right outline-none`}/>
                    </div>
                  </div>
                  {limit>0&&(
                    <>
                      <div className={`h-2 ${dark?'bg-gray-700':'bg-gray-100'} rounded-full overflow-hidden`}>
                        <div className={`h-full rounded-full transition-all ${color}`} style={{width:`${pct}%`}}></div>
                      </div>
                      <p className={`text-xs mt-1 ${pct>=100?'text-red-500':ts}`}>
                        {Math.round(pct)}% utilise {pct>=100?'Depasse!':pct>=75?'Attention':''}
                      </p>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {tab==='recurrents'&&(
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-base font-semibold ${tp}`}>↺ Depenses recurrentes</h2>
              <button onClick={addRecurring} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800">+ Ajouter</button>
            </div>
            <div className="bg-blue-900 bg-opacity-20 rounded-lg p-3 mb-4 text-xs text-blue-400">
              Ces depenses se repetent chaque mois.
            </div>
            {recurring.length===0?(
              <div className={`${cardBorder} border rounded-xl p-8 text-center ${ts} text-sm`}>Aucun recurrent.</div>
            ):(
              <div className={`${cardBorder} border rounded-xl overflow-hidden shadow-sm`}>
                <table className="w-full text-sm">
                  <thead className="bg-green-700 text-white">
                    <tr>
                      <th className="text-left px-4 py-3">Categorie</th>
                      <th className="text-left px-4 py-3">Description</th>
                      <th className="text-right px-4 py-3">Montant/mois</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurring.map((r,i)=>(
                      <tr key={r.id} className={i%2===0?re:ro}>
                        <td className={`px-4 py-3 font-medium ${tp}`}>{r.category}</td>
                        <td className={`px-4 py-3 ${ts}`}>{r.description||'--'}</td>
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

        {tab==='historique'&&(
          <div>
            <h2 className={`text-base font-semibold ${tp} mb-4`}>👥 Historique des partages</h2>
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
                    const mTotal=expenses.filter(e=>e.month===i).reduce((s,e)=>s+e.amount,0)
                    if(mTotal===0) return null
                    return(
                      <tr key={i} className={i%2===0?re:ro}>
                        <td className={`px-4 py-3 font-medium ${tp}`}>{MFULL[i]} {year}</td>
                        <td className={`px-4 py-3 text-right ${tp}`}>{conv(mTotal)}</td>
                        <td className="px-4 py-3 text-right text-green-600">{conv(mTotal*share/100)}</td>
                        <td className="px-4 py-3 text-right text-blue-500">{conv(mTotal*(100-share)/100)}</td>
                      </tr>
                    )
                  })}
                  {expenses.length===0&&<tr><td colSpan="4" className={`px-4 py-8 text-center ${ts} text-sm`}>L'historique apparaitra ici.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==='reglages'&&(
          <div className={`${cardBorder} border rounded-xl p-6 shadow-sm max-w-md`}>
            <h2 className={`text-base font-semibold ${tp} mb-5`}>⚙️ Reglages</h2>
            {[
              {label:'Nom personne 1',val:name1,set:setName1,ph:'Ex: Ousmane'},
              {label:'Nom personne 2',val:name2,set:setName2,ph:'Ex: Doucoure'},
            ].map(f=>(
              <div key={f.label} className="mb-4">
                <label className={`text-xs ${ts} block mb-1`}>{f.label}</label>
                <input type="text" value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph}
                  className={`w-full ${inp} border rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500`}/>
              </div>
            ))}
            <div className="mb-4">
              <label className={`text-xs ${ts} block mb-1`}>Partage par defaut</label>
              <div className="flex items-center gap-3">
                <span className={`text-xs ${ts}`}>{n1}</span>
                <input type="range" min="0" max="100" step="5" value={share} onChange={e=>setShare(parseInt(e.target.value))} className="flex-1"/>
                <span className={`text-xs ${ts}`}>{n2}</span>
                <span className={`text-xs font-medium ${tp}`}>{share}%/{100-share}%</span>
              </div>
            </div>
            <div className="mb-4">
              <label className={`text-xs ${ts} block mb-1`}>Devise de base</label>
              <select value={baseCur} onChange={e=>setBaseCur(e.target.value)} className={`w-full ${sel} border rounded-lg px-3 py-2 text-sm outline-none`}>
                {CURS.map(c=><option key={c.code} value={c.code}>{c.flag} {c.label} ({c.code})</option>)}
              </select>
            </div>
            <div className="mb-5">
              <label className={`text-xs ${ts} block mb-1`}>Theme</label>
              <button onClick={()=>setDark(!dark)}
                className={`w-full ${dark?'bg-gray-700 text-yellow-300':'bg-gray-100 text-gray-700'} border ${dark?'border-gray-600':'border-gray-200'} rounded-lg px-3 py-2 text-sm font-medium`}>
                {dark?'☀️ Mode clair':'🌙 Mode sombre'}
              </button>
            </div>
            <button onClick={saveSettings} className="w-full bg-green-700 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-800">
              💾 Sauvegarder
            </button>
            {saveMsg&&<p className="text-xs text-green-500 mt-2 text-center">{saveMsg}</p>}
          </div>
        )}
      </div>
    </div>
  )
}