import type { PageServerLoad } from './$types.js';
import { getEnabledProviders } from '$lib/server/oauth/providers.js';

export const load: PageServerLoad = async () => {
	return {
		providers: getEnabledProviders()
	};
};
