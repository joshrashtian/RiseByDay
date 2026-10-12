// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { fileURLToPath } from 'node:url';

// The docs load the app's fonts from <repo>/src/assets/fonts.
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

// https://astro.build/config
export default defineConfig({
	vite: {
		server: { fs: { allow: [repoRoot] } },
	},
	integrations: [
		starlight({
      title: 'DayByDay',
      customCss: [
        "./src/styles/fonts.css",
        "./src/styles/custom.css"
      ]
      ,
			sidebar: [
				{
					label: 'Guides',
					items: [{ label: 'Getting Started', slug: 'guides/getting-started' }],
				},
				{
					label: 'Using the App',
					items: [{ label: 'Add a Task', slug: 'app/addtask' }],
				},
				{
					label: 'Tasks',
					items: [{ label: 'Task Language Parser', slug: 'tasks/taskparser' }],
				},
				{
					label: 'Reference',
					items: [{ autogenerate: { directory: 'reference' } }],
				},
				{
					label: 'Contributing',
					items: [{ autogenerate: { directory: 'contributing' } }],
				},
			],
		}),
	],
});
