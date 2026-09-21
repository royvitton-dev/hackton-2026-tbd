import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, reducer, restoreGame, level, type GameState } from '../src/game/engine.ts';
function move(state: GameState, dice: number, luck = .5) {
  state = reducer(state,{type:'ROLL',dice}); state = reducer(state,{type:'MOVE'});
  for (let i=0;i<dice;i++) state = reducer(state,{type:'STEP',luck});
  return state;
}
function endMonth(scores: number[], target = 400) {
  const state = createGame({ count:scores.length,humans:scores.length,target,idol:0,name:'' });
  state.players.forEach((p,i) => { p.score=scores[i]; });
  state.day=4; state.active=state.players.length-1; state.phase='result';
  return reducer(state,{type:'CONTINUE'});
}
test('dice moves a pawn, awards training and XP, and ignores duplicate results', () => {
  const initial = createGame();
  let state = move(initial,1);
  assert.equal(state.players[0].position,1); assert.equal(state.phase,'training');
  state = reducer(state,{type:'TRAIN',performance:100});
  assert.equal(state.players[0].score,35); assert.equal(state.players[0].stats.vocal,33);
  assert.equal(state.players[0].xp,40); assert.equal(initial.players[0].score,0);
  assert.deepEqual(reducer(state,{type:'TRAIN',performance:100}),state);
  state = reducer(state,{type:'CONTINUE'}); assert.equal(state.active,1); assert.equal(state.phase,'ready');
});
test('crossing start grants 20 points and consecutive steps are required', () => {
  let state=createGame(); state.players[0].position=23;
  state=move(state,2); assert.equal(state.players[0].position,1); assert.equal(state.players[0].score,20);
  assert.equal(state.phase,'training'); assert.equal(state.remaining,0);
  assert.deepEqual(reducer(state,{type:'STEP',luck:0}),state);
});
test('all rivals on the arrival tile battle in order and no one battles themselves', () => {
  let state=createGame(); state.players.forEach((p,i) => { if(i) p.position=1; });
  state=move(state,1); assert.deepEqual(state.rivals,[1,2,3]);
  state=reducer(state,{type:'TRAIN',performance:80});
  state=reducer(state,{type:'CONTINUE'});
  for (const rival of [1,2,3]) {
    assert.equal(state.phase,'battle'); assert.equal(state.battle?.opponent,rival);
    state=reducer(state,{type:'CHOOSE',skill:'vocal'});
    state=reducer(state,{type:'PERFORM',performance:100});
    assert.equal(state.phase,'battle');
    state=reducer(state,{type:'PERFORM',performance:0});
    assert.equal(state.phase,'result'); assert.equal(state.players[rival].score,10);
    state=reducer(state,{type:'CONTINUE'});
  }
  assert.equal(state.players[0].wins,3); assert.equal(state.active,1); assert.equal(state.phase,'ready');
});
test('a tied battle gives both participants 25 points without a win', () => {
  let state=createGame(); state.phase='battle'; state.battle={opponent:1,skill:'dance',attack:null,defense:null};
  state=reducer(state,{type:'PERFORM',performance:75}); state=reducer(state,{type:'PERFORM',performance:75});
  assert.equal(state.players[0].score,25); assert.equal(state.players[1].score,25); assert.equal(state.players[0].wins,0);
});
test('monthly ranking uses scores before bonuses, handles ties and preserves selected members', () => {
  let state=endMonth([120,120,99,80]);
  assert.equal(state.phase,'evaluation'); assert.deepEqual(state.evaluation.map(e=>e.rank),[1,1,3,4]);
  assert.deepEqual(state.evaluation.map(e=>e.bonus),[40,40,15,15]);
  assert.deepEqual(state.players.map(p=>p.lineup),[true,true,false,false]);
  state=reducer(state,{type:'NEXT_MONTH'}); assert.equal(state.month,2); assert.equal(state.day,1); assert.equal(state.active,0);
  state.players[0].score=160; state.players[1].score=300; state.players[2].score=200; state.players[3].score=170;
  state.active=3;state.day=4;state.phase='result';state=reducer(state,{type:'CONTINUE'});
  assert.equal(state.players[0].lineup,true); assert.equal(state.players[2].lineup,true);
});
test('score alone does not debut; evaluation qualification and exact target do', () => {
  let state=createGame(); state.players[0].score=400;state.phase='result';
  state=reducer(state,{type:'CONTINUE'});assert.equal(state.phase,'ready');
  state=endMonth([360,200,80,60]);state=reducer(state,{type:'NEXT_MONTH'});
  assert.equal(state.phase,'finished');assert.deepEqual(state.winners,[0]);
  state=createGame();state.players[2].lineup=true;state.players[2].score=400;state.phase='result';
  state=reducer(state,{type:'CONTINUE'});assert.equal(state.phase,'finished');assert.deepEqual(state.winners,[2]);
});
test('stats clamp to 100 and XP upgrades the character', () => {
  let state=createGame();state.players[0].stats.vocal=99;state.players[0].xp=55;state=move(state,1);
  state=reducer(state,{type:'TRAIN',performance:200});assert.equal(state.players[0].stats.vocal,100);assert.equal(level(state.players[0]),2);
});
test('corrupted saves and impossible phases are rejected; a moving turn resumes', () => {
  const state=createGame(); assert.deepEqual(restoreGame(JSON.stringify(state)),state);
  assert.equal(restoreGame('{oops'),null);assert.equal(restoreGame('null'),null);
  assert.equal(restoreGame(JSON.stringify({...state,phase:'battle',battle:null})),null);
  assert.equal(restoreGame(JSON.stringify({...state,phase:'moving',remaining:0})),null);
  const trained=reducer(move(state,1),{type:'TRAIN',performance:90});
  assert.equal(restoreGame(JSON.stringify({...trained,result:{...trained.result,gain:{broken:true}}})),null);
  const moving=reducer(reducer(state,{type:'ROLL',dice:4}),{type:'MOVE'});
  assert.deepEqual(restoreGame(JSON.stringify(moving)),moving);
});
test('complete games with 1–4 players reach debut across different performance levels', () => {
  for(const count of [1,2,3,4]) for(const quality of [0,75,100]) {
    let state=createGame({count,humans:count,target:300,idol:2,name:'테스터'});let seed=17;let steps=0;
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    while(state.phase!=='finished'&&steps++<4000) {
      switch(state.phase){
        case 'ready':state=reducer(state,{type:'ROLL',dice:1+Math.floor(random()*6)});break;
        case 'rolling':state=reducer(state,{type:'MOVE'});break;
        case 'moving':state=reducer(state,{type:'STEP',luck:random()});break;
        case 'training':state=reducer(state,{type:'TRAIN',performance:quality});break;
        case 'result':state=reducer(state,{type:'CONTINUE'});break;
        case 'battle':state=reducer(state,state.battle?.skill?{type:'PERFORM',performance:quality}:{type:'CHOOSE',skill:'dance'});break;
        case 'evaluation':state=reducer(state,{type:'NEXT_MONTH'});break;
      }
      assert.ok(restoreGame(JSON.stringify(state)),`${count} players/${quality}: invalid ${state.phase}`);
    }
    assert.equal(state.phase,'finished',`${count} players/${quality} stalled`);
    assert.ok(state.winners.every(id=>state.players[id].lineup&&state.players[id].score>=300));
  }
});
