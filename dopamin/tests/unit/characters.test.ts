import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CHARACTERS, characterFor } from '../../src/core/characters';
import { createNintendoHead } from '../../src/graphics/characters';
import { createHead, createKart } from '../../src/graphics/models';

describe('Nintendo racer heads',()=>{
  it('provides eight stable identities and a safe fallback for old profiles',()=>{
    expect(CHARACTERS.map(c=>c.name)).toEqual(['마리오','루이지','피치','요시','쿠파','키노피오','동키콩','로젤리나']);expect(characterFor(-1)).toBe(CHARACTERS[0]);expect(characterFor(100)).toBe(CHARACTERS[0]);
  });
  it.each(CHARACTERS)('builds a finite, framed $name head shared by portrait and kart',character=>{
    const head=createNintendoHead(character.id),bounds=new THREE.Box3().setFromObject(head),size=bounds.getSize(new THREE.Vector3());
    expect(head.userData.character).toBe(character.name);expect(size.toArray().every(v=>Number.isFinite(v)&&v>.5&&v<2.5)).toBe(true);
    let vertices=0;head.traverse(object=>{if(object instanceof THREE.Mesh){vertices+=object.geometry.getAttribute('position').count;expect(object.geometry.getAttribute('position').array.every(Number.isFinite)).toBe(true);}});expect(vertices).toBeGreaterThan(1000);
    const happy=createNintendoHead(character.id,true);expect(happy.userData.expression).toBe('smile');expect(happy.getObjectByName('happy-smile')).toBeDefined();expect(head.userData.expression).toBe('neutral');
    expect(createHead(character.id,character.color).userData.characterId).toBe(character.id);expect(createKart(character.id,character.color).getObjectByName('head')!.userData.characterId).toBe(character.id);
  });
});
