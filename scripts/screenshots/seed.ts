import type { Page } from '@playwright/test';
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
			title: 'Crumbs v0.23 Release',
			content: `- [x] CRDT sync logic
- [x] MCP server integration
- [ ] Bake the Docker image
- [ ] Deploy to the homelab
- [ ] Celebrate with a bretzel`,
			color: 'clay',
			checklistMode: true
		},
		{
			key: 'coding-music',
			title: 'Coding Playlists',
			content: `Curated on **Navidrome** for maximum focus.

### Late Night Focus

1. *Tycho* — Dive (ambient electronic)
2. *Boards of Canada* — Music Has the Right to Children
3. *Nujabes* — Modal Soul
4. *C418* — Minecraft Volume Alpha

### Saturday Baking

For slow mornings in the kitchen:

1. *Khruangbin* — Con Todo El Mundo
2. *Tatsuro Yamashita* — For You

#music #personal`,
			color: 'chalk'
		},
		{
			key: 'weekend',
			title: 'Weekend Plans',
			content: `### Saturday

- Farmer's market — get sourdough starter
- Fix the Dokploy SSL cert renewal
- Bake a batch of bretzels

### Sunday

- Retro gaming marathon on *RetroAssembly*
- Update the self-hosting stack
- Plan next trip on **42**

> A weekend well spent brings a week of content.

#personal #weekend`,
			color: 'mint'
		},
		{
			key: 'manifesto',
			title: 'Own Your Software',
			content: `## The Rules

1. **Self-host everything.** Trust no cloud.
2. **Own your data.** Your server, your rules.
3. **Keep it simple.** If it needs a PhD to deploy, it's wrong.
4. **SQLite > Postgres** for single-user apps. Fight me.

> If it can't run on your hardware, it's not really yours.

Seven services, one VPS, *zero* vendor lock-in.

#personal #selfhosting`,
			color: 'coral'
		},
		{
			key: 'retro',
			title: 'Back to Retro Gaming',
			content: `Games running on **RetroAssembly** this summer:

- **Chrono Trigger** (SNES) — best RPG ever made
- **Link's Awakening** (GB) — pure portable magic
- **Symphony of the Night** (PS1) — the *definitive* Metroidvania
- **Advance Wars** (GBA) — turn-based perfection
- **Final Fantasy Tactics** (PS1) — political intrigue + job system

> The pixel art era was peak game design.

#gaming #retro`,
			color: 'peach'
		},
		{
			key: 'selfhosting',
			title: 'Self-Hosting Stack',
			content: `All services running behind **Caddy** reverse proxy on a single Hetzner VPS.

### Core Services

- **Crumbs** — notes *(obviously)*
- **Dokploy** — deployment platform
- **Outline** — team wiki

### Monitoring

> Everything that can break *will* break at 3 AM on a Sunday.

Just getting started. More to come.

#homelab #devops`,
			color: 'fog'
		},
		{
			key: 'bretzel',
			title: 'Bretzel Ingredients',
			content: `- [x] 500g bread flour
- [x] 300ml warm water
- [x] 10g salt
- [ ] 7g dry yeast
- [ ] 30g butter (softened)
- [ ] Baking soda for the bath
- [ ] Coarse salt for topping`,
			color: 'sand',
			checklistMode: true
		}
	];
}

function getVersionHistoryContents(): string[] {
	return [
		// Version 2: Add Navidrome + RetroAssembly
		`All services running behind **Caddy** reverse proxy on a single Hetzner VPS.

### Core Services

- **Crumbs** — notes *(obviously)*
- **Dokploy** — deployment platform
- **Outline** — team wiki
- **Navidrome** — music streaming
- **RetroAssembly** — retro game emulation

### Monitoring

> Everything that can break *will* break at 3 AM on a Sunday.

Growing the stack.

#homelab #devops`,

		// Version 3: Add 42 + Umami
		`All services running behind **Caddy** reverse proxy on a single Hetzner VPS.

### Core Services

- **Crumbs** — notes *(obviously)*
- **42** — holiday budget tracking
- **Dokploy** — deployment platform
- **Outline** — team wiki
- **Navidrome** — music streaming
- **RetroAssembly** — retro game emulation
- **Umami** — privacy-first analytics

### Monitoring

> Everything that can break *will* break at 3 AM on a Sunday.

The stack is getting serious.

#homelab #devops`,

		// Version 4: Final version
		`All services running behind **Caddy** reverse proxy on a single Hetzner VPS.

### Core Services

- **Crumbs** — notes *(obviously)*
- **42** — holiday budget tracking
- **Dokploy** — deployment platform
- **Outline** — team wiki
- **Navidrome** — music streaming
- **RetroAssembly** — retro game emulation
- **Umami** — privacy-first analytics

### Monitoring

> Everything that can break *will* break at 3 AM on a Sunday.

Everything below daily reverse proxy. The dream stack is *almost* complete.

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

	// 6. Create API keys
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
