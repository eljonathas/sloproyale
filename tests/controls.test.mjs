import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlRegistry } from '../dist/client/controls.js';

// Sem foco/hover, hit apenas registra controles e não precisa de um canvas.
const registry = () => new ControlRegistry({}, {}, {textContent:''});

test('cartas giradas recebem toque na área visível, não no retângulo anterior', () => {
 const controls=registry();
 controls.hit('card',100,100,100,160,'Carta',()=>{},false,Math.PI/2);
 assert.equal(controls.at({x:80,y:180})?.id,'card');
 assert.equal(controls.at({x:220,y:180})?.id,'card');
 assert.equal(controls.at({x:150,y:105}),undefined);
 assert.equal(controls.at({x:150,y:255}),undefined);
 assert.equal(controls.at({x:150,y:180})?.id,'card');
});

test('sobreposição da carta selecionada não reordena a navegação por teclado', () => {
 const controls=registry();
 controls.hit('second',0,0,100,100,'2',()=>{},false,0,1);
 controls.hit('third',0,0,100,100,'3',()=>{},true,0,2);
 controls.hit('fourth',0,0,100,100,'4',()=>{},false,0,3);
 controls.hit('first',0,0,100,100,'1',()=>{},false,0,0);
 assert.equal(controls.at({x:50,y:50})?.id,'first','a carta desenhada por último recebe o toque');
 controls.step(1);assert.equal(controls.focus,'first');
 controls.step(1);assert.equal(controls.focus,'second');
 controls.step(1);assert.equal(controls.focus,'fourth','pula a carta indisponível');
 controls.step(1);assert.equal(controls.focus,'first');
 controls.step(-1);assert.equal(controls.focus,'fourth');
});
