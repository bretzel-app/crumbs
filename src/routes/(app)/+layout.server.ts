import { version } from '../../../package.json';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = (event) => {
	return {
		appVersion: version,
		user: event.locals.user
	};
};
