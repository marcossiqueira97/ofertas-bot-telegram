import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Vancod Ofertas — Admin Dashboard',
  description: 'Plataforma de automação de ofertas de afiliados para Telegram.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
