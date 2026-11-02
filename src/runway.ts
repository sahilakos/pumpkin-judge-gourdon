import type {SessionKeyResponse} from '@runwayml/avatars-react';
export const API_BASE = 'https://api.dev.runwayml.com';
export type EmbedConfig={valid:boolean;maxDuration:number;avatarImageUrl?:string;characterUrl?:string};
export async function validateEmbed(signal?:AbortSignal):Promise<EmbedConfig> {
 const response=await fetch('/api/config',{signal});
 const config=await response.json();
 if(!response.ok)throw new Error(config.error||'The local server could not verify Runway.');
 if(config.valid!==true)throw new Error('The character embed is not enabled.');
 return {...config,maxDuration:typeof config.maxDuration==='number'?config.maxDuration:120};
}
export async function connectJudge(signal:AbortSignal,preview=false):Promise<SessionKeyResponse & {avatarId:string}>{
 const response=await fetch('/api/session',{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({smokeTest:preview})});
 const session=await response.json();
 if(!response.ok)throw new Error(session.error||'The local server could not start the judge.');
 if(typeof session.avatarId!=='string')throw new Error('The local server did not return a configured avatar. Restart the server and try again.');
 return {sessionId:session.sessionId,sessionKey:session.sessionKey,avatarId:session.avatarId};
}
