import LinkedList from '../../collection/linked-list.js';
import ParchmentError from '../../error.js';
import Scope from '../../scope.js';
import type { Blot, BlotConstructor, Parent, Root } from './blot.js';
import ShadowBlot from './shadow.js';

// 创建dom 没有映射的blot，实例化后返回blot 实例
function makeAttachedBlot(node: Node, scroll: Root): Blot {
  const found = scroll.find(node);
  if (found) return found;
  try {
    return scroll.create(node);
  } catch (e) {
    const blot = scroll.create(Scope.INLINE);
    Array.from(node.childNodes).forEach((child: Node) => {
      blot.domNode.appendChild(child);
    });
    if (node.parentNode) {
      node.parentNode.replaceChild(blot.domNode, node);
    }
    blot.attach();
    return blot;
  }
}

class ParentBlot extends ShadowBlot implements Parent {
  /**
   * Whitelist array of Blots that can be direct children.
   */
  public static allowedChildren?: BlotConstructor[];

  /**
   * Default child blot to be inserted if this blot becomes empty.
   */
  public static defaultChild?: BlotConstructor;
  public static uiClass = '';

  public children!: LinkedList<Blot>;
  public domNode!: HTMLElement;
  public uiNode: HTMLElement | null = null;

  /**
   * 主要功能：给当前实例添加 this.children = {} 链表结构
  */
  constructor(scroll: Root, domNode: Node) {
    super(scroll, domNode);
    this.build();
  }

  public appendChild(other: Blot): void {
    this.insertBefore(other);
  }

  // 增加blot 和 detach () 互补
  public attach(): void {
    super.attach(); // 是个空方法忽略
    this.children.forEach((child) => {
      child.attach();
    });
  }

  public attachUI(node: HTMLElement): void {
    if (this.uiNode != null) {
      this.uiNode.remove();
    }
    this.uiNode = node;
    if (ParentBlot.uiClass) {
      this.uiNode.classList.add(ParentBlot.uiClass);
    }
    this.uiNode.setAttribute('contenteditable', 'false');
    this.domNode.insertBefore(this.uiNode, this.domNode.firstChild);
  }

  /**
   * Called during construction, should fill its own children LinkedList. 在构造期间被调用，应该填充它自己的子元素链表
   * // 给当前实例对象增加children = {head,tail,length } (new LinkedList() ) 
   * 
   */
  public build(): void {
    this.children = new LinkedList<Blot>();
    // Need to be reversed for if DOM nodes already in order
    Array.from(this.domNode.childNodes)
      .filter((node: Node) => node !== this.uiNode)
      .reverse()
      .forEach((node: Node) => {
        try {
          const child = makeAttachedBlot(node, this.scroll);
          this.insertBefore(child, this.children.head || undefined);
        } catch (err) {
          if (err instanceof ParchmentError) {
            return;
          } else {
            throw err;
          }
        }
      });
  }

  public deleteAt(index: number, length: number): void {
    if (index === 0 && length === this.length()) {
      return this.remove();
    }
    this.children.forEachAt(index, length, (child, offset, childLength) => {
      child.deleteAt(offset, childLength);
    });
  }

  // 获取当前对象的 所有子元素 中符合特定条件的子元素
 
  public descendant<T extends Blot>(
    criteria: new (...args: any[]) => T,
    index: number,
  ): [T | null, number];
  public descendant(
    criteria: (blot: Blot) => boolean,
    index: number,
  ): [Blot | null, number];
  public descendant(criteria: any, index = 0): [Blot | null, number] {
    // 
    const [child, offset] = this.children.find(index);
    if (
      (criteria.blotName == null && criteria(child)) ||
      (criteria.blotName != null && child instanceof criteria)
    ) {
      return [child as any, offset];
    } else if (child instanceof ParentBlot) {
      return child.descendant(criteria, offset);
    } else {
      return [null, -1];
    }
  }

 /*
  * 方法的主要作用是根据给定的筛选条件递归地获取所有符合条件的子元素。
  * 它通过遍历当前对象的子元素，并对每个子元素应用筛选条件。
  * 如果子元素是 ParentBlot 的实例，则递归查找其子元素的后代。
  * 这个方法可以用来实现树形结构的深度搜索，适用于需要按条件筛选复杂嵌套结构的场景。
  */
  public descendants<T extends Blot>(
    criteria: new (...args: any[]) => T,
    index?: number,
    length?: number,
  ): T[];
  public descendants(
    criteria: (blot: Blot) => boolean,
    index?: number,
    length?: number,
  ): Blot[];
  public descendants(
    criteria: any, // 用于判断一个子元素是否符合的筛选条件
    index = 0,
    length: number = Number.MAX_VALUE,
  ): Blot[] {
    let descendants: Blot[] = []; // 存储符合条件的子元素
    let lengthLeft = length; // 剩余的长度，用于限制遍历的范围
    this.children.forEachAt(
      index,
      length,
      (child: Blot, childIndex: number, childLength: number) => {
        if ( // 筛选条件
          (criteria.blotName == null && criteria(child)) ||
          (criteria.blotName != null && child instanceof criteria)
        ) {
          descendants.push(child);
        }
        if (child instanceof ParentBlot) { //递归查找
          descendants = descendants.concat(
            child.descendants(criteria, childIndex, lengthLeft),
          );
        }
        lengthLeft -= childLength;
      },
    );
    return descendants;
  }
  // 移除blot
  public detach(): void {
    this.children.forEach((child) => {
      child.detach();
    });
    super.detach();
  }

  public enforceAllowedChildren(): void {
    let done = false;
    this.children.forEach((child: Blot) => {
      if (done) {
        return;
      }
      const allowed = this.statics.allowedChildren.some(
        (def: BlotConstructor) => child instanceof def,
      );
      if (allowed) {
        return;
      }
      if (child.statics.scope === Scope.BLOCK_BLOT) {
        if (child.next != null) {
          this.splitAfter(child);
        }
        if (child.prev != null) {
          this.splitAfter(child.prev);
        }
        child.parent.unwrap();
        done = true;
      } else if (child instanceof ParentBlot) {
        child.unwrap();
      } else {
        child.remove();
      }
    });
  }

  public formatAt(
    index: number,
    length: number,
    name: string,
    value: any,
  ): void {
    this.children.forEachAt(index, length, (child, offset, childLength) => {
      child.formatAt(offset, childLength, name, value);
    });
  }

  // 创建blot 并插入到parchment 中
  public insertAt(index: number, value: string, def?: any): void {
    const [child, offset] = this.children.find(index);
    if (child) {
      child.insertAt(offset, value, def); // 调用blot自己的inserat()方法
    } else {
      const blot =
        def == null
          ? this.scroll.create('text', value)
          : this.scroll.create(value, def);
      this.appendChild(blot);
    }
  }

 
  // 获取当前子节点包含的blot个数
  public length(): number {
    return this.children.reduce((memo, child) => {
      return memo + child.length();
    }, 0);
  }

  public moveChildren(targetParent: Parent, refNode?: Blot | null): void {
    this.children.forEach((child) => {
      targetParent.insertBefore(child, refNode);
    });
  }

   /*
   * 给定元素前插入blot, 然后插入dom
  *  首先维护好blot 链表结构，然后操作更新dom
  * 通过 链表结构维护好 blot 层级关系，然后将 blot 关联的真实dom 插入html
  */ 
   public insertBefore(childBlot: Blot, refBlot?: Blot | null): void {
    if (childBlot.parent != null) {
      childBlot.parent.children.remove(childBlot);
    }
    let refDomNode: Node | null = null;
    // 1 插入之前给定blot 之前
    this.children.insertBefore(childBlot, refBlot || null);
    childBlot.parent = this;
    if (refBlot != null) {
      refDomNode = refBlot.domNode;
    }

    // div !=  #text
    if (
      this.domNode.parentNode !== childBlot.domNode ||
      this.domNode.nextSibling !== refDomNode
    ) {
      // 2、插入真实dom ; 真实dom: <p>1<p> (=> insertBefore =>) <p>1<p> 会触发MutationObserver 先移除 #text 1 然后在添加 #text 1； 操作在scrollBlot的optimize 方法中劫持了 takeRecords， 所以没有重新触发observer的回调
      this.domNode.insertBefore(childBlot.domNode, refDomNode); // 如果childBlot.domNode 已在dom 中会触发MutationObserver 回调吗？ 答案是会的，quilljs 会不会重新触发回调，未知？？？
    }
    childBlot.attach();
  }


  // 实例化blot后 - >插入dom
  public optimize(context?: { [key: string]: any }): void {
    super.optimize(context);

    // 校验blot的可以插入子节点的白名单
    this.enforceAllowedChildren();
    if (this.uiNode != null && this.uiNode !== this.domNode.firstChild) {
      this.domNode.insertBefore(this.uiNode, this.domNode.firstChild);
    }
    // 初始化走， 首先实例化blot 然后维护好blot 上下关系 最后生成真实dom
    if (this.children.length === 0) {
      if (this.statics.defaultChild != null) {
        // 实例化Blot类
        const child = this.scroll.create(this.statics.defaultChild.blotName);
        // 通过链表结构生成 blot 关系， 然后插入真实dom树 
        this.appendChild(child); // 注意会操作domNode
        // TODO double check if necessary
        // child.optimize(context);
      } else {
        this.remove();
      }
    }
  }

  public path(index: number, inclusive = false): [Blot, number][] {
    const [child, offset] = this.children.find(index, inclusive);
    const position: [Blot, number][] = [[this, index]];
    if (child instanceof ParentBlot) {
      return position.concat(child.path(offset, inclusive));
    } else if (child != null) {
      position.push([child, offset]);
    }
    return position;
  }

  // 删除 blot 节点关系
  public removeChild(child: Blot): void {
    this.children.remove(child);
  }

  public replaceWith(name: string | Blot, value?: any): Blot {
    const replacement =
      typeof name === 'string' ? this.scroll.create(name, value) : name;
    if (replacement instanceof ParentBlot) {
      this.moveChildren(replacement);
    }
    return super.replaceWith(replacement);
  }

  public split(index: number, force = false): Blot | null {
    if (!force) {
      if (index === 0) {
        return this;
      }
      if (index === this.length()) {
        return this.next;
      }
    }
    const after = this.clone() as ParentBlot;
    if (this.parent) {
      this.parent.insertBefore(after, this.next || undefined);
    }
    this.children.forEachAt(index, this.length(), (child, offset, _length) => {
      const split = child.split(offset, force);
      if (split != null) {
        after.appendChild(split);
      }
    });
    return after;
  }

  public splitAfter(child: Blot): Parent {
    const after = this.clone() as ParentBlot;
    while (child.next != null) {
      after.appendChild(child.next);
    }
    if (this.parent) {
      this.parent.insertBefore(after, this.next || undefined);
    }
    return after;
  }

  public unwrap(): void {
    if (this.parent) {
      this.moveChildren(this.parent, this.next || undefined);
    }
    this.remove();
  }
  // 重置blot关系 
  public update(
    mutations: MutationRecord[],
    _context: { [key: string]: any },
  ): void {
    // 新增节点都是原生dom 节点
    const addedNodes: Node[] = [];
    // 删除节点
    const removedNodes: Node[] = [];

    mutations.forEach((mutation) => {
      if (mutation.target === this.domNode && mutation.type === 'childList') {
        addedNodes.push(...mutation.addedNodes);
        removedNodes.push(...mutation.removedNodes);
      }
    }); 
    // [br]
    removedNodes.forEach((node: Node) => {
      // Check node has actually been removed
      // One exception is Chrome does not immediately remove IFRAMEs
      // from DOM but MutationRecord is correct in its reported removal
      if (
        node.parentNode != null &&
        // @ts-expect-error Fix me later
        node.tagName !== 'IFRAME' &&
        document.body.compareDocumentPosition(node) &
          Node.DOCUMENT_POSITION_CONTAINED_BY
      ) {
        return;
      }
      const blot = this.scroll.find(node);
      if (blot == null) {
        return;
      }
      // 删除的dom节点成为孤立节点，没有父节点了
      if (
        blot.domNode.parentNode == null ||
        blot.domNode.parentNode === this.domNode
      ) {
        blot.detach(); // 调用最顶层shadowts 中的detach 方法，用来删除blot
      }
    });
    // [#text]
    const addedNodesFilter = addedNodes.filter((node) => {
      return node.parentNode === this.domNode && node !== this.uiNode;
    })
  
    const addedNodesSort = addedNodesFilter
      .sort((a, b) => {
        if (a === b) { // 0 顺序不变； a<b 返回 < 0 ，a应该在b 前面顺序不变；a > b 大于 0 ， a应该在b后面； 
          return 0;
        }
        if (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) {
          return 1;
        }
        return -1;
      })

      addedNodesSort.forEach((node) => {
        let refBlot: Blot | null = null;
        if (node.nextSibling != null) {
          refBlot = this.scroll.find(node.nextSibling);
        }
        // 返回 this.scroll.find(node) 查找的blot 实例； 没有就 scroll.create(node)创建新的blot,并实例化后返回
        const blot = makeAttachedBlot(node, this.scroll);
        if (blot.next !== refBlot || blot.next == null) {
          if (blot.parent != null) {
            blot.parent.removeChild(this);
          }
          this.insertBefore(blot, refBlot || undefined);
        }
      });

    this.enforceAllowedChildren();
  }
}

export default ParentBlot;
