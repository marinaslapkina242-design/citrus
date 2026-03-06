/**
 * CITRUS ONLINE CORE - Модуль реального мультиплеера
 */
const citrusNet = {
    peer: null,
    connections: {},
    friends: JSON.parse(localStorage.getItem('citrus_friends_list') || '[]'),
    remoteModels: {},

    init() {
        console.log("🌐 CITRUS ONLINE: Запуск сетевого модуля...");
        
        // Генерируем ID на основе ника
        const myId = "CITRUS_" + app.nick.replace(/\s/g, '_') + "_" + Math.floor(Math.random()*999);
        this.peer = new Peer(myId);

        this.peer.on('open', (id) => {
            console.log("✅ Твой сетевой ID:", id);
            this.injectUI(id);
        });

        // Слушаем входящие подключения
        this.peer.on('connection', (conn) => {
            this.setupConnection(conn);
        });

        // Запускаем цикл синхронизации
        this.startSync();
    },

    // Внедряем интерфейс друзей прямо в твой ХАБ
    injectUI(myId) {
        const friendTab = document.getElementById('tab-friends');
        if (!friendTab) return;

        friendTab.innerHTML = `
            <div style="background:rgba(255,152,0,0.1); padding:20px; border-radius:15px; border:1px solid #FF9800; margin-bottom:20px;">
                <h3 style="margin:0; color:#FF9800;">ТВОЙ СЕТЕВОЙ ID: <span style="color:#fff; user-select:all;">${myId}</span></h3>
                <p style="font-size:12px; opacity:0.6;">Отправь этот код другу, чтобы он мог войти в твой мир.</p>
            </div>
            
            <div style="display:flex; gap:10px; margin-bottom:20px;">
                <input type="text" id="net-id-input" placeholder="ID друга..." style="flex:1; padding:12px; background:#111; border:1px solid #333; color:#fff; border-radius:8px;">
                <button onclick="citrusNet.connectToFriend()" style="background:#00E676; color:#000; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer;">ДОБАВИТЬ И ИГРАТЬ</button>
            </div>

            <div id="citrus-net-list">
                <h4 style="color:#555;">ИГРОКИ В СЕТИ:</h4>
                <div id="active-players"></div>
            </div>
        `;
    },

    connectToFriend() {
        const targetId = document.getElementById('net-id-input').value.trim();
        if (!targetId || targetId === this.peer.id) return alert("Неверный ID!");
        
        const conn = this.peer.connect(targetId);
        this.setupConnection(conn);
    },

    setupConnection(conn) {
        conn.on('open', () => {
            this.connections[conn.peer] = conn;
            console.log("🤝 Подключено к:", conn.peer);
            
            // Добавляем в список друзей
            if(!this.friends.includes(conn.peer)) {
                this.friends.push(conn.peer);
                localStorage.setItem('citrus_friends_list', JSON.stringify(this.friends));
            }
            this.renderFriends();
        });

        conn.on('data', (data) => {
            if (data.type === 'move') this.updateRemotePlayer(conn.peer, data);
        });

        conn.on('close', () => {
            if(this.remoteModels[conn.peer]) {
                app.scene.remove(this.remoteModels[conn.peer]);
                delete this.remoteModels[conn.peer];
            }
            delete this.connections[conn.peer];
        });
    },

    updateRemotePlayer(id, data) {
        // Если модели игрока еще нет в сцене - создаем её
        if (!this.remoteModels[id]) {
            const geometry = new THREE.BoxGeometry(1, 2, 1);
            const material = new THREE.MeshPhongMaterial({ color: 0xFF4081 });
            const mesh = new THREE.Mesh(geometry, material);
            
            // Добавляем ник над головой
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.font = '30px Arial';
            ctx.fillText(id.split('_')[1], 10, 40);
            const tex = new THREE.CanvasTexture(canvas);
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: tex}));
            sprite.position.y = 1.5;
            mesh.add(sprite);

            app.scene.add(mesh);
            this.remoteModels[id] = mesh;
        }

        // Обновляем позицию
        this.remoteModels[id].position.lerp(new THREE.Vector3(data.x, data.y, data.z), 0.2);
        this.remoteModels[id].rotation.y = data.ry;
    },

    startSync() {
        setInterval(() => {
            if (app.mode !== 'none' && app.player) {
                const payload = {
                    type: 'move',
                    x: app.player.position.x,
                    y: app.player.position.y,
                    z: app.player.position.z,
                    ry: app.player.rotation.y
                };
                
                // Рассылаем свои координаты всем подключенным друзьям
                for (let id in this.connections) {
                    this.connections[id].send(payload);
                }
            }
        }, 50); // 20 раз в секунду
    },

    renderFriends() {
        const list = document.getElementById('active-players');
        if(!list) return;
        list.innerHTML = this.friends.map(f => `
            <div style="background:#111; padding:10px; border-radius:8px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center; border:1px solid #222;">
                <span>🟢 ${f.split('_')[1]}</span>
                <span style="font-size:10px; color:#444;">ID: ${f}</span>
            </div>
        `).join('');
    }
};

// Ждем загрузки основного приложения и запускаем онлайн
window.addEventListener('load', () => {
    setTimeout(() => {
        if (typeof app !== 'undefined') {
            const originalLogin = app.login;
            app.login = function() {
                originalLogin.apply(this, arguments);
                citrusNet.init();
            };
        }
    }, 1000);
});
