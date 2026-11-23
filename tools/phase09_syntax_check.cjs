'use strict';
/** Strict parser + relative import resolution; not a semantic TypeScript typecheck. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
let ts;try{ts=require('typescript');}catch{ts=require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}
const roots=['apps/api','scripts'];
const files=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){
 const p=path.join(dir,e.name);if(e.isDirectory()&&!['node_modules','dist','.git'].includes(e.name))walk(p);
 else if(e.isFile()&&p.endsWith('.ts'))files.push(p);
}}
for(const dir of roots)if(fs.existsSync(dir))walk(dir);
const errors=[];
for(const file of files){const source=fs.readFileSync(file,'utf8');const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 for(const diag of sf.parseDiagnostics)errors.push(`${file}:${diag.start} ${ts.flattenDiagnosticMessageText(diag.messageText,' ')}`);
 for(const statement of sf.statements){if(!ts.isImportDeclaration(statement)||!statement.moduleSpecifier||!ts.isStringLiteral(statement.moduleSpecifier))continue;
  const spec=statement.moduleSpecifier.text;if(!spec.startsWith('.'))continue;
  const bare=path.resolve(path.dirname(file),spec);const paths=[bare,bare+'.ts',bare+'.tsx',bare+'.d.ts',path.join(bare,'index.ts')];
  if(bare.endsWith('.js'))paths.push(bare.slice(0,-3)+'.ts');
  if(!paths.some(p=>fs.existsSync(p)))errors.push(`${file}: unresolved import ${spec}`);
 }
}
const out={typescript_sources_checked:files.length,syntax_and_relative_import_issues:errors,scope:'TypeScript parser + local imports only (not real typecheck/build)',pass:errors.length===0};
process.stdout.write(JSON.stringify(out,null,2)+'\n');if(errors.length)process.exitCode=1;
