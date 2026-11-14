import './globals.css';

export const metadata = {
  title: 'Cerimonial Matavelli',
  description: 'Recepção de convidados e agenda de eventos'
};

const linkStyle = {
  display: 'inline-flex',
  justifyContent: 'center',
  alignItems: 'center',
  flex: 1,
  textAlign: 'center',
  padding: '11px 14px',
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 600,
  textDecoration: 'none',
  border: '1px solid #eacbd9',
  color: '#713550',
  background: 'rgba(255,255,255,.94)'
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <style>{`
          body:not(:has(.agenda-shell)) nav[aria-label="Navegação do Cerimonial Matavelli"] a[href="/"],
          body:has(.agenda-shell) nav[aria-label="Navegação do Cerimonial Matavelli"] a[href="/agenda"] {
            color: #ffffff !important;
            background: #713550 !important;
            border-color: #713550 !important;
          }
          nav[aria-label="Navegação do Cerimonial Matavelli"] a:focus-visible {
            outline: 3px solid #c98fa8;
            outline-offset: 3px;
          }
        `}</style>
      </head>
      <body>
        <div style={{maxWidth:980, margin:'0 auto', padding:'12px 14px 0'}}>
          <nav aria-label="Navegação do Cerimonial Matavelli" style={{display:'flex', flexWrap:'nowrap', gap:9, margin:0}}>
            <a href="/" style={linkStyle}>Recepção</a>
            <a href="/agenda" style={linkStyle}>Agenda</a>
          </nav>
        </div>
        {children}
      </body>
    </html>
  );
}
