import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const html=await readFile('dist/index.html','utf8');
const paths=[...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"/]+\.js)"/g)].map(match=>match[1]))];
if(!paths.length)throw new Error('No initial JavaScript found');
let raw=0,gzip=0;
for(const path of paths){const file=await readFile(`dist${path}`);raw+=file.length;gzip+=gzipSync(file).length;}
console.log(JSON.stringify({initialJavaScriptBytes:raw,initialJavaScriptGzipBytes:gzip,budget:{raw:550000,gzip:180000}}));
if(raw>550000||gzip>180000)throw new Error('Initial JavaScript exceeded the measured UI budget');
