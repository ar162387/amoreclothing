import Layout from '@/components/layout/Layout';
import { sizeGuide } from '@/data/store';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import sizeguideHero from '@/assets/sizeguide-hero.jpg';

const SizeGuide = () => {
  return (
    <Layout hasHero>
      {/* Hero */}
      <section className="relative h-[60vh] flex items-center">
        <div className="absolute inset-0">
          <img
            src={sizeguideHero}
            alt="Amore Size Guide"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-foreground/30" />
        </div>
        <div className="relative container mx-auto px-6 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-background/80 mb-3">
            Help
          </p>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-light text-background mb-4">
            Size Guide
          </h1>
          <p className="text-sm font-light text-background/80 max-w-lg mx-auto">
            Find your perfect fit with our comprehensive size chart.
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="container mx-auto px-6 max-w-4xl">
          {/* Size Chart */}
          <div className="mb-16">
            <h2 className="font-serif text-2xl font-light mb-8 text-center">
              Measurements (cm)
            </h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-foreground">
                    <TableHead className="text-foreground font-medium">Size</TableHead>
                    <TableHead className="text-foreground font-medium">Bust</TableHead>
                    <TableHead className="text-foreground font-medium">Waist</TableHead>
                    <TableHead className="text-foreground font-medium">Hip</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sizeGuide.measurements.map((row) => (
                    <TableRow key={row.size}>
                      <TableCell className="font-medium">{row.size}</TableCell>
                      <TableCell>{row.bust}</TableCell>
                      <TableCell>{row.waist}</TableCell>
                      <TableCell>{row.hip}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* How to Measure */}
          <div className="mb-16">
            <h2 className="font-serif text-2xl font-light mb-8 text-center">
              How to Measure
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 border border-border flex items-center justify-center">
                  <span className="font-serif text-xl">1</span>
                </div>
                <h3 className="font-medium mb-2">Bust</h3>
                <p className="text-sm font-light text-muted-foreground">
                  Measure around the fullest part of your bust, keeping the tape horizontal.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 border border-border flex items-center justify-center">
                  <span className="font-serif text-xl">2</span>
                </div>
                <h3 className="font-medium mb-2">Waist</h3>
                <p className="text-sm font-light text-muted-foreground">
                  Measure around your natural waistline, typically the narrowest part.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 border border-border flex items-center justify-center">
                  <span className="font-serif text-xl">3</span>
                </div>
                <h3 className="font-medium mb-2">Hip</h3>
                <p className="text-sm font-light text-muted-foreground">
                  Measure around the fullest part of your hips, about 20cm below waist.
                </p>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-secondary p-8 lg:p-12">
            <h2 className="font-serif text-2xl font-light mb-6 text-center">
              Sizing Tips
            </h2>
            <ul className="space-y-4 max-w-lg mx-auto">
              {sizeGuide.tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-3 text-sm font-light">
                  <span className="text-muted-foreground">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="text-center mt-16">
            <p className="text-sm font-light text-muted-foreground mb-4">
              Still unsure about your size? We're here to help.
            </p>
            <a
              href="https://wa.me/923001234567"
              className="inline-flex items-center gap-2 text-sm tracking-widest uppercase border-b border-foreground pb-1 hover:opacity-70 transition-opacity"
            >
              Chat with us on WhatsApp
            </a>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default SizeGuide;
