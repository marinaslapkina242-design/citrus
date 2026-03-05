// server.js — CITRUS ONLINE backend для render.com
// npm install express cors
// node server.js

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const app     = express();

app.use(cors());
app.use(express.json());
app.use(express.static('.'));  // раздаёт index.html

// ─────────────────────────────────────────
// IN-MEMORY хранилище (сбрасывается при рестарте сервера)
// Для постоянного хранения замените на SQLite или fs.writeFileSync
// ─────────────────────────────────────────
const players  = {};   // { userId: { id, name, tag, color, status, world, ts } }
const requests = {};   // { toId: [ { from_id, to_id, from_name, from_tag, from_color } ] }
const accepted = {};   // { toId: [ { from_id, from_name, from_tag } ] }

// Чистим устаревших игроков каждую минуту
setInterval(()=>{
    const cutoff = Date.now() - 6*60*1000;
    for(const uid in players)
        if((players[uid].ts||0) < cutoff) delete players[uid];
}, 60_000);

// ── Присутствие ──────────────────────────
app.post('/api/presence', (req, res)=>{
    const p = req.body;
    if(!p||!p.id||!p.name) return res.status(400).json({error:'bad'});
    players[String(p.id)] = {...p, ts: Date.now()};
    res.json({ok:true});
});

app.get('/api/online', (req, res)=>{
    const cutoff = Date.now() - 5*60*1000;
    const list = Object.values(players).filter(p => p.ts >= cutoff);
    res.json(list);
});

// ── События для игрока (заявки + принятия) ──
app.get('/api/events/:userId', (req, res)=>{
    const uid = req.params.userId;
    res.json({
        requests: requests[uid] || [],
        accepted: accepted[uid] || []
    });
});

// ── Отправить заявку в друзья ──
app.post('/api/request', (req, res)=>{
    const {from_id, to_id, from_name, from_tag, from_color} = req.body;
    if(!from_id||!to_id) return res.status(400).json({error:'bad'});
    if(!requests[to_id]) requests[to_id] = [];
    // Не дублируем
    if(!requests[to_id].find(r=>String(r.from_id)===String(from_id))){
        requests[to_id].push({from_id:String(from_id), to_id:String(to_id), from_name, from_tag, from_color, ts:Date.now()});
    }
    res.json({ok:true});
});

app.delete('/api/request/:toId/:fromId', (req, res)=>{
    const {toId, fromId} = req.params;
    if(requests[toId]) requests[toId] = requests[toId].filter(r=>String(r.from_id)!==String(fromId));
    res.json({ok:true});
});

// ── Принять заявку ──
app.post('/api/accept', (req, res)=>{
    const {from_id, to_id, from_name, from_tag} = req.body;
    if(!from_id||!to_id) return res.status(400).json({error:'bad'});
    // Удаляем исходную заявку
    if(requests[from_id]) requests[from_id] = requests[from_id].filter(r=>String(r.from_id)!==String(to_id));
    // Уведомляем отправителя заявки что его приняли
    if(!accepted[to_id]) accepted[to_id] = [];
    if(!accepted[to_id].find(a=>String(a.from_id)===String(from_id))){
        accepted[to_id].push({from_id:String(from_id), from_name, from_tag, ts:Date.now()});
    }
    res.json({ok:true});
});

app.delete('/api/events/:userId/accepted/:fromId', (req, res)=>{
    const {userId, fromId} = req.params;
    if(accepted[userId]) accepted[userId] = accepted[userId].filter(a=>String(a.from_id)!==String(fromId));
    res.json({ok:true});
});

// ── index.html для всех остальных маршрутов ──
app.get('*', (req, res)=>{
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`CITRUS server running on port ${PORT}`));
