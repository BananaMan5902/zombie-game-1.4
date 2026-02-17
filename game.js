const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;

// Player progress
let progress = JSON.parse(localStorage.getItem('zombieGame')) || {
    score: 0,
    wave: 1,
    playerLives: 3,
    resources: {wood:5, stone:0, ammo:0}
};

// Player
let player = {
    x: MAP_WIDTH/2,
    y: MAP_HEIGHT/2,
    size: 20,
    speed: 5,
    weapon: 0 // 0=Pistol,1=Rifle,2=Full-Auto
};

// Weapons
const weapons = [
    {name:"Pistol", size:4, speed:10, damage:1, auto:false},
    {name:"Rifle", size:6, speed:15, damage:2, auto:false},
    {name:"Full-Auto", size:5, speed:12, damage:1, auto:true, ammo:50}
];

// Bullets
let bullets = [];

// Zombies
let zombies = [];

// Walls
let walls = [];

// Houses
let houses = [];
for(let i=0;i<12;i++){houses.push({x:Math.random()*MAP_WIDTH,y:Math.random()*MAP_HEIGHT,w:100,h:80});}

// Map objects
let ponds=[],trees=[],bushes=[];
for(let i=0;i<5;i++){ponds.push({x:Math.random()*MAP_WIDTH,y:Math.random()*MAP_HEIGHT,w:150,h:100});}
for(let i=0;i<20;i++){trees.push({x:Math.random()*MAP_WIDTH,y:Math.random()*MAP_HEIGHT,w:20,h:40});}
for(let i=0;i<20;i++){bushes.push({x:Math.random()*MAP_WIDTH,y:Math.random()*MAP_HEIGHT,w:15,h:15});}

// Full-auto weapon pickup
let fullAutoSpawn={x:Math.random()*MAP_WIDTH,y:Math.random()*MAP_HEIGHT,picked:false};

// Keys
let keys = {};
document.addEventListener('keydown',e=>keys[e.key]=true);
document.addEventListener('keyup',e=>keys[e.key]=false);

// Mouse
let mouse={x:0,y:0,clicked:false};
canvas.addEventListener('mousemove',e=>{
    const rect = canvas.getBoundingClientRect();
    mouse.x=e.clientX-rect.left;
    mouse.y=e.clientY-rect.top;
});
canvas.addEventListener('mousedown',()=>mouse.clicked=true);
canvas.addEventListener('mouseup',()=>mouse.clicked=false);

// Spawn zombies
function spawnZombie(){
    const types=['normal','helmet','fast'];
    let type=types[Math.floor(Math.random()*types.length)];
    let x=Math.random()*MAP_WIDTH;
    let y=Math.random()*MAP_HEIGHT;
    let speed=type==='fast'?2+progress.wave*0.3:1+progress.wave*0.2;
    let health=type==='helmet'?4:1;
    zombies.push({x,y,size:18,type,speed,health});
}

// Shoot bullet
function shoot(){
    const w = weapons[player.weapon];
    if(w.auto && w.ammo<=0) return;
    const angle=Math.atan2(mouse.y-canvas.height/2,mouse.x-canvas.width/2);
    bullets.push({x:player.x,y:player.y,size:w.size,speed:w.speed,damage:w.damage,dx:Math.cos(angle)*w.speed,dy:Math.sin(angle)*w.speed});
    if(w.auto) w.ammo--;
}

// Build wall near player
function buildWall(type){
    let w={x:player.x+player.size,y:player.y+player.size,w:40,h:10,life:type==='stone'?10:5,type:type,zombiesOn:0};
    walls.push(w);
    if(type==='wood') progress.resources.wood--;
    else progress.resources.stone--;
}

// Update game
function update(dt){
    // Movement
    let vx=0,vy=0;
    if(keys['w']) vy-=1;
    if(keys['s']) vy+=1;
    if(keys['a']) vx-=1;
    if(keys['d']) vx+=1;
    let len=Math.hypot(vx,vy);
    if(len>0){vx/=len; vy/=len;} // normalize for diagonal
    let speed=player.speed;
    ponds.forEach(p=>{
        if(player.x>p.x && player.x<p.x+p.w && player.y>p.y && player.y<p.y+p.h) speed=player.speed/2;
    });
    player.x+=vx*speed;
    player.y+=vy*speed;

    // Weapon switch
    if(keys['1']) player.weapon=0;
    if(keys['2']) player.weapon=1;
    if(keys['3'] && weapons[2].ammo>0) player.weapon=2;

    // Shoot
    if(mouse.clicked){
        if(player.weapon===2) shoot();
    }
    if(!weapons[player.weapon].auto && mouse.clicked) shoot();

    // Build wall
    if(keys['Shift']){
        if(progress.resources.wood>0) buildWall('wood');
        else if(progress.resources.stone>0) buildWall('stone');
    }

    // Update bullets
    bullets.forEach((b,i)=>{
        b.x+=b.dx;
        b.y+=b.dy;
        if(b.x<0||b.x>MAP_WIDTH||b.y<0||b.y>MAP_HEIGHT) bullets.splice(i,1);
    });

    // Update zombies
    zombies.forEach((z,i)=>{
        let angle=Math.atan2(player.y-z.y,player.x-z.x);
        z.x+=Math.cos(angle)*z.speed;
        z.y+=Math.sin(angle)*z.speed;

        bullets.forEach((b,j)=>{
            if(b.x<z.x+z.size && b.x+b.size>z.x && b.y<z.y+z.size && b.y+b.size>z.y){
                z.health-=b.damage;
                bullets.splice(j,1);
                if(z.health<=0){zombies.splice(i,1);progress.score+=10;}
            }
        });

        walls.forEach(w=>{
            if(z.x<w.x+w.w && z.x+z.size>w.x && z.y<w.y+w.h && z.y+z.size>w.y){
                z.x-=Math.cos(angle)*z.speed*0.5;
                z.y-=Math.sin(angle)*z.speed*0.5;
                w.zombiesOn++;
                if(w.zombiesOn>50) walls.splice(walls.indexOf(w),1);
            }
        });

        if(z.x<player.x+player.size && z.x+z.size>player.x &&
           z.y<player.y+player.size && z.y+z.size>player.y){
            progress.playerLives--;
            zombies.splice(i,1);
        }
    });

    // Spawn wave
    if(zombies.length===0){
        progress.wave++;
        for(let i=0;i<progress.wave*5;i++) spawnZombie();
    }

    // Check full-auto pickup
    if(!fullAutoSpawn.picked && player.x>fullAutoSpawn.x-10 && player.x<fullAutoSpawn.x+10 &&
       player.y>fullAutoSpawn.y-10 && player.y<fullAutoSpawn.y+10){
        fullAutoSpawn.picked=true;
        weapons[2].ammo=50;
    }

    localStorage.setItem('zombieGame',JSON.stringify(progress));
}

// Draw
function drawFace(z){
    ctx.fillStyle='black';
    ctx.beginPath();
    ctx.arc(z.x+z.size*0.3,z.y+z.size*0.3,2,0,Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(z.x+z.size*0.7,z.y+z.size*0.3,2,0,Math.PI*2);
    ctx.fill();
    ctx.fillRect(z.x+z.size/2-2,z.y+z.size/2,4,1);
}

function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    const offsetX = player.x-canvas.width/2;
    const offsetY = player.y-canvas.height/2;

    // Ponds
    ponds.forEach(p=>{
        let grad=ctx.createRadialGradient(p.x-offsetX+p.w/2,p.y-offsetY+p.h/2,10,p.x-offsetX+p.w/2,p.y-offsetY+p.h/2,p.w/2);
        grad.addColorStop(0,'#66ccff');
        grad.addColorStop(1,'#3399ff');
        ctx.fillStyle=grad;
        ctx.beginPath();
        ctx.ellipse(p.x-offsetX+p.w/2,p.y-offsetY+p.h/2,p.w/2,p.h/2,0,0,Math.PI*2);
        ctx.fill();
    });

    // Bushes
    ctx.fillStyle='#228822';
    bushes.forEach(b=>{
        ctx.beginPath();
        ctx.arc(b.x-offsetX+b.w/2,b.y-offsetY+b.h/2,b.w/2,0,Math.PI*2);
        ctx.fill();
    });

    // Trees
    ctx.fillStyle='#116611';
    trees.forEach(t=>{
        ctx.beginPath();
        ctx.ellipse(t.x-offsetX+t.w/2,t.y-offsetY+t.h/2,t.w/2,t.h/2,0,0,Math.PI*2);
        ctx.fill();
    });

    // Houses
    houses.forEach(h=>{
        let grad=ctx.createLinearGradient(h.x-offsetX,h.y-offsetY,h.x-offsetX,h.y-offsetY+h.h);
        grad.addColorStop(0,'#964B00');
        grad.addColorStop(1,'#AA7744');
        ctx.fillStyle=grad;
        ctx.beginPath();
        ctx.roundRect(h.x-offsetX,h.y-offsetY,h.w,h.h,5);
        ctx.fill();
    });

    // Walls
    walls.forEach(w=>{
        ctx.fillStyle=w.type==='wood'?'sienna':'gray';
        ctx.beginPath();
        ctx.roundRect(w.x-offsetX,w.y-offsetY,w.w,w.h,3);
        ctx.fill();
    });

    // Player
    let grad=ctx.createRadialGradient(player.x-offsetX,player.y-offsetY,5,player.x-offsetX,player.y-offsetY,player.size);
    grad.addColorStop(0,'#66f');
    grad.addColorStop(1,'#0033aa');
    ctx.fillStyle=grad;
    ctx.beginPath();
    ctx.arc(player.x-offsetX,player.y-offsetY,player.size,0,Math.PI*2);
    ctx.fill();

    // Bullets
    ctx.fillStyle='yellow';
    bullets.forEach(b=>{
        ctx.beginPath();
        ctx.arc(b.x-offsetX,b.y-offsetY,b.size,0,Math.PI*2);
        ctx.fill();
    });

    // Zombies
    zombies.forEach(z=>{
        let gradZ=ctx.createRadialGradient(z.x-offsetX,z.y-offsetY,2,z.x-offsetX,z.y-offsetY,z.size/2);
        gradZ.addColorStop(0,'#99ff99');
        gradZ.addColorStop(1,'#33aa33');
        ctx.fillStyle=gradZ;
        ctx.beginPath();
        ctx.arc(z.x-offsetX,z.y-offsetY,z.size/2,0,Math.PI*2);
        ctx.fill();
        drawFace({x:z.x-offsetX,y:z.y-offsetY,size:z.size});
        if(z.type==='helmet'){
            ctx.fillStyle='gray';
            ctx.fillRect(z.x-offsetX-z.size/2,z.y-offsetY-z.size/2,z.size,5);
        }
    });

    // Full-auto pickup
    if(!fullAutoSpawn.picked){
        ctx.fillStyle='red';
        ctx.beginPath();
        ctx.arc(fullAutoSpawn.x-offsetX,fullAutoSpawn.y-offsetY,10,0,Math.PI*2);
        ctx.fill();
    }

    // HUD
    ctx.fillStyle='white';
    ctx.fillText(`Score: ${progress.score}`,10,20);
    ctx.fillText(`Wave: ${progress.wave}`,10,40);
    ctx.fillText(`Lives: ${progress.playerLives}`,10,60);
    ctx.fillText(`Weapon: ${weapons[player.weapon].name}`,10,80);
    ctx.fillText(`Wood: ${progress.resources.wood} Stone: ${progress.resources.stone} Ammo: ${weapons[2].ammo}`,10,100);
}

// Game loop
let lastTime=0;
function gameLoop(timestamp){
    const dt=timestamp-lastTime;
    lastTime=timestamp;
    update(dt);
    draw();
    if(progress.playerLives<=0){
        alert("Game Over! Score: "+progress.score);
        progress={score:0,wave:1,playerLives:3,resources:{wood:5,stone:0,ammo:0}};
        weapons[2].ammo=50;
        localStorage.setItem('zombieGame',JSON.stringify(progress));
    }
    requestAnimationFrame(gameLoop);
}

// Start initial wave
for(let i=0;i<progress.wave*5;i++) spawnZombie();
gameLoop();
