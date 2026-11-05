
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [convidados, setConvidados] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [recepcionista, setRecepcionista] = useState('Marcela');
  const [eventoId, setEventoId] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const recepcionistas = ['Marcela', 'Sueli', 'Patrícia', 'Isabela'];

  async function carregar(id) {
    if (!id) return;

    setCarregando(true);
    setErro('');

    const [resultadoConvidados, resultadoCheckins] =
      await Promise.all([
        supabase.from('convidados')
          .select('*')
          .eq('evento_id', id)
          .order('nome'),
        supabase.from('checkins')
          .select('id,convidado_id')
          .eq('evento_id', id)
      ]);

    if (resultadoConvidados.error || resultadoCheckins.error) {
      setErro(
        resultadoConvidados.error?.message ||
        resultadoCheckins.error?.message
      );
    } else {
      setConvidados(resultadoConvidados.data || []);
      setCheckins(resultadoCheckins.data || []);
    }

    setCarregando(false);
  }

  useEffect(() => {
    if (!eventoId) return;

    carregar(eventoId);

    const canal = supabase
      .channel(`recepcao-${eventoId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'convidados',
        filter: `evento_id=eq.${eventoId}`
      }, () => carregar(eventoId))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'checkins',
        filter: `evento_id=eq.${eventoId}`
      }, () => carregar(eventoId))
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [eventoId]);

  const presentesIds = useMemo(
    () => new Set(checkins.map(c => c.convidado_id)),
    [checkins]
  );

  const lista = convidados.filter(c => {
    const encontrado = (c.nome || '')
      .toLowerCase()
      .includes(busca.toLowerCase());

    const presente = presentesIds.has(c.id);

    return encontrado && (
      filtro === 'todos' ||
      (filtro === 'presentes' && presente) ||
      (filtro === 'pendentes' && !presente)
    );
  });

  const presentes = convidados.filter(c =>
    presentesIds.has(c.id)
  ).length;

  async function check(convidado) {
    if (ocupado) return;
    setOcupado(true);
    setErro('');

    const presente = presentesIds.has(convidado.id);

    if (presente) {
      const { error } = await supabase
        .from('checkins')
        .delete()
        .eq('evento_id', eventoId)
        .eq('convidado_id', convidado.id);

      if (error) setErro(error.message);
    } else {
      const { error } = await supabase
        .from('checkins')
        .insert({
          evento_id: eventoId,
          convidado_id: convidado.id,
          origem: 'aplicativo'
        });

      if (error) setErro(error.message);
    }

    await carregar(eventoId);
    setOcupado(false);
  }

  async function adicionar() {
    const nome = window.prompt('Nome do convidado extra:');
    if (!nome?.trim()) return;

    const mesa = window.prompt('Mesa ou setor:') || 'A definir';

    setErro('');

    const { error } = await supabase
      .from('convidados')
      .insert({
        evento_id: eventoId,
        nome: nome.trim(),
        mesa
      });

    if (error) {
      setErro(error.message);
    } else {
      await carregar(eventoId);
    }
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
          <label>Recepcionista</label>
          <select
            value={recepcionista}
            onChange={e => setRecepcionista(e.target.value)}
          >
            {recepcionistas.map(nome => (
              <option key={nome}>{nome}</option>
            ))}
          </select>
        </div>
      </header>

      <section className="tools">
        <input
          value={eventoId}
          onChange={e => setEventoId(e.target.value.trim())}
          placeholder="ID do evento (UUID)"
        />
      </section>

      {!eventoId ? (
        <div className="empty">
          Informe o ID do evento para carregar os convidados.
        </div>
      ) : (
        <>
          {erro && <p role="alert">Erro: {erro}</p>}

          <section className="stats">
            <div>
              <b>{convidados.length}</b>
              <span>Convidados</span>
            </div>
            <div>
              <b>{presentes}</b>
              <span>Presentes</span>
            </div>
            <div>
              <b>{convidados.length - presentes}</b>
              <span>Pendentes</span>
            </div>
          </section>

          <section className="tools">
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Pesquisar convidado..."
            />
            <button className="add" onClick={adicionar}>
              + Convidado extra
            </button>
          </section>

          <nav>
            {[
              ['todos', 'Todos'],
              ['presentes', 'Presentes'],
              ['pendentes', 'Pendentes']
            ].map(([valor, texto]) => (
              <button
                key={valor}
                className={filtro === valor ? 'active' : ''}
                onClick={() => setFiltro(valor)}
              >
                {texto}
              </button>
            ))}
          </nav>

          <section className="list">
            {carregando && <p>Atualizando convidados...</p>}

            {lista.map(c => {
              const presente = presentesIds.has(c.id);

              return (
                <article
                  key={c.id}
                  className={presente ? 'checked' : ''}
                >
                  <div>
                    <h2>{c.nome}</h2>
                    <p>
                      {c.mesa || 'Mesa a definir'}
                      {c.idade != null
                        ? ` · ${c.idade} anos`
                        : ''}
                    </p>
                  </div>
                  <button
                    disabled={ocupado}
                    onClick={() => check(c)}
                  >
                    {presente ? '✓ Presente' : 'Fazer check-in'}
                  </button>
                </article>
              );
            })}

            {!carregando && !lista.length && (
              <div className="empty">
                Nenhum convidado encontrado.
              </div>
            )}
          </section>
        </>
      )}

      <footer>PM Cerimonial · Versão de integração</footer>
    </main>
  );
}
