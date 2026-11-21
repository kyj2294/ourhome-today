import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 빌드 결과는 dist/index.html 한 파일 (JS·CSS 인라인).
// 더블클릭해서 바로 열 수도 있고, 그대로 Cloudflare/Vercel에 올려도 된다.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
})
