import './globals.css';
import Navegacao from './Navegacao';

export const metadata = {
  title: 'Cerimonial Matavelli',
  description: 'Recepção, agenda e gestão de eventos em uma única plataforma'
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <style>{`
          nav[aria-label="Navegação do Cerimonial Matavelli"] a:focus-visible {
            outline: 3px solid #c98fa8;
            outline-offset: 3px;
          }
        `}</style>
      </head>
      <body>
        <div style={{maxWidth:980, margin:'0 auto', padding:'12px 14px 0'}}>
          <Navegacao />
        </div>
        {children}
      </body>
    </html>
  );
}
