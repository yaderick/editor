import type LinkedNode from './linked-node.js';

// 双向链表主要特点是其动态性和高效的插入删除操作，但查找效率较低
// https://cloud.tencent.com/developer/article/1511615
class LinkedList<T extends LinkedNode> {
  public head: T | null;
  public tail: T | null;
  public length: number;

  constructor() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  public append(...nodes: T[]): void {
    this.insertBefore(nodes[0], null);
    if (nodes.length > 1) {
      const rest = nodes.slice(1);
      this.append(...rest);
    }
  }

  public at(index: number): T | null {
    const next = this.iterator();
    let cur = next();
    while (cur && index > 0) {
      index -= 1;
      cur = next();
    }
    return cur;
  }

  public contains(node: T): boolean {
    const next = this.iterator();
    let cur = next();
    while (cur) {
      if (cur === node) {
        return true;
      }
      cur = next();
    }
    return false;
  }

  public indexOf(node: T): number {
    const next = this.iterator();
    let cur = next();
    let index = 0;
    while (cur) {
      if (cur === node) {
        return index;
      }
      index += 1;
      cur = next();
    }
    return -1;
  }

  // 用于向双向链表中插入节点 node，并将其插入到参考节点 refNode 之前
  public insertBefore(node: T | null, refNode: T | null): void {
    if (node == null) {
      return;
    }
    // 先移除要插入的节点，确保链表中不会存在重复的节点
    this.remove(node);

    // 将节点 node 的 next 指针指向 refNode，表示 node 将插入到 refNode 之前
    node.next = refNode;
    if (refNode != null) {
      // 将节点 node 的 prev 指针指向 refNode 的前驱节点
      node.prev = refNode.prev;
      if (refNode.prev != null) {
         // 如果 refNode 的前驱节点不为 null，则将其 next 指针指向 node
        refNode.prev.next = node;
      }
      // 将 refNode 的 prev 指针指向 node，完成 node 的插入
      refNode.prev = node;
      if (refNode === this.head) {
        this.head = node;
      }
    } else if (this.tail != null) {
       // 将链表尾节点的 next 指针指向 node
      this.tail.next = node;
      // 将 node 的 prev 指针指向链表尾节点
      node.prev = this.tail;
      // 更新链表的尾节点为 node
      this.tail = node;
    } else {
      // 如果链表既没有头节点也没有尾节点，表示链表为空，直接将 node 设置为头节点和尾节点
      node.prev = null;
      this.head = this.tail = node;
    }
    this.length += 1;
  }
  // 计算blot 的偏移量
  public offset(target: T): number {
    let index = 0;
    let cur = this.head;
    while (cur != null) {
      if (cur === target) {
        return index;
      }
      index += cur.length();
      cur = cur.next as T;
    }
    return -1;
  }
  // 链表删除节点
  public remove(node: T): void {
    if (!this.contains(node)) {
      return;
    }
    if (node.prev != null) {
      node.prev.next = node.next;
    }
    if (node.next != null) {
      node.next.prev = node.prev;
    }
    if (node === this.head) {
      this.head = node.next as T;
    }
    if (node === this.tail) {
      this.tail = node.prev as T;
    }
    this.length -= 1;
  }

  // 列表迭代器，每次调用获取链表中的当前节点，并将curNode 指针移到下一个节点，让逐个节点遍历成为可能
  public iterator(curNode: T | null = this.head): () => T | null { //curNode 是blot实例
    // TODO use yield when we can
    return (): T | null => { // 经典面试题 var  a = {l:1} b={k:2} c=a a ={j:3} c =？ a =?
      const ret = curNode;  // 引用的是对象的地址
      if (curNode != null) {  // curNode 是指针
        curNode = curNode.next as T;
      }
      return ret;
    };
  }
  //  根据index ,查找对应的blot 实例和索引
  public find(index: number, inclusive = false): [T | null, number] {
    const next = this.iterator();  // 闭包保留指针
    let cur = next(); // 返回当前指针节点，然后移动指针到下一位 
    while (cur) {
      const length = cur.length();
      if (
        index < length ||
        (inclusive &&
          index === length &&
          (cur.next == null || cur.next.length() !== 0))
      ) {
        // https://github.com/slab/parchment
        return [cur, index]; // 返回index < blot.length 在的 blot 
      }
      index -= length;
      cur = next();
    }
    return [null, 0];
  }

  // 遍历整个链表节点
  public forEach(callback: (cur: T) => void): void {
    // 闭包实现指针随着函数销毁而不消失
    const next = this.iterator(); // 把指针指向第一个节点默认是this.head, 通过闭包实现指针保留，返回函数
    let cur = next();  // 执行函数返回当前节点，并把指针移动到blot的next
    while (cur) {
      callback(cur);
      cur = next();  // 执行函数返回当前节点，并把指针移动到blot的next
    }
  }

  // 遍历从 index 开始的一段长度 length 的数据，调用回调函数处理每个blot 的 实例
  public forEachAt(
    index: number,
    length: number,
    callback: (cur: T, offset: number, length: number) => void,
  ): void {
    if (length <= 0) {
      return;
    }
    const [startNode, offset] = this.find(index);
    let curIndex = index - offset;
    const next = this.iterator(startNode);
    let cur = next();
    while (cur && curIndex < index + length) {
      const curLength = cur.length();
      if (index > curIndex) {
        callback(
          cur,
          index - curIndex,
          Math.min(length, curIndex + curLength - index),
        );
      } else {
        callback(cur, 0, Math.min(curLength, index + length - curIndex));
      }
      curIndex += curLength;
      cur = next();
    }
  }

  public map(callback: (cur: T) => any): any[] {
    return this.reduce((memo: T[], cur: T) => {
      memo.push(callback(cur));
      return memo;
    }, []);
  }

  public reduce<M>(callback: (memo: M, cur: T) => M, memo: M): M {
    const next = this.iterator();
    let cur = next();
    while (cur) {
      memo = callback(memo, cur);
      cur = next();
    }
    return memo;
  }
}

export default LinkedList;
