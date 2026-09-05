const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const files=cp.execFileSync('git',['-C',root,'ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const failures=[];
for(const f of files){
  const p=path.join(root,f);if(!fs.existsSync(p))continue;
  if(/(^|\/)(?:\.env(?:\..*)?|credentials|.*\.(?:pem|key))$/.test(f)&&!f.endsWith('.env.example'))failures.push(f+': credential filename');
  const text=fs.readFileSync(p,'utf8');
  if(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}\b/.test(text))failures.push(f+': credential pattern');
  if(/(?:aws_secret_access_key|secret_access_key|api_key|access_token)\s*[:=]\s*['"][A-Za-z0-9/+=_-]{24,}['"]/i.test(text))failures.push(f+': secret assignment');
  for(const m of text.matchAll(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi))if(m[0]!=='00000000-0000-0000-0000-000000000000')failures.push(f+': non-placeholder resource/user ID');
  for(const m of text.matchAll(/arn:aws[^:]*:[^:]+:[^:]*:(\d{12}):/g))if(m[1]!=='000000000000')failures.push(f+': deployment account');
  if(f.startsWith('data/')&&f.endsWith('.json')){
    const j=JSON.parse(text);
    if(!f.endsWith('-registry.json')&&!f.endsWith('metric-contract.json')){
      assert.equal(j.sanitized,true,f);assert.equal(j.publication_status,'DATA_WITHHELD',f);
      assert.deepEqual(Object.keys(j).sort(),['evidence','identities','metrics','notice','publication_status','sanitized'].sort(),f);
      assert.deepEqual(j.metrics,{});assert.deepEqual(j.identities,{});assert.deepEqual(j.evidence,[]);
    }
  }
  if(f.endsWith('.js')||f.endsWith('.cjs'))new vm.Script(text,{filename:f});
}
assert.deepEqual(failures,[],'Public privacy gate failed (values intentionally not printed)');
for(const [domain,count] of [['inbound',29],['outbound',18],['agent',15]]){
  const reg=JSON.parse(fs.readFileSync(path.join(root,'data',domain+'-operations-registry.json')));
  assert.equal(reg.metrics.length,count);assert.ok(reg.warehouse);
  for(const m of reg.metrics)assert.ok(m.id&&m.label&&m.meaning&&m.unit&&m.group&&(m.field||m.inputs),'Complete mapping '+m.id);
  assert.ok(fs.readFileSync(path.join(root,domain+'-operations.js'),'utf8').includes('renderPublicDictionary'),'Withheld-data renderer '+domain);
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(m[1].trim())new vm.Script(m[1]);
assert.ok(!html.includes('data-audit-tab="call-center-operations"'));
assert.ok(html.includes('public-dictionaries.js'));
console.log('PASS: 62 complete metric mappings; sanitized data only; no detected keys, private IDs or deployment accounts; public-mode guards and JavaScript syntax.');
