// Neon Snake: Modern neon look, smooth classic movement, refined snake, glowing fruit, glass UI

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const S = 24;
const W = canvas.width;
const H = canvas.height;
const COLS = Math.floor(W/S);
const ROWS = Math.floor(H/S);

let snake, direction, nextDir, fruit, score, highScore, running, paused, tick, speed, baseSpeed, minSpeed, maxSpeed, grow, particles, gameOverAnim, combo, comboTimer, splashes, moveFrom, moveTo, moveProgress, keyBuffer, lastMoveTime, moveDuration, trail, fruitBounce;

const NEON_SNAKE = [
    "#00fff7","#47d1ff","#00e0c9","#0ff","#1affff","#a8fff9","#5ee9ff"
];
const FRUIT_COLOR = "#ff2bff";

function loadHighScore() {
    highScore = Number(localStorage.getItem('snake_highscore')||0);
    document.getElementById('highscore').textContent = highScore;
}
function saveHighScore() {
    if(score>highScore) {
        highScore = score;
        localStorage.setItem('snake_highscore', score);
        document.getElementById('highscore').textContent = highScore;
    }
}
function resetGame() {
    snake = [ {x:Math.floor(COLS/2), y:Math.floor(ROWS/2)} ];
    direction = {x:1, y:0};
    nextDir = {x:1, y:0};
    score = 0;
    grow = 2;
    speed = baseSpeed = 11;
    minSpeed = 6;
    maxSpeed = 20;
    paused = false;
    running = true;
    particles = [];
    gameOverAnim = 0;
    combo = 1;
    comboTimer = 0;
    splashes = [];
    moveFrom = [];
    moveTo = [];
    moveProgress = 1;
    keyBuffer = [];
    lastMoveTime = performance.now();
    moveDuration = 99; // ms per move
    trail = [];
    fruitBounce = 0;
    placeFruit();
    updateScore();
    document.getElementById('pauseBtn').textContent = "⏸";
    document.getElementById('combo').textContent = '';
}
function updateScore() {
    document.getElementById('score').textContent = score;
}
function placeFruit() {
    let ok = false, x, y;
    while(!ok) {
        x = Math.floor(Math.random()*COLS);
        y = Math.floor(Math.random()*ROWS);
        ok = !snake.some(s=>s.x===x&&s.y===y);
    }
    fruit = {x, y};
}
function growParticle(x, y, color) {
    for(let i=0;i<18;i++) {
        particles.push({
            x: x*S+S/2,
            y: y*S+S/2,
            vx: Math.cos(i*Math.PI/9)*2.2*(0.8+Math.random()*0.6),
            vy: Math.sin(i*Math.PI/9)*2.2*(0.8+Math.random()*0.6),
            a: 1,
            color
        });
    }
}
function drawNeonBG(t) {
    // Subtle, slow-moving layered gradient
    let g = ctx.createLinearGradient(0,H/2,W,H/2);
    g.addColorStop(0, `hsl(${185+Math.sin(t/1700)*35}, 90%, 44%)`);
    g.addColorStop(0.47+0.13*Math.sin(t/2100), `hsl(${230+Math.cos(t/2300)*36}, 80%, 18%)`);
    g.addColorStop(1, `hsl(${320+Math.sin(t/1450)*24}, 90%, 17%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);
    // Soft twinkle stars
    ctx.save();
    for(let i=0;i<18;i++) {
        let sx = (Math.sin(t/1700+i*12.3)*0.5+0.5)*W;
        let sy = (Math.cos(t/1300+i*15.7)*0.5+0.5)*H;
        ctx.globalAlpha = 0.07 + 0.10*Math.abs(Math.sin(t/800+i*0.7));
        ctx.beginPath();
        ctx.arc(sx,sy,Math.random()*1.7+0.7,0,2*Math.PI);
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "#fff";
        ctx.shadowBlur = 9;
        ctx.fill();
    }
    ctx.restore();
}
function drawSnake(t, interp) {
    // Neon glowing rounded-rect snake, head is slightly bigger and more expressive
    for(let i=snake.length-1;i>=0;i--) {
        let seg = snake[i];
        let c = NEON_SNAKE[i%NEON_SNAKE.length];
        let from = moveFrom[i] || seg, to = moveTo[i] || seg;
        let x = from.x + (to.x - from.x) * interp;
        let y = from.y + (to.y - from.y) * interp;

        let width = (i===0) ? S*0.95 : S*0.82;
        let height = (i===0) ? S*0.82 : S*0.70;
        let radius = (i===0) ? S*0.36 : S*0.29;

        ctx.save();
        ctx.globalAlpha = 0.9 - i * 0.03;

        // Glow
        ctx.shadowColor = c;
        ctx.shadowBlur = (i==0)?34:14;

        // Main body (rounded rectangle)
        ctx.beginPath();
        roundRect(ctx, x*S+S/2-width/2, y*S+S/2-height/2, width, height, radius);
        let grad = ctx.createLinearGradient(x*S, y*S, x*S+S, y*S+S);
        grad.addColorStop(0, "#fff8");
        grad.addColorStop(0.35, c);
        grad.addColorStop(1, "#0ff2");
        ctx.fillStyle = grad;
        ctx.fill();

        // Inner gloss
        if(i===0) {
            ctx.save();
            ctx.globalAlpha = 0.19 + 0.2*Math.abs(Math.sin(t/110));
            ctx.beginPath();
            roundRect(ctx, x*S+S/2-width/2+3, y*S+S/2-height/2+3, width-6, height-9, radius-4);
            ctx.fillStyle = "#fff2";
            ctx.shadowColor = c;
            ctx.shadowBlur = 13;
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();

        // Eyes on head
        if(i==0) {
            ctx.save();
            ctx.fillStyle="#fff";
            let ex = x*S+S/2+direction.x*4, ey = y*S+S/2+direction.y*4;
            ctx.beginPath();
            ctx.arc(ex-4, ey-5, 2.1, 0, 2*Math.PI);
            ctx.arc(ex+4, ey-5, 2.1, 0, 2*Math.PI);
            ctx.fill();
            // Neon blue mask (smiling)
            ctx.globalAlpha = 0.52;
            ctx.beginPath();
            ctx.arc(x*S+S/2, y*S+S/2+4, 7, Math.PI*0.2, Math.PI*0.8);
            ctx.lineWidth = 2.8;
            ctx.strokeStyle = "#0ff";
            ctx.shadowColor = "#0ff";
            ctx.shadowBlur = 7;
            ctx.stroke();
            ctx.restore();
        }
    }
}
function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y,   x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x,   y+h, r);
    ctx.arcTo(x,   y+h, x,   y,   r);
    ctx.arcTo(x,   y,   x+w, y,   r);
    ctx.closePath();
}
function drawFruit(t) {
    fruitBounce += (Math.sin(t/480+fruit.x)*2.5 - fruitBounce)*0.1;
    ctx.save();
    ctx.shadowColor = FRUIT_COLOR;
    ctx.shadowBlur = 24 + 8*Math.sin(t/500);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(fruit.x*S+S/2, fruit.y*S+S/2+fruitBounce, S*0.41, 0, 2*Math.PI);
    ctx.fillStyle = FRUIT_COLOR;
    ctx.fill();
    // Sparkle
    for(let i=0;i<4;i++) {
        let ang = t/120+i*1.2;
        let r = S*0.37+Math.sin(t/70+i*0.9)*2;
        ctx.save();
        ctx.globalAlpha = 0.4+0.4*Math.sin(t/140+i);
        ctx.beginPath();
        ctx.arc(fruit.x*S+S/2+Math.cos(ang)*r, fruit.y*S+S/2+fruitBounce+Math.sin(ang)*r, 1.7, 0, 2*Math.PI);
        ctx.fillStyle="#fff";
        ctx.shadowColor="#fff";
        ctx.shadowBlur=7;
        ctx.fill();
        ctx.restore();
    }
    ctx.restore();
}
function drawParticles() {
    particles.forEach(p=>{
        ctx.save();
        ctx.globalAlpha = 0.11+0.7*p.a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.1, 0, 2*Math.PI);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 9*p.a;
        ctx.fill();
        ctx.restore();
    });
}
function drawSplashes(t) {
    for(let i=0;i<splashes.length;i++) {
        let s = splashes[i];
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1-s.a);
        ctx.font = `bold ${22-s.a*11}px Orbitron, Arial`;
        ctx.textAlign = "center";
        ctx.fillStyle = s.color;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 14;
        ctx.fillText(s.text, s.x, s.y-s.a*20);
        ctx.restore();
    }
}
function render(now) {
    let t = now;
    let interp = moveProgress;
    ctx.clearRect(0,0,W,H);
    drawNeonBG(t);
    drawParticles();
    drawFruit(t);
    drawSnake(t, interp);
    drawSplashes(t);

    if(combo > 1 && comboTimer > 0) {
        document.getElementById('combo').textContent = "Combo x" + combo;
        document.getElementById('combo').style.color = combo > 2 ? "#ffee65" : "#ff2bff";
    } else {
        document.getElementById('combo').textContent = '';
    }
    if(paused && running) {
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = "#000";
        ctx.fillRect(W/2-130, H/2-44, 260, 88);
        ctx.globalAlpha = 1;
        ctx.font = "bold 40px Orbitron, Arial";
        ctx.fillStyle = "#0ff";
        ctx.textAlign = "center";
        ctx.fillText("PAUSED", W/2, H/2+16);
        ctx.restore();
    }
    if(!running && gameOverAnim>0) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "#111a";
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
        ctx.font = "bold 48px Orbitron, Arial";
        ctx.fillStyle = "#ff2bff";
        ctx.shadowColor = "#ff2bff";
        ctx.shadowBlur = 32;
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", W/2, H/2-10);
        ctx.font = "24px Orbitron, Arial";
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff";
        ctx.fillText("Score: "+score, W/2, H/2+36);
        ctx.restore();
    }
    requestAnimationFrame(render);
}
function moveSnake() {
    // Buffer controls: only apply one new direction per step
    if(keyBuffer.length) {
        let d = keyBuffer.shift();
        if((d.x!==-direction.x || d.y!==-direction.y) && (d.x!==direction.x || d.y!==direction.y)) {
            nextDir = d;
        }
    }
    direction = {x: nextDir.x, y: nextDir.y};
    let newHead = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    if(newHead.x<0) newHead.x=COLS-1;
    if(newHead.x>=COLS) newHead.x=0;
    if(newHead.y<0) newHead.y=ROWS-1;
    if(newHead.y>=ROWS) newHead.y=0;
    // Collision with self
    if(snake.some((s,i)=>i>0&&s.x===newHead.x&&s.y===newHead.y)) {
        running = false;
        gameOverAnim = 1;
        saveHighScore();
        growParticle(newHead.x, newHead.y, "#ff2bff");
        splashes.push({text:"GAME OVER",x:newHead.x*S+S/2,y:newHead.y*S+S/2,color:"#ff2bff",a:0});
        setTimeout(()=>gameOverAnim=0, 2000);
        return;
    }
    snake.unshift(newHead);
    // Eat fruit
    if(newHead.x === fruit.x && newHead.y === fruit.y) {
        let points = combo;
        if(comboTimer > 0) combo = Math.min(combo + 1, 5);
        else combo = 1;
        comboTimer = 44;
        score += points;
        grow+=1;
        updateScore();
        growParticle(newHead.x, newHead.y, FRUIT_COLOR);
        splashes.push({text:`+${points}`,x:newHead.x*S+S/2,y:newHead.y*S+S/2,color:FRUIT_COLOR,a:0});
        placeFruit();
    } else {
        if(grow>0) grow--;
        else snake.pop();
    }
    if(comboTimer > 0) comboTimer--;
    if(comboTimer === 0 && combo > 1) combo = 1;
    saveHighScore();
}
function advanceParticles() {
    for(let i=particles.length-1;i>=0;i--) {
        let p=particles[i];
        p.x+=p.vx;
        p.y+=p.vy;
        p.a*=0.89;
        if(p.a<0.06) particles.splice(i,1);
    }
}
function advanceSplashes() {
    for(let i=splashes.length-1;i>=0;i--) {
        let s = splashes[i];
        s.a += 0.055;
        if(s.a>=1) splashes.splice(i,1);
    }
}
function gameLoop(now) {
    if(paused || !running) {
        lastMoveTime = now;
        moveProgress = 1;
        setTimeout(()=>gameLoop(performance.now()), 14);
        return;
    }
    let elapsed = now - lastMoveTime;
    moveProgress = Math.min(1, elapsed / moveDuration);
    if(elapsed >= moveDuration) {
        moveFrom = snake.map(s=>({...s}));
        moveSnake();
        moveTo = snake.map(s=>({...s}));
        if(moveTo.length < moveFrom.length) moveFrom.length = moveTo.length;
        lastMoveTime = now;
        moveProgress = 0;
    }
    advanceParticles();
    advanceSplashes();
    setTimeout(()=>gameLoop(performance.now()), 14);
}
function handleKey(e,down) {
    if(!down) return;
    let d;
    if(["ArrowLeft","a","A"].includes(e.key) && direction.x!==1) d={x:-1,y:0};
    else if(["ArrowUp","w","W"].includes(e.key) && direction.y!==1) d={x:0,y:-1};
    else if(["ArrowRight","d","D"].includes(e.key) && direction.x!==-1) d={x:1,y:0};
    else if(["ArrowDown","s","S"].includes(e.key) && direction.y!==-1) d={x:0,y:1};
    else if(e.key===" "||e.key==="Spacebar") togglePause();
    else return;
    keyBuffer.push(d);
    e.preventDefault();
}
function handleTouch(dir) {
    let d;
    if(dir==='left' && direction.x!==1) d={x:-1,y:0};
    if(dir==='up' && direction.y!==1) d={x:0,y:-1};
    if(dir==='right' && direction.x!==-1) d={x:1,y:0};
    if(dir==='down' && direction.y!==-1) d={x:0,y:1};
    if(d) keyBuffer.push(d);
}
function togglePause() {
    if(!running) return;
    paused=!paused;
    document.getElementById('pauseBtn').textContent = paused?"▶️":"⏸";
}
document.getElementById('restartBtn').onclick = ()=>resetGame();
document.getElementById('pauseBtn').onclick = togglePause;
window.addEventListener('keydown', e=>{
    handleKey(e,true);
}, {passive:false});
window.addEventListener('keyup', e=>{
}, {passive:false});
function isMobile() {
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}
if(isMobile()) {
    document.getElementById('mobile-controls').style.display = 'block';
    document.querySelectorAll('#mobile-controls button').forEach(btn=>{
        btn.addEventListener('touchstart', function(e){
            e.preventDefault();
            if(btn.classList.contains('up')) handleTouch('up');
            if(btn.classList.contains('down')) handleTouch('down');
            if(btn.classList.contains('left')) handleTouch('left');
            if(btn.classList.contains('right')) handleTouch('right');
        }, {passive:false});
    });
}
function startGame() {
    loadHighScore();
    tick=0;
    resetGame();
    requestAnimationFrame(render);
    setTimeout(()=>gameLoop(performance.now()), 0);
}
startGame();