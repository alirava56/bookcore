"use strict";
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const EXCLUDE=new Set(['node_modules','dist','.git']);
function inventory(root){
 const result=[];
 function visit(folder,relative=''){
  for(const item of fs.readdirSync(folder,{withFileTypes:true})){
   const rel=relative?relative+'/'+item.name:item.name;
   if(item.isSymbolicLink()) throw new Error('SYMLINK_NOT_ALLOWED: '+rel);
   if(item.isDirectory()){if(!EXCLUDE.has(item.name))visit(path.join(folder,item.name),rel);}
   else if(item.isFile()&&rel!=='MANIFEST.md')result.push(rel);
  }
 }
 visit(root);return result.sort();
}
function sha(buffer){return crypto.createHash('sha256').update(buffer).digest('hex');}
function render(root){
 const rows=inventory(root).map(rel=>{
  const bytes=fs.readFileSync(path.join(root,rel));
  return `| \`${rel}\` | \`${sha(bytes)}\` | ${bytes.length} |`;
 });
 return '# BookCore SHA-256 Release Manifest\n\n| File | SHA-256 | Bytes |\n|---|---|---|\n'+rows.join('\n')+'\n';
}
function verify(root,mode='release'){
 if(!['release','workspace'].includes(mode))throw new Error('INVALID_MANIFEST_MODE');
 const manifest=fs.readFileSync(path.join(root,'MANIFEST.md'),'utf8');
 const rows=[...manifest.matchAll(/^\| `([^`]+)` \| `([a-f0-9]{64})` \| (\d+) \|$/gm)];
 if(rows.length<20)throw new Error('MANIFEST_TOO_SMALL');
 const expected=new Set();
 for(const [,rel,expectedHash,expectedSize] of rows){
  if(rel.includes('\\')||path.posix.isAbsolute(rel)||rel.split('/').includes('..')||expected.has(rel))throw new Error('MANIFEST_INVALID_PATH');
  expected.add(rel);
  const absolute=path.resolve(root,rel);
  if(!absolute.startsWith(path.resolve(root)+path.sep))throw new Error('MANIFEST_ESCAPE');
  const st=fs.lstatSync(absolute,{throwIfNoEntry:false});
  if(!st?.isFile()||st.isSymbolicLink())throw new Error('MANIFEST_MISSING_OR_UNTRUSTED: '+rel);
  const data=fs.readFileSync(absolute);
  if(data.length!==Number(expectedSize)||sha(data)!==expectedHash)throw new Error('MANIFEST_CONTENT_MISMATCH: '+rel);
 }
 const extras=inventory(root).filter(rel=>!expected.has(rel));
 if(mode==='release'&&extras.length)throw new Error('MANIFEST_UNTRACKED: '+extras.join(','));
 return {mode,verified:rows.length,untracked:extras,releaseCertified:mode==='release'&&extras.length===0};
}
module.exports={inventory,render,verify};
