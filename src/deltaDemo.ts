import Quill, {Delta} from 'quill';



/**
 * 实例化 三种方式 
 * 1、无参
 * 2、数组
 * 3、对象 => {ops: []} 满足格式
 */

const  delta1 = new Delta();
const delta2 = new Delta([
  { insert: 'Hello ' },
  { insert: 'World', attributes: { bold: true } },
]); // 等价于 new Delta().insert('Hello ').insert(' World', { bold: true })


const delta3 = new Delta({ ops: [{ insert: 'Foo ' }] }).delete(3);
const delta31 = new Delta(delta3)

console.log(delta1, 'delta1');
console.log(delta2, 'delta2');
console.log(delta3, 'delta3');
console.log(delta31, 'delta31');

/*
 * insert(arg: string | Record<string, unknown>, attributes?: AttributeMap | null): this
 * 插入文本或嵌入对象
 */ 

const insertDelta = new Delta();
insertDelta.insert('Hello')
     .insert(' World', { bold: true })
     .insert({ image: 'http://example.com/image.png' }, { alt: 'Example Image' });
     
console.log(insertDelta, 'insertDelta');

/*
 * delete(length: number): this
 * 删除指定长度的文本：
 */ 

const deleteDelta = new Delta()
  .insert('Hello World')
  .delete(6); // 删除 'Hello '


  console.log(deleteDelta, 'deleteDelta');
/*
 * retain(length: number | Record<string, unknown>, attributes?: AttributeMap | null): this
 * 保留指定长度的文本并可选择保留属性：
 * 即光标移动几
 */ 

const retaindelta = new Delta()
  .insert('Hello World', { bold: true })
  .retain(5) // 保留前5个字符,即光标移动5个字符，
  .retain(6, { italic: true }); // 光标移动6个字符并将这6个变斜体

  console.log(retaindelta, 'retaindelta');

  /*
 * push(newOp: Op): this
 * 添加新操作并合并相邻操作：
 */ 

  const pushdelta = new Delta()
  .insert('Hello')
  .push({ insert: ' World', attributes: { bold: true } })
  .push({ delete: 5 }); // 合并相邻的操作


console.log(pushdelta, 'pushdelta');


  /*
 * chop(): this
 * 移除最后一个操作：
 */ 

  const chopdelta = new Delta()
  .insert('Hello World')
  .chop(); // 移除 'Hello World'



console.log(chopdelta, 'chopdelta');




export {
    delta1, 
    delta2,
    delta3,
    insertDelta,
    deleteDelta
}

