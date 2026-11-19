'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const secoes = [
  { href: '/', titulo: 'Recepção', corresponde: (rota) => rota === '/' },
  { href: '/agenda', titulo: 'Agenda', corresponde: (rota) => rota === '/agenda' || rota.startsWith('/agenda/') },
  { href: '/eventos/admin', titulo: 'Eventos', corresponde: (rota) => rota === '/eventos' || rota.startsWith('/eventos/') },
];

export default function Navegacao() {
  const rota = usePathname() || '/';

  return (
    <nav aria-label="Navegação do Cerimonial Matavelli" style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: 7,
      margin: 0,
    }}>
      {secoes.map((secao) => {
        const ativa = secao.corresponde(rota);
        return (
          <Link
            key={secao.href}
            href={secao.href}
            aria-current={ativa ? 'page' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              minWidth: 0,
              padding: '12px 7px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.25,
              textDecoration: 'none',
              border: '1px solid',
              borderColor: ativa ? '#713550' : '#eacbd9',
              background: ativa ? '#713550' : 'rgba(255,255,255,.94)',
              color: ativa ? '#fff' : '#713550',
            }}
          >
            {secao.titulo}
          </Link>
        );
      })}
    </nav>
  );
}
