import type { Page } from 'playwright';
import { generateBretzelPng, generateSaltShakerPng } from './bretzel-pixel';
import { BASE_URL, ADMIN, COLLABORATOR } from './constants';

type HttpMethod = 'post' | 'patch' | 'get' | 'delete';

async function api(page: Page, method: HttpMethod, path: string, data?: unknown) {
	const res = await page.request[method](
		`${BASE_URL}${path}`,
		data !== undefined ? { data } : undefined
	);
	if (!res.ok()) {
		throw new Error(`${method.toUpperCase()} ${path} failed: ${res.status()} ${await res.text()}`);
	}
	const text = await res.text();
	return text ? JSON.parse(text) : {};
}

async function uploadAttachment(
	page: Page,
	noteId: string,
	filename: string,
	pngBuffer: Buffer,
	featured: boolean
): Promise<void> {
	const res = await page.request.post(`${BASE_URL}/api/notes/${noteId}/attachments`, {
		multipart: {
			file: {
				name: filename,
				mimeType: 'image/png',
				buffer: pngBuffer
			}
		}
	});
	if (!res.ok()) {
		throw new Error(`Upload ${filename} failed: ${res.status()} ${await res.text()}`);
	}
	if (featured) {
		const attachment = await res.json();
		await api(page, 'patch', `/api/notes/${noteId}/attachments?attachmentId=${attachment.id}`, {
			featured: true
		});
	}
}

interface NoteData {
	key: string;
	title: string;
	content: string;
	color: string;
	pinned?: boolean;
	checklistMode?: boolean;
}

function getNotesData(): NoteData[] {
	// Created in reverse display order so newest (first created) appears last,
	// and the grid reads naturally with pinned "Bretzel Ingredients" at top-left
	return [
		{
			key: 'bakingcode',
			title: 'Baking code for the...',
			content: `A developer's checklist where code meets dough.

- [x] Set up CI/CD pipeline
- [x] Write the CRDT sync logic
- [ ] Bake the docker image
- [ ] Deploy to the homelab
- [ ] Celebrate with a bretzel

#dev #bretzel`,
			color: 'clay',
			checklistMode: true
		},
		{
			key: 'flute',
			title: 'Ancient Flute Harmonica Discovered',
			content: `Archaeologists found a 40,000-year-old flute carved from vulture bone.

The oldest known musical instrument.
Imagine the first song ever played.

#reading`,
			color: 'chalk'
		},
		{
			key: 'weekend',
			title: 'Weekend Plans',
			content: `Saturday:
- Farmer's market (get sourdough starter)
- Fix the Dokploy SSL cert renewal
- Bake a batch of bretzels

Sunday:
- Retro gaming marathon
- Update the self-hosting stack
- Plan next trip on 42

#personal #weekend`,
			color: 'mint'
		},
		{
			key: 'manifesto',
			title: 'The Best Software Is the Software You Own',
			content: `Self-host everything. Trust no cloud.

The best software is the software you own.
Your data. Your server. Your rules.

If it can't run on your hardware, it's not really yours.

#personal #bretzel`,
			color: 'coral'
		},
		{
			key: 'retro',
			title: 'Back to Retro Gaming',
			content: `Games to replay this summer:

Chrono Trigger (SNES) — best RPG ever made
The Legend of Zelda: Link's Awakening (GB)
Castlevania: Symphony of the Night (PS1)
Advance Wars (GBA)
Final Fantasy Tactics (PS1)

The pixel art era was peak game design.

#reading #personal`,
			color: 'peach'
		},
		{
			key: 'selfhosting',
			title: 'Self-Hosting Stack',
			content: `Current homelab setup:

**Crumbs** — notes (obviously)
**Vaultwarden** — passwords
**Nextcloud** — files & calendar

Just getting started. More to come.

#homelab #devops`,
			color: 'fog'
		},
		{
			key: 'bretzel',
			title: 'Bretzel Ingredients',
			content: `The perfect Alsatian bretzel recipe:

- [x] 500g bread flour
- [x] 300ml warm water
- [x] 10g salt
- [ ] 7g dry yeast
- [ ] 30g butter (softened)
- [ ] Baking soda for the bath
- [ ] Coarse salt for topping

#baking #bretzel`,
			color: 'sand',
			pinned: true,
			checklistMode: true
		}
	];
}

function getVersionHistoryContents(): string[] {
	return [
		// Version 2: Add Dokploy + Outline
		`Current homelab setup:

**Crumbs** — notes (obviously)
**Dokploy** — deployment platform
**Outline** — team wiki
**Vaultwarden** — passwords
**Nextcloud** — files & calendar

Growing the stack.

#homelab #devops`,

		// Version 3: Add Navidrome + Plausible
		`Current homelab setup:

**Crumbs** — notes (obviously)
**Dokploy** — deployment platform
**Outline** — team wiki
**Navidrome** — music streaming
**Vaultwarden** — passwords
**Nextcloud** — files & calendar
**Plausible** — analytics

The stack is getting serious.

#homelab #devops`,

		// Version 4: Add 42, final version
		`Current homelab setup:

**Crumbs** — notes (obviously)
**42** — holiday budget tracking
**Dokploy** — deployment platform
**Outline** — team wiki
**Navidrome** — music streaming
**Vaultwarden** — passwords
**Nextcloud** — files & calendar
**Plausible** — analytics

Everything below daily reverse proxy.

#homelab #devops`
	];
}

export async function seed(page: Page): Promise<void> {
	// 1. Setup admin (sets session cookie)
	await api(page, 'post', '/api/auth/setup', {
		email: ADMIN.email,
		displayName: ADMIN.displayName,
		password: ADMIN.password
	});
	console.log('  admin created');

	// 2. Create collaborator user
	const alice = await api(page, 'post', '/api/admin/users', {
		email: COLLABORATOR.email,
		displayName: COLLABORATOR.displayName,
		password: COLLABORATOR.password,
		role: 'user'
	});
	const aliceId: number = alice.id;
	console.log('  collaborator created (id:', aliceId, ')');

	// 3. Create notes (order matters — newest appear first in grid)
	const noteData = getNotesData();
	const noteIds: Record<string, string> = {};
	for (const note of noteData) {
		const created = await api(page, 'post', '/api/notes', {
			title: note.title,
			content: note.content,
			color: note.color,
			pinned: note.pinned ?? false,
			checklistMode: note.checklistMode ?? false
		});
		noteIds[note.key] = created.id;
		console.log('  note created:', note.title);
	}

	// 4. Share "Weekend Plans" with Alice
	await api(page, 'post', `/api/notes/${noteIds['weekend']}/collaborators`, {
		userId: aliceId
	});
	console.log('  shared "Weekend Plans" with Alice');

	// 5. Create version history for "Self-Hosting Stack"
	const versionContents = getVersionHistoryContents();
	for (let i = 0; i < versionContents.length; i++) {
		await api(page, 'patch', `/api/notes/${noteIds['selfhosting']}`, {
			content: versionContents[i]
		});
		console.log(`  version ${i + 2} created for "Self-Hosting Stack"`);
	}

	// 6. Upload pixel-art images to "Bretzel Ingredients"
	await uploadAttachment(page, noteIds['bretzel'], 'bretzel.png', generateBretzelPng(), true);
	console.log('  uploaded bretzel.png (featured)');
	await uploadAttachment(
		page,
		noteIds['bretzel'],
		'salt-shaker.png',
		generateSaltShakerPng(),
		false
	);
	console.log('  uploaded salt-shaker.png');

	// 7. Create API keys
	await api(page, 'post', '/api/settings/api-keys', { name: 'Claude Code' });
	await api(page, 'post', '/api/settings/api-keys', { name: 'N8N' });
	console.log('  API keys created');
}

export async function login(page: Page): Promise<void> {
	await page.goto(`${BASE_URL}/login`);
	await page.getByTestId('email-input').fill(ADMIN.email);
	await page.getByTestId('password-input').fill(ADMIN.password);
	await page.getByTestId('login-btn').click();
	await page.waitForURL('**/');
	await page.waitForLoadState('networkidle');
}
