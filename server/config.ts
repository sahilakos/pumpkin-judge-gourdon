import dotenv from 'dotenv';
import {resolve} from 'node:path';

// Support existing local installations; new clones use .env.
dotenv.config({path:[resolve('.env.local'),resolve('.env')],quiet:true});

export function requiredEnv(name:string):string {
 const value=process.env[name]?.trim();
 if(!value||value.startsWith('your_'))throw new Error('Set '+name+' in .env before starting the app. See .env.example.');
 return value;
}
