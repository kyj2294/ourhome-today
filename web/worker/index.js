// Cloudflare Worker: 빌드된 앱(dist/index.html 한 파일)을 그대로 돌려준다.
// 앱은 #/ 주소 방식이라 어떤 경로로 들어와도 같은 페이지를 주면 된다.
import html from '../dist/index.html'

export default {
  async fetch() {
    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    })
  },
}
