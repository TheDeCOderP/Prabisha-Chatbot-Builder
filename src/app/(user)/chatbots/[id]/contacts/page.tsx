"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Mail, Pencil, Phone, Plus, Trash2, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type Contact = { id: string; name: string; role: string; email: string | null; phoneNumber: string | null }
const emptyForm = { name: "", role: "", email: "", phoneNumber: "" }

export default function ContactsPage() {
	const { id } = useParams<{ id: string }>()
	const [contacts, setContacts] = useState<Contact[]>([])
	const [form, setForm] = useState(emptyForm)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)

	const loadContacts = useCallback(async () => {
		try {
			const response = await fetch(`/api/chatbots/${id}/contacts`)
			if (!response.ok) throw new Error()
			setContacts((await response.json()).contacts)
		} catch { toast.error("Failed to load contacts") } finally { setLoading(false) }
	}, [id])

	useEffect(() => { loadContacts() }, [loadContacts])

	const addContact = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!form.name.trim() || !form.role.trim()) return toast.error("Name and role are required")
		setSaving(true)
		try {
			const response = await fetch(editingId ? `/api/chatbots/${id}/contacts/${editingId}` : `/api/chatbots/${id}/contacts`, { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
			const data = await response.json()
			if (!response.ok) throw new Error(data.error)
			setContacts(current => (editingId ? current.map(contact => contact.id === editingId ? data.contact : contact) : [...current, data.contact]).sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name)))
			setForm(emptyForm)
			setEditingId(null)
			toast.success(editingId ? "Contact updated" : "Contact added")
		} catch (error) { toast.error(error instanceof Error ? error.message : `Failed to ${editingId ? "update" : "add"} contact`) } finally { setSaving(false) }
	}

	const startEditing = (contact: Contact) => {
		setEditingId(contact.id)
		setForm({ name: contact.name, role: contact.role, email: contact.email || "", phoneNumber: contact.phoneNumber || "" })
		window.scrollTo({ top: 0, behavior: "smooth" })
	}

	const cancelEditing = () => { setEditingId(null); setForm(emptyForm) }

	const removeContact = async (contact: Contact) => {
		if (!window.confirm(`Remove ${contact.name}?`)) return
		const response = await fetch(`/api/chatbots/${id}/contacts/${contact.id}`, { method: "DELETE" })
		if (!response.ok) return toast.error("Failed to remove contact")
		setContacts(current => current.filter(item => item.id !== contact.id))
		toast.success("Contact removed")
	}

	return <div className="mx-auto max-w-5xl space-y-8 p-8">
		<div><h1 className="text-3xl font-bold tracking-tight">Contacts</h1><p className="mt-1 text-muted-foreground">Give your chatbot trusted people to contact when scheduling meetings or routing requests.</p></div>
		<Card><CardHeader><CardTitle>Add a contact</CardTitle><CardDescription>Roles help the chatbot choose the right person.</CardDescription></CardHeader>
			<CardContent><form onSubmit={addContact} className="grid gap-4 md:grid-cols-2">
				{([['name', 'Full name', 'e.g. Priya Sharma'], ['role', 'Role', 'e.g. Sales'], ['email', 'Email', 'name@company.com'], ['phoneNumber', 'Phone number', '+1 555 123 4567']] as const).map(([key, label, placeholder]) => <label key={key} className="space-y-2 text-sm font-medium">{label}<Input value={form[key]} placeholder={placeholder} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} required={key === 'name' || key === 'role'} /></label>)}
				<div className="flex gap-2 md:col-span-2"><Button type="submit" disabled={saving}>{editingId ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{saving ? "Saving..." : editingId ? "Save changes" : "Add contact"}</Button>{editingId && <Button type="button" variant="outline" onClick={cancelEditing}>Cancel</Button>}</div>
			</form></CardContent>
		</Card>
		<div className="space-y-3"><h2 className="text-lg font-semibold">Your contacts</h2>{loading ? <p className="text-sm text-muted-foreground">Loading contacts...</p> : contacts.length === 0 ? <Card className="border-dashed"><CardContent className="flex flex-col items-center py-12 text-center"><UserRound className="mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium">No contacts yet</p><p className="text-sm text-muted-foreground">Add the people your chatbot can route meetings to.</p></CardContent></Card> : <div className="grid gap-3 md:grid-cols-2">{contacts.map(contact => <Card key={contact.id}><CardContent className="flex items-start justify-between gap-4 p-5"><div className="min-w-0"><div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-muted-foreground" /><p className="truncate font-semibold">{contact.name}</p></div><Badge variant="secondary" className="mt-2">{contact.role}</Badge><div className="mt-3 space-y-1 text-sm text-muted-foreground">{contact.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{contact.email}</p>}{contact.phoneNumber && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{contact.phoneNumber}</p>}</div></div><div className="flex shrink-0"><Button variant="ghost" size="icon" aria-label={`Edit ${contact.name}`} onClick={() => startEditing(contact)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={`Remove ${contact.name}`} onClick={() => removeContact(contact)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></CardContent></Card>)}</div>}</div>
	</div>
}
