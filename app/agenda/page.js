'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import './agenda.css';

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const SEMANA = ['D','S','T','Q','Q','S','S'];
const STATUS = {
  confirmado: { texto: 'Confirmado', classe: 'confirmado' },
  pre_reservado: { texto: 'Pré-reservado', classe: 'pre' },
  bloqueado: { texto: 'Bloqueado', classe: 'bloqueado' },
};
const isoDate = (ano, mes, dia) => `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
const formatDate = (iso) => iso.split('-').reverse().join('/');

export default function Agenda() {
  const agora = new Date();
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth());
  const [selecionado, setSelecionado] = useState(isoDate(agora.getFullYear(), agora.getMonth(), agora.getDate()));
  const [registros, setRegistros] = useState([]);
  const [estado, setEstado] = useState('carregando');
  const [erro, setErro] = useState('');
  const inicio = isoDate(ano, mes, 1);
  const fim = isoDate(ano, mes, new Date(ano,mes+1,0).getDate());

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setEstado('carregando'); setErro('');
      const {data,error} = await supabase.from('agenda_eventos')
        .select('data_evento,tipo_evento,local_evento,status')
        .gte('data_evento',inicio).lte('data_evento',fim).order('data_evento');
      if (!ativo) return;
      if (error) {
        setRegistros([]); setEstado('erro');
        setErro('A agenda compartilhada ainda não está liberada para consulta. A configuração de acesso será concluída no Supabase.');
      } else { setRegistros(data || []); setEstado('pronto'); }
    }
    carregar();
    const channel = supabase.channel(`agenda-consulta-${inicio}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'agenda_eventos'},()=>carregar())
      .subscribe();
    return () => { ativo=false; supabase.removeChannel(channel); };
  }, [inicio,fim]);

  const porData = useMemo(() => Object.fromEntries(registros.map(r=>[r.data_evento,r])),[registros]);
  const primeiro = new Date(ano,mes,1).getDay();
  const qtd = new Date(ano,mes+1,0).getDate();
  const dias = Array.from({length:Math.ceil((primeiro+qtd)/7)*7},(_,i)=>i-primeiro+1);
  const registro = porData[selecionado];
  function mudarMes(n) {
    const nova = new Date(ano,mes+n,1);
    setAno(nova.getFullYear()); setMes(nova.getMonth());
    setSelecionado(isoDate(nova.getFullYear(),nova.getMonth(),1));
  }
  return <main className="agenda-shell">
    <header className="agenda-topo">
      <div className="agenda-ramos" aria-hidden="true" />
      <p className="agenda-marca">PATRÍCIA MATAVELLI CERIMONIAL</p>
      <h1>Agenda de eventos</h1>
      <p>Consulte a disponibilidade das datas</p>
    </header>
    <div className="agenda-atalhos"><a href="/" className="agenda-voltar">← Voltar à recepção</a><a href="/agenda/admin" className="agenda-voltar">Administrar agenda</a></div>
    <section className="agenda-painel" aria-label="Calendário de disponibilidade">
      <div className="agenda-navegacao">
        <button type="button" onClick={()=>mudarMes(-1)} aria-label="Mês anterior">‹</button>
        <h2>{MESES[mes].charAt(0).toUpperCase()+MESES[mes].slice(1)} de {ano}</h2>
        <button type="button" onClick={()=>mudarMes(1)} aria-label="Próximo mês">›</button>
      </div>
      <div className="agenda-grid">
        {SEMANA.map((nome,i)=><span key={`sem-${i}`} className="agenda-dia-semana">{nome}</span>)}
        {dias.map((dia,i)=>{
          if(dia<1 || dia>qtd) return <span key={`vazio-${i}`} className="agenda-vazio"/>;
          const data=isoDate(ano,mes,dia), item=porData[data], estilo=STATUS[item?.status]?.classe;
          return <button type="button" key={data}
            className={`agenda-dia ${data===selecionado?'selecionado':''}`}
            onClick={()=>setSelecionado(data)} aria-pressed={data===selecionado}
            aria-label={`${formatDate(data)}: ${estado!=='pronto'?'disponibilidade não verificada':item?STATUS[item.status]?.texto||'Reservado':'Disponível'}`}>
            <span>{dia}</span>{item&&<i className={`agenda-ponto ${estilo||'bloqueado'}`}/>}
          </button>;
        })}
      </div>
      <div className="agenda-legenda">
        <span><i className="agenda-ponto confirmado"/> Confirmado</span>
        <span><i className="agenda-ponto pre"/> Pré-reservado</span>
        <span><i className="agenda-ponto bloqueado"/> Bloqueado</span>
      </div>
      {estado==='carregando' && <p role="status" className="agenda-mensagem">Consultando a disponibilidade…</p>}
      {estado==='erro' && <p role="alert" className="agenda-aviso">{erro}</p>}
      {estado==='pronto' && <div className="agenda-detalhe" aria-live="polite">
        <small>{formatDate(selecionado)}</small>
        {registro ? <>
          <strong>{registro.status==='bloqueado'?'Data bloqueada':registro.tipo_evento||'Evento'}</strong>
          <span className={`agenda-situacao ${STATUS[registro.status]?.classe||'bloqueado'}`}>{STATUS[registro.status]?.texto||'Ocupado'}</span>
          {registro.local_evento && <p>{registro.local_evento}</p>}
        </> : <><strong>Data disponível</strong><p>Sem reservas ou bloqueios registrados.</p></>}
      </div>}
    </section>
    <p className="agenda-nota">Consulta de disponibilidade. O cadastro e a alteração de datas serão exclusivos das administradoras após a configuração do acesso seguro.</p>
  </main>;
}
