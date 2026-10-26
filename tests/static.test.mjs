import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Pages 경로에 맞는 상대 URL을 사용하고 압축 부트스트랩을 제거했다', () => {
  const html = read('docs/index.html');
  assert.ok(html.includes('./assets/pages.js'));
  assert.ok(html.includes('./config.js'));
  assert.ok(!html.includes('v275JsGzip'));
  assert.ok(!html.includes('google.script.run'));
  assert.ok(!html.includes('src="/assets/'));
  for (const path of ['docs/assets/pages.js', 'docs/assets/app.js', 'docs/config.js']) new vm.Script(read(path));
});
test('설정이 없으면 로그인 안내를 보여주고 업무 화면을 실행하지 않는다', () => {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { hidden: false, textContent: '', addEventListener() {} });
    return elements.get(id);
  };
  const context = vm.createContext({ window: {}, document: { getElementById: element }, clearTimeout, setTimeout, Proxy, console });
  new vm.Script(read('docs/assets/pages.js')).runInContext(context);
  assert.match(element('pagesLoginStatus').textContent, /관리자 설정/);
});
test('토큰을 브라우저 영구 저장소나 URL에 기록하지 않는다', () => {
  const adapter = read('docs/assets/pages.js');
  assert.ok(!/localStorage|sessionStorage|document\.cookie|location\.hash\s*=/.test(adapter));
  assert.ok(!read('docs/config.js').includes('API_SHARED_SECRET:'));
});
