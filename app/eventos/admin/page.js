'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {supabase} from '../../../lib/supabase';
import '../../agenda/agenda.css';

const clean = v => String(v ?? '').trim();
const norm = v => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const dateCode = s => s ? s.slice(8,10)+s.slice(5,7)+s.slice(0,4) : '';
const nameKeys=['nome','nome completo','convidado','convidados','nome do convidado'];
const tableKeys=['mesa','numero da mesa','mesa numero','setor','setorizacao'];
const detect=(row,keys)=>row.findIndex(x=>keys.includes(norm(x)));

export default function AdminEventos(){
  const [user,setUser]=useState(null),[admin,setAdmin]=useState(false),[checking,setChecking]=useState(true);
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState('');
  const [busy,setBusy]=useState(false),[events,setEvents]=useState([]),[form,setForm]=useState({name:'',date:'',place:''});
  const [eventId,setEventId]=useState(''),[guestCount,setGuestCount]=useState(0);
  const [sheets,setSheets]=useState([]),[sheetIndex,setSheetIndex]=useState(0),[headerIndex,setHeaderIndex]=useState(0);
  const [nameCol,setNameCol]=useState(0),[tableCol,setTableCol]=useState(-1),[uploading,setUploading]=useState(false);
  const [staff,setStaff]=useState([]),[assigned,setAssigned]=useState([]),[staffId,setStaffId]=useState(''),[newStaff,setNewStaff]=useState('');

  const loadEvents=useCallback(async()=>{
    const {data,error}=await supabase.from('eventos').select('id,nome,data_evento,codigo_acesso,ativo').order('data_evento',{ascending:false});
    if(error)setMessage('Erro ao carregar eventos: '+error.message); else setEvents(data||[]);
  },[]);
  const verify=useCallback(async()=>{
    setChecking(true);
    const {data:{user:current},error}=await supabase.auth.getUser();
    setUser(error?null:current);
    if(!current||error){setAdmin(false);setChecking(false);return;}
    const {data, error:permissionError}=await supabase.from('administradores').select('id').eq('auth_user_id',current.id).eq('ativo',true).maybeSingle();
    setAdmin(Boolean(data)&&!permissionError);setChecking(false);
  },[]);
  useEffect(()=>{verify();const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>verify());return ()=>subscription.unsubscribe();},[verify]);
  useEffect(()=>{if(admin)loadEvents();},[admin,loadEvents]);
  const loadStaff=useCallback(async()=>{
    const {data,error}=await supabase.from('recepcionistas').select('id,nome,ativo').eq('ativo',true).order('nome');
    if(error)setMessage('Equipe: '+error.message);else setStaff(data||[]);
  },[]);
  const loadAssigned=useCallback(async()=>{
    if(!eventId){setAssigned([]);return;}
    const {data,error}=await supabase.from('equipe_evento').select('id,recepcionista_id').eq('evento_id',eventId);
    if(error)setMessage('Vínculos da equipe: '+error.message);else setAssigned(data||[]);
  },[eventId]);
  useEffect(()=>{if(admin)loadStaff();},[admin,loadStaff]);
  useEffect(()=>{if(admin)loadAssigned();},[admin,loadAssigned]);

  useEffect(()=>{
    if(!eventId){setGuestCount(0);return;}
    supabase.from('convidados').select('id',{count:'exact',head:true}).eq('evento_id',eventId).then(({count,error})=>{if(!error)setGuestCount(count||0);});
  },[eventId]);

  async function magic(e){e.preventDefault();setBusy(true);setMessage('');
    const {error}=await supabase.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:false,emailRedirectTo:window.location.origin+'/eventos/admin'}});
    setBusy(false);setMessage(error?'Erro: '+error.message:'Confira o e-mail para acessar.');
  }
  async function byPassword(e){e.preventDefault();setBusy(true);
    const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    setBusy(false);if(error)setMessage(error.message);
  }
  async function create(e){e.preventDefault();if(!admin||busy)return;setBusy(true);setMessage('');
    const {data,error}=await supabase.from('eventos').insert({nome:form.name.trim(),data_evento:form.date,local_evento:form.place.trim()||null,codigo_acesso:dateCode(form.date),ativo:true}).select('id').single();
    setBusy(false);
    if(error){setMessage(error.code==='23505'?'Já existe evento para esta data/código.':error.message);return;}
    setForm({name:'',date:'',place:''});setEventId(data.id);await loadEvents();setMessage('Evento criado. Agora importe a lista.');
  }
  async function addStaff(e){
    e.preventDefault();if(!admin||!eventId||!staffId)return;
    if(assigned.some(x=>x.recepcionista_id===staffId)){setMessage('Recepcionista já vinculada.');return;}
    setBusy(true);const {error}=await supabase.from('equipe_evento').insert({evento_id:eventId,recepcionista_id:staffId,funcao:'recepcao'});
    setBusy(false);if(error)setMessage('Não foi possível vincular: '+error.message);else {setMessage('Recepcionista vinculada ao evento.');await loadAssigned();}
  }
  async function addNewStaff(e){
    e.preventDefault();if(!admin||!newStaff.trim())return;
    setBusy(true);const {error}=await supabase.from('recepcionistas').insert({nome:newStaff.trim(),ativo:true});
    setBusy(false);if(error)setMessage('Não foi possível cadastrar: '+error.message);else{setNewStaff('');setMessage('Recepcionista cadastrada. Agora vincule ao evento.');await loadStaff();}
  }
  async function removeStaff(id){
    if(!admin||!eventId||!window.confirm('Retirar esta recepcionista apenas deste evento?'))return;
    setBusy(true);const {error}=await supabase.from('equipe_evento').delete().eq('id',id).eq('evento_id',eventId);
    setBusy(false);if(error)setMessage('Não foi possível remover: '+error.message);else {setMessage('Recepcionista removida deste evento.');await loadAssigned();}
  }
  function chooseSheet(items,index){
    setSheetIndex(index);const rows=items[index]?.data||[];let indexHeader=0;
    for(let i=0;i<Math.min(30,rows.length);i++)if(detect(rows[i]||[],nameKeys)>=0){indexHeader=i;break;}
    setHeaderIndex(indexHeader);setNameCol(Math.max(0,detect(rows[indexHeader]||[],nameKeys)));
    setTableCol(detect(rows[indexHeader]||[],tableKeys));
  }
  async function readFile(e){const file=e.target.files?.[0];if(!file)return;setMessage('');setSheets([]);
    if(!/\.xlsx$/i.test(file.name)){setMessage('Escolha um arquivo .xlsx.');return;}
    if(file.size>10*1024*1024){setMessage('O arquivo ultrapassa 10 MB.');return;}
    setBusy(true);
    try{const {default:readWorkbook}=await import('read-excel-file/browser');
      // A versão 9.x exporta todas as abas em objetos {sheet,data}.
      const sheetsFound=(await readWorkbook(file)).filter(x=>Array.isArray(x.data)&&x.data.length);
      if(!sheetsFound.length)throw Error('A planilha está vazia.');
      const preferred=sheetsFound.findIndex(x=>['os convidados','lista de convidados','convidados'].includes(norm(x.sheet)));
      setSheets(sheetsFound);chooseSheet(sheetsFound,preferred>=0?preferred:0);
    }catch(err){setMessage('Erro na leitura: '+err.message);}finally{setBusy(false);}
  }
  const rows=sheets[sheetIndex]?.data||[];
  const headings=rows[headerIndex]||[];
  const maxCols=Math.max(1,headings.length,...rows.slice(headerIndex+1,headerIndex+4).map(r=>r.length));
  const cols=Array.from({length:maxCols},(_,i)=>({value:i,label:clean(headings[i])||'Coluna '+(i+1)}));
  const people=useMemo(()=>rows.slice(headerIndex+1).map((row,i)=>({key:i,name:clean(row[nameCol]),table:tableCol<0?'':clean(row[tableCol])})).filter(p=>p.name),[rows,headerIndex,nameCol,tableCol]);
  const invalid=people.some(p=>p.name.length>250);
  async function importGuests(){
    if(!admin||!eventId||guestCount||!people.length||invalid||uploading||busy)return;
    if(people.length>5000){setMessage('Limite de 5.000 convidados por importação.');return;}
    if(!window.confirm('Importar '+people.length+' convidados para o evento selecionado?'))return;
    setUploading(true);setMessage('');let saved=0;
    for(let i=0;i<people.length;i+=100){
      const batch=people.slice(i,i+100).map(p=>({evento_id:eventId,nome:p.name,mesa:p.table||null}));
      const {error}=await supabase.from('convidados').insert(batch);
      if(error){setMessage('Importação interrompida após '+saved+' nomes. Não repita sem conferir os registros: '+error.message);setUploading(false);return;}
      saved+=batch.length;
    }
    setUploading(false);setGuestCount(saved);setSheets([]);setMessage(saved+' convidados importados com sucesso.');
  }
  const current=events.find(e=>e.id===eventId);
  return <main className="agenda-shell">
    <header className="agenda-topo"><p className="agenda-marca">PATRÍCIA MATAVELLI CERIMONIAL</p><h1>Gerenciar eventos</h1><p>Cadastro de eventos e importação Excel</p></header>
    <div className="agenda-atalhos"><a className="agenda-voltar" href="/">Recepção</a><a className="agenda-voltar" href="/agenda">Agenda</a></div>
    {checking?<section className="agenda-admin">Verificando acesso…</section>:!user?
      <section className="agenda-admin"><h2>Entrar como administradora</h2><form className="agenda-form" onSubmit={magic}><label>E-mail cadastrado<input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><button className="agenda-submit" disabled={busy}>Enviar link de acesso</button></form><details><summary>Já tenho senha</summary><form className="agenda-form" onSubmit={byPassword}><label>Senha<input required type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>Entrar</button></form></details></section>:
      !admin?<section className="agenda-admin"><h2>Acesso restrito</h2><p>Somente administradoras autorizadas podem cadastrar eventos.</p></section>:<>
      <section className="agenda-admin"><h2>Cadastrar evento</h2><form className="agenda-form" onSubmit={create}>
        <label>Nome do evento<input maxLength={200} required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></label>
        <label>Data<input required type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></label>
        <label>Local (opcional)<input maxLength={200} value={form.place} onChange={e=>setForm(f=>({...f,place:e.target.value}))}/></label>
        {form.date&&<p>Código do evento: <b>{dateCode(form.date)}</b></p>}
        <button disabled={busy} className="agenda-submit">Criar evento</button>
      </form></section>
      <section className="agenda-admin"><h2>Equipe do evento</h2>
        <p>Selecione o evento na seção de importação e vincule as recepcionistas autorizadas. A lista de convidados não ficará disponível para quem não pertence à equipe.</p>
        <label>Evento<select value={eventId} onChange={e=>{setEventId(e.target.value);setSheets([]);}}><option value="">Selecione o evento</option>{events.map(e=><option key={e.id} value={e.id}>{e.nome} — {e.data_evento?.split('-').reverse().join('/')}</option>)}</select></label>
        {!eventId?<p>Selecione um evento para gerenciar a equipe.</p>:<>
          <form className="agenda-form" onSubmit={addStaff}>
            <label>Recepcionista<select value={staffId} onChange={e=>setStaffId(e.target.value)} required>
              <option value="">Selecione uma recepcionista</option>{staff.filter(r=>!assigned.some(a=>a.recepcionista_id===r.id)).map(r=><option key={r.id} value={r.id}>{r.nome}</option>)}
            </select></label>
            <button className="agenda-submit" disabled={busy||!staffId}>Vincular ao evento</button>
          </form>
          {assigned.map(a=><div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,margin:'10px 0'}}>
            <span>{staff.find(r=>r.id===a.recepcionista_id)?.nome||'Recepcionista'}</span>
            <button type="button" disabled={busy} onClick={()=>removeStaff(a.id)}>Retirar</button>
          </div>)}
        </>}
        <details style={{marginTop:16}}><summary>Cadastrar nova recepcionista</summary>
          <form className="agenda-form" onSubmit={addNewStaff}>
            <label>Nome<input required maxLength={100} value={newStaff} onChange={e=>setNewStaff(e.target.value)}/></label>
            <button className="agenda-submit" disabled={busy}>Cadastrar recepcionista</button>
          </form>
        </details>
      </section>
      <section className="agenda-admin"><h2>Importar convidados</h2><p>Selecione o evento e confira os nomes e mesas antes de importar.</p><div className="agenda-form">
        <label>Evento<select value={eventId} onChange={e=>{setEventId(e.target.value);setSheets([]);}}><option value="">Selecione o evento</option>{events.map(e=><option value={e.id} key={e.id}>{e.nome} — {e.data_evento?.split('-').reverse().join('/')}</option>)}</select></label>
        {current&&<p><b>{current.nome}</b>: {guestCount} convidados cadastrados.</p>}
        {current&&guestCount>0&&<p>Este evento já possui convidados. A importação integral está bloqueada para evitar duplicações.</p>}
        <label>Planilha Excel (.xlsx)<input disabled={!eventId||busy||uploading} type="file" accept=".xlsx" onChange={readFile}/></label>
      </div>
      {sheets.length>0&&<div className="agenda-form">
        <label>Aba<select value={sheetIndex} onChange={e=>chooseSheet(sheets,Number(e.target.value))}>{sheets.map((s,i)=><option key={i} value={i}>{s.sheet}</option>)}</select></label>
        <label>Linha com cabeçalhos<select value={headerIndex} onChange={e=>{const i=Number(e.target.value);setHeaderIndex(i);setNameCol(Math.max(0,detect(rows[i]||[],nameKeys)));setTableCol(detect(rows[i]||[],tableKeys));}}>{rows.slice(0,30).map((r,i)=><option key={i} value={i}>Linha {i+1}: {r.slice(0,3).map(clean).join(' | ').slice(0,75)}</option>)}</select></label>
        <label>Coluna de nomes<select value={nameCol} onChange={e=>setNameCol(Number(e.target.value))}>{cols.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
        <label>Coluna de mesa ou setor<select value={tableCol} onChange={e=>setTableCol(Number(e.target.value))}><option value={-1}>Sem mesa</option>{cols.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
        <p><b>{people.length} convidados identificados.</b> Prévia:</p>
        <div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th>Nome</th><th>Mesa</th></tr></thead><tbody>{people.slice(0,5).map(p=><tr key={p.key}><td>{p.name}</td><td>{p.table||'—'}</td></tr>)}</tbody></table></div>
        {invalid&&<p role="alert">Há nomes acima do limite de 250 caracteres.</p>}
        <button type="button" className="agenda-submit" disabled={!eventId||guestCount>0||!people.length||invalid||busy||uploading} onClick={importGuests}>{uploading?'Importando…':'Confirmar importação de '+people.length+' convidados'}</button>
      </div>}
      </section>
    </>}
    {message&&<p className="agenda-notice" role="status">{message}</p>}
  </main>;
}
