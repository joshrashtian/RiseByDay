// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { fileURLToPath } from 'node:url';
import starlightThemeBlack from 'starlight-theme-black'

// The docs load the app's fonts from <repo>/src/assets/fonts.
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

// https://astro.build/config
export default defineConfig({
	vite: {
		server: { fs: { allow: [repoRoot] } },
		// The parser playground imports the app's parser from <repo>/src. Resolve
		// its imports here so the docs build only needs its own node_modules.
		resolve: {
			alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) },
			dedupe: ['luxon'],
		},
	},
	integrations: [
		starlight({
      title: 'RiseByDay',
      customCss: [
        "./src/styles/fonts.css",
        "./src/styles/custom.css"
      ],
      plugins: [

      ],
			sidebar: [
				{
					label: 'Guides',
					items: [{ label: 'Getting Started', slug: 'guides/getting-started' }],
				},
				{
					label: 'Using the App',
					items: [
						{ label: 'Add a Task', slug: 'app/addtask' },
						{ label: 'Color Themes', slug: 'app/themes' },
					],
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
