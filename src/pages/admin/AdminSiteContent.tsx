import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import AdminLayout from '@/components/admin/AdminLayout';
import MediaSlotField from '@/components/admin/MediaSlotField';
import RotatingMediaField, { type NewMediaEntry } from '@/components/admin/RotatingMediaField';
import type { PendingMedia } from '@/components/admin/MediaUploader';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useSiteContent } from '@/contexts/SiteContentContext';
import { siteContentService, SiteContent, SiteMediaValue, SiteMediaList, HomeStyleTile } from '@/services/siteContent';
import { resolveMedia } from '@/components/admin/MediaUploader';
import { uploadService } from '@/services/upload';
import { pruneEmpty } from '@/lib/siteContent';
import { SITE_CONTENT_DEFAULTS } from '@/config/siteContent.defaults';

type PendingMap = Record<string, PendingMedia | null>;
/** Newly-added (not yet uploaded) items for a rotating slot, keyed by slotId. */
type NewMediaMap = Record<string, NewMediaEntry[]>;

/** Uploads a slot's pending file (if any) and folds in a resolved poster. */
async function resolveSlot(
  media: SiteMediaValue,
  mediaKey: string,
  posterKey: string,
  pending: PendingMap,
): Promise<SiteMediaValue> {
  const resolvedMedia = (await resolveMedia(pending[mediaKey] ?? null, media, 'site')) ?? media;
  const posterCurrent: SiteMediaValue | null = resolvedMedia.poster_url
    ? { type: 'image', url: resolvedMedia.poster_url }
    : null;
  const resolvedPoster = await resolveMedia(pending[posterKey] ?? null, posterCurrent, 'site');
  return { ...resolvedMedia, poster_url: resolvedPoster?.url };
}

/**
 * Uploads every newly-added entry for a rotating slot and appends them to
 * whatever existing items remain (some may have been removed by the admin).
 * Upload stays deferred to save time, same as resolveMedia/resolveSlot.
 */
async function resolveRotatingSlot(existing: SiteMediaList, entries: NewMediaEntry[]): Promise<SiteMediaList> {
  const uploaded: SiteMediaValue[] = [];
  for (const entry of entries) {
    const url = await uploadService.uploadMedia(entry.file.file, 'site');
    const poster_url = entry.poster ? await uploadService.uploadMedia(entry.poster.file, 'site') : undefined;
    uploaded.push({ type: entry.file.kind, url, poster_url, alt: entry.file.alt });
  }
  return [...existing, ...uploaded];
}

const AdminSiteContent = () => {
  const { content, loading, refresh } = useSiteContent();
  const [draft, setDraft] = useState<SiteContent>(content);
  const [initialized, setInitialized] = useState(false);
  const [pending, setPending] = useState<PendingMap>({});
  const [newMedia, setNewMedia] = useState<NewMediaMap>({});
  const [dirty, setDirty] = useState<{ home: boolean; contact: boolean }>({ home: false, contact: false });
  const [saving, setSaving] = useState<'home' | 'contact' | null>(null);

  // Seed the draft once the initial fetch resolves. After that, the draft
  // is fully local — a background refresh() from another tab/save never
  // overwrites in-progress edits.
  useEffect(() => {
    if (!loading && !initialized) {
      setDraft(content);
      setInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initialized]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty.home || dirty.contact) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const setPendingFor = (key: string, value: PendingMedia | null) => {
    setPending((prev) => ({ ...prev, [key]: value }));
  };

  // --- Rotating media (hero + both style tiles) -----------------------------
  const addNewMedia = (slotId: string, file: PendingMedia) => {
    const id = `${slotId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setNewMedia((prev) => ({ ...prev, [slotId]: [...(prev[slotId] ?? []), { id, file, poster: null }] }));
    setDirty((s) => ({ ...s, home: true }));
  };
  const removeNewMedia = (slotId: string, id: string) => {
    setNewMedia((prev) => ({ ...prev, [slotId]: (prev[slotId] ?? []).filter((e) => e.id !== id) }));
    setDirty((s) => ({ ...s, home: true }));
  };
  const setNewMediaPoster = (slotId: string, id: string, poster: PendingMedia | null) => {
    setNewMedia((prev) => ({
      ...prev,
      [slotId]: (prev[slotId] ?? []).map((e) => (e.id === id ? { ...e, poster } : e)),
    }));
  };
  const setNewMediaAlt = (slotId: string, id: string, alt: string) => {
    setNewMedia((prev) => ({
      ...prev,
      [slotId]: (prev[slotId] ?? []).map((e) => (e.id === id ? { ...e, file: { ...e.file, alt } } : e)),
    }));
    setDirty((s) => ({ ...s, home: true }));
  };
  const removeHomeHeroMedia = (index: number) => {
    setDraft((d) => ({
      ...d,
      home: { ...d.home, hero: { ...d.home.hero, media: d.home.hero.media.filter((_, i) => i !== index) } },
    }));
    setDirty((s) => ({ ...s, home: true }));
  };
  const updateHomeHeroMediaAlt = (index: number, alt: string) => {
    setDraft((d) => ({
      ...d,
      home: {
        ...d.home,
        hero: { ...d.home.hero, media: d.home.hero.media.map((m, i) => (i === index ? { ...m, alt } : m)) },
      },
    }));
    setDirty((s) => ({ ...s, home: true }));
  };
  const removeHomeTileMedia = (tileIndex: 0 | 1, mediaIndex: number) => {
    setDraft((d) => {
      const tiles = [...d.home.style.tiles] as [HomeStyleTile, HomeStyleTile];
      tiles[tileIndex] = { ...tiles[tileIndex], media: tiles[tileIndex].media.filter((_, i) => i !== mediaIndex) };
      return { ...d, home: { ...d.home, style: { ...d.home.style, tiles } } };
    });
    setDirty((s) => ({ ...s, home: true }));
  };
  const updateHomeTileMediaAlt = (tileIndex: 0 | 1, mediaIndex: number, alt: string) => {
    setDraft((d) => {
      const tiles = [...d.home.style.tiles] as [HomeStyleTile, HomeStyleTile];
      tiles[tileIndex] = {
        ...tiles[tileIndex],
        media: tiles[tileIndex].media.map((m, i) => (i === mediaIndex ? { ...m, alt } : m)),
      };
      return { ...d, home: { ...d.home, style: { ...d.home.style, tiles } } };
    });
    setDirty((s) => ({ ...s, home: true }));
  };
  const updateHomeRotationSeconds = (seconds: number) => {
    setDraft((d) => ({ ...d, home: { ...d.home, media_rotation_seconds: seconds } }));
    setDirty((s) => ({ ...s, home: true }));
  };

  // --- Home field updaters -------------------------------------------------
  const updateHomeHero = (patch: Partial<SiteContent['home']['hero']>) => {
    setDraft((d) => ({ ...d, home: { ...d.home, hero: { ...d.home.hero, ...patch } } }));
    setDirty((s) => ({ ...s, home: true }));
  };
  const updateHomeProducts = (patch: Partial<SiteContent['home']['products']>) => {
    setDraft((d) => ({ ...d, home: { ...d.home, products: { ...d.home.products, ...patch } } }));
    setDirty((s) => ({ ...s, home: true }));
  };
  const updateHomeStyle = (patch: Partial<Pick<SiteContent['home']['style'], 'eyebrow' | 'title'>>) => {
    setDraft((d) => ({ ...d, home: { ...d.home, style: { ...d.home.style, ...patch } } }));
    setDirty((s) => ({ ...s, home: true }));
  };
  const updateHomeTile = (index: 0 | 1, patch: Partial<HomeStyleTile>) => {
    setDraft((d) => {
      const tiles = [...d.home.style.tiles] as [HomeStyleTile, HomeStyleTile];
      tiles[index] = { ...tiles[index], ...patch };
      return { ...d, home: { ...d.home, style: { ...d.home.style, tiles } } };
    });
    setDirty((s) => ({ ...s, home: true }));
  };
  const updateHomePhilosophy = (patch: Partial<SiteContent['home']['philosophy']>) => {
    setDraft((d) => ({ ...d, home: { ...d.home, philosophy: { ...d.home.philosophy, ...patch } } }));
    setDirty((s) => ({ ...s, home: true }));
  };

  // --- Contact field updaters ----------------------------------------------
  const updateContactHero = (patch: Partial<SiteContent['contact']['hero']>) => {
    setDraft((d) => ({ ...d, contact: { ...d.contact, hero: { ...d.contact.hero, ...patch } } }));
    setDirty((s) => ({ ...s, contact: true }));
  };
  const updateContactInfo = (patch: Partial<SiteContent['contact']['info']>) => {
    setDraft((d) => ({ ...d, contact: { ...d.contact, info: { ...d.contact.info, ...patch } } }));
    setDirty((s) => ({ ...s, contact: true }));
  };
  const updateContactForm = (patch: Partial<SiteContent['contact']['form']>) => {
    setDraft((d) => ({ ...d, contact: { ...d.contact, form: { ...d.contact.form, ...patch } } }));
    setDirty((s) => ({ ...s, contact: true }));
  };

  const clearPendingByPrefix = (prefix: string) => {
    setPending((prev) => {
      const next = { ...prev };
      Object.keys(next)
        .filter((k) => k.startsWith(prefix))
        .forEach((k) => delete next[k]);
      return next;
    });
  };

  const handleSaveHome = async () => {
    setSaving('home');
    try {
      const heroMedia = await resolveRotatingSlot(draft.home.hero.media, newMedia['home.hero'] ?? []);
      const tile0Media = await resolveRotatingSlot(
        draft.home.style.tiles[0].media,
        newMedia['home.style.tiles.0'] ?? [],
      );
      const tile1Media = await resolveRotatingSlot(
        draft.home.style.tiles[1].media,
        newMedia['home.style.tiles.1'] ?? [],
      );

      if (heroMedia.length === 0 || tile0Media.length === 0 || tile1Media.length === 0) {
        throw new Error('Each media slot needs at least one image or video.');
      }

      const next: SiteContent['home'] = {
        ...draft.home,
        hero: { ...draft.home.hero, media: heroMedia },
        style: {
          ...draft.home.style,
          tiles: [
            { ...draft.home.style.tiles[0], media: tile0Media },
            { ...draft.home.style.tiles[1], media: tile1Media },
          ],
        },
      };

      const { error } = await siteContentService.upsertPage('home', pruneEmpty(next));
      if (error) throw error;

      setDraft((d) => ({ ...d, home: next }));
      setNewMedia((prev) => {
        const next = { ...prev };
        delete next['home.hero'];
        delete next['home.style.tiles.0'];
        delete next['home.style.tiles.1'];
        return next;
      });
      setDirty((s) => ({ ...s, home: false }));
      toast.success('Home page updated');
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save. Nothing was changed.');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveContact = async () => {
    setSaving('contact');
    try {
      const heroMedia = await resolveSlot(draft.contact.hero.media, 'contact.hero', 'contact.hero.poster', pending);

      const next: SiteContent['contact'] = {
        ...draft.contact,
        hero: { ...draft.contact.hero, media: heroMedia },
      };

      const { error } = await siteContentService.upsertPage('contact', pruneEmpty(next));
      if (error) throw error;

      setDraft((d) => ({ ...d, contact: next }));
      clearPendingByPrefix('contact.');
      setDirty((s) => ({ ...s, contact: false }));
      toast.success('Contact page updated');
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save. Nothing was changed.');
    } finally {
      setSaving(null);
    }
  };

  if (!initialized) {
    return (
      <AdminLayout>
        <p className="text-muted-foreground">Loading site content...</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="font-serif text-2xl lg:text-3xl font-light">Site Content</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Edit the copy and media shown on the Home and Contact pages. Leave a field blank to fall
          back to its built-in default.
        </p>
      </div>

      <Tabs defaultValue="home">
        <TabsList>
          <TabsTrigger value="home">
            Home {dirty.home && <span className="ml-2 text-xs text-amber-600">•</span>}
          </TabsTrigger>
          <TabsTrigger value="contact">
            Contact {dirty.contact && <span className="ml-2 text-xs text-amber-600">•</span>}
          </TabsTrigger>
        </TabsList>

        {/* ---------------- HOME ---------------- */}
        <TabsContent value="home" className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {dirty.home ? 'Unsaved changes' : 'All changes saved'}
            </p>
            <Button onClick={handleSaveHome} disabled={saving === 'home' || !dirty.home}>
              {saving === 'home' ? 'Saving...' : 'Save Home Page'}
            </Button>
          </div>

          <div className="bg-background rounded-lg border p-4 flex items-center gap-4">
            <Label htmlFor="rotation-seconds" className="whitespace-nowrap">
              Rotation Interval
            </Label>
            <Input
              id="rotation-seconds"
              type="number"
              min={1}
              max={60}
              className="w-24"
              value={draft.home.media_rotation_seconds}
              onChange={(e) => updateHomeRotationSeconds(Math.max(1, Number(e.target.value) || 1))}
            />
            <p className="text-xs text-muted-foreground">
              seconds between transitions for the Hero and Shop by Style tiles, whenever a slot has
              more than one item
            </p>
          </div>

          <Accordion type="multiple" defaultValue={['hero']} className="bg-background rounded-lg border px-6">
            <AccordionItem value="hero">
              <AccordionTrigger>Hero</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Eyebrow</Label>
                    <Input
                      value={draft.home.hero.eyebrow}
                      placeholder={SITE_CONTENT_DEFAULTS.home.hero.eyebrow}
                      onChange={(e) => updateHomeHero({ eyebrow: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={draft.home.hero.title}
                      placeholder={SITE_CONTENT_DEFAULTS.home.hero.title}
                      onChange={(e) => updateHomeHero({ title: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Body</Label>
                  <Textarea
                    rows={3}
                    value={draft.home.hero.body}
                    placeholder={SITE_CONTENT_DEFAULTS.home.hero.body}
                    onChange={(e) => updateHomeHero({ body: e.target.value })}
                  />
                </div>
                <RotatingMediaField
                  slotId="home.hero"
                  existing={draft.home.hero.media}
                  onRemoveExisting={removeHomeHeroMedia}
                  onUpdateExistingAlt={updateHomeHeroMediaAlt}
                  newEntries={newMedia['home.hero'] ?? []}
                  onAddNew={(p) => addNewMedia('home.hero', p)}
                  onRemoveNew={(id) => removeNewMedia('home.hero', id)}
                  onSetNewPoster={(id, poster) => setNewMediaPoster('home.hero', id, poster)}
                  onSetNewAlt={(id, alt) => setNewMediaAlt('home.hero', id, alt)}
                  disabled={saving === 'home'}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="products">
              <AccordionTrigger>Products Section</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Eyebrow</Label>
                    <Input
                      value={draft.home.products.eyebrow}
                      placeholder={SITE_CONTENT_DEFAULTS.home.products.eyebrow}
                      onChange={(e) => updateHomeProducts({ eyebrow: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={draft.home.products.title}
                      placeholder={SITE_CONTENT_DEFAULTS.home.products.title}
                      onChange={(e) => updateHomeProducts({ title: e.target.value })}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="style">
              <AccordionTrigger>Shop by Style</AccordionTrigger>
              <AccordionContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Section Eyebrow</Label>
                    <Input
                      value={draft.home.style.eyebrow}
                      placeholder={SITE_CONTENT_DEFAULTS.home.style.eyebrow}
                      onChange={(e) => updateHomeStyle({ eyebrow: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Section Title</Label>
                    <Input
                      value={draft.home.style.title}
                      placeholder={SITE_CONTENT_DEFAULTS.home.style.title}
                      onChange={(e) => updateHomeStyle({ title: e.target.value })}
                    />
                  </div>
                </div>

                {([0, 1] as const).map((index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-4">
                    <p className="text-sm font-medium">Tile {index + 1}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Eyebrow</Label>
                        <Input
                          value={draft.home.style.tiles[index].eyebrow}
                          placeholder={SITE_CONTENT_DEFAULTS.home.style.tiles[index].eyebrow}
                          onChange={(e) => updateHomeTile(index, { eyebrow: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          value={draft.home.style.tiles[index].title}
                          placeholder={SITE_CONTENT_DEFAULTS.home.style.tiles[index].title}
                          onChange={(e) => updateHomeTile(index, { title: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Link (where the tile goes when clicked)</Label>
                      <Input
                        value={draft.home.style.tiles[index].href}
                        placeholder={SITE_CONTENT_DEFAULTS.home.style.tiles[index].href}
                        onChange={(e) => updateHomeTile(index, { href: e.target.value })}
                      />
                    </div>
                    <RotatingMediaField
                      slotId={`home.style.tiles.${index}`}
                      existing={draft.home.style.tiles[index].media}
                      onRemoveExisting={(mediaIndex) => removeHomeTileMedia(index, mediaIndex)}
                      onUpdateExistingAlt={(mediaIndex, alt) => updateHomeTileMediaAlt(index, mediaIndex, alt)}
                      newEntries={newMedia[`home.style.tiles.${index}`] ?? []}
                      onAddNew={(p) => addNewMedia(`home.style.tiles.${index}`, p)}
                      onRemoveNew={(id) => removeNewMedia(`home.style.tiles.${index}`, id)}
                      onSetNewPoster={(id, poster) => setNewMediaPoster(`home.style.tiles.${index}`, id, poster)}
                      onSetNewAlt={(id, alt) => setNewMediaAlt(`home.style.tiles.${index}`, id, alt)}
                      disabled={saving === 'home'}
                    />
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="philosophy" className="border-b-0">
              <AccordionTrigger>Philosophy</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Eyebrow</Label>
                  <Input
                    value={draft.home.philosophy.eyebrow}
                    placeholder={SITE_CONTENT_DEFAULTS.home.philosophy.eyebrow}
                    onChange={(e) => updateHomePhilosophy({ eyebrow: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quote</Label>
                  <Textarea
                    rows={3}
                    value={draft.home.philosophy.quote}
                    placeholder={SITE_CONTENT_DEFAULTS.home.philosophy.quote}
                    onChange={(e) => updateHomePhilosophy({ quote: e.target.value })}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        {/* ---------------- CONTACT ---------------- */}
        <TabsContent value="contact" className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {dirty.contact ? 'Unsaved changes' : 'All changes saved'}
            </p>
            <Button onClick={handleSaveContact} disabled={saving === 'contact' || !dirty.contact}>
              {saving === 'contact' ? 'Saving...' : 'Save Contact Page'}
            </Button>
          </div>

          <Accordion type="multiple" defaultValue={['hero']} className="bg-background rounded-lg border px-6">
            <AccordionItem value="hero">
              <AccordionTrigger>Hero</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Eyebrow</Label>
                    <Input
                      value={draft.contact.hero.eyebrow}
                      placeholder={SITE_CONTENT_DEFAULTS.contact.hero.eyebrow}
                      onChange={(e) => updateContactHero({ eyebrow: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={draft.contact.hero.title}
                      placeholder={SITE_CONTENT_DEFAULTS.contact.hero.title}
                      onChange={(e) => updateContactHero({ title: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Body</Label>
                  <Textarea
                    rows={3}
                    value={draft.contact.hero.body}
                    placeholder={SITE_CONTENT_DEFAULTS.contact.hero.body}
                    onChange={(e) => updateContactHero({ body: e.target.value })}
                  />
                </div>
                <MediaSlotField
                  slotId="contact.hero"
                  value={draft.contact.hero.media}
                  onValueChange={(v) => updateContactHero({ media: v ?? SITE_CONTENT_DEFAULTS.contact.hero.media })}
                  pending={pending['contact.hero'] ?? null}
                  onPendingChange={(p) => setPendingFor('contact.hero', p)}
                  posterPending={pending['contact.hero.poster'] ?? null}
                  onPosterPendingChange={(p) => setPendingFor('contact.hero.poster', p)}
                  disabled={saving === 'contact'}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="info">
              <AccordionTrigger>Contact Details</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={draft.contact.info.email}
                      placeholder={SITE_CONTENT_DEFAULTS.contact.info.email}
                      onChange={(e) => updateContactInfo({ email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp / Phone</Label>
                    <Input
                      value={draft.contact.info.phone}
                      placeholder={SITE_CONTENT_DEFAULTS.contact.info.phone}
                      onChange={(e) => updateContactInfo({ phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Instagram Handle</Label>
                    <Input
                      value={draft.contact.info.instagram_handle}
                      placeholder={SITE_CONTENT_DEFAULTS.contact.info.instagram_handle}
                      onChange={(e) => updateContactInfo({ instagram_handle: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Instagram URL</Label>
                    <Input
                      value={draft.contact.info.instagram_url}
                      placeholder={SITE_CONTENT_DEFAULTS.contact.info.instagram_url}
                      onChange={(e) => updateContactInfo({ instagram_url: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input
                      value={draft.contact.info.location}
                      placeholder={SITE_CONTENT_DEFAULTS.contact.info.location}
                      onChange={(e) => updateContactInfo({ location: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp prefilled message</Label>
                  <Textarea
                    rows={2}
                    value={draft.contact.info.whatsapp_message}
                    placeholder={SITE_CONTENT_DEFAULTS.contact.info.whatsapp_message}
                    onChange={(e) => updateContactInfo({ whatsapp_message: e.target.value })}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="form" className="border-b-0">
              <AccordionTrigger>Form Copy</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Form Title</Label>
                  <Input
                    value={draft.contact.form.title}
                    placeholder={SITE_CONTENT_DEFAULTS.contact.form.title}
                    onChange={(e) => updateContactForm({ title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Success Message</Label>
                  <Textarea
                    rows={2}
                    value={draft.contact.form.success_message}
                    placeholder={SITE_CONTENT_DEFAULTS.contact.form.success_message}
                    onChange={(e) => updateContactForm({ success_message: e.target.value })}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default AdminSiteContent;
