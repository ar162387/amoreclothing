import { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
  hasHero?: boolean;
}

const Layout = ({ children, hasHero = false }: LayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header hasHero={hasHero} />
      <main className={`flex-1 ${hasHero ? '' : 'pt-16 lg:pt-20'}`}>{children}</main>
      <Footer />
    </div>
  );
};

export default Layout;
