const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const from=html.indexOf('const SCHEMA =');
const to=html.indexOf('const ORDER_STAGES =',from);
const schema=vm.runInNewContext(html.slice(from,to)+'; SCHEMA');
const textFields=['bowLegInches','knockKneesInches','shoulderDownInches','bowLegComment','knockKneesComment','forwardStanceComment','outfoldHeight','cuffComment','collarComment','shirtInitialsText','shirtComments','Initials in Suit','suitComments','waistcoatComments','bandiComments','sherwaniComments'];
const contract={measures:[...new Set(Object.values(schema).flatMap(value=>value.measures))],ticks:[...new Set(Object.values(schema).flatMap(value=>(value.ticks||[]).map(([key])=>key)))],texts:textFields};
const output=JSON.stringify(contract,null,2)+'\n';
const target=path.join(root,'shared','measurement-fields.json');
if(process.argv.includes('--check')) {
 if(fs.readFileSync(target,'utf8')!==output)throw new Error('Run npm run shared:contract after changing measurement fields.');
} else fs.writeFileSync(target,output);
