'use client';
import {useMemo,useState} from 'react';
const base=[
{id:1,nome:'Ana Martins',mesa:'Mesa 01',tipo:'Adulto',presente:false},
{id:2,nome:'Bruno Almeida',mesa:'Mesa 04',tipo:'Adulto',presente:true},
{id:3,nome:'Clara Souza',mesa:'Mesa 02',tipo:'Criança',idade:7,presente:false},
{id:4,nome:'Daniel Ferreira',mesa:'Mesa 08',tipo:'Adulto',presente:false},
{id:5,nome:'Elisa Rocha',mesa:'Mesa 03',tipo:'Criança',idade:4,presente:true},
];
export default function Home(){
 const [convidados,setConvidados]=useState(base); const [busca,setBusca]=useState(''); const [filtro,setFiltro]=useState('todos'); const [recepcionista,setRecepcionista]=useState('Marcela');
 const lista=useMemo(()=>convidados.filter(c=>c.nome.toLowerCase().includes(busca.toLowerCase())&&(filtro==='todos'||(filtro==='presentes'?c.presente:!c.presente))),[convidados,busca,filtro]);
 const presentes=convidados.filter(c=>c.presente).length;
 function check(id){setConvidados(v=>v.map(c=>c.id===id?{...c,presente:!c.presente}:c))}
 function adicionar(){const nome=window.prompt('Nome do convidado extra:');if(!nome)return;const mesa=window.prompt('Mesa ou setor:')||'A definir';setConvidados(v=>[...v,{id:Date.now(),nome,mesa,tipo:'Extra',presente:true,extra:true,incluidoPor:recepcionista}])}
 return <main className="shell"><header><div><span className="eyebrow">PM CERIMONIAL</span><h1>Recepção de convidados</h1><p>Evento 01/11/2026</p></div><div className="who"><label>Recepcionista</label><select value={recepcionista} onChange={e=>setRecepcionista(e.target.value)}><option>Marcela</option><option>Sueli</option><option>Patrícia</option></select></div></header>
 <section className="stats"><div><b>{convidados.length}</b><span>Convidados</span></div><div><b>{presentes}</b><span>Presentes</span></div><div><b>{convidados.length-presentes}</b><span>Pendentes</span></div></section>
 <section className="tools"><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Pesquisar convidado..."/><button className="add" onClick={adicionar}>+ Convidado extra</button></section>
 <nav>{[['todos','Todos'],['presentes','Presentes'],['pendentes','Pendentes']].map(([v,t])=><button key={v} className={filtro===v?'active':''} onClick={()=>setFiltro(v)}>{t}</button>)}</nav>
 <section className="list">{lista.map(c=><article key={c.id} className={c.presente?'checked':''}><div><h2>{c.nome}</h2><p>{c.mesa} · {c.tipo}{c.idade?` · ${c.idade} anos`:''}</p>{c.extra&&<small>Inclusão extraordinária · {c.incluidoPor}</small>}</div><button onClick={()=>check(c.id)}>{c.presente?'✓ Presente':'Fazer check-in'}</button></article>)}{!lista.length&&<div className="empty">Nenhum convidado encontrado.</div>}</section>
 <footer>Protótipo inicial · próxima etapa: banco compartilhado, importação do Excel e modo offline.</footer></main>
}
