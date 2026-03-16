
import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { collectionsService, Collection, CreateCollectionDTO } from '@/services/collections';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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

const AdminCollections = () => {
    const [collectionList, setCollectionList] = useState<Collection[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const fetchCollections = async () => {
        setLoading(true);
        const { data, error } = await collectionsService.getCollections();
        if (error) {
            toast.error('Failed to load collections');
            console.error(error);
        } else {
            setCollectionList(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchCollections();
    }, []);

    const handleDelete = async (id: string) => {
        // Ideally we should have a confirmation dialog here
        if (!window.confirm("Are you sure you want to delete this collection?")) return;

        const { error } = await collectionsService.deleteCollection(id);
        if (error) {
            toast.error('Failed to delete collection');
        } else {
            toast.success('Collection deleted successfully');
            setCollectionList((prev) => prev.filter((c) => c.id !== id));
        }
    };

    const handleSave = async (collectionData: CreateCollectionDTO) => {
        try {
            if (editingCollection) {
                const { data, error } = await collectionsService.updateCollection(editingCollection.id, collectionData);
                if (error) throw error;
                toast.success('Collection updated successfully');
                setCollectionList((prev) =>
                    prev.map((c) => (c.id === editingCollection.id ? (data as Collection) : c))
                );
            } else {
                const { data, error } = await collectionsService.createCollection(collectionData);
                if (error) throw error;
                toast.success('Collection added successfully');
                if (data) setCollectionList((prev) => [data as Collection, ...prev]);
            }
            setIsDialogOpen(false);
            setEditingCollection(null);
        } catch (error) {
            console.error(error);
            toast.error('Failed to save collection');
        }
    };

    return (
        <AdminLayout>
            <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-light mb-2">Collections</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage your product collections
                    </p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button
                            onClick={() => setEditingCollection(null)}
                            className="uppercase tracking-wider"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Collection
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="font-serif text-2xl font-light">
                                {editingCollection ? 'Edit Collection' : 'Add New Collection'}
                            </DialogTitle>
                        </DialogHeader>
                        <CollectionForm
                            collection={editingCollection}
                            onSave={handleSave}
                            onCancel={() => setIsDialogOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            <div className="bg-background border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Season</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Description</TableHead>
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
                        ) : collectionList.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                    No collections found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            collectionList.map((collection) => (
                                <TableRow key={collection.id}>
                                    <TableCell className="font-medium">{collection.name}</TableCell>
                                    <TableCell>{collection.season}</TableCell>
                                    <TableCell>{collection.product_count || 0}</TableCell>
                                    <TableCell className="max-w-[300px] truncate" title={collection.description || ""}>
                                        {collection.description}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    setEditingCollection(collection);
                                                    setIsDialogOpen(true);
                                                }}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDelete(collection.id)}
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
        </AdminLayout>
    );
};

// Collection Form Component
interface CollectionFormProps {
    collection: Collection | null;
    onSave: (data: CreateCollectionDTO) => void;
    onCancel: () => void;
}

const CollectionForm = ({ collection, onSave, onCancel }: CollectionFormProps) => {
    const [formData, setFormData] = useState<CreateCollectionDTO>({
        name: collection?.name || '',
        season: collection?.season || '',
        description: collection?.description || '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            <div className="space-y-2">
                <Label htmlFor="name">Collection Name</Label>
                <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="season">Season</Label>
                <Input
                    id="season"
                    value={formData.season}
                    onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                    placeholder="e.g., Spring/Summer 2025"
                    required
                />
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

            <div className="flex gap-4 pt-4">
                <Button variant="outline" type="button" onClick={onCancel} className="flex-1">
                    Cancel
                </Button>
                <Button type="submit" className="flex-1">
                    {collection ? 'Update Collection' : 'Add Collection'}
                </Button>
            </div>
        </form>
    );
};

export default AdminCollections;
