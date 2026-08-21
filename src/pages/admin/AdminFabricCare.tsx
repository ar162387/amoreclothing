
import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { fabricCareService, FabricCare, CreateFabricCareDTO } from '@/services/fabricCare';
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

const AdminFabricCare = () => {
    const [entries, setEntries] = useState<FabricCare[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<FabricCare | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const fetchEntries = async () => {
        setLoading(true);
        const { data, error } = await fabricCareService.getAll();
        if (error) {
            toast.error('Failed to load fabric & care entries');
            console.error(error);
        } else {
            setEntries(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchEntries();
    }, []);

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this fabric & care entry? Any products using it will show no fabric info until you assign a different one.')) return;

        const { error } = await fabricCareService.remove(id);
        if (error) {
            toast.error('Failed to delete entry');
        } else {
            toast.success('Entry deleted');
            setEntries((prev) => prev.filter((e) => e.id !== id));
        }
    };

    const handleSave = async (data: CreateFabricCareDTO) => {
        try {
            if (editing) {
                const { data: updated, error } = await fabricCareService.update(editing.id, data);
                if (error) throw error;
                toast.success('Entry updated');
                setEntries((prev) => prev.map((e) => (e.id === editing.id ? (updated as FabricCare) : e)));
            } else {
                const { data: created, error } = await fabricCareService.create(data);
                if (error) throw error;
                toast.success('Entry added');
                if (created) setEntries((prev) => [...prev, created as FabricCare]);
            }
            setIsDialogOpen(false);
            setEditing(null);
        } catch (error) {
            console.error(error);
            toast.error('Failed to save entry');
        }
    };

    return (
        <AdminLayout>
            <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-light mb-2">Fabric &amp; Care</h1>
                    <p className="text-sm text-muted-foreground">
                        Create reusable fabric &amp; care descriptions, then assign one to any number of products
                        from the product form. It shows below the description on the product page.
                    </p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => setEditing(null)} className="uppercase tracking-wider">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Entry
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="font-serif text-2xl font-light">
                                {editing ? 'Edit Entry' : 'Add New Entry'}
                            </DialogTitle>
                        </DialogHeader>
                        <FabricCareForm entry={editing} onSave={handleSave} onCancel={() => setIsDialogOpen(false)} />
                    </DialogContent>
                </Dialog>
            </div>

            <div className="bg-background border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-10">Loading...</TableCell>
                            </TableRow>
                        ) : entries.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">
                                    No fabric &amp; care entries yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            entries.map((entry) => (
                                <TableRow key={entry.id}>
                                    <TableCell className="font-medium">{entry.title}</TableCell>
                                    <TableCell className="max-w-[400px] truncate" title={entry.body}>
                                        {entry.body}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    setEditing(entry);
                                                    setIsDialogOpen(true);
                                                }}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDelete(entry.id)}
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

interface FabricCareFormProps {
    entry: FabricCare | null;
    onSave: (data: CreateFabricCareDTO) => void;
    onCancel: () => void;
}

const FabricCareForm = ({ entry, onSave, onCancel }: FabricCareFormProps) => {
    const [formData, setFormData] = useState<CreateFabricCareDTO>({
        title: entry?.title || '',
        body: entry?.body || '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            <div className="space-y-2">
                <Label htmlFor="fc-title">Title</Label>
                <Input
                    id="fc-title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Brushed Wool Blend"
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="fc-body">Fabric &amp; Care Description</Label>
                <Textarea
                    id="fc-body"
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    rows={6}
                    className="resize-none"
                    placeholder={'70% Wool, 30% Polyester.\nDry clean only. Do not bleach.'}
                    required
                />
            </div>

            <div className="flex gap-4 pt-4">
                <Button variant="outline" type="button" onClick={onCancel} className="flex-1">
                    Cancel
                </Button>
                <Button type="submit" className="flex-1">
                    {entry ? 'Update Entry' : 'Add Entry'}
                </Button>
            </div>
        </form>
    );
};

export default AdminFabricCare;
