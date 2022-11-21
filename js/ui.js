const ui = document.getElementById('ui')
const game = document.getElementById('game')
const main = document.getElementById('main')
const controls = document.getElementById('controls')
const instructions = document.getElementById('instructions')
const gameoverOverlay = document.getElementById('gameoverOverlay')
const startBtn = document.getElementById('startBtn')
const restartBtn = document.getElementById('restart')
const pressAnyKeyOverlay = document.getElementById('pressAnyKeyOverlay')

function next(count){
    controls.style.display = 'block'
    main.style.display = 'none'
    startBtn.onclick = () => begin(count)
    restartBtn.onclick = () => begin(count)
    showKeyBindings()

    const p2Inputs = document.getElementsByClassName('player2')
    for (let i = 0; i < p2Inputs.length; i++){
        p2Inputs[i].disabled = count != 2
    }
}

function mainMenu(){
    ui.style.display = 'flex'
    main.style.display = 'block'
    game.style.display = 'none'
    gameoverOverlay.style.display = 'none'
    instructions.style.display = 'none'
    controls.style.display = 'none'
}

function showInstructions(){
    instructions.style.display = 'block'
    main.style.display = 'none'
}

function begin(count){
    playing = true
    p2isAI = count == 1
    ui.style.display = 'none'
    game.style.display = 'block'
    gameoverOverlay.style.display = 'none'
    startGame()
}

function showKeyBindings(){
    document.getElementsByClassName('player1 up')[0].value = p1Controls.up
    document.getElementsByClassName('player1 down')[0].value = p1Controls.down
    document.getElementsByClassName('player1 left')[0].value = p1Controls.left
    document.getElementsByClassName('player1 right')[0].value = p1Controls.right
    document.getElementsByClassName('player1 bomb')[0].value = p1Controls.bomb
    document.getElementsByClassName('player2 up')[0].value = p2Controls.up
    document.getElementsByClassName('player2 down')[0].value = p2Controls.down
    document.getElementsByClassName('player2 left')[0].value = p2Controls.left
    document.getElementsByClassName('player2 right')[0].value = p2Controls.right
    document.getElementsByClassName('player2 bomb')[0].value = p2Controls.bomb
}

async function setKeyBinding(element, controls, key){
    element.blur()
    pressAnyKeyOverlay.style.visibility = 'visible'
    const readKey = () => new Promise(resolve => window.addEventListener('keydown', resolve, { once: true }));
    const x = await readKey();
    pressAnyKeyOverlay.style.visibility = 'hidden'
    controls[key] = x.key
    showKeyBindings()
}
