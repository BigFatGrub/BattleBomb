const loader = new THREE.GLTFLoader();
const audioLoader = new THREE.AudioLoader();
const gameDom = document.getElementById('game')
let p2isAI = false
let playing = false
let blocky1
let blocky2
let stepsBuffer

const p1Controls = {
    up: 'w',
    down: 's',
    left: 'a',
    right: 'd',
    bomb: ' '
}
const p2Controls = {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    bomb: '0'
}

loader.load('./objects/blocky.glb', res => {
    blocky1 = res
}, undefined, error => {
    console.error(error);
});
loader.load('./objects/blocky2.glb', res => {
    blocky2 = res
}, undefined, error => {
    console.error(error);
});

function startGame() {
    const existingCanvasses = document.getElementsByTagName('canvas')
    for (let i = existingCanvasses.length - 1; i >= 0; i--){ existingCanvasses[0].remove() }

    const playerObj1 = SkeletonUtils.clone(blocky1.scene.children[0])
    const playerObj2 = SkeletonUtils.clone(blocky2.scene.children[0])
    const animations = blocky1.animations
    //////////////////////
    // Global Variables //
    //////////////////////

    // Scene related
    let gameover = false
    const timerTime = 15 // seconds
    const fieldWidth = 10 // tiles, must be even
    const fieldHeight = 9 // tiles, must be uneven
    const bombRotateSpeed = 0.02
    const bombTime = 1.5 // seconds
    let aspect = window.innerWidth / window.innerHeight;
    let frustumSize = Math.sqrt(fieldWidth ** 2 + fieldHeight ** 2) + 4
    const fallingTiles = []
    let evaluateTurn = false

    // Character related
    const walkSpeed = 0.05

    // UI related
    const circle = document.querySelector('circle');
    const gameoverOverlay = document.getElementById('gameoverOverlay')
    const tilesCountP1 = document.getElementsByClassName('tileCounter p1')[0].getElementsByTagName('p')[0]
    const tilesCountP2 = document.getElementsByClassName('tileCounter p2')[0].getElementsByTagName('p')[0]
    let noChangeCounter = 0
    tilesCountP1.innerHTML = fieldWidth / 2 * fieldHeight
    tilesCountP2.innerHTML = fieldWidth / 2 * fieldHeight

    // AI related, only used when p2 is AI
    let destinationTile


    /////////////////
    // Scene setup //
    /////////////////

    // Stats monitor
    // const stats = new Stats();
    // stats.showPanel(0)
    // gameDom.appendChild(stats.dom);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(frustumSize/ - 2, frustumSize / 2, frustumSize / aspect / 2, frustumSize / aspect / - 2, 1, 1000);
    const listener = new THREE.AudioListener();
    const clock = new THREE.Clock()
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(new THREE.Color(0x21252d))
    gameDom.appendChild(renderer.domElement);

    camera.add( listener );
    camera.position.set(-10, 10, 10)
    camera.lookAt(0, 0, 0)

    const steps1 = new THREE.PositionalAudio( listener );
    const steps2 = new THREE.PositionalAudio( listener );
    audioLoader.load( './audio/steps.mp3', function( buffer ) {
        steps1.setBuffer( buffer )
        steps2.setBuffer( buffer )
        steps1.setRefDistance( 10 )
        steps2.setRefDistance( 10 )
        steps1.setLoop( true )
        steps2.setLoop( true )
    });
    
    const targetObject = new THREE.Object3D();
    targetObject.position.set(2, -10, -5)
    scene.add(targetObject);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.75);
    const ambientLight = new THREE.AmbientLight(0x404040); // soft white light
    // directionalLight.castShadow = true
    directionalLight.target = targetObject
    scene.add(directionalLight);
    scene.add(ambientLight);

    const axesHelper = new THREE.AxesHelper(1);
    scene.add(axesHelper);

    //////////////////////////////
    // Generating playing field //
    //////////////////////////////

    // Floor tiles
    const tilesP1 = []
    const tilesP2 = []
    const tileGeometry = new THREE.BoxGeometry(0.9, 0.5, 0.9);
    tileGeometry.translate(0, -0.7, 0)
    for (let i = 0; i < fieldWidth; i++) {
        for (let j = 0; j < fieldHeight; j++) {
            const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
            const tile = new THREE.Mesh(tileGeometry, material);
            const explosion = new THREE.PositionalAudio( listener );
            tile.position.set(i - fieldWidth / 2 + (i < fieldWidth / 2 ? 0.2 : 0.7), 0, j - fieldHeight / 2)

            if (i < fieldWidth / 2) { tilesP1.push({
                i, j, object: tile,
                bomb: undefined,
                explosion
            }) }
            else { tilesP2.push({
                i, j, object: tile,
                bomb: undefined, h: undefined,
                g: undefined, f: undefined,
                cameFrom: undefined,
                explosion
            }) }
            tile.add(explosion)
            scene.add(tile);
        }
    }

    // Adding explosion sounds to tiles
    audioLoader.load( './audio/explosion.mp3', function( buffer ) {
        [...tilesP1, ...tilesP1].forEach(t => {
            t.explosion.setBuffer( buffer )
            t.explosion.setRefDistance( 10 )
        })
    });

    // Finding neighbors and link them
    for (let t = 0; t < tilesP1.length; t++) {
        const tile = tilesP1[t]
        tile.tileUp = tilesP1.find(ti => ti.i == tile.i + 1 && ti.j == tile.j)
        tile.tileDown = tilesP1.find(ti => ti.i == tile.i - 1 && ti.j == tile.j)
        tile.tileLeft = tilesP1.find(ti => ti.i == tile.i && ti.j == tile.j - 1)
        tile.tileRight = tilesP1.find(ti => ti.i == tile.i && ti.j == tile.j + 1)
    }

    for (let t = 0; t < tilesP2.length; t++) {
        const tile = tilesP2[t]
        tile.tileUp = tilesP2.find(ti => ti.i == tile.i + 1 && ti.j == tile.j)
        tile.tileDown = tilesP2.find(ti => ti.i == tile.i - 1 && ti.j == tile.j)
        tile.tileLeft = tilesP2.find(ti => ti.i == tile.i && ti.j == tile.j - 1)
        tile.tileRight = tilesP2.find(ti => ti.i == tile.i && ti.j == tile.j + 1)
    }

    ///////////////////////
    // Generating player //
    ///////////////////////

    const player1 = {
        object: new THREE.Object3D(), //new THREE.Mesh(playerGeometry, player1Material),
        pivot: new THREE.Object3D(),
        movement: [],
        bombs: [],
        tiles: tilesP1,
        currentTile: undefined,
        opponent: undefined,
        bombCounting: false,
        bombCounter: bombTime,
        mixer: new THREE.AnimationMixer(playerObj1),
        hoverColor: 0x0FC100,
        steps: steps1,
        idleAction: null,
        runAction: null,
        poopAction: null
    }
    const player2 = {
        object: new THREE.Object3D(),
        pivot: new THREE.Object3D(),
        movement: [],
        bombs: [],
        tiles: tilesP2,
        currentTile: undefined,
        opponent: undefined,
        bombCounting: false,
        bombCounter: bombTime,
        mixer: new THREE.AnimationMixer(playerObj2),
        hoverColor: 0xC10B00,
        steps: steps2,
        idleAction: null,
        runAction: null,
        poopAction: null
    }

    const players = [player1, player2]
    players.forEach(p => {
        p.idleAction = p.mixer.clipAction(animations[2]);
        p.runAction = p.mixer.clipAction(animations[4]);
        p.poopAction = p.mixer.clipAction(animations[3]);
        const middleTile = p.tiles[Math.floor(p.tiles.length / 2)]
        p.object.position.set(middleTile.object.position.x, -0.5, middleTile.object.position.y)
        p.currentTile = middleTile
        p.object.add(p.steps)

        scene.add(p.object);
        scene.add(p.pivot);
    })

    player1.object.add(playerObj1)
    player2.object.add(playerObj2)
    player1.opponent = player2
    player2.opponent = player1
    player1.object.rotation.y = - Math.PI / 2
    player2.object.rotation.y = Math.PI / 2

    //////////////////////////
    // Initialize Functions //
    //////////////////////////

    // Animate functions
    function animate() {

        if (!playing) { return }
        requestAnimationFrame(animate);

        // stats.begin();

        if (!evaluateTurn) {
            timerTick()

            // Start Ai after a few seconds
            if (p2isAI && clock.elapsedTime > 1 && !gameover){
                if(!destinationTile){strategyAI()}
                playerUpdateAI()
            }
            
            playerUpdate(player1)
            playerUpdate(player2)

            bombsUpdate()
        } else if (!gameover) {
            evaluate()
        }

        const clockDelta = clock.getDelta()
        player1.mixer.update(clockDelta);
        player2.mixer.update(clockDelta);
        renderer.render(scene, camera);

        // stats.end();
    }

    // Update loop
    function playerUpdateAI() {
        // Emulate key actions based on calculated moves
        const path = player2.path
        const CurrentTilePos = player2.currentTile.object.position
        if (path[path.length - 1] == player2.currentTile &&
            player2.object.position.distanceTo(CurrentTilePos) < 0.6){
                path.splice(path.length - 1, 1)
        }
        if (path.length == 0 && !player2.bombCounting){
            player2.bombCounting = true;
            player2.movement = []
            setTimeout(() => {
                player2.bombCounting = false
                player2.bombCounter = bombTime
                destinationTile = undefined
            }, bombTime * 1000 + 500)
        }
        else if (path[path.length - 1] == player2.currentTile.tileUp){player2.movement = ['up']}
        else if (path[path.length - 1] == player2.currentTile.tileDown){player2.movement = ['down']}
        else if (path[path.length - 1] == player2.currentTile.tileLeft){player2.movement = ['left']}
        else if (path[path.length - 1] == player2.currentTile.tileRight){player2.movement = ['right']}
    }

    function playerUpdate(player) {
        // Check to which location it should snap
        const tileDistances = player.tiles.map(t => (player.object.position.x - t.object.position.x) ** 2 + (player.object.position.z - t.object.position.z) ** 2)
        player.currentTile = player.tiles[tileDistances.indexOf(Math.min.apply(null, tileDistances))]
        player.tiles.forEach(tile => tile.object.material.color.setHex(0xfffffff))
        player.currentTile.object.material.color.setHex(player.hoverColor);

        if (!player.bombCounting || player.bombCounter < 0) {
            movementLogic(player)
        } else {
            if (player.steps.isPlaying){player.steps.pause()}
            if (player.runAction.isRunning()) { player.runAction.stop() }
            if (player.idleAction.isRunning()) { player.idleAction.stop() }
            if (!player.poopAction.isRunning()) { player.poopAction.play() }

            player.bombCounter -= 1 / 60
            if (player.bombCounter < 0) { addBomb(player) }
        }
    }

    function bombsUpdate() {
        // Move falling tiles further down
        for (let i = fallingTiles.length - 1; i >= 0; i--) {
            fallingObj = fallingTiles[i].object
            fallingObj.position.y -= 0.03 - fallingObj.position.y * 0.01;
            if (fallingObj.position.y < -20) {
                scene.remove(fallingObj);
            }
        }
    }

    // Move bombs and end turn
    let rotateAngle = 0
    let firstIntercept = false

    function evaluate() {
        player1.pivot.rotation.z -= bombRotateSpeed;
        player2.pivot.rotation.z += bombRotateSpeed;

        rotateAngle += bombRotateSpeed;
        if (rotateAngle > Math.PI / 2 && !firstIntercept) {
            firstIntercept = true
            for (let i = player1.bombs.length - 1; i >= 0; i--) {
                const b1 = player1.bombs[i]
                for (let j = player2.bombs.length - 1; j >= 0; j--) {
                    const b2 = player2.bombs[j]
                    if (b1.destinyTile.i == b2.originTile.i &&
                        b1.destinyTile.j == b2.originTile.j) {
                        // Insert explosion here
                        player1.pivot.remove(b1.object)
                        player2.pivot.remove(b2.object)
                        player1.bombs.splice(i, 1)
                        player2.bombs.splice(j, 1)
                    }
                }
            }
        }
        if (rotateAngle > Math.PI) {
            // tile explosion logic
            const allBombs = player1.bombs.concat(player2.bombs)
            for (let i = 0; i < allBombs.length; i++) {
                setTimeout(() => allBombs[i].destinyTile.explosion.play(), Math.random() * 500)
                if (allBombs[i].destinyTile) {
                    fallingTiles.push(allBombs[i].destinyTile)
                    if (allBombs[i].destinyTile.tileUp) { allBombs[i].destinyTile.tileUp.tileDown = undefined }
                    if (allBombs[i].destinyTile.tileDown) { allBombs[i].destinyTile.tileDown.tileUp = undefined }
                    if (allBombs[i].destinyTile.tileRight) { allBombs[i].destinyTile.tileRight.tileLeft = undefined }
                    if (allBombs[i].destinyTile.tileLeft) { allBombs[i].destinyTile.tileLeft.tileRight = undefined }
                }
            }

            // reset values
            rotateAngle = 0
            evaluateTurn = false
            firstIntercept = false
            destinationTile = undefined

            const players = [player1, player2]
            players.forEach(p => {
                for (let i = 0; i < p.tiles.length; i++) { p.tiles[i].bomb = undefined }
                p.bombs.splice(0, p.bombs.length)
                p.pivot.remove(...p.pivot.children);
                p.pivot.rotation.z = 0
                p.bombCounting = false
                p.bombCounting = false
                p.bombCounter = bombTime

                if (p.poopAction.isRunning()) { p.poopAction.stop() }
                if (!p.idleAction.isRunning()) { p.idleAction.play() }
                if (p.runAction.isRunning()) { p.runAction.stop() }
                if (p.steps.isPlaying){p.steps.pause()}
                p.movement = []
            })

            // Check if game should finish
            const p1IslandTiles = countTiles(player1)
            const p2IslandTiles = countTiles(player2)

            if (tilesCountP1.innerHTML != p1IslandTiles.length.toString() ||
            tilesCountP2.innerHTML != p2IslandTiles.length.toString() ){
                noChangeCounter == 0
            } else {
                noChangeCounter++
            }
            tilesCountP1.innerHTML = p1IslandTiles.length.toString()
            tilesCountP2.innerHTML = p2IslandTiles.length.toString()

            if (noChangeCounter > 2){
                gameOver('stale')
            }
            else if( !checkForOverlap() ||
                p1IslandTiles.length == 1 ||
                p2IslandTiles.length == 1 ){
                gameOver('isolation')
            }
        }
    }

    // Input control
    function onKeyDown(event) {
        var keyCode = event.key;
        if (keyCode == p1Controls.up) {
            player1.movement.push('up')
        } else if (keyCode == p1Controls.down) {
            player1.movement.push('down')
        } else if (keyCode == p1Controls.left) {
            player1.movement.push('left')
        } else if (keyCode == p1Controls.right) {
            player1.movement.push('right')
        } else if (keyCode == p1Controls.bomb) {
            player1.bombCounting = true
        }
        else if (keyCode == p2Controls.up && !p2isAI) {
            player2.movement.push('up')
        } else if (keyCode == p2Controls.down && !p2isAI) {
            player2.movement.push('down')
        } else if (keyCode == p2Controls.left && !p2isAI) {
            player2.movement.push('left')
        } else if (keyCode == p2Controls.right && !p2isAI) {
            player2.movement.push('right')
        } else if (keyCode == p2Controls.bomb && !p2isAI) {
            player2.bombCounting = true
        }
    };
    function onKeyUp(event) {
        var keyCode = event.key;
        if (keyCode == p1Controls.up) {
            player1.movement = player1.movement.filter(d => d != 'up')
        } else if (keyCode == p1Controls.down) {
            player1.movement = player1.movement.filter(d => d != 'down')
        } else if (keyCode == p1Controls.left) {
            player1.movement = player1.movement.filter(d => d != 'left')
        } else if (keyCode == p1Controls.right) {
            player1.movement = player1.movement.filter(d => d != 'right')
        } else if (keyCode == p1Controls.bomb) {
            player1.bombCounting = false
            player1.bombCounter = bombTime
        }
        else if (keyCode == p2Controls.up && !p2isAI) {
            player2.movement = player2.movement.filter(d => d != 'up')
        } else if (keyCode == p2Controls.down && !p2isAI) {
            player2.movement = player2.movement.filter(d => d != 'down')
        } else if (keyCode == p2Controls.left && !p2isAI) {
            player2.movement = player2.movement.filter(d => d != 'left')
        } else if (keyCode == p2Controls.right && !p2isAI) {
            player2.movement = player2.movement.filter(d => d != 'right')
        } else if (keyCode == p2Controls.bomb && !p2isAI) {
            player2.bombCounting = false
            player2.bombCounter = bombTime
        }
    };

    // Movement logic
    function movementLogic(player) {
        const curTile = player.currentTile

        // When falling, disable movement
        if (curTile.object.position.y < 0) {
            player.object.position.y = curTile.object.position.y - 0.5;
            gameOver('lost')
            return
        }
        const xDist = curTile.object.position.x - player.object.position.x
        const zDist = curTile.object.position.z - player.object.position.z

        if (Math.abs(xDist) > walkSpeed / 2
            && player.movement[player.movement.length - 1] != 'up'
            && player.movement[player.movement.length - 1] != 'down') { // Only stop when close to a tile center
            player.object.position.x += xDist / Math.abs(xDist) * walkSpeed
        }

        if (Math.abs(zDist) > walkSpeed / 2
            && player.movement[player.movement.length - 1] != 'right'
            && player.movement[player.movement.length - 1] != 'left') { // Only stop when close to a tile center
            player.object.position.z += zDist / Math.abs(zDist) * walkSpeed
        }

        // Handle Movement
        // Only move is there is an adjacent tile and that tile does not have a bomb
        if (player.movement.length == 0) {
            if (player.steps.isPlaying){player.steps.pause()}
            if (player.poopAction.isRunning()) { player.poopAction.stop() }
            if (!player.idleAction.isRunning()) { player.idleAction.play() }
            if (player.runAction.isRunning()) { player.runAction.stop() }
        } else {
            if (!player.steps.isPlaying){
                if (player.steps){player.steps.play()}
            }
        }

        switch (player.movement[player.movement.length - 1]) {
            case 'right': if (curTile.tileRight || zDist > 0) {
                const multiplier = (curTile.tileRight ? 1 - !!curTile.tileRight.bomb || zDist > 0 : 1)
                player.object.position.z += multiplier * walkSpeed;
                player.object.rotation.y = Math.PI
                if (player.poopAction.isRunning()) { player.poopAction.stop() }
                if (player.idleAction.isRunning()) { player.idleAction.stop() }
                if (!player.runAction.isRunning()) { player.runAction.play() }
            } break;
            case 'left': if (curTile.tileLeft || zDist < 0) {
                const multiplier = (curTile.tileLeft ? 1 - !!curTile.tileLeft.bomb || zDist < 0 : 1)
                player.object.position.z -= multiplier * walkSpeed;
                player.object.rotation.y = 0
                if (player.poopAction.isRunning()) { player.poopAction.stop() }
                if (player.idleAction.isRunning()) { player.idleAction.stop() }
                if (!player.runAction.isRunning()) { player.runAction.play() }
            } break;
            case 'up': if (curTile.tileUp || xDist > 0) {
                const multiplier = (curTile.tileUp ? 1 - !!curTile.tileUp.bomb || xDist > 0 : 1)
                player.object.position.x += multiplier * walkSpeed;
                player.object.rotation.y = -Math.PI / 2
                if (player.poopAction.isRunning()) { player.poopAction.stop() }
                if (player.idleAction.isRunning()) { player.idleAction.stop() }
                if (!player.runAction.isRunning()) { player.runAction.play() }
            } break;
            case 'down': if (curTile.tileDown || xDist < 0) {
                const multiplier = (curTile.tileDown ? 1 - !!curTile.tileDown.bomb || xDist < 0 : 1)
                player.object.position.x -= multiplier * walkSpeed;
                player.object.rotation.y = Math.PI / 2
                if (player.poopAction.isRunning()) { player.poopAction.stop() }
                if (player.idleAction.isRunning()) { player.idleAction.stop() }
                if (!player.runAction.isRunning()) { player.runAction.play() }
            } break;
        }
    }

    function strategyAI(){
        const possibleTiles = countTiles(player2)
        destinationTile = possibleTiles[Math.floor(Math.random() * possibleTiles.length)];
    
        const openSet = [player2.currentTile]
        const closedSet = []
        let foundResult = false

        while (openSet.length > 0){
            // as long as there are options to evaluate:
            let winner = 0
            // Check open tile with lowest distance score
            for (let i = 0; i < openSet.length; i++){
                if (openSet[i].f < openSet[winner].f){ winner = i}
            }
            const current = openSet[winner]
            if (current == destinationTile){ foundResult = true; break }

            // Add new current tile to closed tiles and remove from open tiles
            closedSet.push(current)
            for (var i = openSet.length; i >= 0; i--){
                if (openSet[i] == current){openSet.splice(i, 1)}
            }

            // Take all neighbors of current tile and update distance score
            const neighbors = [current.tileUp, current.tileDown, current.tileLeft, current.tileRight]
            for (let i = 0; i < neighbors.length; i++){
                if (!neighbors[i]){ continue }
                if (neighbors[i].bomb){ continue }
                if (neighbors[i].object.position.y < 0){ continue }
                if (closedSet.includes(neighbors[i])){ continue }
                const tempG = current.g + 1
                if (openSet.includes(neighbors[i])){
                    if (neighbors[i].g > tempG){
                        neighbors[i].g = tempG
                        neighbors[i].cameFrom = current
                        neighbors[i].f = neighbors[i].g + neighbors[i].h
                    }
                } else {
                    neighbors[i].g = tempG
                    neighbors[i].cameFrom = current
                    neighbors[i].h = neighbors[i].object.position.manhattanDistanceTo(destinationTile.object.position)
                    neighbors[i].f = neighbors[i].g + neighbors[i].h
                    openSet.push(neighbors[i])
                }
            }
        }
        
        if (foundResult){
            const path = [destinationTile]
            while (path[path.length - 1] != player2.currentTile){
                path.push(path[path.length - 1].cameFrom)
            }
            player2.path = path
        } else {
            destinationTile = undefined
        }
    }

    // Add bomb to the field
    const bombGeometry = new THREE.SphereGeometry(0.3, 32, 32);
    const bombMaterial = new THREE.MeshStandardMaterial({ color: 0x010101 });
    bombGeometry.translate(0, -0.2, 0)

    function addBomb(player) {
        const bomb = new THREE.Mesh(bombGeometry, bombMaterial);
        bomb.position.x = player.currentTile.object.position.x
        bomb.position.z = player.currentTile.object.position.z
        player.currentTile.bomb = bomb
        player.pivot.add(bomb)
        player.bombs.push({
            object: bomb,
            originTile: player.currentTile,
            destinyTile: player.opponent.tiles.find(
                t => t.j == player.currentTile.j && t.i == fieldWidth - 1 - player.currentTile.i
            )
        })
    }

    function countTiles(player){
        const toCheck = [player.currentTile]
        const checked = []

        while (toCheck.length > 0){
            const cur = toCheck[0]
            checked.push(toCheck[0])
            toCheck.splice(0, 1)

            const neighbors = [cur.tileUp, cur.tileDown, cur.tileLeft, cur.tileRight]
            for (let i = 0; i < neighbors.length; i++){
                if (!neighbors[i]){ continue }
                if (fallingTiles.includes(neighbors[i])){ continue }
                if (neighbors[i].object.position.y < 0){ continue }
                if (toCheck.includes(neighbors[i])){ continue }
                if (checked.includes(neighbors[i])){ continue }
                toCheck.push(neighbors[i])
            }
        }

        return checked
    }

    function checkForOverlap(){
        // Check if islands overlap, if not, game over as well
        const islandP1 = countTiles(player1)
        const islandP2 = countTiles(player2)
        for (let n = 0; n < islandP1.length; n++){
            const i = islandP1[n].i
            const j = islandP1[n].j
            const opposite = islandP2.find(t => t.j == j && t.i == fieldWidth - 1 - i)
            if (opposite){ return true }
        }
        return false
    }

    function gameOver(type){
        if (gameover){return}
        gameover = true
        const p1tiles = parseInt(tilesCountP1.innerHTML)
        const p2tiles = parseInt(tilesCountP2.innerHTML)
        const textItem = gameoverOverlay.getElementsByTagName('h3')[0]

        setTimeout(() => {
            playing = false
            gameoverAudio.play()
            gameoverOverlay.style.display = 'flex'

            if (type == 'lost'){
                // Someone got hit by a bomb
                const p1hit = player1.object.position.y < -1
                const p2hit = player2.object.position.y < -1
                if (p1hit && p2hit){
                    textItem.style.color = 'white'
                    textItem.innerHTML = 'What a bummer! you both got hit!'
                } else if (p1hit && p2isAI){
                    textItem.style.color = '#C10B00'
                    textItem.innerHTML = 'Better luck next time! You got hit by the AI.'
                } else if ( p1hit && !p2isAI){
                    textItem.style.color = '#C10B00'
                    textItem.innerHTML = 'Player 2 won the game!'
                } else if (p2hit && p2isAI){
                    textItem.style.color = '#0FC100'
                    textItem.innerHTML = 'you won from the AI! In your face computer...'
                } else if ( p2hit && !p2isAI){
                    textItem.style.color = '#0FC100'
                    textItem.innerHTML = 'Player 1 won the game!'
                }
            }
    
            if (type == 'isolation'){
                // your islands don't overlap
                if (p1tiles == p2tiles){
                    textItem.style.color = 'white'
                    textItem.innerHTML = 'Completely isolated... and you have the same island size.'
                } else if (p1tiles < p2tiles && p2isAI){
                    textItem.style.color = '#C10B00'
                    textItem.innerHTML = 'Completely isolated... but the AI has a larger island!'
                } else if ( p1tiles < p2tiles && !p2isAI){
                    textItem.style.color = '#C10B00'
                    textItem.innerHTML = 'Completely isolated... but player 2 has a larger island!'
                } else if (p1tiles > p2tiles && p2isAI){
                    textItem.style.color = '#0FC100'
                    textItem.innerHTML = 'Completely isolated... but you have a larger island!'
                } else if ( p1tiles > p2tiles && !p2isAI){
                    textItem.style.color = '#0FC100'
                    textItem.innerHTML = 'Completely isolated... but player 1 has a larger island!'
                }
            }
    
            if (type == 'stale'){
                // Nothing happened for 3 rounds
                if (p1tiles == p2tiles){
                    textItem.style.color = 'white'
                    textItem.innerHTML = 'Stalemate! And you have the same island size.'
                } else if (p1tiles < p2tiles && p2isAI){
                    textItem.style.color = '#C10B00'
                    textItem.innerHTML = 'Stalemate! But the AI has a larger island!'
                } else if ( p1tiles < p2tiles && !p2isAI){
                    textItem.style.color = '#C10B00'
                    textItem.innerHTML = 'Stalemate! But player 2 has a larger island!'
                } else if (p1tiles > p2tiles && p2isAI){
                    textItem.style.color = '#0FC100'
                    textItem.innerHTML = 'Stalemate! But you have a larger island!'
                } else if ( p1tiles > p2tiles && !p2isAI){
                    textItem.style.color = '#0FC100'
                    textItem.innerHTML = 'Stalemate! But player 1 has a larger island!'
                }
            }

            const players = [player1, player2]
            players.forEach(p => {
                if (p.poopAction.isRunning()) { p.poopAction.stop() }
                if (!p.idleAction.isRunning()) { p.idleAction.play() }
                if (p.runAction.isRunning()) { p.runAction.stop() }
                if (p.steps.isPlaying){p.steps.pause()}
                p.movement = []
            })
        }, 2000)
        
    }

    let timer = 0
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = `${circumference}`;

    function timerTick() {
        timer = timer > timerTime ? 0 : timer + 1 / 60
        const offset = circumference - (timer / timerTime) * circumference;
        circle.style.strokeDashoffset = offset;

        if (timer == 0) { evaluateTurn = true }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Dynamic resizing
    function onWindowResize() {

        frustumSize = Math.sqrt(fieldWidth ** 2 + fieldHeight ** 2) + 4
        aspect = window.innerWidth / (window.innerHeight);
        const fieldMargin = frustumSize / aspect

        camera.left = - frustumSize / 2;
        camera.right = frustumSize / 2;
        camera.top = fieldMargin / 2;
        camera.bottom = - fieldMargin / 2;

        camera.updateProjectionMatrix();

        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener('resize', onWindowResize);

    animate()
}
