'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const RECEPCIONISTAS = ['Marcela', 'Sueli', 'Patrícia', 'Isabela'];
// Associação temporária do evento de teste. Não equivale a autenticação.
const EVENTOS_TESTE = { '01/11/2026': '017dd324-dbba-4674-ba24-b7ed7e5cfaa0' };
// Aceita apenas numeros no teclado do celular e insere barras automaticamente.
function formatarDataEvento(valor) {
  const numeros = String(valor).replace(/\D/g, '').slice(0, 8);
  if (numeros.length <= 2) return numeros;
  if (numeros.length <= 4) return `${numeros.slice(0, 2)}/${numeros.slice(2)}`;
  return `${numeros.slice(0, 2)}/${numeros.slice(2, 4)}/${numeros.slice(4)}`;
}

function dataValida(valor) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) return false;
  const [dia, mes, ano] = valor.split('/').map(Number);
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

function apresentarMesa(valor) {
  const texto = String(valor ?? '').trim();
  if (!texto) return 'Mesa a definir';
  if (/^\d+$/.test(texto)) return `Mesa ${texto.padStart(2, '0')}`;
  if (/^mesa\s+/i.test(texto)) return texto;
  if (/^setor\s+/i.test(texto)) return texto;
  return texto;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function Home() {
  const [convidados, setConvidados] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [recepcionista, setRecepcionista] = useState(RECEPCIONISTAS[0]);
  const [eventoId, setEventoId] = useState('');
  const [codigoEvento, setCodigoEvento] = useState('');
  const [acessoMensagem, setAcessoMensagem] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const idValido = UUID_RE.test(eventoId);

  function entrar(evento) {
    evento.preventDefault();
    const codigo = formatarDataEvento(codigoEvento.trim());
    if (!dataValida(codigo)) {
      setAcessoMensagem('Informe uma data válida com 8 números. Exemplo: 01112026.');
      return;
    }
    if (!RECEPCIONISTAS.includes(recepcionista)) {
      setAcessoMensagem('Escolha uma recepcionista da equipe.');
      return;
    }
    const id = EVENTOS_TESTE[codigo];
    if (!id) {
      setAcessoMensagem('Código ainda não cadastrado nesta versão de teste. Para este teste, use 01/11/2026.');
      return;
    }
    setAcessoMensagem('');
    setEventoId(id);
  }

  function sair() {
    setEventoId('');
    setConvidados([]);
    setCheckins([]);
    setBusca('');
    setFiltro('todos');
    setErro('');
    setAviso('');
  }

  async function carregar(id, preservarErro = false) {
    if (!UUID_RE.test(id)) return;
    setCarregando(true);
    if (!preservarErro) setErro('');
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'convidados', filter: `evento_id=eq.${eventoId}` }, () => { if (ativo) carregar(eventoId, true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins', filter: `evento_id=eq.${eventoId}` }, () => { if (ativo) carregar(eventoId, true); })
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
        : supabase.from('checkins').insert({ evento_id: eventoId, convidado_id: convidado.id });
      const { error } = await operacao;
      if (error) {
        // Nao apagar este aviso ao atualizar a lista: ele informa a causa da falha.
        setErro(`Check-in não realizado: ${error.message}${error.code ? ` (código ${error.code})` : ''}`);
        return;
      }
      await carregar(eventoId);
      // Confirmar pelo banco, sem declarar sucesso apenas por ter clicado.
      const { data: confirmacao, error: erroConfirmacao } = await supabase
        .from('checkins').select('id').eq('evento_id', eventoId)
        .eq('convidado_id', convidado.id).limit(1);
      if (erroConfirmacao) {
        setErro(`Não foi possível confirmar o check-in: ${erroConfirmacao.message}`);
      } else if (Boolean(confirmacao?.length) === presente) {
        setErro('O banco não confirmou a alteração da presença. Tente atualizar a página e confira o registro antes de tentar novamente.');
      }
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
      {!eventoId ? (
        <>
          <header>
            <div>
              <span className="eyebrow">PM CERIMONIAL</span>
              <h1>Bem-vinda à recepção</h1>
              <p>Acesso ao evento</p>
            </div>
          </header>
          <form onSubmit={entrar} style={{background:'white',marginTop:18,padding:22,borderRadius:20,border:'1px solid var(--borda)',display:'grid',gap:16}}>
            <div style={{display:'grid',gap:7}}>
              <label htmlFor="codigo-evento" style={{fontWeight:700,color:'var(--ameixa)'}}>Código do evento</label>
              <input id="codigo-evento" value={codigoEvento} onChange={e=>{setCodigoEvento(formatarDataEvento(e.target.value));setAcessoMensagem('');}} placeholder="DD/MM/AAAA" inputMode="numeric" maxLength={10} autoComplete="off" required />
              <small style={{color:'var(--suave)'}}>Para o evento de teste: 01/11/2026</small>
            </div>
            <div style={{display:'grid',gap:7}}>
              <label htmlFor="recepcionista" style={{fontWeight:700,color:'var(--ameixa)'}}>Recepcionista</label>
              <select id="recepcionista" value={recepcionista} onChange={e=>setRecepcionista(e.target.value)}>
                {RECEPCIONISTAS.map(nome=><option key={nome} value={nome}>{nome}</option>)}
              </select>
            </div>
            {acessoMensagem && <p role="alert">{acessoMensagem}</p>}
            <button type="submit" className="add">Entrar no evento</button>
          </form>
          <p style={{fontSize:12,color:'var(--suave)',textAlign:'center',lineHeight:1.5}}>Versão de teste: a seleção do nome não autentica a recepcionista. A autorização segura dos dados continua pendente.</p>
        </>
      ) : (
        <>
          <header>
            <div>
              <span className="eyebrow">PM CERIMONIAL</span>
              <h1>{eventoId === EVENTOS_TESTE['01/11/2026'] ? 'Allan & Luciana' : 'Recepção de convidados'}</h1>
              <p>Evento {codigoEvento} · {recepcionista}</p>
            </div>
            <button onClick={sair} style={{border:'1px solid #f0d8e1',borderRadius:12,background:'transparent',color:'white',padding:'10px 13px',cursor:'pointer'}}>Trocar evento</button>
          </header>
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
                  <div><h2>{c.nome}</h2><p>{apresentarMesa(c.mesa)}{c.idade != null ? ` · ${c.idade} anos` : ''}</p></div>
                  <button disabled={ocupado || carregando} onClick={() => check(c)}>{presente ? '✓ Presente' : 'Fazer check-in'}</button>
                </article>
              );
            })}
            {!carregando && !lista.length && !aviso && !erro && <div className="empty">Nenhum convidado encontrado.</div>}
          </section>
        </>
      )}
      <footer>PM Cerimonial · Versão de teste · Acesso seguro em desenvolvimento</footer>
    </main>
  );
}
