'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
let ts;try{ts=require('typescript');}catch{ts=require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 const filename=path.join(dir,e.name);return e.isDirectory()?walk(filename):e.isFile()&&filename.endsWith('.controller.ts')?[filename]:[];});}
const results=[];
function decs(node){return ts.canHaveDecorators(node)?(ts.getDecorators(node)||[]):[];}
function named(node){return decs(node).map(d=>{const e=d.expression;
 if(ts.isCallExpression(e))return {name:e.expression.getText(),args:e.arguments};
 return {name:e.getText(),args:[]};});}
function argString(arg){return arg&&ts.isStringLiteralLike(arg)?arg.text:undefined;}
for(const file of walk('apps/api/src/modules')){
 const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 for(const klass of sf.statements.filter(ts.isClassDeclaration)){
  const cls= named(klass);const controller=cls.find(x=>x.name==='Controller');if(!controller)continue;
  const prefix=argString(controller.args[0])??'';
  for(const method of klass.members.filter(ts.isMethodDeclaration)){
   const dd=named(method);const route=dd.find(x=>['Get','Post','Put','Patch','Delete','Options','Head'].includes(x.name));
   if(!route)continue;
   const suffix=argString(route.args[0])??'';
   const url='/'+[prefix,suffix].filter(Boolean).join('/').replace(/\/+/g,'/');
   const handler=method.name.getText(sf);
   const body=method.parameters.find(p=>named(p).some(x=>x.name==='Body'));
   const hdr=dd.filter(x=>x.name==='ApiHeader').map(x=>x.args[0]?.getText(sf)??'');
   const resp=dd.filter(x=>x.name==='ApiResponse').map(x=>x.args[0]?.getText(sf)??'');
   results.push({method:route.name.toUpperCase(),route:url,controller:klass.name?.text,
    handler,file,public:dd.some(x=>x.name==='Public'),monitoring:dd.some(x=>x.name==='MonitoringRoute'),
    classPublic:cls.some(x=>x.name==='Public'),
    hasRoleGuard:dd.some(x=>x.name==='UseGuards'),
    requestDto:body?.type?.getText(sf)??null,responseDecorators:resp,
    idempotencyHeader:hdr.some(x=>/Idempotency-Key/.test(x)),
    currentPrincipal:method.parameters.some(p=>named(p).some(x=>x.name==='CurrentPrincipal'))});
  }
 }
}
results.sort((a,b)=>a.route.localeCompare(b.route)||a.method.localeCompare(b.method));
process.stdout.write(JSON.stringify(results,null,2)+'\n');
