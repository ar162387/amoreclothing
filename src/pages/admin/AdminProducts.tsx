
import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Upload, X } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { productsService, Product, CreateProductDTO, SizeGuide, SizeGuideHead, SizeGuideRow } from '@/services/products';
import { collectionsService, Collection } from '@/services/collections';
import { fabricCareService, FabricCare } from '@/services/fabricCare';
import { uploadService } from '@/services/upload';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [fabricCareOptions, setFabricCareOptions] = useState<FabricCare[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await productsService.getProducts();
    if (error) {
      toast.error('Failed to load products');
      console.error(error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const fetchCollections = async () => {
    const { data, error } = await collectionsService.getCollections();
    if (error) {
      console.error('Failed to load collections', error);
    } else {
      setCollections(data || []);
    }
  };

  const fetchFabricCare = async () => {
    const { data, error } = await fabricCareService.getAll();
    if (error) {
      console.error('Failed to load fabric & care entries', error);
    } else {
      setFabricCareOptions(data || []);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCollections();
    fetchFabricCare();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;

    const { error } = await productsService.deleteProduct(id);
    if (error) {
      toast.error('Failed to delete product');
    } else {
      toast.success('Product deleted successfully');
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleSave = async (productData: CreateProductDTO, id?: string) => {
    try {
      if (id) {
        const { data, error } = await productsService.updateProduct(id, productData);
        if (error) throw error;
        toast.success('Product updated successfully');
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? (data as Product) : p))
        );
      } else {
        const { data, error } = await productsService.createProduct(productData);
        if (error) throw error;
        toast.success('Product added successfully');
        if (data) setProducts((prev) => [data as Product, ...prev]);
      }
      setIsDialogOpen(false);
      setEditingProduct(null);
    } catch (error) {
      console.error(error);
      toast.error('Failed to save product');
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-light mb-2">Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage your product catalog
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => setEditingProduct(null)}
              className="uppercase tracking-wider"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl font-light">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </DialogTitle>
              <DialogDescription>
                {editingProduct ? 'Update the details of your product below.' : 'Fill in the details to create a new product.'}
              </DialogDescription>
            </DialogHeader>
            <ProductForm
              product={editingProduct}
              collections={collections}
              fabricCareOptions={fabricCareOptions}
              onSave={handleSave}
              onCancel={() => setIsDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="bg-background border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Collection</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock (Sizes)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-16 bg-muted shrink-0 overflow-hidden rounded border">
                        {product.image_front ? (
                          <img
                            src={product.image_front}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                            No Img
                          </div>
                        )}
                      </div>
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{product.collections?.name || '-'}</TableCell>
                  <TableCell>PKR {product.price.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {product.sizes && product.sizes.length > 0 ? (
                        product.sizes.map((s) => (
                          <span key={s} className="px-2 py-0.5 bg-secondary text-xs rounded-full">
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-destructive text-xs">Out of Stock</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingProduct(product);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout >
  );
};

// Product Form Component
interface ProductFormProps {
  product: Product | null;
  collections: Collection[];
  fabricCareOptions: FabricCare[];
  onSave: (data: CreateProductDTO, id?: string) => Promise<void>;
  onCancel: () => void;
}

const AVAILABLE_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Local file state interface
interface LocalFile {
  file: File;
  preview: string;
}

const ProductForm = ({ product, collections, fabricCareOptions, onSave, onCancel }: ProductFormProps) => {
  const [formData, setFormData] = useState<CreateProductDTO>({
    name: product?.name || '',
    price: product?.price || 0,
    description: product?.description || '',
    collection_id: product?.collection_id || '',
    sizes: product?.sizes || [],
    image_front: product?.image_front || '',
    image_back: product?.image_back || '',
    images_other: product?.images_other || [],
    available: product?.available ?? true,
    featured: product?.featured ?? false,
    size_guide: product?.size_guide || [],
    fabric_care_id: product?.fabric_care_id || null,
  });

  const [localFront, setLocalFront] = useState<LocalFile | null>(null);
  const [localBack, setLocalBack] = useState<LocalFile | null>(null);
  const [localOthers, setLocalOthers] = useState<LocalFile[]>([]);
  const [uploading, setUploading] = useState(false);

  // Reset form when product changes (e.g., when opening edit modal)
  useEffect(() => {
    setFormData({
      name: product?.name || '',
      price: product?.price || 0,
      description: product?.description || '',
      collection_id: product?.collection_id || '',
      sizes: product?.sizes || [],
      image_front: product?.image_front || '',
      image_back: product?.image_back || '',
      images_other: product?.images_other || [],
      available: product?.available ?? true,
      featured: product?.featured ?? false,
      size_guide: product?.size_guide || [],
      fabric_care_id: product?.fabric_care_id || null,
    });
    // Clear local file states when switching products
    setLocalFront(null);
    setLocalBack(null);
    setLocalOthers([]);
  }, [product]);


  // Helper to handle local file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, field: 'image_front' | 'image_back' | 'images_other') => {
    if (!e.target.files?.length) return;

    if (field === 'images_other') {
      const newFiles: LocalFile[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        newFiles.push({
          file,
          preview: URL.createObjectURL(file)
        });
      }
      setLocalOthers(prev => [...prev, ...newFiles]);
    } else {
      const file = e.target.files[0];
      const localFile = { file, preview: URL.createObjectURL(file) };
      if (field === 'image_front') setLocalFront(localFile);
      if (field === 'image_back') setLocalBack(localFile);
    }
  };

  const removeLocalOther = (index: number) => {
    setLocalOthers(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingOther = (urlToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      images_other: prev.images_other?.filter(url => url !== urlToRemove)
    }));
  };

  const handleSizeToggle = (size: string) => {
    const currentSizes = formData.sizes || [];
    const newSizes = currentSizes.includes(size)
      ? currentSizes.filter((s) => s !== size)
      : [...currentSizes, size];

    setFormData({
      ...formData,
      sizes: newSizes,
      available: newSizes.length > 0
    });
  };

  // --- Size guide (dynamic heads/rows, per selected size) -----------------
  const sizeGuide: SizeGuide = formData.size_guide || [];
  const selectedSizes = formData.sizes || [];

  const setSizeGuide = (next: SizeGuide) => setFormData((prev) => ({ ...prev, size_guide: next }));

  const addHead = () => setSizeGuide([...sizeGuide, { id: newId(), label: '', rows: [] }]);
  const removeHead = (headId: string) => setSizeGuide(sizeGuide.filter((h) => h.id !== headId));
  const updateHeadLabel = (headId: string, label: string) =>
    setSizeGuide(sizeGuide.map((h) => (h.id === headId ? { ...h, label } : h)));

  const addRow = (headId: string) =>
    setSizeGuide(
      sizeGuide.map((h) => (h.id === headId ? { ...h, rows: [...h.rows, { id: newId(), label: '', values: {} }] } : h))
    );
  const removeRow = (headId: string, rowId: string) =>
    setSizeGuide(sizeGuide.map((h) => (h.id === headId ? { ...h, rows: h.rows.filter((r) => r.id !== rowId) } : h)));
  const updateRowLabel = (headId: string, rowId: string, label: string) =>
    setSizeGuide(
      sizeGuide.map((h) =>
        h.id === headId ? { ...h, rows: h.rows.map((r) => (r.id === rowId ? { ...r, label } : r)) } : h
      )
    );
  const updateRowValue = (headId: string, rowId: string, size: string, value: string) =>
    setSizeGuide(
      sizeGuide.map((h) =>
        h.id === headId
          ? { ...h, rows: h.rows.map((r) => (r.id === rowId ? { ...r, values: { ...r.values, [size]: value } } : r)) }
          : h
      )
    );

  /** Every row must have a value for every currently-selected size before saving — a size guide
   * that's silently missing a column is worse than no size guide at all. */
  const validateSizeGuide = (): string | null => {
    for (const head of sizeGuide) {
      if (!head.label.trim()) return 'Every size guide head needs a name.';
      for (const row of head.rows) {
        if (!row.label.trim()) return `Every row under "${head.label}" needs a name.`;
        for (const size of selectedSizes) {
          if (!row.values[size]?.trim()) {
            return `"${head.label} — ${row.label}" is missing a value for size ${size}.`;
          }
        }
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const sizeGuideError = validateSizeGuide();
    if (sizeGuideError) {
      toast.error(sizeGuideError);
      return;
    }

    setUploading(true);

    try {
      let finalFront = formData.image_front;
      let finalBack = formData.image_back;
      const finalOthers = [...(formData.images_other || [])];

      // Upload local files
      if (localFront) {
        const url = await uploadService.uploadImage(localFront.file);
        finalFront = url;
      }

      if (localBack) {
        const url = await uploadService.uploadImage(localBack.file);
        finalBack = url;
      }

      for (const local of localOthers) {
        const url = await uploadService.uploadImage(local.file);
        finalOthers.push(url);
      }

      const finalData: CreateProductDTO = {
        ...formData,
        collection_id: formData.collection_id || null,
        image_front: finalFront,
        image_back: finalBack,
        images_other: finalOthers,
      };

      await onSave(finalData, product?.id);
    } catch (error) {
      console.error("Upload error", error);
      toast.error("Failed to upload images. Product not saved.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (PKR)</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="collection">Collection</Label>
              <Select
                value={formData.collection_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, collection_id: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select collection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No collection</SelectItem>
                  {collections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fabric-care">Fabric &amp; Care</Label>
            <Select
              value={formData.fabric_care_id || 'none'}
              onValueChange={(value) => setFormData({ ...formData, fabric_care_id: value === 'none' ? null : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select fabric & care info" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {fabricCareOptions.map((fc) => (
                  <SelectItem key={fc.id} value={fc.id}>
                    {fc.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Shown below the description on the product page. Manage entries under Fabric & Care.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Available Sizes (In Stock)</Label>
            <div className="flex flex-wrap gap-4 p-4 border rounded-md">
              {AVAILABLE_SIZES.map((size) => (
                <div key={size} className="flex items-center space-x-2">
                  <Checkbox
                    id={`size-${size}`}
                    checked={(formData.sizes || []).includes(size)}
                    onCheckedChange={() => handleSizeToggle(size)}
                  />
                  <label
                    htmlFor={`size-${size}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {size}
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Unchecked sizes are considered out of stock.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="featured"
              checked={formData.featured}
              onCheckedChange={(checked) => setFormData({ ...formData, featured: checked as boolean })}
            />
            <Label htmlFor="featured">Featured Product</Label>
          </div>
        </div>

        {/* Image Upload Section */}
        <div className="space-y-6">
          <Label className="text-lg">Images</Label>

          {/* Front Image */}
          <div className="space-y-2">
            <Label>Front Image</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/50 transition-colors">
              {localFront ? (
                <div className="relative aspect-[3/4] w-32 mx-auto">
                  <img src={localFront.preview} alt="Front New" className="w-full h-full object-cover rounded opacity-90" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white text-xs font-medium">New</div>
                  <Button
                    variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6"
                    type="button"
                    onClick={() => setLocalFront(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : formData.image_front ? (
                <div className="relative aspect-[3/4] w-32 mx-auto">
                  <img src={formData.image_front} alt="Front" className="w-full h-full object-cover rounded" />
                  <Button
                    variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6"
                    type="button"
                    onClick={() => setFormData({ ...formData, image_front: '' })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <Input
                    type="file" accept="image/*" className="hidden" id="front-upload"
                    onChange={(e) => handleFileSelect(e, 'image_front')}
                  />
                  <Label htmlFor="front-upload" className="cursor-pointer text-sm text-primary hover:underline">
                    Upload Front Image
                  </Label>
                </div>
              )}
            </div>
          </div>

          {/* Back Image */}
          <div className="space-y-2">
            <Label>Back Image</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/50 transition-colors">
              {localBack ? (
                <div className="relative aspect-[3/4] w-32 mx-auto">
                  <img src={localBack.preview} alt="Back New" className="w-full h-full object-cover rounded opacity-90" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white text-xs font-medium">New</div>
                  <Button
                    variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6"
                    type="button"
                    onClick={() => setLocalBack(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : formData.image_back ? (
                <div className="relative aspect-[3/4] w-32 mx-auto">
                  <img src={formData.image_back} alt="Back" className="w-full h-full object-cover rounded" />
                  <Button
                    variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6"
                    type="button"
                    onClick={() => setFormData({ ...formData, image_back: '' })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <Input
                    type="file" accept="image/*" className="hidden" id="back-upload"
                    onChange={(e) => handleFileSelect(e, 'image_back')}
                  />
                  <Label htmlFor="back-upload" className="cursor-pointer text-sm text-primary hover:underline">
                    Upload Back Image
                  </Label>
                </div>
              )}
            </div>
          </div>

          {/* Other Images */}
          <div className="space-y-2">
            <Label>Other Images</Label>
            <div className="border-2 border-dashed rounded-lg p-4">
              <div className="grid grid-cols-3 gap-2 mb-4">
                {/* Existing Images */}
                {formData.images_other?.map((url, idx) => (
                  <div key={`existing-${idx}`} className="relative aspect-square">
                    <img src={url} alt={`Other ${idx}`} className="w-full h-full object-cover rounded" />
                    <Button
                      variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5"
                      type="button"
                      onClick={() => removeExistingOther(url)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {/* New Local Images */}
                {localOthers.map((file, idx) => (
                  <div key={`local-${idx}`} className="relative aspect-square">
                    <img src={file.preview} alt={`Local ${idx}`} className="w-full h-full object-cover rounded opacity-90" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white text-xs font-medium">New</div>
                    <Button
                      variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5"
                      type="button"
                      onClick={() => removeLocalOther(idx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="text-center">
                <Input
                  type="file" accept="image/*" multiple className="hidden" id="other-upload"
                  onChange={(e) => handleFileSelect(e, 'images_other')}
                />
                <Label htmlFor="other-upload" className="cursor-pointer text-xs flex items-center justify-center gap-2 text-primary hover:underline">
                  <Plus className="h-4 w-4" /> Add More Images
                </Label>
              </div>
            </div>
          </div>

          {uploading && <p className="text-xs text-blue-500 text-center animate-pulse">Uploading images...</p>}
        </div>
      </div>

      {/* Size Guide — any number of heads (e.g. Shirt, Trouser), each with any number of rows
          (e.g. Length, Chest), each requiring a value for every currently-selected size. */}
      <div className="space-y-3 pt-4 border-t">
        <div>
          <Label className="text-base">Size Guide</Label>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedSizes.length === 0
              ? 'Select at least one size above to build a size guide.'
              : `Every row needs a value for each selected size: ${selectedSizes.join(', ')}.`}
          </p>
        </div>

        {sizeGuide.map((head) => (
          <div key={head.id} className="border rounded-md p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={head.label}
                onChange={(e) => updateHeadLabel(head.id, e.target.value)}
                placeholder="Head name, e.g. Shirt"
                className="font-medium"
              />
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => removeHead(head.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {head.rows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-2 pl-4 border-l-2 border-border">
                <Input
                  value={row.label}
                  onChange={(e) => updateRowLabel(head.id, row.id, e.target.value)}
                  placeholder="Row, e.g. Length"
                  className="w-40 shrink-0"
                />
                {selectedSizes.map((size) => (
                  <div key={size} className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground w-6 text-center">{size}</span>
                    <Input
                      value={row.values[size] || ''}
                      onChange={(e) => updateRowValue(head.id, row.id, size, e.target.value)}
                      placeholder="e.g. 68 cm"
                      className="w-24"
                    />
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => removeRow(head.id, row.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => addRow(head.id)}
              disabled={selectedSizes.length === 0}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
            </Button>
          </div>
        ))}

        <Button variant="outline" size="sm" type="button" onClick={addHead}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Head (e.g. Shirt, Trouser)
        </Button>
      </div>

      <div className="flex gap-4 pt-4 border-t">
        <Button variant="outline" type="button" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={uploading}>
          {uploading ? 'Saving...' : (product ? 'Update Product' : 'Add Product')}
        </Button>
      </div>
    </form>
  );
};

export default AdminProducts;
