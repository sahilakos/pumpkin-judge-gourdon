export const HOUR=60*60*1000;
export const INTERVAL=5*60*1000;
export const CLOCK_KEY='pumpkin-court:carving-clock:v1';
export type Clock={version:1;status:'ready'|'running'|'paused'|'finished';remaining:number;deadline:number|null;lastAnnouncement:number;audio:boolean;history:{index:number;text:string;time:number}[]};
export function freshClock():Clock{return {version:1,status:'ready',remaining:HOUR,deadline:null,lastAnnouncement:0,audio:true,history:[]};}
export function timeLeft(clock:Clock,now=Date.now()){return Math.max(0,Math.min(HOUR,clock.status==='running'&&clock.deadline!==null?clock.deadline-now:clock.remaining));}
export function startClock(clock:Clock,now=Date.now()):Clock {if(clock.status!=='ready'&&clock.status!=='paused')return clock;return {...clock,status:'running',deadline:now+clock.remaining};}
export function pauseClock(clock:Clock,now=Date.now()):Clock {if(clock.status!=='running')return clock;return {...clock,status:'paused',remaining:timeLeft(clock,now),deadline:null};}
export function dueAnnouncement(clock:Clock,now=Date.now()){if(clock.status!=='running')return 0;const index=Math.min(12,Math.floor((HOUR-timeLeft(clock,now))/INTERVAL));return index>clock.lastAnnouncement?index:0;}
export function displayTime(ms:number){const sec=Math.ceil(Math.max(0,ms)/1000);return Math.floor(sec/3600)+':'+String(Math.floor(sec%3600/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');}
export function restoreClock(raw:string):Clock{const c=JSON.parse(raw);if(c.version!==1||!['ready','running','paused','finished'].includes(c.status)||typeof c.remaining!=='number'||c.remaining<0||c.remaining>HOUR||!Number.isInteger(c.lastAnnouncement)||c.lastAnnouncement<0||c.lastAnnouncement>12||(c.status==='running'&&typeof c.deadline!=='number')||!Array.isArray(c.history))throw new Error('Invalid clock');return c;}
export const interludes=[
 {title:'A fruity little secret',kind:'PUMPKIN FACT',text:'A secret from the pumpkin patch: pumpkins are botanically fruit! They contain seeds, just like apples. Yours simply has a much more dramatic haircut.',minutes:55},
 {title:'The ghost at the window',kind:'A TINY GHOST STORY',text:'A little ghost tapped on a dark window. Tap. Tap. Tap. Inside, a pumpkin blinked. “Wrong house,” it whispered. “The candy is next door.”',minutes:50},
 {title:'Before the pumpkin',kind:'HALLOWEEN FACT',text:'Long before pumpkins lit the porch, people in Ireland carved Halloween lanterns from turnips. Imagine doing all this carving on something small enough to fit in your pocket!',minutes:45},
 {title:'The midnight inspection',kind:'A MESSAGE FROM THE PATCH',text:'Somewhere, a very small bat is inspecting your progress. Its official advice? Step back, admire your pumpkin, and choose one detail that deserves a little extra magic.',minutes:40},
 {title:'Mostly water, all personality',kind:'PUMPKIN FACT',text:'A pumpkin is about ninety percent water. The remaining ten percent is apparently enough to hold a face, a candle, and an extremely strong opinion about Halloween.',minutes:35},
 {title:'The missing broom',kind:'A TINY WITCH STORY',text:'At midnight, a witch discovered her broom was gone. She followed the crumbs into the kitchen. There it was, sweeping up cookie crumbs. Even magical brooms need hobbies.',minutes:30},
 {title:'A patch of many colors',kind:'PUMPKIN FACT',text:'Orange is only the beginning. Pumpkins can also be yellow, green, or blue. Somewhere in a pumpkin patch, there is a gourd quietly refusing to follow the dress code.',minutes:25},
 {title:'Footsteps in the hallway',kind:'A TINY GHOST STORY',text:'They heard footsteps in the empty hallway. Slowly, a tiny shadow appeared. It was a ghost in enormous slippers, carrying hot chocolate. “Sorry,” it said. “These floors are chilly.”',minutes:20},
 {title:'The final-detail spell',kind:'A MESSAGE FROM THE PATCH',text:'The moon is rising over the pumpkin patch. Look at your creation from across the table. What do you notice first? Give that feature one last thoughtful touch.',minutes:15},
 {title:'The orange mystery',kind:'PUMPKIN FACT',text:'Many pumpkins get their orange color from natural pigments called carotenoids, including beta-carotene. That glowing autumn color was there long before anyone gave the pumpkin a grin.',minutes:10},
 {title:'The last five minutes',kind:'FINAL CARVING CALL',text:'A hush falls over the pumpkin patch. Five minutes remain! Finish your favorite details, tidy your space, and let that pumpkin personality shine. The court is almost ready.',minutes:5},
 {title:'Tools down. Pumpkins up.',kind:'THE CARVING HOUR IS COMPLETE',text:'The carving hour is over! Put your tools down safely, admire your masterpiece, and get ready to present it. When everyone is ready, your host can summon Judge Gourdon.',minutes:0}
];
export function announcementText(index:number,remainingMs?:number){const i=interludes[index-1];const minutes=remainingMs===undefined?i.minutes:Math.ceil(Math.max(0,remainingMs)/60000);return i.text+(minutes>0?' You have '+minutes+' minutes left.':'');}

