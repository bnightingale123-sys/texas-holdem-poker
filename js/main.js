// ============================================
// main.js - Application Entry Point
// ============================================

let game;

document.addEventListener('DOMContentLoaded', () => {
  game = new Game();
  setupEventListeners();
});

function setupEventListeners() {
  // Start button
  document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    game.init();
    game.startRound();
  });

  // Game action buttons
  document.getElementById('btn-fold').addEventListener('click', () => {
    game.handlePlayerAction('fold');
  });

  document.getElementById('btn-check').addEventListener('click', () => {
    game.handlePlayerAction('check');
  });

  document.getElementById('btn-call').addEventListener('click', () => {
    game.handlePlayerAction('call');
  });

  document.getElementById('btn-raise').addEventListener('click', () => {
    const input = document.getElementById('raise-input');
    const amount = parseInt(input.value) || game.minRaise;
    game.handlePlayerAction('raise', amount);
  });

  document.getElementById('btn-allin').addEventListener('click', () => {
    game.handlePlayerAction('allin');
  });

  // Raise input shortcuts
  document.getElementById('raise-half-pot').addEventListener('click', () => {
    const input = document.getElementById('raise-input');
    input.value = Math.max(game.minRaise, Math.floor(game.pot / 2));
  });

  document.getElementById('raise-pot').addEventListener('click', () => {
    const input = document.getElementById('raise-input');
    input.value = Math.max(game.minRaise, game.pot);
  });

  document.getElementById('raise-2x').addEventListener('click', () => {
    const input = document.getElementById('raise-input');
    input.value = Math.max(game.minRaise, game.minRaise * 2);
  });
}
