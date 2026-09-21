export const CHARACTERS = [
  {id:0,name:'마리오',english:'Mario',color:'#e52521'},
  {id:1,name:'루이지',english:'Luigi',color:'#32aa45'},
  {id:2,name:'피치',english:'Peach',color:'#f290bc'},
  {id:3,name:'요시',english:'Yoshi',color:'#70be32'},
  {id:4,name:'쿠파',english:'Bowser',color:'#efa52e'},
  {id:5,name:'키노피오',english:'Toad',color:'#ed433d'},
  {id:6,name:'동키콩',english:'Donkey Kong',color:'#ad7445'},
  {id:7,name:'로젤리나',english:'Rosalina',color:'#6bd4c9'},
] as const;
export function characterFor(variant:number){return CHARACTERS[variant]||CHARACTERS[0];}
