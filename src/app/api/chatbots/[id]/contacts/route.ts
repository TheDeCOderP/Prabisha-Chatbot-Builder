import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

async function getAuthorizedChatbot(context: RouteContext) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
	const { id } = await context.params;
	const chatbot = await prisma.chatbot.findFirst({
		where: { id, workspace: { members: { some: { userId: session.user.id } } } },
		select: { id: true },
	});
	if (!chatbot) return { response: NextResponse.json({ error: 'Chatbot not found or access denied' }, { status: 404 }) };
	return { chatbot };
}

export async function GET(request: Request, context: RouteContext) {
	try {
		const access = await getAuthorizedChatbot(context);
		if ('response' in access) return access.response;
		const contacts = await prisma.contact.findMany({ where: { chatbotId: access.chatbot.id }, orderBy: [{ role: 'asc' }, { name: 'asc' }] });
		return NextResponse.json({ contacts });
	} catch (error) {
		console.error('Failed to fetch contacts:', error);
		return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
	}
}

export async function POST(request: Request, context: RouteContext) {
	try {
		const access = await getAuthorizedChatbot(context);
		if ('response' in access) return access.response;
		const body = await request.json();
		const name = typeof body.name === 'string' ? body.name.trim() : '';
		const role = typeof body.role === 'string' ? body.role.trim() : '';
		const email = typeof body.email === 'string' ? body.email.trim() : null;
		const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : null;
		if (!name || !role) return NextResponse.json({ error: 'Name and role are required' }, { status: 400 });
		const contact = await prisma.contact.create({ data: { chatbotId: access.chatbot.id, name, role, email: email || null, phoneNumber: phoneNumber || null } });
		await prisma.questionCache.deleteMany({ where: { chatbotId: access.chatbot.id } });
		return NextResponse.json({ contact }, { status: 201 });
	} catch (error) {
		console.error('Failed to create contact:', error);
		return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
	}
}
