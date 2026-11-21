import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {readFileSync} from 'node:fs';
import {diagramWriter} from './src/shell/diagramWriter';
const {version}=JSON.parse(readFileSync('package.json','utf8')) as {version:string};
export default defineConfig({plugins:[react(),diagramWriter()],define:{__APP_VERSION__:JSON.stringify(version)},base:'./',worker:{format:'es'},build:{sourcemap:true,rollupOptions:{input:{main:'index.html',shell:'shell.html'}}},server:{port:5173},preview:{port:4173}});
