"""Offline structural and URL-scope checks; not a Loon parser/emulator."""
import pathlib,re,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
class ModernPluginTests(unittest.TestCase):
 def setUp(self):
  self.text=(ROOT/'TabulaBili.plugin').read_text()
  self.lines=[x for x in self.text.splitlines() if x.startswith(('request if ','response if '))]
 def test_minimum_version(self): self.assertIn('#!loon_version = 3.5.3(1007)',self.text)
 def test_typed_arguments(self):
  self.assertEqual(sum('{${mode}}' in s for s in self.lines),2)
  self.assertEqual(sum('{${risk_notify}, ${risk_debug}}' in s for s in self.lines),2)
 def test_single_web_pure_rewrite(self):
  rewrite=[s for s in self.lines if 'then request.header.del(' in s]
  self.assertEqual(len(rewrite),1)
  self.assertIn('${mode} == "pure"',rewrite[0]);self.assertNotIn('url.replace',rewrite[0])
 def test_no_web_pure_script_collision(self):
  web=[s for s in self.lines if 'tag="TabulaBili Web推荐清洗"' in s][0]
  self.assertIn('/^(refresh|mixed)$/',web)
 def test_scripts_have_body_and_timeout_options(self):
  for s in self.lines:
   if 'then script(' in s:self.assertIn('requires_body=',s);self.assertIn('timeout=',s)
 def test_url_scope(self):
  for s in self.lines:
   if '指纹采集' in s:continue
   pattern=re.search(r'\$\{url\} ~= /(.*)/i then',s).group(1).replace(r'\/','/')
   rx=re.compile(pattern,re.I)
   app='app' in s.split(' then ')[0]
   base=('https://app.bilibili.com/x/v2/feed/index' if app else 'https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd')
   for suffix in ['', '?x=1']:self.assertIsNotNone(rx.search(base+suffix))
   for suffix in ['/extra','evil','_other']:self.assertIsNone(rx.search(base+suffix))
   self.assertIsNone(rx.search('https://api.bilibili.com/x/player/wbi/playurl?access_key=test'))
 def test_capture_excludes_only_exact_recommendations(self):
  s=[x for x in self.lines if '指纹采集' in x][0]
  pattern=re.search(r'\$\{url\} ~= /(.*)/i then',s).group(1).replace(r'\/','/')
  rx=re.compile(pattern,re.I)
  self.assertIsNone(rx.search('https://app.bilibili.com/x/v2/feed/index?x=1'))
  self.assertIsNotNone(rx.search('https://app.bilibili.com/x/v2/feed/index/extra'))
 def test_response_url_guard(self):
  for s in self.lines:
   if s.startswith('response'):self.assertIn('${url} ~= ',s);self.assertIn('requires_body=true',s)
 def test_copies_synchronized(self):
  for name in ['TabulaBili.tf.plugin','plugin/TabulaBili.plugin','plugin/TabulaBili.conf','plugin/TabulaBili.tf.plugin']:
   with self.subTest(path=name):self.assertEqual((ROOT/name).read_text(),self.text)
 def test_all_entries_modern_syntax_and_version(self):
  for name in ['TabulaBili.plugin','TabulaBili.tf.plugin','plugin/TabulaBili.plugin','plugin/TabulaBili.conf','plugin/TabulaBili.tf.plugin','plugin/TabulaBili.local.plugin']:
   with self.subTest(path=name):
    text=(ROOT/name).read_text()
    self.assertIn('#!loon_version = 3.5.3(1007)',text)
    self.assertIn('[Rewrite]',text);self.assertIn('[Script]',text)
    self.assertNotRegex(text,r'(?m)^http-(request|response) ')
    self.assertNotIn('script-path',text)
    lines=[s for s in text.splitlines() if s.startswith(('request if ','response if '))]
    self.assertEqual(len(lines),6)
    self.assertEqual(sum('then script(' in s for s in lines),5)
    self.assertIn('勿重复启用',text)
 def test_local_template_same_implementation(self):
  local=(ROOT/'plugin/TabulaBili.local.plugin').read_text()
  normalized=local.replace('script("scripts/','script("https://raw.githubusercontent.com/beckyeeky/TabulaBili-Loon/main/scripts/')
  strip_desc=lambda text:'\n'.join(s for s in text.splitlines() if not s.startswith('#!desc'))
  self.assertEqual(strip_desc(normalized),strip_desc(self.text))
  self.assertEqual(sum('then script("scripts/' in s for s in local.splitlines()),5)
  self.assertNotIn('/main/scripts/',local)
if __name__=='__main__':unittest.main()
