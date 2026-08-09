import { useState } from 'react';
import { Mail, Phone, Instagram, MapPin } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import SiteMedia from '@/components/SiteMedia';
import { toast } from 'sonner';
import { z } from 'zod';
import { useSitePage } from '@/contexts/SiteContentContext';
import { toWaNumber } from '@/lib/siteContent';
import { useSeo } from '@/hooks/use-seo';
import { absoluteUrl, buildContactPageJsonLd } from '@/lib/seo';

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Invalid email address').max(255),
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  message: z.string().trim().min(1, 'Message is required').max(2000),
});

const Contact = () => {
  const contact = useSitePage('contact');

  useSeo({
    title: 'Contact | RAR Studio',
    description: contact.hero.body,
    canonicalPath: '/contact',
    image: contact.hero.media.type === 'image' ? absoluteUrl(contact.hero.media.url) : undefined,
    jsonLd: buildContactPageJsonLd(contact.info),
  });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = contactSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000));

    toast.success(contact.form.success_message);
    setFormData({ name: '', email: '', subject: '', message: '' });
    setIsSubmitting(false);
  };

  const openWhatsApp = () => {
    const message = encodeURIComponent(contact.info.whatsapp_message);
    window.open(`https://wa.me/${toWaNumber(contact.info.phone)}?text=${message}`, '_blank');
  };

  return (
    <Layout hasHero>
      {/* Hero */}
      <section className="relative h-[60vh] flex items-center">
        <div className="absolute inset-0">
          <SiteMedia
            media={contact.hero.media}
            className="w-full h-full object-cover"
            priority
          />
          <div className="absolute inset-0 bg-foreground/30" />
        </div>
        <div className="relative container mx-auto px-6 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-background/80 mb-3">
            {contact.hero.eyebrow}
          </p>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-light text-background mb-4">
            {contact.hero.title}
          </h1>
          <p className="text-sm font-light text-background/80 max-w-lg mx-auto">
            {contact.hero.body}
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 max-w-6xl mx-auto">
            {/* Contact Info */}
            <div>
              <h2 className="font-serif text-2xl font-light mb-8">Get in Touch</h2>
              
              <div className="space-y-6 mb-12">
                <a
                  href={`mailto:${contact.info.email}`}
                  className="flex items-start gap-4 group"
                >
                  <div className="w-12 h-12 border border-border flex items-center justify-center group-hover:bg-foreground group-hover:text-background transition-colors">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Email</p>
                    <p className="text-sm text-muted-foreground">{contact.info.email}</p>
                  </div>
                </a>

                <button
                  onClick={openWhatsApp}
                  className="flex items-start gap-4 group text-left w-full"
                >
                  <div className="w-12 h-12 border border-border flex items-center justify-center group-hover:bg-foreground group-hover:text-background transition-colors">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">WhatsApp</p>
                    <p className="text-sm text-muted-foreground">{contact.info.phone}</p>
                  </div>
                </button>

                <a
                  href={contact.info.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 group"
                >
                  <div className="w-12 h-12 border border-border flex items-center justify-center group-hover:bg-foreground group-hover:text-background transition-colors">
                    <Instagram className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Instagram</p>
                    <p className="text-sm text-muted-foreground">{contact.info.instagram_handle}</p>
                  </div>
                </a>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 border border-border flex items-center justify-center">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Location</p>
                    <p className="text-sm text-muted-foreground">{contact.info.location}</p>
                  </div>
                </div>
              </div>

              {/* Quick WhatsApp Button */}
              <button
                onClick={openWhatsApp}
                className="w-full py-4 bg-foreground text-background text-sm tracking-widest uppercase hover:opacity-90 transition-opacity"
              >
                Chat on WhatsApp
              </button>
            </div>

            {/* Contact Form */}
            <div>
              <h2 className="font-serif text-2xl font-light mb-8">{contact.form.title}</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={`w-full border-b py-3 bg-transparent text-sm focus:outline-none transition-colors ${
                      errors.name ? 'border-destructive' : 'border-border focus:border-foreground'
                    }`}
                    placeholder="Your name"
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive mt-1">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full border-b py-3 bg-transparent text-sm focus:outline-none transition-colors ${
                      errors.email ? 'border-destructive' : 'border-border focus:border-foreground'
                    }`}
                    placeholder="your@email.com"
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className={`w-full border-b py-3 bg-transparent text-sm focus:outline-none transition-colors ${
                      errors.subject ? 'border-destructive' : 'border-border focus:border-foreground'
                    }`}
                    placeholder="How can we help?"
                  />
                  {errors.subject && (
                    <p className="text-xs text-destructive mt-1">{errors.subject}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows={5}
                    className={`w-full border-b py-3 bg-transparent text-sm focus:outline-none resize-none transition-colors ${
                      errors.message ? 'border-destructive' : 'border-border focus:border-foreground'
                    }`}
                    placeholder="Your message..."
                  />
                  {errors.message && (
                    <p className="text-xs text-destructive mt-1">{errors.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-foreground text-background text-sm tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Contact;
