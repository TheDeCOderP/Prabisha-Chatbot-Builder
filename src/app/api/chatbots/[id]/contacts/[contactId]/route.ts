import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string; contactId: string }> };

async function getAuthorizedContact(context: RouteContext) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
	const { id, contactId } = await context.params;
	const contact = await prisma.contact.findFirst({ where: { id: contactId, chatbotId: id, chatbot: { workspace: { members: { some: { userId: session.user.id } } } } } });
	if (!contact) return { response: NextResponse.json({ error: 'Contact not found or access denied' }, { status: 404 }) };
	return { contact };
}

export async function PATCH(request: Request, context: RouteContext) {
	try {
		const access = await getAuthorizedContact(context);
		if ('response' in access) return access.response;
		const body = await request.json();
		const data: { name?: string; role?: string; email?: string | null; phoneNumber?: string | null } = {};
		if (body.name !== undefined) data.name = typeof body.name === 'string' ? body.name.trim() : '';
		if (body.role !== undefined) data.role = typeof body.role === 'string' ? body.role.trim() : '';
		if (body.email !== undefined) data.email = typeof body.email === 'string' ? body.email.trim() || null : null;
		if (body.phoneNumber !== undefined) data.phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() || null : null;
		if (data.name === '' || data.role === '') return NextResponse.json({ error: 'Name and role cannot be empty' }, { status: 400 });
		const contact = await prisma.contact.update({ where: { id: access.contact.id }, data });
		await prisma.questionCache.deleteMany({ where: { chatbotId: access.contact.chatbotId } });
		return NextResponse.json({ contact });
	} catch (error) {
		console.error('Failed to update contact:', error);
		return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
	}
}

export async function DELETE(request: Request, context: RouteContext) {
	try {
		const access = await getAuthorizedContact(context);
		if ('response' in access) return access.response;
		await prisma.contact.delete({ where: { id: access.contact.id } });
		await prisma.questionCache.deleteMany({ where: { chatbotId: access.contact.chatbotId } });
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Failed to delete contact:', error);
		return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
	}
}
