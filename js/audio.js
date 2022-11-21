ambience = new Audio('./audio/ambience.mp3');
gameoverAudio = new Audio('./audio/gameover.mp3');
const musicIcon = document.getElementById('musicIcon')

ambience.volume = 0.1
gameoverAudio.volume = 0.3

if (typeof ambience.loop == 'boolean')
{
    ambience.loop = true;
}
else
{
    ambience.addEventListener('ended', function() {
        this.currentTime = 0;
        this.play();
    }, false);
}
ambience.play();

function toggleAudio(state){
    if (state){
        ambience.play()
        musicIcon.classList.remove('disabled')
        musicIcon.onclick = () => toggleAudio(false)
    } else {
        ambience.pause();
        ambience.currentTime = 0;
        musicIcon.onclick = () => toggleAudio(true)
        musicIcon.classList.add('disabled')
    }
}
