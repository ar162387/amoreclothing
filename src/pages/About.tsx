import Layout from '@/components/layout/Layout';
import aboutHero from '@/assets/about-hero.jpg';
import collectionWinter from '@/assets/collection-winter.jpg';

const About = () => {
  return (
    <Layout hasHero>
      {/* Hero */}
      <section className="relative h-[60vh] flex items-center">
        <div className="absolute inset-0">
          <img
            src={aboutHero}
            alt="Amore Story"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-foreground/30" />
        </div>
        <div className="relative container mx-auto px-6">
          <div className="max-w-2xl">
            <p className="text-xs tracking-[0.3em] uppercase mb-4 text-background/80">Our Story</p>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-light text-background">
              Crafted with Love
            </h1>
          </div>
        </div>
      </section>

      {/* Brand Story */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">
                The Beginning
              </p>
              <h2 className="font-serif text-3xl lg:text-4xl font-light mb-8">
                Born from a Passion for Timeless Style
              </h2>
              <div className="space-y-6 text-sm font-light leading-relaxed text-muted-foreground">
                <p>
                  Amore was founded with a singular vision: to create clothing that celebrates the 
                  modern woman in all her complexity. We believe that true elegance comes not from 
                  following trends, but from understanding your own unique style.
                </p>
                <p>
                  Our journey began with a simple observation – the modern woman deserves clothes 
                  that work as hard as she does, pieces that transition seamlessly from boardroom 
                  to dinner, from weekday to weekend.
                </p>
                <p>
                  Each piece in our collection is thoughtfully designed to be a wardrobe 
                  staple, made with the finest materials and attention to detail that ensures 
                  they'll remain beautiful for years to come.
                </p>
              </div>
            </div>
            <div className="aspect-[4/5] overflow-hidden">
              <img
                src={collectionWinter}
                alt="Amore craftsmanship"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 lg:py-28 bg-secondary">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">
              What We Stand For
            </p>
            <h2 className="font-serif text-3xl lg:text-4xl font-light">
              Our Values
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 border border-border flex items-center justify-center">
                <span className="font-serif text-2xl">01</span>
              </div>
              <h3 className="text-lg font-light mb-4">Quality Over Quantity</h3>
              <p className="text-sm font-light text-muted-foreground leading-relaxed">
                We believe in investing in fewer, better pieces. Each garment is crafted 
                with premium materials and meticulous attention to detail.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 border border-border flex items-center justify-center">
                <span className="font-serif text-2xl">02</span>
              </div>
              <h3 className="text-lg font-light mb-4">Timeless Design</h3>
              <p className="text-sm font-light text-muted-foreground leading-relaxed">
                Our designs transcend seasons. We create pieces that remain relevant 
                and beautiful year after year.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 border border-border flex items-center justify-center">
                <span className="font-serif text-2xl">03</span>
              </div>
              <h3 className="text-lg font-light mb-4">Conscious Craft</h3>
              <p className="text-sm font-light text-muted-foreground leading-relaxed">
                We're committed to responsible practices, from sourcing to production, 
                ensuring our impact is positive.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-6">
          <blockquote className="max-w-3xl mx-auto text-center">
            <p className="font-serif text-2xl lg:text-3xl font-light leading-relaxed mb-6">
              "At Amore, we don't just make clothes. We craft confidence, one beautiful 
              piece at a time."
            </p>
            <footer className="text-sm tracking-widest uppercase text-muted-foreground">
              — The Amore Team
            </footer>
          </blockquote>
        </div>
      </section>
    </Layout>
  );
};

export default About;
