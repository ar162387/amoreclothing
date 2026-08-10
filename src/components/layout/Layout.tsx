import { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
  hasHero?: boolean;
  /** Header renders in-flow (static) instead of fixed-overlay — e.g. the product detail page,
   * where a fixed header would otherwise require compensating top padding on <main>. */
  staticHeader?: boolean;
}

const Layout = ({ children, hasHero = false, staticHeader = false }: LayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header hasHero={hasHero} staticHeader={staticHeader} />
      <main className={`flex-1 ${hasHero || staticHeader ? '' : 'pt-16 lg:pt-20'}`}>{children}</main>
      <Footer />
    </div>
  );
};

export default Layout;
