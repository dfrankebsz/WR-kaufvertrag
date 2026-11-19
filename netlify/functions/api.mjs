import { getStore } from '@netlify/blobs';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
const users=()=>getStore('kv-users');
const sessions=()=>getStore('kv-sessions');
const prog=()=>getStore('kv-progress');
const hash=s=>createHash('sha256').update(s).digest('hex');
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const err=(message,status=400)=>json({error:message},status);
const validClass=s=>typeof s==='string' && /^[a-zA-Z0-9ÄÖÜäöüß_-]{2,32}$/.test(s);
const validNick=s=>typeof s==='string' && /^[\p{L}\p{N}_.-]{3,24}$/u.test(s);
const userKey=(c,n)=>hash(`${c.trim().toLowerCase()}\0${n.trim().toLowerCase()}`);
const passhash=(pw,salt)=>scryptSync(pw,salt,64).toString('hex');
function checkpass(pw,u){try{return timingSafeEqual(Buffer.from(passhash(pw,u.salt),'hex'),Buffer.from(u.passwordHash,'hex'))}catch{return false}}
async function auth(request){const header=request.headers.get('authorization')||'';const tok=header.startsWith('Bearer ')?header.slice(7):'';if(!/^[a-f0-9]{64}$/.test(tok))return null;const s=await sessions().get(hash(tok),{type:'json'});if(!s||s.expires<Date.now())return null;const u=await users().get(s.id,{type:'json'});return u&&Number(u.sessionEpoch||0)===Number(s.sessionEpoch||0)?{u,id:s.id}:null}
const publicUser=u=>({nick:u.nick,klasse:u.klasse,role:u.role});
function safeProgress(data){if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Ungültiger Fortschritt');const {answers={},scores={},checked={},xp=0,inventory=[],equipped={},selfcheck={}}=data; if(JSON.stringify(data).length>350000)throw Error('Zu viele Daten');return {answers,scores,checked,xp:Math.max(0,Math.min(1000000,Number(xp)||0)),inventory,equipped,selfcheck};}
export default async function handler(request){
 try{
  if(request.method!=='POST')return err('Nur POST erlaubt',405);
  const len=Number(request.headers.get('content-length')||0);if(len>390000)return err('Anfrage zu groß',413);
  const body=await request.json();const action=body?.action;
  if(action==='register'){
   const {nick,klasse,password,role='student',teacherCode}=body;
   if(!validNick(nick)||!validClass(klasse)||typeof password!=='string'||password.length<10||password.length>128)return err('Nickname: 3–24 Zeichen; Klasse: 2–32 Zeichen; Passwort: mindestens 10 Zeichen.');
   if(!['student','teacher'].includes(role))return err('Ungültige Rolle');
   if(role==='teacher'){
    const expected=process.env.TEACHER_INVITE_CODE;
    if(!expected||expected.length<12)return err('Lehrer-Code ist bei Netlify noch nicht eingerichtet.',503);
    if(typeof teacherCode!=='string'||!safeEqual(teacherCode,expected))return err('Lehrer-Code ungültig',403);
   }
   const id=userKey(klasse,nick);const existing=await users().get(id,{type:'json'});if(existing)return err('Nickname in dieser Klasse bereits vergeben',409);
   const salt=randomBytes(16).toString('hex');const u={nick,klasse,role,salt,passwordHash:passhash(password,salt),created:Date.now(),sessionEpoch:0};
   await users().setJSON(id,u,{onlyIfNew:true}); const saved=await users().get(id,{type:'json'});if(!saved||!checkpass(password,saved))return err('Registrierung fehlgeschlagen, Nickname vermutlich vergeben.',409);
   const token=await session(id);return json({token,user:publicUser(saved),progress:{}});
  }
  if(action==='login'){
   const {nick,klasse,password}=body; if(!validNick(nick)||!validClass(klasse)||typeof password!=='string')return err('Anmeldedaten ungültig');
   const id=userKey(klasse,nick);const u=await users().get(id,{type:'json'});if(!u||!checkpass(password,u))return err('Nickname, Klasse oder Passwort nicht korrekt',401);
   const token=await session(id);return json({token,user:publicUser(u),progress:await prog().get(id,{type:'json'})||{}});
  }
  const a=await auth(request);if(!a)return err('Bitte erneut anmelden',401);
  const {u,id}=a;
  if(action==='me')return json({user:publicUser(u),progress:await prog().get(id,{type:'json'})||{}});
  if(action==='save'){
   const clean=safeProgress(body.progress);await prog().setJSON(id,clean);return json({ok:true});
  }
  if(action==='changePassword'){
   if(!checkpass(body.oldPassword,u)||typeof body.newPassword!=='string'||body.newPassword.length<10)return err('Passwort ungültig oder zu kurz');
   u.salt=randomBytes(16).toString('hex');u.passwordHash=passhash(body.newPassword,u.salt);u.sessionEpoch=Number(u.sessionEpoch||0)+1;await users().setJSON(id,u);return json({ok:true,reauth:true});
  }
  if(u.role!=='teacher')return err('Nur für Lehrkräfte',403);
  if(action==='roster'){
   const list=await users().list();const members=[];
   for(const item of list.blobs){const p=await users().get(item.key,{type:'json'});if(p?.klasse.toLowerCase()!==u.klasse.toLowerCase())continue;const state=await prog().get(item.key,{type:'json'})||{};members.push({...publicUser(p),userId:item.key,completed:Object.values(state.scores||{}).filter(x=>x?.done).length,xp:state.xp||0,progress:state});}
   return json({members:members.sort((a,b)=>a.nick.localeCompare(b.nick,'de'))});
  }
  if(['resetProgress','resetPassword','deleteUser','resetClass'].includes(action)){
   if(action==='resetClass'){
    if(body.confirm!==u.klasse)return err('Klassennamen zur Bestätigung eingeben');
    const list=await users().list();let count=0;for(const item of list.blobs){const p=await users().get(item.key,{type:'json'});if(p?.klasse.toLowerCase()===u.klasse.toLowerCase()&&p.role==='student'){await prog().delete(item.key);p.sessionEpoch=Number(p.sessionEpoch||0)+1;await users().setJSON(item.key,p);count++}}return json({ok:true,count});
   }
   const target=String(body.userId||'');const v=await users().get(target,{type:'json'});if(!v||v.klasse.toLowerCase()!==u.klasse.toLowerCase()||v.role!=='student')return err('Schülerkonto in dieser Klasse nicht gefunden',404);
   if(action==='resetProgress'){await prog().delete(target);v.sessionEpoch=Number(v.sessionEpoch||0)+1;await users().setJSON(target,v);return json({ok:true})}
   if(action==='deleteUser'){await users().delete(target);await prog().delete(target);return json({ok:true})}
   if(action==='resetPassword'){const password=randomBytes(12).toString('base64url');v.salt=randomBytes(16).toString('hex');v.passwordHash=passhash(password,v.salt);v.sessionEpoch=Number(v.sessionEpoch||0)+1;await users().setJSON(target,v);return json({ok:true,password})}
  }
  return err('Unbekannte Aktion',404);
 }catch(e){console.error(e);return err('Verarbeitung fehlgeschlagen: '+(e.message==='Ungültiger Fortschritt'||e.message==='Zu viele Daten'?e.message:'Bitte Angaben prüfen oder später erneut versuchen.'),500)}
}
function safeEqual(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
async function session(id){const token=randomBytes(32).toString('hex');const u=await users().get(id,{type:'json'});await sessions().setJSON(hash(token),{id,sessionEpoch:Number(u?.sessionEpoch||0),expires:Date.now()+30*86400000});return token}
