'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const RECEPCIONISTAS = ['Marcela', 'Sueli', 'Patrícia', 'Isabela'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function Home() {
  const [convidados, setConvidados] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [recepcionista, setRecepcionista] = useState(RECEPCIONISTAS[0]);
  const [eventoId, setEventoId] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const idValido = UUID_RE.test(eventoId);

  async function carregar(id) {
    if (!UUID_RE.test(id)) return;
    setCarregando(true);
    setErro('');
    setAviso('');
    try {
      const [resultadoConvidados, resultadoCheckins] = await Promise.all([
        supabase.from('convidados').select('*').eq('evento_id', id).order('nome'),
        supabase.from('checkins').select('id,convidado_id').eq('evento_id', id)
      ]);
      if (resultadoConvidados.error) {
        setErro(`Falha ao consultar convidados: ${resultadoConvidados.error.message}`);
        setConvidados([]);
        return;
      }
      if (resultadoCheckins.error) {
        setErro(`Falha ao consultar presenças: ${resultadoCheckins.error.message}`);
        setConvidados(resultadoConvidados.data || []);
        setCheckins([]);
        return;
      }
      const dados = resultadoConvidados.data || [];
      setConvidados(dados);
      setCheckins(resultadoCheckins.data || []);
      if (dados.length === 0) {
        setAviso('A consulta não retornou convidados. Como existem registros no Supabase, precisamos verificar a autorização de leitura (RLS) e a associação com este evento. Nenhum dado foi apagado.');
      }
    } catch (e) {
      setErro(`Não foi possível acessar o Supabase: ${e?.message || 'erro de conexão'}`);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    setConvidados([]);
    setCheckins([]);
    setErro('');
    setAviso('');
    if (!idValido) return;
    let ativo = true;
    // Evita requisições enquanto o identificador está sendo digitado.
    const canal = supabase
      .channel(`recepcao-${eventoId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'convidados', filter: `evento_id=eq.${eventoId}` }, () => { if (ativo) carregar(eventoId); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins', filter: `evento_id=eq.${eventoId}` }, () => { if (ativo) carregar(eventoId); })
      .subscribe();
    carregar(eventoId);
    return () => { ativo = false; supabase.removeChannel(canal); };
  }, [eventoId, idValido]);

  const presentesIds = useMemo(() => new Set(checkins.map(c => c.convidado_id)), [checkins]);
  const lista = convidados.filter(c => {
    const encontrado = (c.nome || '').toLowerCase().includes(busca.toLowerCase());
    const presente = presentesIds.has(c.id);
    return encontrado && (filtro === 'todos' || (filtro === 'presentes' && presente) || (filtro === 'pendentes' && !presente));
  });
  const presentes = convidados.filter(c => presentesIds.has(c.id)).length;

  async function check(convidado) {
    if (ocupado || !idValido) return;
    setOcupado(true);
    setErro('');
    try {
      const presente = presentesIds.has(convidado.id);
      const operacao = presente
        ? supabase.from('checkins').delete().eq('evento_id', eventoId).eq('convidado_id', convidado.id)
        : supabase.from('checkins').insert({ evento_id: eventoId, convidado_id: convidado.id, origem: 'aplicativo' });
      const { error } = await operacao;
      if (error) setErro(`Não foi possível registrar presença: ${error.message}`);
      await carregar(eventoId);
    } catch (e) {
      setErro(`Falha no check-in: ${e?.message || 'erro de conexão'}`);
    } finally {
      setOcupado(false);
    }
  }

  async function adicionar() {
    if (!idValido) return;
    const nome = window.prompt('Nome do convidado extra:');
    if (!nome?.trim()) return;
    const mesa = window.prompt('Mesa ou setor:') || 'A definir';
    setErro('');
    const { error } = await supabase.from('convidados').insert({ evento_id: eventoId, nome: nome.trim(), mesa });
    if (error) setErro(`Não foi possível incluir o convidado: ${error.message}`);
    else await carregar(eventoId);
  }

  return (
    <main className="shell">
      <header>
        <div>
          <span className="eyebrow">PM CERIMONIAL</span>
          <h1>Recepção de convidados</h1>
          <p>Controle compartilhado de presença</p>
        </div>
        <div className="who">
          <label htmlFor="recepcionista">Recepcionista</label>
          <select id="recepcionista" value={recepcionista} onChange={e => setRecepcionista(e.target.value)}>
            {RECEPCIONISTAS.map(nome => <option key={nome}>{nome}</option>)}
          </select>
        </div>
      </header>

      <section className="tools">
        <input aria-label="Identificador do evento" value={eventoId} onChange={e => setEventoId(e.target.value.trim())} placeholder="ID do evento (UUID)" autoComplete="off" />
      </section>

      {!eventoId ? (
        <div className="empty">Informe o identificador do evento para consultar a lista.</div>
      ) : !idValido ? (
        <div className="empty">Insira o identificador completo do evento (UUID).</div>
      ) : (
        <>
          {erro && <p role="alert">{erro}</p>}
          {aviso && !carregando && <p role="status" style={{padding:'14px',background:'#fff6ee',border:'1px solid #e7d4bf',borderRadius:'12px',color:'#6b4939'}}>{aviso}</p>}
          <section className="stats">
            <div><b>{convidados.length}</b><span>Convidados</span></div>
            <div><b>{presentes}</b><span>Presentes</span></div>
            <div><b>{convidados.length - presentes}</b><span>Pendentes</span></div>
          </section>
          <section className="tools">
            <input aria-label="Pesquisar convidado" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar convidado..." />
            <button className="add" onClick={adicionar} disabled={carregando || ocupado}>+ Convidado extra</button>
          </section>
          <nav>
            {[['todos','Todos'],['presentes','Presentes'],['pendentes','Pendentes']].map(([valor, texto]) => (
              <button key={valor} className={filtro === valor ? 'active' : ''} onClick={() => setFiltro(valor)}>{texto}</button>
            ))}
          </nav>
          <section className="list">
            {carregando && <p role="status">Atualizando convidados...</p>}
            {lista.map(c => {
              const presente = presentesIds.has(c.id);
              return (
                <article key={c.id} className={presente ? 'checked' : ''}>
                  <div><h2>{c.nome}</h2><p>{c.mesa || 'Mesa a definir'}{c.idade != null ? ` · ${c.idade} anos` : ''}</p></div>
                  <button disabled={ocupado || carregando} onClick={() => check(c)}>{presente ? '✓ Presente' : 'Fazer check-in'}</button>
                </article>
              );
            })}
            {!carregando && !lista.length && !aviso && !erro && <div className="empty">Nenhum convidado encontrado.</div>}
          </section>
        </>
      )}
      <footer>PM Cerimonial · Integração Supabase</footer>
    </main>
  );
}
