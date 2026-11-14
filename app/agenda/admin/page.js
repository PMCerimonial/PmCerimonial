'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import '../agenda.css';

const EMPTY = { data_evento:'', tipo_evento:'Casamento', local_evento:'', status:'pre_reservado', observacoes:'' };
const TYPES=['Casamento','Debutante','Aniversário','Corporativo','Formatura','Outros'];
const STATUS={pre_reservado:'Pré-reservado',confirmado:'Confirmado',bloqueado:'Bloqueado'};

export default function AdministrarAgenda(){
 const [user,setUser]=useState(null),[checking,setChecking]=useState(true),[admin,setAdmin]=useState(false);
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [items,setItems]=useState([]),[form,setForm]=useState({...EMPTY});
 const [editing,setEditing]=useState(null),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 const setField=(name,value)=>setForm(f=>({...f,[name]:value}));
 const refresh=useCallback(async()=>{
  const {data,error}=await supabase.from('agenda_eventos').select('id,data_evento,tipo_evento,local_evento,status,observacoes').order('data_evento',{ascending:true});
  if(error){setMsg('Não foi possível carregar a agenda: '+error.message);return;}
  setItems(data||[]);
 },[]);
 const checkAdmin=useCallback(async()=>{
  setChecking(true);
  const {data:{user:current}}=await supabase.auth.getUser();
  setUser(current||null);
  if(!current){setAdmin(false);setChecking(false);return;}
  const {data,error}=await supabase.from('administradores').select('id').eq('auth_user_id',current.id).eq('ativo',true).maybeSingle();
  setAdmin(Boolean(data)&&!error);setChecking(false);
 },[]);
 useEffect(()=>{
  checkAdmin();
  const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{checkAdmin();});
  return ()=>subscription.unsubscribe();
 },[checkAdmin]);
 useEffect(()=>{if(admin)refresh()},[admin,refresh]);
 async function magicLink(e){e.preventDefault();setMsg('');setBusy(true);
  const {error}=await supabase.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:false,emailRedirectTo:window.location.origin+'/agenda/admin'}});
  setBusy(false);setMsg(error?'Não foi possível enviar o acesso: '+error.message:'Enviamos um link de acesso para o e-mail cadastrado. Verifique também a pasta de spam.');
 }
 async function loginPassword(e){e.preventDefault();setMsg('');setBusy(true);
  const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
  setBusy(false);if(error)setMsg('Acesso não realizado: '+error.message);
 }
 async function save(e){e.preventDefault();if(!admin||busy)return;setBusy(true);setMsg('');
  const payload={data_evento:form.data_evento,tipo_evento:form.status==='bloqueado'?null:form.tipo_evento.trim(),local_evento:form.local_evento.trim()||null,status:form.status,observacoes:form.observacoes.trim()||null};
  const {error}=editing?await supabase.from('agenda_eventos').update(payload).eq('id',editing):await supabase.from('agenda_eventos').insert(payload);
  setBusy(false);
  if(error){setMsg(error.code==='23505'?'Esta data já está ocupada. Apenas um compromisso por dia é permitido.':'Não foi possível salvar: '+error.message);return;}
  setForm({...EMPTY});setEditing(null);setMsg('Compromisso salvo com sucesso.');await refresh();
 }
 async function remove(){if(!admin||!editing||busy||!window.confirm('Excluir este compromisso da agenda?'))return;
  setBusy(true);setMsg('');const {error}=await supabase.from('agenda_eventos').delete().eq('id',editing);setBusy(false);
  if(error){setMsg('Não foi possível excluir: '+error.message);return;}
  setForm({...EMPTY});setEditing(null);setMsg('Compromisso excluído.');await refresh();
 }
 const choose=(item)=>{setEditing(item.id);setForm({data_evento:item.data_evento,tipo_evento:item.tipo_evento||'Outros',local_evento:item.local_evento||'',status:item.status,observacoes:item.observacoes||''});window.scrollTo({top:0,behavior:'smooth'});};
 return <main className="agenda-shell">
  <header className="agenda-topo"><p className="agenda-marca">PATRÍCIA MATAVELLI CERIMONIAL</p><h1>Gestão da agenda</h1><p>Acesso exclusivo das administradoras</p></header>
  <div className="agenda-atalhos"><a className="agenda-voltar" href="/agenda">← Voltar ao calendário</a><a className="agenda-voltar" href="/">Recepção</a></div>
  {checking?<div className="agenda-admin">Verificando acesso…</div>:!user?<section className="agenda-admin">
    <h2>Entrar como administradora</h2><p>Utilize o e-mail já cadastrado no Cerimonial Matavelli.</p>
    <form onSubmit={magicLink} className="agenda-form"><label>E-mail cadastrado<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label><button className="agenda-submit" disabled={busy}>Enviar link de acesso por e-mail</button></form>
    <details style={{marginTop:18}}><summary>Já tenho senha de acesso</summary><form className="agenda-form" onSubmit={loginPassword}><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label><button className="agenda-submit" disabled={busy}>Entrar com senha</button></form></details>
   </section>:!admin?<section className="agenda-admin"><h2>Acesso restrito</h2><p>Esta conta não possui autorização administrativa para gerenciar datas.</p><button onClick={()=>supabase.auth.signOut()} className="agenda-submit">Sair</button></section>:<>
    <div className="agenda-atalhos"><span>Administradora autenticada</span><button className="agenda-submit" onClick={()=>supabase.auth.signOut()}>Sair</button></div>
    <section className="agenda-admin"><h2>{editing?'Alterar compromisso':'Cadastrar compromisso'}</h2>
      <form className="agenda-form" onSubmit={save}>
       <label>Data<input type="date" required value={form.data_evento} onChange={e=>setField('data_evento',e.target.value)}/></label>
       <label>Situação<select value={form.status} onChange={e=>setField('status',e.target.value)}>{Object.entries(STATUS).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
       {form.status!=='bloqueado'&&<label>Tipo do evento<select value={form.tipo_evento} onChange={e=>setField('tipo_evento',e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></label>}
       <label>Local (opcional)<input value={form.local_evento} onChange={e=>setField('local_evento',e.target.value)} maxLength={200}/></label>
       <label>Observações (opcional)<textarea value={form.observacoes} onChange={e=>setField('observacoes',e.target.value)} maxLength={1000}/></label>
       <div className="agenda-actions"><button disabled={busy} type="submit">{busy?'Salvando…':'Salvar compromisso'}</button>{editing&&<><button className="secondary" type="button" onClick={()=>{setEditing(null);setForm({...EMPTY});setMsg('')}}>Cancelar edição</button><button className="danger" type="button" disabled={busy} onClick={remove}>Excluir</button></>}</div>
      </form>
    </section>
    <section className="agenda-admin"><h2>Compromissos cadastrados</h2>{items.length===0?<p>Nenhuma data cadastrada.</p>:items.map(x=><div className="agenda-admin-item" key={x.id}><span><b>{x.data_evento.split('-').reverse().join('/')}</b> · {x.status==='bloqueado'?'Data bloqueada':x.tipo_evento} · {STATUS[x.status]}</span><button onClick={()=>choose(x)}>Editar</button></div>)}</section>
   </>}
  {msg&&<p className="agenda-notice" role="status">{msg}</p>}
 </main>;
}
